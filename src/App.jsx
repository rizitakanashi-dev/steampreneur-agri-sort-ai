import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Fab, useMediaQuery } from '@mui/material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  CircularProgress,
  FormControl,
  FormLabel,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import GrassRoundedIcon from '@mui/icons-material/GrassRounded'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { calculateHarvest, calculateHarvestValue } from './business/harvestCalculation.js'
import { deleteBatch, readBatches, saveBatch } from './business/harvestStorage.js'
import { COMMODITY_OPTIONS, PRICE_REFERENCE_SOURCE, REFERENCE_PRICES_PER_KG } from './business/priceReference.js'
import { fetchBapanasLive } from './services/scanService.js'
import { AppShell } from './components/AppShell.jsx'
import { stopAllActiveCameraStreams } from './components/LiveCameraViewfinder.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { PageHeader } from './components/PageHeader.jsx'
import { logoutActiveUser, readActiveUser, restoreAuthSession, getAuthHeaders } from './business/authStorage.js'

/*
 * Code splitting per halaman: komponen berat (scanner AI, chart, sertifikat)
 * hanya diunduh saat benar-benar dibuka, memotong bundle awal untuk
 * pengguna di jaringan lambat (jaringan lapangan petani).
 */
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'))
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'))
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'))
const BatchQCScanner = lazy(() => import('./components/BatchQCScanner.jsx').then((m) => ({ default: m.BatchQCScanner })))
const HarvestForm = lazy(() => import('./components/HarvestForm.jsx').then((m) => ({ default: m.HarvestForm })))
const HarvestRecap = lazy(() => import('./components/HarvestRecap.jsx').then((m) => ({ default: m.HarvestRecap })))
const QCResults = lazy(() => import('./components/QCResults.jsx').then((m) => ({ default: m.QCResults })))
const PricingDashboard = lazy(() => import('./components/PricingDashboard.jsx').then((m) => ({ default: m.PricingDashboard })))

function PageLoadingFallback() {
  return (
    <Box alignItems="center" display="flex" justifyContent="center" sx={{ minHeight: { xs: '40vh', md: '50vh' }, width: '100%' }}>
      <CircularProgress size={32} />
    </Box>
  )
}

const pages = {
  overview: { title: 'Dashboard', description: 'Pantau kualitas panen dan peluang harga dalam satu tampilan.' },
  scanner: { title: 'Batch QC Scanner', description: 'Siapkan batch panen untuk pemeriksaan kualitas.' },
  results: { title: 'Hasil Analisis QC', description: 'Tinjau hasil pemeriksaan mutu dan rekomendasi tindakan.' },
  'results-list': { title: 'Rekap Data Panen', description: 'Lihat seluruh batch panen yang tersimpan di browser.' },
  pricing: { title: 'Harga Pasar', description: 'Pantau acuan harga pasar untuk keputusan jual yang lebih tepat.' },
}

const rupiahFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function formatRupiah(value) {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return '-'
  return rupiahFormatter.format(num).replace(/^Rp\s*/, 'Rp ')
}

