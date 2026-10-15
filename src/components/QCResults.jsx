import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import RecyclingRoundedIcon from '@mui/icons-material/RecyclingRounded'

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

function formatRupiah(value) {
  return typeof value === 'number' && Number.isFinite(value) ? rupiahFormatter.format(value) : 'Belum tersedia'
}

function QualityIndicator({ color, icon: Icon, label, percentage, weight }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        alignItems: 'center',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        flex: 1,
        minWidth: { xs: '100%', sm: 180 },
        p: 2,
      }}
    >
      <Box sx={{ alignItems: 'center', bgcolor: `${color}18`, borderRadius: 2, color, display: 'flex', height: 40, justifyContent: 'center', width: 40 }}>
        <Icon fontSize="small" />
      </Box>
      <Box>
        <Typography color="text.secondary" variant="body2">{label}</Typography>
        <Typography color={color} fontWeight={800} variant="h5">{formatNumber(percentage)}%</Typography>
        <Typography color="text.secondary" variant="caption">{formatNumber(weight)} kg</Typography>
      </Box>
    </Stack>
  )
}

function ActionRecommendation({ result }) {
  const rejectPercentage = result?.persenC
  const gradeAPercentage = result?.persenA

  if (typeof rejectPercentage === 'number' && rejectPercentage > 0) {
    return (
      <Alert icon={<RecyclingRoundedIcon />} severity="info">
        <Typography fontWeight={700} variant="body2">Pisahkan produk Reject sebelum pengiriman.</Typography>
        <Typography variant="body2">Sebanyak {formatNumber(rejectPercentage)}% ({formatNumber(result.beratC)} kg) dapat diarahkan untuk olahan atau pakan sesuai kondisi lapangan.</Typography>
      </Alert>
    )
  }

  if (typeof gradeAPercentage === 'number' && gradeAPercentage > 0) {
    return (
      <Alert icon={<LocalShippingRoundedIcon />} severity="info">
        <Typography fontWeight={700} variant="body2">Batch siap dipertimbangkan untuk pengiriman.</Typography>
        <Typography variant="body2">Grade A tercatat sebesar {formatNumber(gradeAPercentage)}% dari batch ini.</Typography>
      </Alert>
    )
  }

  return <Alert severity="info">Tinjau kembali komposisi mutu batch sebelum menentukan tujuan penjualan.</Alert>
}

export function QCResults({ batch, onBackToInput, onViewRecap }) {
  if (!batch?.hasil) {
    return (
      <Box sx={{ alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', px: 2 }}>
        <AssessmentRoundedIcon color="disabled" sx={{ fontSize: 56, mb: 2 }} />
        <Typography gutterBottom variant="h5">Belum ada hasil QC</Typography>
        <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 420 }} variant="body2">
          Simpan satu batch dari halaman input untuk melihat distribusi mutu dan estimasi nilainya.
        </Typography>
        <Button onClick={onBackToInput} startIcon={<ArrowBackRoundedIcon />} variant="outlined">
          Kembali ke input batch
        </Button>
      </Box>
    )
  }

  const { hasil } = batch

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Stack alignItems="center" direction="row" spacing={1}>
                <AssessmentRoundedIcon color="primary" />
                <Typography variant="h5">Hasil Analisis QC</Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
                Ringkasan hasil batch yang sudah dihitung dan disimpan.
              </Typography>
            </Box>
            <Chip color="success" label="Hasil tersimpan" size="small" />
          </Stack>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 4 }}><Typography color="text.secondary" variant="body2">ID batch</Typography><Typography fontWeight={700} variant="body1">{batch.id}</Typography></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><Typography color="text.secondary" variant="body2">Tanggal</Typography><Typography fontWeight={700} variant="body1">{batch.tanggal}</Typography></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><Typography color="text.secondary" variant="body2">Komoditas</Typography><Typography fontWeight={700} variant="body1">{batch.komoditas}</Typography></Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box><Typography variant="h6">Distribusi kualitas</Typography><Typography color="text.secondary" variant="body2">Berat total: {formatNumber(batch.beratKg)} kg</Typography></Box>
                <Inventory2RoundedIcon color="primary" />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <QualityIndicator color="#289d67" icon={AssessmentRoundedIcon} label="Grade A" percentage={hasil.persenA} weight={hasil.beratA} />
                <QualityIndicator color="#c68f2f" icon={AssessmentRoundedIcon} label="Grade B" percentage={hasil.persenB} weight={hasil.beratB} />
                <QualityIndicator color="#a94f46" icon={RecyclingRoundedIcon} label="Reject" percentage={hasil.persenC} weight={hasil.beratC} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography color="text.secondary" variant="body2">Estimasi nilai panen</Typography>
              <Typography color="primary.dark" sx={{ mt: 1 }} variant="h4">{formatRupiah(hasil.totalNilai)}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">Nilai disimpan sebagai arsip hasil batch.</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography gutterBottom variant="h6">Rekomendasi tindakan</Typography>
          <ActionRecommendation result={hasil} />
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Button fullWidth onClick={onBackToInput} startIcon={<ArrowBackRoundedIcon />} variant="outlined" sx={{ maxWidth: { sm: 220 } }}>Kembali ke input</Button>
        <Button fullWidth onClick={onViewRecap} variant="outlined" sx={{ maxWidth: { sm: 220 } }}>Lihat semua rekap</Button>
      </Stack>
    </Stack>
  )
}
