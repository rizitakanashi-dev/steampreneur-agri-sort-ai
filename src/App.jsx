import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
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
import { calculateHarvest, calculateHarvestValue } from './business/harvestCalculation.js'
import { deleteBatch, readBatches, saveBatch } from './business/harvestStorage.js'
import { COMMODITY_OPTIONS, PRICE_REFERENCE_SOURCE, REFERENCE_PRICES_PER_KG } from './business/priceReference.js'
import { fetchBapanasLive } from './services/scanService.js'
import { AppShell } from './components/AppShell.jsx'
import { BatchQCScanner } from './components/BatchQCScanner.jsx'
import { HarvestForm } from './components/HarvestForm.jsx'
import { HarvestRecap } from './components/HarvestRecap.jsx'
import { QCResults } from './components/QCResults.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { PageHeader } from './components/PageHeader.jsx'
import { PricingDashboard } from './components/PricingDashboard.jsx'

const pages = {
  overview: { title: 'Dashboard', description: 'Pantau kualitas panen dan peluang harga dalam satu tampilan.' },
  scanner: { title: 'Batch QC Scanner', description: 'Siapkan batch panen untuk pemeriksaan kualitas.' },
  results: { title: 'Hasil Analisis QC', description: 'Tinjau hasil pemeriksaan mutu dan rekomendasi tindakan.' },
  'results-list': { title: 'Rekap Data Panen', description: 'Lihat seluruh batch panen yang tersimpan di browser.' },
  pricing: { title: 'Harga Pasar', description: 'Pantau acuan harga pasar untuk keputusan jual yang lebih tepat.' },
}

const metrics = [
  { label: 'Batch tersimpan', value: 'Lokal', detail: 'tersimpan di browser ini', icon: LocalShippingRoundedIcon, color: '#036e45' },
  { label: 'Komoditas terdaftar', value: String(COMMODITY_OPTIONS.length), detail: 'sesuai konfigurasi harga', icon: AutoAwesomeRoundedIcon, color: '#2f7299' },
  { label: 'Sumber harga', value: 'BAPANAS', detail: 'Panel Harga Pangan Sumbar', icon: TrendingUpRoundedIcon, color: '#036e45' },
]

const rupiahFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function formatRupiah(value) {
  return typeof value === 'number' && Number.isFinite(value) ? rupiahFormatter.format(value) : '-'
}

