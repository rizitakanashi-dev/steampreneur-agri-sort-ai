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
  Typography,
} from '@mui/material'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
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

  const isBapanasActive = Boolean(bapanasPayload && bapanasPayload.commodities)
  const isSp2kpActive = Boolean(sp2kpPayload && sp2kpPayload.commodities)
  const currentFeedPayload = activeSource === 'sp2kp' ? sp2kpPayload : bapanasPayload
  const isFeedActive = activeSource === 'sp2kp' ? isSp2kpActive : isBapanasActive
  const currentCommodities = currentFeedPayload?.commodities || {}

  // Resolusi harga acuan untuk komoditas terpilih (BAPANAS / SP2KP / Fallback Lokal)
  const bKey = normalizeToBapanasKey(commodity)
  const activeItem = isFeedActive ? currentCommodities[bKey] : null
  const referencePrice = activeItem ? activeItem.price_per_kg : getReferencePricePerKg(commodity)

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
        }),
        validationError: '',
      }
    } catch (calculationError) {
      return { projection: null, validationError: calculationError.message }
    }
  }, [commodity, volumeKg, persenA, persenB, includeReject])

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
                onClick={() => setActiveSource('bapanas')}
                startIcon={<AccountBalanceRoundedIcon />}
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                BAPANAS RI
              </Button>
              <Button
                size="small"
                variant={activeSource === 'sp2kp' ? 'contained' : 'outlined'}
                color={activeSource === 'sp2kp' ? 'success' : 'inherit'}
                onClick={() => setActiveSource('sp2kp')}
                startIcon={<StorefrontRoundedIcon />}
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                SP2KP Kemendag RI
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={() => setIsComparisonModalOpen(true)}
                startIcon={<BalanceRoundedIcon />}
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                Triangulasi Harga
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* 2. Banner Status Lembaga yang Sedang Aktif */}
      {isFeedActive ? (
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
                {isFeedActive ? (
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
                {isFeedActive
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
                      const bItem = isFeedActive ? currentCommodities[itemKey] : null
                      const price = bItem ? bItem.price_per_kg : REFERENCE_PRICES_PER_KG[option]
                      const trendLabel = bItem ? bItem.trend_label : 'Stabil'
                      const changeRp = bItem?.price_change_rp ?? 0

                      return (
                        <TableRow hover key={option} selected={option === commodity}>
                          <TableCell>
                            <Typography fontWeight={option === commodity ? 700 : 500} variant="body2">
                              {option}
                            </Typography>
                            {bItem?.category && (
                              <Typography color="text.secondary" variant="caption">
                                {bItem.category}
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
                              color={changeRp > 0 ? 'success' : changeRp < 0 ? 'error' : 'default'}
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
              <strong>SP2KP (Kementerian Perdagangan RI)</strong> untuk menghitung harga komposit yang adil (*fair market price*) bagi petani dan pedagang.
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
                </TableRow>
              </TableHead>
              <TableBody>
                {(comparisonPayload?.comparison || []).map((row) => (
                  <TableRow hover key={row.commodity_key}>
                    <TableCell sx={{ fontWeight: 600 }}>{row.commodity_name}</TableCell>
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
                  </TableRow>
                ))}
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