function MetricCard({ detail, icon: Icon, label, value, color }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" sx={{ mb: 1 }} variant="body2">{label}</Typography>
            <Typography sx={{ fontSize: { xs: 25, sm: 30 }, fontWeight: 800, letterSpacing: '-0.03em' }} variant="h4">{value}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="caption">{detail}</Typography>
          </Box>
          <Box sx={{ alignItems: 'center', bgcolor: `${color}18`, borderRadius: 2, color, display: 'flex', height: 42, justifyContent: 'center', width: 42 }}>
            <Icon fontSize="small" />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

function formatBatchDisplayId(rawId) {
  if (!rawId) return '-'
  const id = String(rawId)
  if (id.startsWith('panen-') && id.length > 15) {
    const ts = Number(id.replace('panen-', ''))
    if (!isNaN(ts)) {
      const d = new Date(ts)
      const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
      return `PANEN-${dateStr}`
    }
    return `BATCH-${id.slice(-6)}`
  }
  return id
}

function DashboardPreview({ onNavigate, batches = [], onSelectBatch }) {
  const [bapanasData, setBapanasData] = useState(null)
  const [bapanasOffline, setBapanasOffline] = useState(false)
  const [isRefreshingPrice, setIsRefreshingPrice] = useState(false)
  // Pengunci dedupe: efek mount (termasuk double-invoke StrictMode) dan tombol
  // refresh tidak boleh mengirim dua request BAPANAS bersamaan.
  const bapanasInFlightRef = useRef(false)

  const loadBapanas = (timeoutMs) => {
    if (bapanasInFlightRef.current) return
    bapanasInFlightRef.current = true
    setIsRefreshingPrice(true)
    fetchBapanasLive(timeoutMs)
      .then((data) => {
        if (data?.commodities) {
          setBapanasData(data)
          setBapanasOffline(false)
        }
      })
      .catch(() => {
        // Backend/BAPANAS tidak terjangkau: tampilkan indikator offline,
        // harga acuan lokal tetap dipakai sebagai fallback.
        setBapanasOffline(true)
      })
      .finally(() => {
        bapanasInFlightRef.current = false
        setIsRefreshingPrice(false)
      })
  }

  const handleRefreshBapanas = () => loadBapanas(5000)

  useEffect(() => {
    loadBapanas(4000)
  }, [])

  const dynamicMetrics = [
    {
      label: 'Batch tersimpan',
      value: `${batches.length} Batch`,
      detail: batches.length > 0 ? 'Tersimpan di browser ini' : 'Belum ada batch dicatat',
      icon: LocalShippingRoundedIcon,
      color: '#036e45',
    },
    {
      label: 'Komoditas terdaftar',
      value: `${COMMODITY_OPTIONS.length} Komoditas`,
      detail: 'Terung, Tomat, Cabai',
      icon: AutoAwesomeRoundedIcon,
      color: '#2f7299',
    },
    {
      label: 'Sumber acuan harga',
      value: bapanasData ? 'BAPANAS Live' : 'BAPANAS & SP2KP',
      detail: bapanasData?.market_center || 'Panel Pangan & Kemendag RI',
      icon: TrendingUpRoundedIcon,
      color: '#036e45',
    },
  ]

  const lastBatch = batches.length > 0 ? batches[batches.length - 1] : null

  return (
    <>
      <Card sx={{ background: 'linear-gradient(135deg, #036e45 0%, #0b8a5a 100%)', color: 'common.white', mb: 2.5, overflow: 'hidden', position: 'relative' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 }, position: 'relative', zIndex: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ maxWidth: { xs: '100%', sm: 560 } }}>
              <Chip icon={<CheckCircleRoundedIcon />} label="Sistem siap digunakan" size="small" sx={{ bgcolor: 'rgba(255,255,255,.16)', color: 'common.white', mb: 2, '& .MuiChip-icon': { color: '#b8e7d5' } }} />
              <Typography sx={{ fontSize: { xs: 26, sm: 34 }, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1 }} variant="h4">
                Sortir cerdas, panen maksimal.
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,.78)', mt: 1.5, maxWidth: 480 }} variant="body1">
                Ubah data panen menjadi keputusan QC dan harga yang lebih jelas untuk tim lapangan.
              </Typography>
              <Button color="inherit" endIcon={<ArrowForwardRoundedIcon />} fullWidth onClick={() => onNavigate('scanner')} sx={{ bgcolor: 'common.white', color: 'primary.dark', mt: 2.5, maxWidth: { sm: 200 }, '&:hover': { bgcolor: '#e8f5ee' } }} variant="contained">
                Mulai scan batch
              </Button>
            </Box>
            <Box sx={{ alignItems: 'center', bgcolor: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 3, display: 'flex', justifyContent: 'center', minHeight: 150, minWidth: { sm: 190 }, p: 2 }}>
              <Stack spacing={1} sx={{ alignItems: 'center' }}>
                <GrassRoundedIcon sx={{ fontSize: 48, color: '#b8e7d5' }} />
                <Typography sx={{ color: 'rgba(255,255,255,.8)' }} variant="caption">Precision Agriculture</Typography>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {dynamicMetrics.map((metric) => <Grid key={metric.label} size={{ xs: 12, sm: 4 }}><MetricCard {...metric} /></Grid>)}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                  <Typography fontWeight={700} variant="h6">
                    Harga acuan pasar
                  </Typography>
                  {bapanasData ? (
                    <Chip color="success" icon={<CheckCircleRoundedIcon />} label="BAPANAS Terverifikasi" size="small" />
                  ) : bapanasOffline ? (
                    <Chip color="warning" label="Offline — pakai acuan lokal" size="small" />
                  ) : (
                    <Chip color="default" label="Acuan BAPANAS Payakumbuh" size="small" variant="outlined" />
                  )}
                  <Tooltip title="Perbarui / Sinkronisasi Harga BAPANAS Terkini">
                    <span>
                      <IconButton
                        aria-label="Sinkronisasi harga BAPANAS"
                        disabled={isRefreshingPrice}
                        onClick={handleRefreshBapanas}
                        size="small"
                      >
                        <RefreshRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <Typography color="text.secondary" sx={{ display: 'block', mt: 0.5 }} variant="caption">
                  {bapanasData
                    ? `Panel BAPANAS • ${bapanasData.market_center}`
                    : `Acuan Pasar • Diperbarui ${PRICE_REFERENCE_SOURCE.updatedAt}${bapanasOffline ? ' (gagal sinkron, menampilkan acuan lokal)' : ''}`}
                </Typography>
              </Box>

              <Stack spacing={0} sx={{ width: '100%' }}>
                {COMMODITY_OPTIONS.map((commodity) => {
                  const bapanasKey = commodity.toLowerCase()
                  const livePrice = bapanasData?.commodities?.[bapanasKey]?.price_per_kg
                  const priceToShow = livePrice || REFERENCE_PRICES_PER_KG[commodity]
                  return (
                    <Stack
                      direction="row"
                      key={commodity}
                      spacing={2}
                      sx={{alignItems: 'center', justifyContent: 'space-between', 
                        width: '100%',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        py: 1.5,
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Typography fontWeight={600} variant="body2" color="text.primary" sx={{ flexGrow: 1 }}>
                        {commodity}
                      </Typography>
                      <Typography fontWeight={700} variant="body2" color="primary.dark" sx={{ ml: 'auto', textAlign: 'right', whiteSpace: 'nowrap', pl: 2 }}>
                        {formatRupiah(priceToShow)} / kg
                      </Typography>
                    </Stack>
                  )
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              {lastBatch ? (
                <Stack spacing={1.5}>
                  <Box sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                      <Typography fontWeight={700} variant="h6">
                        Batch Panen Terakhir
                      </Typography>
                      <Tooltip title={`ID Lengkap: ${lastBatch.id}`}>
                        <Chip
                          color="primary"
                          label={formatBatchDisplayId(lastBatch.id)}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </Tooltip>
                    </Stack>
                    <Typography color="text.secondary" sx={{ display: 'block', mt: 0.5 }} variant="caption">
                      Ringkasan mutu &amp; transaksi batch terakhir
                    </Typography>
                  </Box>

                  <Stack spacing={0} sx={{ width: '100%', mb: 2 }}>
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{alignItems: 'center', justifyContent: 'space-between',  width: '100%', borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}
                    >
                      <Typography color="text.secondary" fontWeight={600} variant="body2" sx={{ flexGrow: 1 }}>
                        Komoditas
                      </Typography>
                      <Typography fontWeight={700} variant="body2" color="text.primary" sx={{ ml: 'auto', textAlign: 'right', whiteSpace: 'nowrap', pl: 2 }}>
                        {lastBatch.komoditas}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{alignItems: 'center', justifyContent: 'space-between',  width: '100%', borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}
                    >
                      <Typography color="text.secondary" fontWeight={600} variant="body2" sx={{ flexGrow: 1 }}>
                        Berat Total
                      </Typography>
                      <Typography fontWeight={700} variant="body2" color="text.primary" sx={{ ml: 'auto', textAlign: 'right', whiteSpace: 'nowrap', pl: 2 }}>
                        {lastBatch.beratKg ?? lastBatch.volume_kg ?? 0} kg
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{alignItems: 'center', justifyContent: 'space-between',  width: '100%', borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}
                    >
                      <Typography color="text.secondary" fontWeight={600} variant="body2" sx={{ flexGrow: 1 }}>
                        Estimasi Nilai
                      </Typography>
                      <Typography fontWeight={700} variant="body2" color="success.main" sx={{ ml: 'auto', textAlign: 'right', whiteSpace: 'nowrap', pl: 2 }}>
                        {formatRupiah(lastBatch.pricing?.estimated_economic_value ?? lastBatch.hasil?.totalNilai)}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{alignItems: 'center', justifyContent: 'space-between',  width: '100%', py: 1.5 }}
                    >
                      <Typography color="text.secondary" fontWeight={600} variant="body2" sx={{ flexGrow: 1 }}>
                        Tanggal
                      </Typography>
                      <Typography fontWeight={700} variant="body2" color="text.primary" sx={{ ml: 'auto', textAlign: 'right', whiteSpace: 'nowrap', pl: 2 }}>
                        {lastBatch.tanggal || lastBatch.tanggalPanen || '-'}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Button
                    endIcon={<VisibilityRoundedIcon />}
                    fullWidth
                    onClick={() => {
                      if (typeof onSelectBatch === 'function') {
                        onSelectBatch(lastBatch)
                      } else {
                        onNavigate('results')
                      }
                    }}
                    sx={{ mt: 1 }}
                    variant="contained"
                  >
                    Buka Hasil &amp; Sertifikat
                  </Button>
                </Stack>
              ) : (
                <>
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1 }}>
                    <CameraAltRoundedIcon color="primary" fontSize="small" />
                    <Typography variant="h6">Mulai Pemeriksaan</Typography>
                  </Stack>
                  <Typography color="text.secondary" variant="body2">
                    Belum ada batch panen yang disimpan. Gunakan scanner untuk memeriksa mutu panen dan rekomendasi harga.
                  </Typography>
                  <Button endIcon={<ArrowForwardRoundedIcon />} fullWidth onClick={() => onNavigate('scanner')} sx={{ mt: 2 }} variant="outlined">
                    Buka QC Scanner
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}

function FoundationPage({
  activePage,
  onHarvestConfirm,
  onNavigate,
  batches,
  selectedBatch,
  onBackToInput,
  onViewRecap,
  onSelectBatch,
  onBatchSaved,
  onDeleteBatch,
  openCertModal = false,
  immersive = false,
}) {
  const [showManualForm, setShowManualForm] = useState(false)
  const page = pages[activePage]

  if (activePage === 'overview') {
    return <DashboardPreview onNavigate={onNavigate} batches={batches} onSelectBatch={onSelectBatch} />
  }

  if (activePage === 'scanner') {
    return (
      <Stack spacing={2.5}>
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="text"
            color="inherit"
            onClick={() => setShowManualForm((prev) => !prev)}
            sx={{ textDecoration: 'underline', color: 'text.secondary' }}
          >
            {showManualForm ? '← Kembali ke Scanner Kamera AI' : 'Beralih ke Input Panen Manual (Tanpa Foto) →'}
          </Button>
        </Stack>

        {showManualForm ? (
          <HarvestForm onSave={onHarvestConfirm} />
        ) : (
          <BatchQCScanner
            onBatchSaved={onBatchSaved}
            onViewResults={(batch) => onSelectBatch(batch)}
            immersive={immersive}
          />
        )}
      </Stack>
    )
  }

  if (activePage === 'results') {
    const currentBatch = selectedBatch || (batches && batches.length > 0 ? batches[batches.length - 1] : null)
    return (
      <QCResults
        batch={currentBatch}
        onBackToInput={onBackToInput}
        onViewRecap={onViewRecap}
        initialOpenCertificate={openCertModal}
      />
    )
  }
  if (activePage === 'results-list') {
    return <HarvestRecap batches={batches} onSelectBatch={onSelectBatch} onDeleteBatch={onDeleteBatch} />
  }
  if (activePage === 'pricing') return <PricingDashboard />
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">{page.title}</Typography><Chip color="warning" label="Segera hadir" size="small" /></Stack>
          <Typography color="text.secondary" variant="body2">{page.description} Komponen lengkap halaman ini akan dikerjakan pada langkah implementasi berikutnya.</Typography>
          <Alert severity="info">Kerangka navigasi aktif. Belum ada kalkulasi bisnis atau integrasi AI.</Alert>
        </Stack>
      </CardContent>
    </Card>
  )
}

function getInitialRoute() {
  if (typeof window !== 'undefined') {
    const rawHash = window.location.hash.replace('#', '')
    const hasSession = Boolean(getAuthHeaders().Authorization)
    if (rawHash === 'login') {
      return { view: 'login', page: 'overview' }
    }
    if (rawHash === 'register' || rawHash.includes('access_token=')) {
      return { view: 'register', page: 'overview' }
    }
    if (pages[rawHash]) {
      return { view: hasSession ? 'app' : 'login', page: rawHash }
    }
    try {
      const params = new URLSearchParams(window.location.search)
      const pageParam = params.get('page')
      if (pages[pageParam]) {
        return { view: hasSession ? 'app' : 'login', page: pageParam }
      }
      if (params.get('view') === 'app') {
        return { view: hasSession ? 'app' : 'login', page: 'overview' }
      }
    } catch {}
  }
  return { view: 'landing', page: 'overview' }
}

function App() {
  const [activeUser, setActiveUser] = useState(() => readActiveUser())
  const [sessionChecking, setSessionChecking] = useState(() => Boolean(getAuthHeaders().Authorization))
  const [currentView, setCurrentView] = useState(() => getInitialRoute().view)
  const [activePage, setActivePage] = useState(() => getInitialRoute().page)
  const [pendingPage, setPendingPage] = useState(() => getInitialRoute().page)
  const [batches, setBatches] = useState([])
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [openCertModal, setOpenCertModal] = useState(false)
  const [harvestMessage, setHarvestMessage] = useState('')
  // Issue #30: layar kamera terdedikasi di mobile (<=600px). Masuk scanner =
  // masuk mode immersive; keluar lewat tombol exit di header khusus scanner.
  const isMobileViewport = useMediaQuery('(max-width: 599.95px)')
  const [scannerImmersive, setScannerImmersive] = useState(true)
  const scannerImmersiveActive =
    currentView === 'app' && activePage === 'scanner' && isMobileViewport && scannerImmersive
  const page = pages[activePage] || pages.overview

  useEffect(() => {
    const storedBatches = readBatches()
    setBatches(storedBatches)
    setSelectedBatch(storedBatches[storedBatches.length - 1] || null)
  }, [])

  useEffect(() => {
    if (!sessionChecking) return
    let cancelled = false
    restoreAuthSession().then((user) => {
      if (cancelled) return
      setActiveUser(user)
      if (!user && pages[window.location.hash.replace('#', '')]) {
        setPendingPage(window.location.hash.replace('#', ''))
        setCurrentView('login')
        window.location.hash = 'login'
      }
      setSessionChecking(false)
    })
    return () => { cancelled = true }
  }, [sessionChecking])

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '')
      const user = getAuthHeaders().Authorization ? readActiveUser() : null
      setActiveUser(user)
      if (hash === 'login') {
        stopAllActiveCameraStreams()
        setCurrentView('login')
      } else if (hash === 'register' || hash.includes('access_token=')) {
        stopAllActiveCameraStreams()
        setCurrentView('register')
      } else if (pages[hash]) {
        if (hash !== 'scanner') {
          stopAllActiveCameraStreams()
        }
        if (!user) {
          setPendingPage(hash)
          setCurrentView('login')
        } else {
          setCurrentView('app')
          setActivePage(hash)
        }
      } else if (hash === '' || hash === 'landing') {
        stopAllActiveCameraStreams()
        setCurrentView('landing')
      }
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  const handleOpenApp = (targetPage = 'overview') => {
    const pageToOpen = pages[targetPage] ? targetPage : 'overview'
    if (pageToOpen !== 'scanner') {
      stopAllActiveCameraStreams()
    }
    const user = getAuthHeaders().Authorization ? readActiveUser() : null
    setActiveUser(user)
    if (!user) {
      setPendingPage(pageToOpen)
      setCurrentView('login')
      window.location.hash = 'login'
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setCurrentView('app')
    setActivePage(pageToOpen)
    window.location.hash = pageToOpen
    if (pageToOpen === 'scanner') setScannerImmersive(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSwitchToRegister = () => {
    setCurrentView('register')
    window.location.hash = 'register'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSwitchToLogin = () => {
    setCurrentView('login')
    window.location.hash = 'login'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLoginSuccess = (loggedInUser) => {
    setActiveUser(loggedInUser)
    const userBatches = readBatches()
    setBatches(userBatches)
    setSelectedBatch(userBatches[userBatches.length - 1] || null)
    const destination = pages[pendingPage] ? pendingPage : 'overview'
    setCurrentView('app')
    setActivePage(destination)
    window.location.hash = destination
    if (destination === 'scanner') setScannerImmersive(true)
    setHarvestMessage(`Selamat datang kembali, ${loggedInUser.fullName} (${loggedInUser.email})!`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRegisterSuccess = (newUser) => {
    setActiveUser(newUser)
    const userBatches = readBatches()
    setBatches(userBatches)
    setSelectedBatch(userBatches[userBatches.length - 1] || null)
    const destination = pages[pendingPage] ? pendingPage : 'overview'
    setCurrentView('app')
    setActivePage(destination)
    window.location.hash = destination
    if (destination === 'scanner') setScannerImmersive(true)
    setHarvestMessage(`Selamat datang, ${newUser.fullName} (${newUser.email})! Akun Anda berhasil terdaftar.`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = () => {
    stopAllActiveCameraStreams()
    void logoutActiveUser()
    setActiveUser(null)
    setBatches([])
    setSelectedBatch(null)
    setHarvestMessage('')
    setCurrentView('landing')
    window.location.hash = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBackToLanding = () => {
    stopAllActiveCameraStreams()
    setCurrentView('landing')
    window.location.hash = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavigate = (pageId) => {
    if (pageId === 'landing') {
      handleBackToLanding()
      return
    }
    if (pageId !== 'scanner') {
      stopAllActiveCameraStreams()
    }
    setCurrentView('app')
    setActivePage(pageId)
    window.location.hash = pageId
    setHarvestMessage('')
    setOpenCertModal(false)
    // Reset scroll ke atas: viewport tidak boleh tertinggal di posisi
    // halaman lama, agar konten halaman baru langsung terlihat saat loncat
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const handleBackToInput = () => {
    setHarvestMessage('')
    setOpenCertModal(false)
    setActivePage('scanner')
    window.location.hash = 'scanner'
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const handleViewRecap = () => {
    stopAllActiveCameraStreams()
    setHarvestMessage('')
    setOpenCertModal(false)
    setActivePage('results-list')
    window.location.hash = 'results-list'
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const handleSelectBatch = (batch, options = {}) => {
    stopAllActiveCameraStreams()
    setSelectedBatch(batch)
    setOpenCertModal(Boolean(options?.openCertificate))
    setActivePage('results')
    window.location.hash = 'results'
  }

  const handleDataChanged = () => {
    const storedBatches = readBatches()
    setBatches(storedBatches)
    setSelectedBatch(storedBatches[storedBatches.length - 1] || null)
  }

  const handleDeleteBatch = (batchId) => {
    deleteBatch(batchId)
    const storedBatches = readBatches()
    setBatches(storedBatches)
    if (selectedBatch?.id === batchId) {
      setSelectedBatch(storedBatches[storedBatches.length - 1] || null)
    }
    setHarvestMessage(`Batch ${batchId} berhasil dihapus dari rekap data panen.`)
  }

  const handleHarvestConfirm = (input) => {
    const calculation = calculateHarvest(input)
    const basePrice =
      input.scanResult?.smart_pricing?.reference_price_per_kg ||
      input.scanResult?.smart_pricing?.base_price_per_kg ||
      REFERENCE_PRICES_PER_KG[input.komoditas] ||
      12000
    const valueCalculation = calculateHarvestValue({
      ...input,
      hargaAcuanPerKg: basePrice,
    })
    const isAiScan = Boolean(input.scanResult?.inference_result)
    const savedBatch = saveBatch({
      ...input,
      ai_scan_performed: isAiScan,
      inference: input.scanResult?.inference_result,
      pricing: input.scanResult?.smart_pricing,
      hasil: {
        persenA: calculation.persentase.gradeA,
        persenB: calculation.persentase.gradeB,
        persenC: calculation.persentase.reject,
        beratA: calculation.beratKg.gradeA,
        beratB: calculation.beratKg.gradeB,
        beratC: calculation.beratKg.reject,
        nilaiA: valueCalculation.nilai.gradeA,
        nilaiB: valueCalculation.nilai.gradeB,
        nilaiC: valueCalculation.nilai.reject,
        totalNilai: input.scanResult?.smart_pricing?.estimated_economic_value ?? valueCalculation.totalNilai,
      },
      dicatatPada: new Date().toISOString(),
    })
    setBatches((current) => [...current, savedBatch])
    setSelectedBatch(savedBatch)
    setHarvestMessage(`Batch ${savedBatch.id} berhasil disimpan ke rekap.`)
    setActivePage('results')
    window.location.hash = 'results'
  }

  if (sessionChecking) {
    return (
      <Box sx={{ minHeight: ['100vh', '100dvh'], display: 'grid', placeItems: 'center', bgcolor: '#f2f5f3' }}>
        <Typography color="text.secondary">Memverifikasi sesi...</Typography>
      </Box>
    )
  }

  if (currentView === 'landing') {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LandingPage onOpenApp={handleOpenApp} />
      </Suspense>
    )
  }

  if (currentView === 'login') {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onSwitchToRegister={handleSwitchToRegister}
          onBackToLanding={handleBackToLanding}
        />
      </Suspense>
    )
  }

  if (currentView === 'register') {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <RegisterPage
          onRegisterSuccess={handleRegisterSuccess}
          onSwitchToLogin={handleSwitchToLogin}
          onBackToLanding={handleBackToLanding}
        />
      </Suspense>
    )
  }

  return (
    <AppShell
      activePage={activePage}
      activeUser={activeUser}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
      onBackToLanding={handleBackToLanding}
      onDataChanged={handleDataChanged}
      immersive={scannerImmersiveActive}
    >
      <Container
        maxWidth="lg"
        sx={
          scannerImmersiveActive
            ? { px: 0, py: 0 }
            : { px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2.5, sm: 3.5, md: 4.5 } }
        }
      >
        {scannerImmersiveActive ? (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ pt: 'calc(10px + env(safe-area-inset-top))', pr: 0.5 }}
          >
            <Typography variant="subtitle1" fontWeight={800} color="text.primary">
              {page.title}
            </Typography>
            <IconButton
              aria-label="Keluar layar pemindaian khusus"
              edge="end"
              onClick={() => setScannerImmersive(false)}
              size="small"
            >
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
        ) : (
          <PageHeader eyebrow="Agri-Sort AI / Precision Agriculture" title={page.title} description={page.description} />
        )}
        {harvestMessage && <Alert onClose={() => setHarvestMessage('')} severity="success" sx={{ mb: 2 }}>{harvestMessage}</Alert>}
        <ErrorBoundary key={activePage} onReset={() => setActivePage('overview')}>
          <Suspense fallback={<PageLoadingFallback />}>
            <FoundationPage
              activePage={activePage}
              immersive={scannerImmersiveActive}
              batches={batches}
              onBackToInput={handleBackToInput}
              onHarvestConfirm={handleHarvestConfirm}
              onNavigate={handleNavigate}
              onSelectBatch={handleSelectBatch}
              onViewRecap={handleViewRecap}
              selectedBatch={selectedBatch}
              openCertModal={openCertModal}
              onDeleteBatch={handleDeleteBatch}
              onBatchSaved={(newBatch) => {
                setBatches((current) => [...current, newBatch])
                setSelectedBatch(newBatch)
                setHarvestMessage(`Batch ${newBatch.id} (${newBatch.komoditas}) berhasil disimpan ke rekap data panen.`)
              }}
            />
          </Suspense>
        </ErrorBoundary>

        {/* Opsi A (keputusan UX): setelah keluar dari mode kamera via ✕,
            sediakan jalan balik 1 ketuk khusus HP — tombol mengambang */}
        {activePage === 'scanner' && currentView === 'app' && isMobileViewport && !scannerImmersiveActive && (
          <Fab
            variant="extended"
            color="primary"
            aria-label="Kembali ke mode kamera layar penuh"
            onClick={() => setScannerImmersive(true)}
            sx={{
              position: 'fixed',
              bottom: 'calc(16px + env(safe-area-inset-bottom))',
              right: 16,
              zIndex: 1100,
              fontWeight: 800,
            }}
          >
            <CameraAltRoundedIcon sx={{ mr: 1 }} />
            Mode Kamera
          </Fab>
        )}
      </Container>
    </AppShell>
  )
}

export default App