function MetricCard({ detail, icon: Icon, label, value, color }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
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

function formatBatchDisplayId(id) {
  if (!id) return '-'
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
  const [isRefreshingPrice, setIsRefreshingPrice] = useState(false)

  const handleRefreshBapanas = () => {
    setIsRefreshingPrice(true)
    fetchBapanasLive(5000)
      .then((data) => {
        if (data?.commodities) {
          setBapanasData(data)
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsRefreshingPrice(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    fetchBapanasLive(4000)
      .then((data) => {
        if (isMounted && data?.commodities) {
          setBapanasData(data)
        }
      })
      .catch(() => {
        // Fallback anggun ke harga acuan lokal tanpa melempar exception
      })
    return () => {
      isMounted = false
    }
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
      detail: 'Terung, Tomat, Cabai (Sayembara 2026)',
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
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
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
              <Stack alignItems="center" spacing={1}>
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
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Harga acuan pasar</Typography>
                  <Typography color="text.secondary" variant="caption">
                    {bapanasData ? `Panel BAPANAS • ${bapanasData.market_center}` : `Acuan Pasar • Diperbarui ${PRICE_REFERENCE_SOURCE.updatedAt}`}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {bapanasData ? (
                    <Chip color="success" icon={<CheckCircleRoundedIcon />} label="BAPANAS Terverifikasi" size="small" />
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
              </Stack>
              <Stack spacing={1}>
                {COMMODITY_OPTIONS.map((commodity) => {
                  const bapanasKey = commodity.toLowerCase()
                  const livePrice = bapanasData?.commodities?.[bapanasKey]?.price_per_kg
                  const priceToShow = livePrice || REFERENCE_PRICES_PER_KG[commodity]
                  return (
                    <Stack alignItems="center" direction="row" justifyContent="space-between" key={commodity} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1.25 }}>
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                        <Box sx={{ bgcolor: 'primary.light', borderRadius: '50%', height: 8, width: 8 }} />
                        <Typography fontWeight={600} variant="body2">{commodity}</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="baseline" spacing={0.5}>
                        <Typography fontWeight={700} variant="body2">{formatRupiah(priceToShow)}</Typography>
                        <Typography color="text.secondary" variant="caption">/ kg</Typography>
                      </Stack>
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
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Batch Panen Terakhir</Typography>
                    <Tooltip title={`ID Lengkap: ${lastBatch.id}`}>
                      <Chip color="primary" label={formatBatchDisplayId(lastBatch.id)} size="small" variant="outlined" />
                    </Tooltip>
                  </Stack>
                  <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" fontWeight={700} color="primary.dark">
                      {lastBatch.komoditas}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">Berat Total:</Typography>
                      <Typography variant="body2" fontWeight={600}>{lastBatch.beratKg} kg</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">Estimasi Nilai:</Typography>
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        {formatRupiah(lastBatch.pricing?.estimated_economic_value ?? lastBatch.hasil?.totalNilai)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Tanggal:</Typography>
                      <Typography variant="caption">{lastBatch.tanggal || '-'}</Typography>
                    </Stack>
                  </Box>
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
}) {
  const [showManualForm, setShowManualForm] = useState(false)
  const page = pages[activePage]

  if (activePage === 'overview') {
    return <DashboardPreview onNavigate={onNavigate} batches={batches} onSelectBatch={onSelectBatch} />
  }

  if (activePage === 'scanner') {
    return (
      <Stack spacing={2.5}>
        <Stack direction="row" justifyContent="flex-end">
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
          <Stack alignItems="center" direction="row" justifyContent="space-between"><Typography variant="h6">{page.title}</Typography><Chip color="warning" label="Segera hadir" size="small" /></Stack>
          <Typography color="text.secondary" variant="body2">{page.description} Komponen lengkap halaman ini akan dikerjakan pada langkah implementasi berikutnya.</Typography>
          <Alert severity="info">Kerangka navigasi aktif. Belum ada kalkulasi bisnis atau integrasi AI.</Alert>
        </Stack>
      </CardContent>
    </Card>
  )
}

function App() {
  const [activePage, setActivePage] = useState('overview')
  const [batches, setBatches] = useState([])
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [openCertModal, setOpenCertModal] = useState(false)
  const [harvestMessage, setHarvestMessage] = useState('')
  const page = pages[activePage]

  useEffect(() => {
    const storedBatches = readBatches()
    setBatches(storedBatches)
    setSelectedBatch(storedBatches[storedBatches.length - 1] || null)
  }, [])

  const handleNavigate = (pageId) => {
    setActivePage(pageId)
    setHarvestMessage('')
    setOpenCertModal(false)
  }

  const handleBackToInput = () => {
    setHarvestMessage('')
    setOpenCertModal(false)
    setActivePage('scanner')
  }

  const handleViewRecap = () => {
    setHarvestMessage('')
    setOpenCertModal(false)
    setActivePage('results-list')
  }

  const handleSelectBatch = (batch, options = {}) => {
    setSelectedBatch(batch)
    setOpenCertModal(Boolean(options?.openCertificate))
    setActivePage('results')
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
  }

  return (
    <AppShell
      activePage={activePage}
      onNavigate={handleNavigate}
      onDataChanged={handleDataChanged}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2.5, sm: 3.5, md: 4.5 } }}>
        <PageHeader eyebrow="Agri-Sort AI / Precision Agriculture" title={page.title} description={page.description} />
        {harvestMessage && <Alert onClose={() => setHarvestMessage('')} severity="success" sx={{ mb: 2 }}>{harvestMessage}</Alert>}
        <ErrorBoundary key={activePage} onReset={() => setActivePage('overview')}>
          <FoundationPage
            activePage={activePage}
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
        </ErrorBoundary>
      </Container>
    </AppShell>
  )
}

export default App
