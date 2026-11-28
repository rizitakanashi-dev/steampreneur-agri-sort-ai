import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
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
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import BalanceRoundedIcon from '@mui/icons-material/BalanceRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import { calculateMinimumPrice, parseNumeric } from '../business/harvestCalculation.js'
import { calculateRevenueProjection, calculateWeightedPricePerKg } from '../business/harvestProjection.js'
import { calculateFarmerProfitability } from '../business/farmerFinance.js'
import { COMMODITY_OPTIONS, PRICE_HISTORY, PRICE_REFERENCE_SOURCE, REFERENCE_PRICES_PER_KG, getReferencePricePerKg } from '../business/priceReference.js'
import { PriceTrendChart } from './PriceTrendChart.jsx'
import { PRICE_DATA_MODE, commodityNameToId } from '../services/priceApi.js'
import { LivePricePanel } from './pricing/LivePricePanel.jsx'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import IntegrationInstructionsRoundedIcon from '@mui/icons-material/IntegrationInstructionsRounded'
import {
  fetchSp2kpLive,
  syncSp2kpPrices,
  fetchGovernmentPriceComparison,
} from '../services/scanService.js'
import { formatNumber, formatRupiah } from './pricing/formatters.js'
import { DEFAULT_GOVERNMENT_COMPARISON, mapComparisonKeyToCommodity } from './pricing/governmentComparisonData.js'
import { FarmerFinanceCard } from './pricing/FarmerFinanceCard.jsx'
import { TriangulasiComparisonModal } from './pricing/TriangulasiComparisonModal.jsx'

// API kompatibilitas: helper ini sebelumnya diekspor dari file ini
export { mapComparisonKeyToCommodity }

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

