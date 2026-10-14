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
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import GrassRoundedIcon from '@mui/icons-material/GrassRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import { calculateHarvest, calculateHarvestValue } from './business/harvestCalculation.js'
import { readBatches, saveBatch } from './business/harvestStorage.js'
import { COMMODITY_OPTIONS, PRICE_REFERENCE_SOURCE, REFERENCE_PRICES_PER_KG } from './business/priceReference.js'
import { AppShell } from './components/AppShell.jsx'
import { HarvestForm } from './components/HarvestForm.jsx'
import { HarvestRecap } from './components/HarvestRecap.jsx'
import { QCResults } from './components/QCResults.jsx'
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
  { label: 'Sumber harga', value: 'Simulasi', detail: 'bukan data BAPANAS resmi', icon: TrendingUpRoundedIcon, color: '#b49262' },
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

function DashboardPreview() {
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
              <Button color="inherit" endIcon={<ArrowForwardRoundedIcon />} fullWidth onClick={() => {}} sx={{ bgcolor: 'common.white', color: 'primary.dark', mt: 2.5, maxWidth: { sm: 200 }, '&:hover': { bgcolor: '#e8f5ee' } }} variant="contained">
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
        {metrics.map((metric) => <Grid key={metric.label} size={{ xs: 12, sm: 4 }}><MetricCard {...metric} /></Grid>)}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box><Typography variant="h6">Harga acuan pasar</Typography><Typography color="text.secondary" variant="caption">Sumber: simulasi, diperbarui {PRICE_REFERENCE_SOURCE.updatedAt}</Typography></Box>
                <Chip color="warning" label="Simulasi" size="small" variant="outlined" />
              </Stack>
              <Stack spacing={1}>
                {COMMODITY_OPTIONS.map((commodity) => (
                  <Stack alignItems="center" direction="row" justifyContent="space-between" key={commodity} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1.25 }}>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}><Box sx={{ bgcolor: 'primary.light', borderRadius: '50%', height: 8, width: 8 }} /><Typography fontWeight={600} variant="body2">{commodity}</Typography></Stack>
                    <Stack alignItems="flex-end"><Typography fontWeight={700} variant="body2">{formatRupiah(REFERENCE_PRICES_PER_KG[commodity])}</Typography><Typography color="text.secondary" variant="caption">per kg</Typography></Stack>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1 }}><CameraAltRoundedIcon color="primary" fontSize="small" /><Typography variant="h6">Alur berikutnya</Typography></Stack>
              <Typography color="text.secondary" variant="body2">Masukkan data batch untuk melihat distribusi Grade A, B, dan Reject.</Typography>
              <Button endIcon={<ArrowForwardRoundedIcon />} fullWidth sx={{ mt: 2 }} variant="outlined">Buka QC Scanner</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}

function FoundationPage({ activePage, onHarvestConfirm, batches, selectedBatch, onBackToInput, onViewRecap }) {
  const page = pages[activePage]
  if (activePage === 'overview') return <DashboardPreview />
  if (activePage === 'scanner') return <HarvestForm onSave={onHarvestConfirm} />
  if (activePage === 'results') return <QCResults batch={selectedBatch} onBackToInput={onBackToInput} onViewRecap={onViewRecap} />
  if (activePage === 'results-list') return <HarvestRecap batches={batches} />
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
  }

  const handleBackToInput = () => {
    setHarvestMessage('')
    setActivePage('scanner')
  }

  const handleViewRecap = () => {
    setHarvestMessage('')
    setActivePage('results-list')
  }

  const handleHarvestConfirm = (input) => {
    const calculation = calculateHarvest(input)
    const valueCalculation = calculateHarvestValue({
      ...input,
      hargaAcuanPerKg: REFERENCE_PRICES_PER_KG[input.komoditas],
    })
    const savedBatch = saveBatch({
      ...input,
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
        totalNilai: valueCalculation.totalNilai,
      },
      dicatatPada: new Date().toISOString(),
    })
    setBatches((current) => [...current, savedBatch])
    setSelectedBatch(savedBatch)
    setHarvestMessage(`Batch ${savedBatch.id} berhasil disimpan ke rekap.`)
    setActivePage('results')
  }

  return (
    <AppShell activePage={activePage} onNavigate={handleNavigate}>
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2.5, sm: 3.5, md: 4.5 } }}>
        <PageHeader eyebrow="Agri-Sort AI / Precision Agriculture" title={page.title} description={page.description} />
        {harvestMessage && <Alert onClose={() => setHarvestMessage('')} severity="success" sx={{ mb: 2 }}>{harvestMessage}</Alert>}
        <FoundationPage activePage={activePage} batches={batches} onBackToInput={handleBackToInput} onHarvestConfirm={handleHarvestConfirm} onViewRecap={handleViewRecap} selectedBatch={selectedBatch} />
      </Container>
    </AppShell>
  )
}

export default App
