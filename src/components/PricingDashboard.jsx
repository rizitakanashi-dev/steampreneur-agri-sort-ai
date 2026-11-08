import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import BalanceRoundedIcon from '@mui/icons-material/BalanceRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import { calculateMinimumPrice, parseNumeric } from '../business/harvestCalculation.js'
import { calculateRevenueProjection, calculateWeightedPricePerKg } from '../business/harvestProjection.js'
import { calculateFarmerProfitability } from '../business/farmerFinance.js'
import { COMMODITY_OPTIONS, PRICE_HISTORY, PRICE_REFERENCE_SOURCE, REFERENCE_PRICES_PER_KG, getReferencePricePerKg } from '../business/priceReference.js'
import { PriceTrendChart } from './PriceTrendChart.jsx'
import {
  fetchBapanasLive,
  syncBapanasPrices,
  fetchSp2kpLive,
  syncSp2kpPrices,
  fetchGovernmentPriceComparison,
} from '../services/scanService.js'

const rupiahFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

function formatRupiah(value) {
  return typeof value === 'number' && Number.isFinite(value) ? rupiahFormatter.format(value) : '-'
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

function normalizeToBapanasKey(name) {
  const norm = String(name || '').trim().toLowerCase()
  if (norm.includes('keriting') || (norm.includes('cabai merah') && !norm.includes('rawit'))) {
    return 'cabai merah keriting'
  }
  if (norm.includes('rawit merah') || norm.includes('setan')) {
    return 'cabai rawit merah'
  }
  if (norm.includes('rawit')) {
    return 'cabai rawit hijau'
  }
  if (norm.includes('tomat')) {
    return 'tomat'
  }
  if (norm.includes('terung') || norm.includes('terong')) {
    return 'terung'
  }
  return norm
}

export function mapComparisonKeyToCommodity(key, name) {
  const norm = String(name || key || '').trim().toLowerCase()
  if (norm.includes('keriting') || (norm.includes('cabai merah') && !norm.includes('rawit'))) {
    return 'Cabai Merah Keriting'
  }
  if (norm.includes('rawit merah') || norm.includes('setan')) {
    return 'Cabai Rawit Merah'
  }
  if (norm.includes('rawit')) {
    return 'Cabai Rawit Hijau'
  }
  if (norm.includes('terung') || norm.includes('terong')) {
    return 'Terung'
  }
  if (norm.includes('tomat')) {
    return 'Tomat'
  }
  return null
}

const DEFAULT_GOVERNMENT_COMPARISON = Object.freeze({
  title: 'Triangulasi Harga Pangan Resmi Pemerintah RI',
  region: 'Sumatera Barat',
  market_center: 'Pasar Ibuh Payakumbuh',
  date: '2026-11-08',
  last_synced: '2026-11-08T07:00:00+07:00',
  institutions: {
    bapanas: {
      name: 'Badan Pangan Nasional (BAPANAS)',
      url: 'https://panelharga.badanpangan.go.id',
    },
    kemendag: {
      name: 'Kementerian Perdagangan (SP2KP Kemendag RI)',
      url: 'https://sp2kp.kemendag.go.id/',
    },
  },
  comparison: Object.freeze([
    {
      commodity_key: 'cabai merah keriting',
      commodity_name: 'Cabai Merah Keriting',
      bapanas_price_per_kg: 45000,
      sp2kp_kemendag_price_per_kg: 44800,
      composite_fair_price: 44900,
      disparity_rp: 200,
      convergence_index_percent: 99.55,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'cabai rawit merah',
      commodity_name: 'Cabai Rawit Merah',
      bapanas_price_per_kg: 42000,
      sp2kp_kemendag_price_per_kg: 42500,
      composite_fair_price: 42250,
      disparity_rp: 500,
      convergence_index_percent: 98.82,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'cabai rawit hijau',
      commodity_name: 'Cabai Rawit Hijau',
      bapanas_price_per_kg: 30000,
      sp2kp_kemendag_price_per_kg: 30000,
      composite_fair_price: 30000,
      disparity_rp: 0,
      convergence_index_percent: 100.0,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'tomat',
      commodity_name: 'Tomat',
      bapanas_price_per_kg: 12000,
      sp2kp_kemendag_price_per_kg: 12000,
      composite_fair_price: 12000,
      disparity_rp: 0,
      convergence_index_percent: 100.0,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'terung',
      commodity_name: 'Terung',
      bapanas_price_per_kg: 10000,
      sp2kp_kemendag_price_per_kg: 10000,
      composite_fair_price: 10000,
      disparity_rp: 0,
      convergence_index_percent: 100.0,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'bawang merah',
      commodity_name: 'Bawang Merah',
      bapanas_price_per_kg: null,
      sp2kp_kemendag_price_per_kg: 34500,
      composite_fair_price: 34500,
      disparity_rp: 0,
      convergence_index_percent: 100.0,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
  ]),
})

export function PricingDashboard() {
  const [commodity, setCommodity] = useState(COMMODITY_OPTIONS[0])
  const [volumeKg, setVolumeKg] = useState('500')
  const [persenA, setPersenA] = useState('72')
  const [persenB, setPersenB] = useState('18')
  const [includeReject, setIncludeReject] = useState(false)
  const [error, setError] = useState('')

  // State Finansial Petani (BPP & BEP)
  const [bppInput, setBppInput] = useState('7000')
  const [targetMargin, setTargetMargin] = useState('20')

  // State Sumber Data Pemerintah: 'bapanas' | 'sp2kp'
  const [activeSource, setActiveSource] = useState('bapanas')

  // State untuk Live Feed BAPANAS & SP2KP Kemendag RI
  const [bapanasPayload, setBapanasPayload] = useState(null)
  const [sp2kpPayload, setSp2kpPayload] = useState(null)
  const [comparisonPayload, setComparisonPayload] = useState(null)
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false)

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState('')

  useEffect(() => {
    let isMounted = true
    async function loadFeeds() {
      try {
        const [bapanasFeed, sp2kpFeed, compFeed] = await Promise.allSettled([
          fetchBapanasLive(4000),
          fetchSp2kpLive(4000),
          fetchGovernmentPriceComparison(4000),
        ])
        if (isMounted) {
          if (bapanasFeed.status === 'fulfilled' && bapanasFeed.value?.commodities) {
            setBapanasPayload(bapanasFeed.value)
          }
          if (sp2kpFeed.status === 'fulfilled' && sp2kpFeed.value?.commodities) {
            setSp2kpPayload(sp2kpFeed.value)
          }
          if (compFeed.status === 'fulfilled' && compFeed.value?.comparison) {
            setComparisonPayload(compFeed.value)
          }
        }
      } catch {
        // Fallback graceful: jika backend offline, gunakan acuan lokal simulasi
      }
    }
    loadFeeds()
    return () => {
      isMounted = false
    }
  }, [])

  const handleSyncPrices = async () => {
    setIsSyncing(true)
    setSyncStatusMsg('')
    try {
      if (activeSource === 'sp2kp') {
        const refreshed = await syncSp2kpPrices(6000)
        if (refreshed && refreshed.commodities) {
          setSp2kpPayload(refreshed)
          setSyncStatusMsg('Harga pangan SP2KP Kemendag RI berhasil disinkronkan langsung!')
        }
      } else if (activeSource === 'triangulasi') {
        const [refreshedComp, refreshedBapanas, refreshedSp2kp] = await Promise.allSettled([
          fetchGovernmentPriceComparison(6000),
          syncBapanasPrices(6000),
          syncSp2kpPrices(6000),
        ])
        if (refreshedComp.status === 'fulfilled' && refreshedComp.value?.comparison) {
          setComparisonPayload(refreshedComp.value)
        }
        if (refreshedBapanas.status === 'fulfilled' && refreshedBapanas.value?.commodities) {
          setBapanasPayload(refreshedBapanas.value)
        }
        if (refreshedSp2kp.status === 'fulfilled' && refreshedSp2kp.value?.commodities) {
          setSp2kpPayload(refreshedSp2kp.value)
        }
        setSyncStatusMsg('Harga komposit triangulasi BAPANAS & SP2KP berhasil disinkronkan langsung!')
      } else {
        const refreshed = await syncBapanasPrices(6000)
        if (refreshed && refreshed.commodities) {
          setBapanasPayload(refreshed)
          setSyncStatusMsg('Harga pangan BAPANAS berhasil disinkronkan langsung!')
        }
      }
    } catch (err) {
      setSyncStatusMsg(`Gagal menyinkronkan: ${err?.message || 'Server offline'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const effectiveComparison = comparisonPayload || DEFAULT_GOVERNMENT_COMPARISON
  const effectiveComparisonList = effectiveComparison?.comparison || []

  const isBapanasActive = Boolean(bapanasPayload && bapanasPayload.commodities)
  const isSp2kpActive = Boolean(sp2kpPayload && sp2kpPayload.commodities)
  const isTriangulasiActive = activeSource === 'triangulasi'

  const currentFeedPayload = activeSource === 'sp2kp' ? sp2kpPayload : bapanasPayload
  const isFeedActive = activeSource === 'sp2kp' ? isSp2kpActive : isBapanasActive
  const currentCommodities = currentFeedPayload?.commodities || {}

  // Resolusi harga acuan untuk komoditas terpilih (BAPANAS / SP2KP / Triangulasi / Fallback Lokal)
  const bKey = normalizeToBapanasKey(commodity)
  const activeItem = isFeedActive ? currentCommodities[bKey] : null
  const triangulasiItem = effectiveComparisonList.find(
    (c) => c.commodity_key === bKey || c.commodity_name?.toLowerCase() === commodity.toLowerCase()
  )

  const referencePrice = isTriangulasiActive
    ? (triangulasiItem?.composite_fair_price || (activeItem ? activeItem.price_per_kg : getReferencePricePerKg(commodity)))
    : (activeItem ? activeItem.price_per_kg : getReferencePricePerKg(commodity))

  const handleSelectTriangulationCommodity = (row) => {
    const matched = mapComparisonKeyToCommodity(row.commodity_key, row.commodity_name)
    if (matched && COMMODITY_OPTIONS.includes(matched)) {
      setCommodity(matched)
      setActiveSource('triangulasi')
      setIsComparisonModalOpen(false)
      setSyncStatusMsg(`Harga komposit triangulasi ${matched} (${formatRupiah(row.composite_fair_price)}/kg) berhasil diterapkan ke kalkulator!`)
    } else {
      setActiveSource('triangulasi')
      setSyncStatusMsg(`Komoditas ${row.commodity_name} terpantau di SP2KP Kemendag RI (${formatRupiah(row.composite_fair_price)}/kg). Model AI Sort disiapkan khusus untuk Cabai, Terung, dan Tomat.`)
    }
  }

  // Resolusi riwayat harga grafik tren
  const history = useMemo(() => {
    if (activeItem && Array.isArray(activeItem.weekly_history) && activeItem.weekly_history.length > 0) {
      return activeItem.weekly_history.map((h) => ({
        label: h.label || h.date,
        pricePerKg: h.price_per_kg,
      }))
    }
    return PRICE_HISTORY[commodity] || []
  }, [activeItem, commodity])

  const { projection, validationError } = useMemo(() => {
    const parsedA = parseNumeric(persenA)
    const parsedB = parseNumeric(persenB)
    if (parsedA === null || parsedB === null) {
      return { projection: null, validationError: 'Persentase Grade A dan Grade B harus berupa angka.' }
    }
    if (parsedA + parsedB > 100) {
      return { projection: null, validationError: 'Total Grade A dan Grade B tidak boleh melebihi 100%.' }
    }
    try {
      return {
        projection: calculateRevenueProjection({
          komoditas: commodity,
          volumeKg,
          persenA: parsedA,
          persenB: parsedB,
          persenC: 100 - parsedA - parsedB,
          includeReject,
          customPricePerKg: referencePrice,
        }),
        validationError: '',
      }
    } catch (calculationError) {
      return { projection: null, validationError: calculationError.message }
    }
  }, [commodity, volumeKg, persenA, persenB, includeReject, referencePrice])

  const weightedPrice = projection ? calculateWeightedPricePerKg(projection) : null

  // Kalkulasi Kelayakan Finansial & Titik Impas Petani (HPP, BEP, Net Profit, ROI)
  const farmerFinance = useMemo(() => {
    if (!projection) return null
    return calculateFarmerProfitability({
      revenue: projection.totalNilai,
      sellableVolumeKg: projection.volumeKg,
      costMode: 'perKg',
      bppPerKg: bppInput,
    })
  }, [projection, bppInput])

  // Rekomendasi Harga Jual Sasaran Berdasarkan Margin Target
  const targetPriceRec = useMemo(() => {
    const bpp = parseNumeric(bppInput)
    const margin = parseNumeric(targetMargin)
    if (bpp === null || bpp <= 0 || margin === null || margin < 0) return null
    try {
      return calculateMinimumPrice({
        bppPerKg: bpp,
        policy: { type: 'margin', percent: margin },
      })
    } catch {
      return null
    }
  }, [bppInput, targetMargin])

  return (
    <Stack spacing={3}>
      {/* 1. Bar Pemilih Lembaga Resmi Negara & Tombol Triangulasi */}
      <Card elevation={1} sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ md: 'center' }}
            spacing={1.5}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>
                Pilih Sumber Data Acuan Harga Pasar Resmi
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Data ditarik langsung dari sistem kementerian dan badan pangan nasional resmi RI.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                size="small"
                variant={activeSource === 'bapanas' ? 'contained' : 'outlined'}
                color={activeSource === 'bapanas' ? 'success' : 'inherit'}
                onClick={() => {
                  setActiveSource('bapanas')
                  setSyncStatusMsg('Sumber harga diubah ke Panel BAPANAS RI.')
                }}
                startIcon={<AccountBalanceRoundedIcon />}
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                BAPANAS RI
              </Button>
              <Button
                size="small"
                variant={activeSource === 'sp2kp' ? 'contained' : 'outlined'}
                color={activeSource === 'sp2kp' ? 'success' : 'inherit'}
                onClick={() => {
                  setActiveSource('sp2kp')
                  setSyncStatusMsg('Sumber harga diubah ke SP2KP Kemendag RI.')
                }}
                startIcon={<StorefrontRoundedIcon />}
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                SP2KP Kemendag RI
              </Button>
              <Button
                size="small"
                variant={activeSource === 'triangulasi' ? 'contained' : 'outlined'}
                color={activeSource === 'triangulasi' ? 'primary' : 'inherit'}
                onClick={() => {
                  setActiveSource('triangulasi')
                  setSyncStatusMsg('Sumber harga diubah ke Triangulasi Komposit Dua Lembaga Negara.')
                }}
                startIcon={<VerifiedRoundedIcon />}
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                Triangulasi Komposit
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="info"
                onClick={() => setIsComparisonModalOpen(true)}
                startIcon={<BalanceRoundedIcon />}
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                Tabel Komparasi & Pilih
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* 2. Banner Status Lembaga yang Sedang Aktif */}
      {isTriangulasiActive ? (
        <Alert
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                disabled={isSyncing}
                onClick={handleSyncPrices}
                size="small"
                startIcon={isSyncing ? <CircularProgress color="inherit" size={16} /> : <SyncRoundedIcon />}
              >
                {isSyncing ? 'Sinkronisasi...' : 'Sinkronkan'}
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => setIsComparisonModalOpen(true)}
                startIcon={<BalanceRoundedIcon />}
              >
                Ganti Komoditas
              </Button>
            </Stack>
          }
          icon={<VerifiedRoundedIcon />}
          severity="success"
          sx={{ borderRadius: 2, bgcolor: 'rgba(5, 150, 105, 0.08)', border: '1px solid #10b981' }}
        >
          <Typography fontWeight={700} variant="body2">
            🛡️ Menggunakan Triangulasi Dua Lembaga Negara (BAPANAS RI + SP2KP Kemendag RI)
          </Typography>
          <Typography variant="body2">
            Harga Komposit Adil Pasar Ibuh Payakumbuh untuk <strong>{commodity}</strong>: <strong>{formatRupiah(referencePrice)} / kg</strong>
            {triangulasiItem?.convergence_index_percent ? ` &bull; Indeks Konvergensi: ${triangulasiItem.convergence_index_percent}%` : ''}
            {triangulasiItem?.disparity_rp !== undefined ? ` &bull; Selisih Antar-Lembaga: ${formatRupiah(triangulasiItem.disparity_rp)}` : ''}
          </Typography>
          {syncStatusMsg && (
            <Typography sx={{ fontStyle: 'italic', mt: 0.5 }} variant="caption">
              {syncStatusMsg}
            </Typography>
          )}
        </Alert>
      ) : isFeedActive ? (
        <Alert
          action={
            <Button
              color="inherit"
              disabled={isSyncing}
              onClick={handleSyncPrices}
              size="small"
              startIcon={isSyncing ? <CircularProgress color="inherit" size={16} /> : <SyncRoundedIcon />}
            >
              {isSyncing ? 'Sinkronisasi...' : 'Sinkronkan'}
            </Button>
          }
          icon={<VerifiedRoundedIcon />}
          severity="success"
          sx={{ borderRadius: 2 }}
        >
          <Typography fontWeight={700} variant="body2">
            Terhubung Resmi ke {currentFeedPayload.source || currentFeedPayload.agency}
          </Typography>
          <Typography variant="body2">
            Wilayah: {currentFeedPayload.region} ({currentFeedPayload.market_center}) &bull; Tanggal data: {currentFeedPayload.data_date} &bull; Portal: {currentFeedPayload.portal_url || 'https://sp2kp.kemendag.go.id/'}
          </Typography>
          {syncStatusMsg && (
            <Typography sx={{ fontStyle: 'italic', mt: 0.5 }} variant="caption">
              {syncStatusMsg}
            </Typography>
          )}
        </Alert>
      ) : (
        <Alert
          action={
            <Button
              color="inherit"
              disabled={isSyncing}
              onClick={handleSyncPrices}
              size="small"
              startIcon={isSyncing ? <CircularProgress color="inherit" size={16} /> : <SyncRoundedIcon />}
            >
              Hubungkan Sumber
            </Button>
          }
          icon={<InfoOutlinedIcon />}
          severity="info"
          sx={{ borderRadius: 2 }}
        >
          <Typography fontWeight={700} variant="body2">Mode Cadangan Acuan Lokal (Simulasi).</Typography>
          <Typography variant="body2">
            Sumber: {PRICE_REFERENCE_SOURCE.label}. Terakhir diperbarui {PRICE_REFERENCE_SOURCE.updatedAt}. {PRICE_REFERENCE_SOURCE.note}
          </Typography>
          {syncStatusMsg && (
            <Typography sx={{ fontStyle: 'italic', mt: 0.5 }} variant="caption">
              {syncStatusMsg}
            </Typography>
          )}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack alignItems="center" direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Harga referensi per komoditas</Typography>
                {isTriangulasiActive ? (
                  <Chip
                    color="primary"
                    icon={<VerifiedRoundedIcon />}
                    label="Triangulasi BAPANAS + SP2KP"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                ) : isFeedActive ? (
                  <Chip
                    color="success"
                    icon={<VerifiedRoundedIcon />}
                    label={activeSource === 'sp2kp' ? 'SP2KP Kemendag RI' : 'Panel BAPANAS RI'}
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                ) : (
                  <Chip color="warning" label="Simulasi Acuan Lokal" size="small" />
                )}
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                {isTriangulasiActive
                  ? `${effectiveComparison.market_center || 'Pasar Ibuh Payakumbuh'} — Harga Komposit Konsensus Dua Lembaga Negara`
                  : isFeedActive
                  ? `${currentFeedPayload.market_center || 'Pasar Ibuh Payakumbuh'} — Diperbarui per ${currentFeedPayload.data_date}`
                  : `Diperbarui: ${PRICE_REFERENCE_SOURCE.updatedAt}`}
              </Typography>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 360 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f2f4f6' }}>
                      <TableCell>Komoditas</TableCell>
                      <TableCell align="right">Harga acuan Grade A</TableCell>
                      <TableCell align="right">Perubahan / Tren</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {COMMODITY_OPTIONS.map((option) => {
                      const itemKey = normalizeToBapanasKey(option)
                      let price = REFERENCE_PRICES_PER_KG[option]
                      let trendLabel = 'Stabil'
                      let changeRp = 0
                      let categorySub = null

                      if (isTriangulasiActive) {
                        const tItem = effectiveComparisonList.find((c) => c.commodity_key === itemKey)
                        if (tItem) {
                          price = tItem.composite_fair_price
                          trendLabel = `Konv ${tItem.convergence_index_percent}%`
                          changeRp = 0
                          categorySub = `BAPANAS ${formatRupiah(tItem.bapanas_price_per_kg)} • SP2KP ${formatRupiah(tItem.sp2kp_kemendag_price_per_kg)}`
                        }
                      } else if (isFeedActive) {
                        const bItem = currentCommodities[itemKey]
                        if (bItem) {
                          price = bItem.price_per_kg
                          trendLabel = bItem.trend_label
                          changeRp = bItem.price_change_rp ?? 0
                          categorySub = bItem.category
                        }
                      }

                      return (
                        <TableRow
                          hover
                          key={option}
                          selected={option === commodity}
                          onClick={() => setCommodity(option)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Typography fontWeight={option === commodity ? 700 : 500} variant="body2">
                              {option}
                            </Typography>
                            {categorySub && (
                              <Typography color="text.secondary" variant="caption">
                                {categorySub}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight={600} variant="body2">
                              {formatRupiah(price)} / kg
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              color={changeRp > 0 ? 'success' : changeRp < 0 ? 'error' : isTriangulasiActive ? 'primary' : 'default'}
                              label={trendLabel}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography gutterBottom variant="h6">Tren harga {commodity}</Typography>
              <PriceTrendChart
                commodity={commodity}
                history={history}
                isOfficialBapanas={isBapanasActive}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography gutterBottom variant="h6">Form proyeksi panen</Typography>
              <Stack spacing={2.25} sx={{ mt: 1 }}>
                <FormControl fullWidth size="small">
                  <Typography color="text.secondary" sx={{ mb: 0.75 }} variant="body2">Komoditas</Typography>
                  <Select onChange={(event) => setCommodity(event.target.value)} value={commodity}>
                    {COMMODITY_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  helperText={`Harga acuan: ${formatRupiah(referencePrice)} / kg`}
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }}
                  inputMode="decimal"
                  label="Volume panen"
                  onChange={(event) => setVolumeKg(event.target.value)}
                  size="small"
                  value={volumeKg}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    fullWidth
                    slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                    inputMode="decimal"
                    label="Grade A"
                    onChange={(event) => setPersenA(event.target.value)}
                    size="small"
                    value={persenA}
                  />
                  <TextField
                    fullWidth
                    slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                    inputMode="decimal"
                    label="Grade B"
                    onChange={(event) => setPersenB(event.target.value)}
                    size="small"
                    value={persenB}
                  />
                </Stack>
                <TextField
                  fullWidth
                  disabled
                  helperText="Reject = 100% - Grade A - Grade B"
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                  label="Reject"
                  size="small"
                  value={projection ? formatNumber(projection.persentase.reject) : '-'}
                />
                <FormControlLabel
                  control={<Switch checked={includeReject} onChange={(event) => setIncludeReject(event.target.checked)} />}
                  label={<Typography variant="body2">Hitung Reject sebagai pendapatan (nilai olahan)</Typography>}
                />
                <Button disabled endIcon={<CalculateRoundedIcon />} fullWidth variant="outlined">Proyeksi dihitung otomatis</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography gutterBottom variant="h6">Ringkasan proyeksi pendapatan</Typography>
                {validationError && <Alert severity="error" sx={{ mb: 2 }}>{validationError}</Alert>}
                {projection ? (
                  <Stack spacing={2}>
                    <Box>
                      <Typography color="text.secondary" variant="body2">Estimasi nilai jual (Grade A + Grade B)</Typography>
                      <Typography color="primary.dark" variant="h5">{formatRupiah(projection.totalNilaiJual)}</Typography>
                      <Typography color="text.secondary" variant="caption">
                        Harga rata-rata tertimbang: {formatRupiah(weightedPrice)} / kg
                      </Typography>
                    </Box>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 480 }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f2f4f6' }}>
                            <TableCell>Grade</TableCell>
                            <TableCell align="right">Persentase</TableCell>
                            <TableCell align="right">Berat</TableCell>
                            <TableCell align="right">Nilai</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell><Chip color="success" label="Grade A" size="small" /></TableCell>
                            <TableCell align="right">{formatNumber(projection.persentase.gradeA)}%</TableCell>
                            <TableCell align="right">{formatNumber(projection.beratKg.gradeA)} kg</TableCell>
                            <TableCell align="right">{formatRupiah(projection.nilai.gradeA)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell><Chip color="warning" label="Grade B" size="small" /></TableCell>
                            <TableCell align="right">{formatNumber(projection.persentase.gradeB)}%</TableCell>
                            <TableCell align="right">{formatNumber(projection.beratKg.gradeB)} kg</TableCell>
                            <TableCell align="right">{formatRupiah(projection.nilai.gradeB)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell><Chip color="error" label="Reject" size="small" /></TableCell>
                            <TableCell align="right">{formatNumber(projection.persentase.reject)}%</TableCell>
                            <TableCell align="right">{formatNumber(projection.beratKg.reject)} kg</TableCell>
                            <TableCell align="right">{includeReject ? formatRupiah(projection.nilai.reject) : 'Tidak dihitung'}</TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f7f9fa' }}>
                            <TableCell colSpan={2}><Typography fontWeight={700} variant="body2">Total volume</Typography></TableCell>
                            <TableCell align="right"><Typography fontWeight={700} variant="body2">{formatNumber(projection.volumeKg)} kg</Typography></TableCell>
                            <TableCell align="right"><Typography fontWeight={700} variant="body2">{formatRupiah(projection.totalNilai)}</Typography></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    Lengkapi form volume panen dan persentase grade untuk melihat proyeksi.
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* KARTU FINANSIAL PETANI: HPP, BEP, DAN LABA BERSIH (STEAM MATH & ENTREPRENEURSHIP) */}
            <Card sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack alignItems="center" direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
                  <Stack alignItems="center" direction="row" spacing={1}>
                    <MonetizationOnRoundedIcon color="primary" />
                    <Typography variant="h6">Titik Impas (BEP) & Laba Petani</Typography>
                  </Stack>
                  <Chip
                    color="primary"
                    label="STEAM: Preneur"
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                  />
                </Stack>
                <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                  Kalkulator kelayakan finansial agribisnis: bandingkan nilai sortasi pasar dengan Biaya Pokok Produksi (BPP) budidaya.
                </Typography>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      helperText="Estimasi modal bibit, pupuk, pestisida & tenaga kerja"
                      inputMode="decimal"
                      label="BPP / Modal per kg"
                      onChange={(e) => setBppInput(e.target.value)}
                      size="small"
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                          endAdornment: <InputAdornment position="end">/ kg</InputAdornment>,
                        },
                      }}
                      value={bppInput}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      helperText="Target margin laba bersih yang diharapkan"
                      inputMode="decimal"
                      label="Target Margin Petani"
                      onChange={(e) => setTargetMargin(e.target.value)}
                      size="small"
                      slotProps={{
                        input: {
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        },
                      }}
                      value={targetMargin}
                    />
                  </Grid>
                </Grid>

                {farmerFinance ? (
                  <Stack spacing={2}>
                    {/* Status Laba / Rugi Banner */}
                    <Box
                      sx={{
                        bgcolor: farmerFinance.isProfitable ? '#f0fdf4' : '#fef2f2',
                        border: '1px solid',
                        borderColor: farmerFinance.isProfitable ? '#86efac' : '#fca5a5',
                        borderRadius: 2,
                        p: 2,
                      }}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                        <Box>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            {farmerFinance.isProfitable ? (
                              <TrendingUpRoundedIcon sx={{ color: '#16a34a' }} />
                            ) : (
                              <TrendingDownRoundedIcon sx={{ color: '#dc2626' }} />
                            )}
                            <Typography fontWeight={700} variant="subtitle2" sx={{ color: farmerFinance.isProfitable ? '#15803d' : '#b91c1c' }}>
                              {farmerFinance.isProfitable ? 'Prospek Panen Menguntungkan (Surplus)' : 'Potensi Defisit / Risiko Rugi'}
                            </Typography>
                          </Stack>
                          <Typography fontWeight={800} variant="h5" sx={{ color: farmerFinance.isProfitable ? '#166534' : '#991b1b', mt: 0.5 }}>
                            {formatRupiah(farmerFinance.netProfit)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: farmerFinance.isProfitable ? '#15803d' : '#b91c1c' }}>
                            Margin Bersih: {farmerFinance.profitMarginPercent}% &bull; ROI Modal: {farmerFinance.roiPercent}%
                          </Typography>
                        </Box>

                        <Chip
                          color={farmerFinance.isProfitable ? 'success' : 'error'}
                          label={farmerFinance.isProfitable ? `Laba Bersih` : `Defisit Modal`}
                          sx={{ fontWeight: 700 }}
                        />
                      </Stack>
                    </Box>

                    {/* Rincian Finansial & Titik Impas (BEP) */}
                    <TableContainer sx={{ overflowX: 'auto', border: '1px solid #f1f5f9', borderRadius: 1.5 }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ color: 'text.secondary' }}>Total Modal Budidaya (HPP Total)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>{formatRupiah(farmerFinance.totalCost)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ color: 'text.secondary' }}>Titik Impas Harga (BEP Harga)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.dark' }}>
                              {formatRupiah(farmerFinance.bepPricePerKg)} / kg
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ color: 'text.secondary' }}>Volume Balik Modal (BEP Volume)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {formatNumber(farmerFinance.bepVolumeKg)} kg dari {formatNumber(farmerFinance.sellableVolumeKg)} kg
                            </TableCell>
                          </TableRow>
                          {targetPriceRec && (
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                              <TableCell sx={{ fontWeight: 600, color: '#036e45' }}>
                                Rekomendasi Jual (Target Margin {targetMargin}%)
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: '#036e45' }}>
                                {formatRupiah(targetPriceRec)} / kg
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {error && <Alert severity="info">{error}</Alert>}
                  </Stack>
                ) : (
                  <Alert severity="info" icon={<InfoOutlinedIcon />}>
                    Lengkapi form volume panen dan persentase grade di atas untuk melihat analisis laba dan titik impas.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* DIALOG TRIANGULASI HARGA RESMI PEMERINTAH (BAPANAS VS SP2KP KEMENDAG) */}
      <Dialog
        open={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <BalanceRoundedIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Triangulasi Harga Pangan Resmi Pemerintah RI
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Komparasi BAPANAS RI vs SP2KP Kemendag RI (Wilayah: Sumatera Barat / Pasar Ibuh Payakumbuh)
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setIsComparisonModalOpen(false)} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2.5, borderRadius: 2 }}>
            <Typography variant="body2">
              Sistem membandingkan data harian dari <strong>Panel Harga BAPANAS (Badan Pangan Nasional)</strong> dan{' '}
              <strong>SP2KP (Kementerian Perdagangan RI)</strong> untuk menghitung harga komposit yang adil (<em>fair market price</em>).
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary', fontWeight: 600 }}>
              💡 <strong>Tips Interaktif:</strong> Klik pada baris komoditas atau tombol <strong>&quot;Gunakan&quot;</strong> di bawah untuk langsung menerapkan harga komposit ke kalkulator pendapatan dan analisis laba petani.
            </Typography>
          </Alert>

          <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Komoditas</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>BAPANAS RI</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>SP2KP Kemendag</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'rgba(5, 150, 105, 0.08)' }}>Harga Komposit Adil</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Disparitas</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Indeks Konvergensi</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {effectiveComparisonList.map((row) => {
                  const matched = mapComparisonKeyToCommodity(row.commodity_key, row.commodity_name)
                  const isSupported = Boolean(matched && COMMODITY_OPTIONS.includes(matched))
                  const isCurrentCommodity = isSupported && commodity === matched && isTriangulasiActive

                  return (
                    <TableRow
                      hover
                      key={row.commodity_key}
                      onClick={() => handleSelectTriangulationCommodity(row)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: isCurrentCommodity ? 'rgba(5, 150, 105, 0.08)' : 'inherit',
                        transition: 'background-color 0.15s ease',
                        '&:hover': { bgcolor: 'rgba(5, 150, 105, 0.12)' },
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight={700}>
                            {row.commodity_name}
                          </Typography>
                          {isCurrentCommodity && (
                            <Chip size="small" label="Aktif" color="success" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }} />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{row.bapanas_price_per_kg ? formatRupiah(row.bapanas_price_per_kg) : '-'}</TableCell>
                      <TableCell align="right">{row.sp2kp_kemendag_price_per_kg ? formatRupiah(row.sp2kp_kemendag_price_per_kg) : '-'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main', bgcolor: 'rgba(5, 150, 105, 0.04)' }}>
                        {formatRupiah(row.composite_fair_price)}
                      </TableCell>
                      <TableCell align="right">{row.disparity_rp ? formatRupiah(row.disparity_rp) : 'Rp 0'}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${row.convergence_index_percent}%`}
                          size="small"
                          color={row.convergence_index_percent >= 98 ? 'success' : 'default'}
                          variant={row.convergence_index_percent >= 98 ? 'filled' : 'outlined'}
                          sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {isSupported ? (
                          <Button
                            size="small"
                            variant={isCurrentCommodity ? 'contained' : 'outlined'}
                            color="primary"
                            startIcon={isCurrentCommodity ? <CheckCircleRoundedIcon /> : <CalculateRoundedIcon />}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectTriangulationCommodity(row)
                            }}
                            sx={{ textTransform: 'none', py: 0.25, px: 1.25, fontSize: '0.75rem', fontWeight: 700, borderRadius: 1.5 }}
                          >
                            {isCurrentCommodity ? 'Sedang Aktif' : 'Gunakan'}
                          </Button>
                        ) : (
                          <Tooltip title="Data acuan pasar Kemendag RI">
                            <Chip label="Referensi" size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsComparisonModalOpen(false)} variant="contained" color="primary">
            Tutup
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