export function PricingDashboard({ canSyncPrices = false }) {
  const theme = useTheme()
  const isCompactLayout = useMediaQuery(theme.breakpoints.down('sm'))
  // Mode data PUBLIK (isu #44): live | demo | off — default off sampai API tersedia.
  const priceDataMode = PRICE_DATA_MODE
  const [liveObservation, setLiveObservation] = useState(null)
  const [commodity, setCommodity] = useState(COMMODITY_OPTIONS[0])
  const [volumeKg, setVolumeKg] = useState('500')
  const [persenA, setPersenA] = useState('72')
  const [persenB, setPersenB] = useState('18')
  const [includeReject, setIncludeReject] = useState(false)
  const [error, setError] = useState('')

  // State Finansial Petani (BPP & BEP)
  const [bppInput, setBppInput] = useState('7000')
  const [targetMargin, setTargetMargin] = useState('20')

  // State Sumber Data Pemerintah: 'sp2kp' | 'triangulasi'
  const [activeSource, setActiveSource] = useState('sp2kp')

  // State untuk Live Feed SP2KP Kemendag RI
  const [sp2kpPayload, setSp2kpPayload] = useState(null)
  const [comparisonPayload, setComparisonPayload] = useState(null)
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false)

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState('')

  useEffect(() => {
    // Mode LIVE membaca HANYA kontrak /api/v1/prices/* (panel terpisah) —
    // endpoint statis lama tidak dipanggil sama sekali (#44).
    if (priceDataMode === 'live') return undefined
    let isMounted = true
    async function loadFeeds() {
      try {
        const [sp2kpFeed, compFeed] = await Promise.allSettled([
          fetchSp2kpLive(4000),
          fetchGovernmentPriceComparison(4000),
        ])
        if (isMounted) {
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
    if (priceDataMode === 'live') return // sinkron legacy tidak berlaku di mode live
    setIsSyncing(true)
    setSyncStatusMsg('')
    try {
      if (activeSource === 'sp2kp') {
        const refreshed = await syncSp2kpPrices(6000)
        if (refreshed && refreshed.commodities) {
          setSp2kpPayload(refreshed)
          setSyncStatusMsg('Data acuan SP2KP berhasil dimuat ulang (baseline lokal).')
        }
      } else if (activeSource === 'triangulasi') {
        const [refreshedComp, refreshedSp2kp] = await Promise.allSettled([
          fetchGovernmentPriceComparison(6000),
          syncSp2kpPrices(6000),
        ])
        if (refreshedComp.status === 'fulfilled' && refreshedComp.value?.comparison) {
          setComparisonPayload(refreshedComp.value)
        }
        if (refreshedSp2kp.status === 'fulfilled' && refreshedSp2kp.value?.commodities) {
          setSp2kpPayload(refreshedSp2kp.value)
        }
        setSyncStatusMsg('Data acuan komposit berhasil dimuat ulang (baseline lokal).')
      }
    } catch (err) {
      setSyncStatusMsg(`Gagal menyinkronkan: ${err?.message || 'Server offline'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const effectiveComparison = comparisonPayload || DEFAULT_GOVERNMENT_COMPARISON
  const effectiveComparisonList = effectiveComparison?.comparison || []

  const isSp2kpActive = Boolean(sp2kpPayload && sp2kpPayload.commodities)
  const isTriangulasiActive = activeSource === 'triangulasi'

  const currentFeedPayload = sp2kpPayload
  const isFeedActive = isSp2kpActive
  const currentCommodities = currentFeedPayload?.commodities || {}

  // Resolusi harga acuan untuk komoditas terpilih (SP2KP / Triangulasi / Fallback Lokal)
  const bKey = normalizeToBapanasKey(commodity)
  const activeItem = isFeedActive ? currentCommodities[bKey] : null
  const triangulasiItem = effectiveComparisonList.find(
    (c) => c.commodity_key === bKey || c.commodity_name?.toLowerCase() === commodity.toLowerCase()
  )

  // Isu #44: di mode live, harga acuan WAJIB dari kontrak — angka statis lokal
  // tidak pernah dipakai sebagai nilai proyeksi (penyamaran demo = dilarang).
  const liveContractPrice = priceDataMode === 'live' ? (liveObservation?.price_value ?? null) : null
  const referencePrice = priceDataMode === 'live'
    ? liveContractPrice
    : isTriangulasiActive
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
          allowStaticFallback: priceDataMode !== 'live',
        }),
        validationError: '',
      }
    } catch (calculationError) {
      return { projection: null, validationError: calculationError.message }
    }
  }, [commodity, volumeKg, persenA, persenB, includeReject, referencePrice, priceDataMode])

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

  // Grid proyeksi dipakai bersama mode demo & live (isu #44)
  const projectionGrid = (
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
                    helperText={`Harga acuan: ${formatRupiah(referencePrice)} / kg${
                      priceDataMode === 'live'
                        ? liveObservation?.price_value != null
                          ? ' (kontrak SP2KP — historis)'
                          : ' (belum tersedia dari kontrak)'
                        : ' (acuan lokal demo)'
                    }`}
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
                      {isCompactLayout ? (
                        /* Mobile: rincian grade bertumpuk, tanpa scroll horizontal */
                        <Stack spacing={1.25}>
                          {[
                            { key: 'gradeA', color: 'success', label: 'Grade A', persen: projection.persentase.gradeA, berat: projection.beratKg.gradeA, nilai: formatRupiah(projection.nilai.gradeA) },
                            { key: 'gradeB', color: 'warning', label: 'Grade B', persen: projection.persentase.gradeB, berat: projection.beratKg.gradeB, nilai: formatRupiah(projection.nilai.gradeB) },
                            { key: 'reject', color: 'error', label: 'Reject', persen: projection.persentase.reject, berat: projection.beratKg.reject, nilai: includeReject ? formatRupiah(projection.nilai.reject) : 'Tidak dihitung' },
                          ].map((grade) => (
                            <Stack
                              key={grade.key}
                              direction="row"
                              spacing={1.5}
                              sx={{alignItems: 'center', justifyContent: 'space-between',  borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}
                            >
                              <Chip color={grade.color} label={grade.label} size="small" />
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body2">{formatNumber(grade.persen)}% • {formatNumber(grade.berat)} kg</Typography>
                                <Typography color="primary.dark" fontWeight={700} variant="body2">{grade.nilai}</Typography>
                              </Box>
                            </Stack>
                          ))}
                          <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{alignItems: 'center', justifyContent: 'space-between',  bgcolor: '#f7f9fa', borderRadius: 1.5, px: 1.5, py: 1 }}
                          >
                            <Typography fontWeight={700} variant="body2">Total volume</Typography>
                            <Typography fontWeight={700} variant="body2">
                              {formatNumber(projection.volumeKg)} kg • {formatRupiah(projection.totalNilai)}
                            </Typography>
                          </Stack>
                        </Stack>
                      ) : (
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
                      )}
                    </Stack>
                  ) : (
                    <Typography color="text.secondary" variant="body2">
                      Lengkapi form volume panen dan persentase grade untuk melihat proyeksi.
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* KARTU FINANSIAL PETANI: HPP, BEP, DAN LABA BERSIH (STEAM MATH & ENTREPRENEURSHIP) */}
              <FarmerFinanceCard
                error={error}
                farmerFinance={farmerFinance}
                bppInput={bppInput}
                onBppChange={(e) => setBppInput(e.target.value)}
                onTargetMarginChange={(e) => setTargetMargin(e.target.value)}
                targetMargin={targetMargin}
                targetPriceRec={targetPriceRec}
              />
            </Stack>
          </Grid>
        </Grid>

  )

  if (priceDataMode === 'off') {
    return (
      <Stack spacing={3}>
        <Alert severity="info" icon={<IntegrationInstructionsRoundedIcon />} sx={{ borderRadius: 2 }}>
          <Typography fontWeight={700} variant="body2">Integrasi harga resmi siap — belum diaktifkan di server ini.</Typography>
          <Typography variant="body2">
            Akses SP2KP sudah terkonfirmasi via dataset resmi data.go.id (impor XLSX harian,
            berlabel historis) dan importer siap di backend — tinggal flag
            <code> PRICE_SP2KP_ENABLED</code> + <code>PRICE_INGEST_ENABLED</code> yang masih OFF.
            Kalkulator di bawah memakai acuan lokal statis berlabel demo, bukan harga live.
          </Typography>
        </Alert>
        {projectionGrid}
      </Stack>
    )
  }

  if (priceDataMode === 'live') {
    return (
      <Stack spacing={3}>
        <Alert severity="success" icon={<VerifiedRoundedIcon />} sx={{ borderRadius: 2 }}>
          <Typography fontWeight={700} variant="body2">Harga resmi SP2KP Kemendag RI aktif.</Typography>
          <Typography variant="body2">
            Harga ditarik otomatis dari panel harga resmi SP2KP (data.go.id) dan diperbarui berkala.
            Yang tampil adalah harga historis terakhir yang dipublikasikan sumber — bukan realtime.
          </Typography>
        </Alert>
        <Card elevation={0} sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2 }}>
              <Box>
                <Typography fontWeight={800} variant="subtitle2">Sumber Data Acuan Harga Pasar</Typography>
                <Typography color="text.secondary" variant="caption">Kontrak harga resmi — Kota Payakumbuh 1376 (Pasar Ibuh)</Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <Select onChange={(event) => { setCommodity(event.target.value); setLiveObservation(null) }} value={commodity}>
                  {COMMODITY_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <LivePricePanel commodityName={commodity} onObservation={setLiveObservation} />
          </CardContent>
        </Card>
        {projectionGrid}
      </Stack>
    )
  }

  return (
    <Stack spacing={3}>
      {priceDataMode === 'demo' && (
        <Alert severity="warning" icon={<ScienceRoundedIcon />} sx={{ borderRadius: 2 }}>
          <Typography fontWeight={700} variant="body2">MODE DEMO — seluruh angka harga di halaman ini adalah acuan lokal statis.</Typography>
          <Typography variant="body2">Bukan harga live dan bukan data resmi lembaga; tidak diperbarui otomatis.</Typography>
        </Alert>
      )}
      {/* 1. Bar Pemilih Lembaga Resmi Negara & Tombol Triangulasi */}
      <Card elevation={0} sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
           sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: 'text.primary' }}>
                Sumber Data Acuan Harga Pasar
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Data acuan SP2KP Kemendag RI untuk Pasar Ibuh Payakumbuh
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }} useFlexGap>
              <Button
                size="small"
                variant={activeSource === 'sp2kp' ? 'contained' : 'outlined'}
                color={activeSource === 'sp2kp' ? 'success' : 'inherit'}
                onClick={() => {
                  setActiveSource('sp2kp')
                  setSyncStatusMsg('Sumber harga diubah ke SP2KP Kemendag RI.')
                }}
                startIcon={<StorefrontRoundedIcon fontSize="small" />}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  textTransform: 'none',
                  px: 1.5,
                  py: 0.75,
                }}
              >
                SP2KP Kemendag
              </Button>
              <Button
                size="small"
                variant={activeSource === 'triangulasi' ? 'contained' : 'outlined'}
                color={activeSource === 'triangulasi' ? 'primary' : 'inherit'}
                onClick={() => {
                  setActiveSource('triangulasi')
                  setSyncStatusMsg('Sumber harga diubah ke Triangulasi Komposit SP2KP + Acuan Lokal.')
                }}
                startIcon={<VerifiedRoundedIcon fontSize="small" />}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  textTransform: 'none',
                  px: 1.5,
                  py: 0.75,
                }}
              >
                Triangulasi Komposit
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="info"
                onClick={() => setIsComparisonModalOpen(true)}
                startIcon={<BalanceRoundedIcon fontSize="small" />}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  textTransform: 'none',
                  px: 1.5,
                  py: 0.75,
                  bgcolor: 'background.paper',
                }}
              >
                Tabel Komparasi
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* 2. Banner Status Lembaga yang Sedang Aktif */}
      {isTriangulasiActive ? (
        <Alert
          action={
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }} useFlexGap>
              {canSyncPrices && <Button
                color="inherit"
                disabled={isSyncing}
                onClick={handleSyncPrices}
                size="small"
                startIcon={isSyncing ? <CircularProgress color="inherit" size={16} /> : <SyncRoundedIcon />}
                sx={{ whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 700 }}
              >
                {isSyncing ? 'Sinkronisasi...' : 'Sinkronkan'}
              </Button>}
              <Button
                color="inherit"
                size="small"
                onClick={() => setIsComparisonModalOpen(true)}
                startIcon={<BalanceRoundedIcon />}
                sx={{ whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 700 }}
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
            Menggunakan Triangulasi Komposit (SP2KP Kemendag RI + Acuan Harga Lokal)
          </Typography>
          <Typography variant="body2">
            Harga Komposit Adil Pasar Ibuh Payakumbuh untuk <strong>{commodity}</strong>: <strong>{formatRupiah(referencePrice)} / kg</strong>
            {triangulasiItem?.convergence_index_percent ? ` &bull; Indeks Konvergensi: ${triangulasiItem.convergence_index_percent}%` : ''}
            {triangulasiItem?.disparity_rp !== undefined ? ` &bull; Selisih Harga: ${formatRupiah(triangulasiItem.disparity_rp)}` : ''}
          </Typography>
          {syncStatusMsg && (
            <Typography sx={{ fontStyle: 'italic', mt: 0.5 }} variant="caption">
              {syncStatusMsg}
            </Typography>
          )}
        </Alert>
      ) : isFeedActive ? (
        <Alert
          action={canSyncPrices ? <Button
              color="inherit"
              disabled={isSyncing}
              onClick={handleSyncPrices}
              size="small"
              startIcon={isSyncing ? <CircularProgress color="inherit" size={16} /> : <SyncRoundedIcon />}
            >
              {isSyncing ? 'Sinkronisasi...' : 'Sinkronkan'}
            </Button> : null}
          icon={<VerifiedRoundedIcon />}
          severity="success"
          sx={{ borderRadius: 2 }}
        >
          <Typography fontWeight={700} variant="body2">
            Data Acuan SP2KP Kemendag RI (Baseline Lokal Tersimpan)
          </Typography>
          <Typography variant="body2">
            Wilayah: {currentFeedPayload.region} ({currentFeedPayload.market_center}) &bull; Tanggal data: {currentFeedPayload.data_date} &bull; Belum terhubung API resmi SP2KP — menampilkan acuan tersimpan
          </Typography>
          {syncStatusMsg && (
            <Typography sx={{ fontStyle: 'italic', mt: 0.5 }} variant="caption">
              {syncStatusMsg}
            </Typography>
          )}
        </Alert>
      ) : (
        <Alert
          action={canSyncPrices ? <Button
              color="inherit"
              disabled={isSyncing}
              onClick={handleSyncPrices}
              size="small"
              startIcon={isSyncing ? <CircularProgress color="inherit" size={16} /> : <SyncRoundedIcon />}
            >
              Hubungkan Sumber
            </Button> : null}
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
              <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between',  mb: 1 }}>
                <Typography variant="h6">Harga referensi per komoditas</Typography>
                {isTriangulasiActive ? (
                  <Chip
                    color="primary"
                    icon={<VerifiedRoundedIcon />}
                    label="Triangulasi SP2KP + Acuan Lokal"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                ) : isFeedActive ? (
                  <Chip
                    color="success"
                    icon={<VerifiedRoundedIcon />}
                    label="SP2KP Kemendag RI"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                ) : (
                  <Chip color="warning" label="Simulasi Acuan Lokal" size="small" />
                )}
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                {isTriangulasiActive
                  ? `${effectiveComparison.market_center || 'Pasar Ibuh Payakumbuh'} — Harga Komposit SP2KP & Acuan Lokal`
                  : isFeedActive
                  ? `${currentFeedPayload.market_center || 'Pasar Ibuh Payakumbuh'} — Diperbarui per ${currentFeedPayload.data_date}`
                  : `Diperbarui: ${PRICE_REFERENCE_SOURCE.updatedAt}`}
              </Typography>
              {isCompactLayout ? (
                /* Mobile: daftar kartu pemilih harga, tanpa scroll horizontal */
                <Stack spacing={1}>
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
                        categorySub = `Lokal ${formatRupiah(tItem.bapanas_price_per_kg)} • SP2KP ${formatRupiah(tItem.sp2kp_kemendag_price_per_kg)}`
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

                    const isSelected = option === commodity
                    return (
                      <Box
                        key={option}
                        onClick={() => setCommodity(option)}
                        sx={{
                          bgcolor: isSelected ? 'rgba(1, 110, 68, 0.08)' : '#fafcfb',
                          border: '1px solid',
                          borderColor: isSelected ? 'primary.main' : '#e3e8e7',
                          borderRadius: 2,
                          cursor: 'pointer',
                          p: 1.5,
                        }}
                      >
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={isSelected ? 700 : 600} variant="body2">{option}</Typography>
                            {categorySub && (
                              <Typography color="text.secondary" noWrap sx={{ display: 'block' }} variant="caption">
                                {categorySub}
                              </Typography>
                            )}
                          </Box>
                          <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                            <Typography color="primary.dark" fontWeight={700} noWrap variant="body2">
                              {formatRupiah(price)} / kg
                            </Typography>
                            <Chip
                              color={changeRp > 0 ? 'success' : changeRp < 0 ? 'error' : isTriangulasiActive ? 'primary' : 'default'}
                              label={trendLabel}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                        </Stack>
                      </Box>
                    )
                  })}
                </Stack>
              ) : (
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
                          categorySub = `Lokal ${formatRupiah(tItem.bapanas_price_per_kg)} • SP2KP ${formatRupiah(tItem.sp2kp_kemendag_price_per_kg)}`
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
              )}
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
                isOfficialBapanas={isSp2kpActive}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {projectionGrid}

      {/* DIALOG TRIANGULASI HARGA ACUAN (SP2KP KEMENDAG VS ACUAN LOKAL) */}
      <TriangulasiComparisonModal
        commodity={commodity}
        effectiveComparisonList={effectiveComparisonList}
        isTriangulasiActive={isTriangulasiActive}
        onClose={() => setIsComparisonModalOpen(false)}
        onSelectTriangulationCommodity={handleSelectTriangulationCommodity}
        open={isComparisonModalOpen}
      />
    </Stack>
  )
}
