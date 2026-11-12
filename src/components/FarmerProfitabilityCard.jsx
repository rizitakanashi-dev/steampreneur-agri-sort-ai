import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded'
import ScaleRoundedIcon from '@mui/icons-material/ScaleRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import { calculateFarmerProfitability } from '../business/farmerFinance.js'

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

function formatRupiah(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Rp 0'
  return rupiahFormatter.format(value).replace(/^Rp\s*/, 'Rp ')
}

function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0'
  return numberFormatter.format(value)
}

function getDefaultBppForCommodity(commodity = '') {
  const c = commodity.toLowerCase()
  if (c.includes('cabai') || c.includes('chili') || c.includes('cabe')) {
    return 20000
  }
  if (c.includes('tomat')) {
    return 4500
  }
  return 3500 // Default terung
}

export function FarmerProfitabilityCard({
  revenue = 0,
  sellableVolumeKg = 0,
  totalVolumeKg = 0,
  commodity = 'Terung',
}) {
  const defaultBpp = getDefaultBppForCommodity(commodity)
  const [costMode, setCostMode] = useState('perKg') // 'perKg' | 'total'
  const [bppInput, setBppInput] = useState(String(defaultBpp))
  const [totalCostInput, setTotalCostInput] = useState(
    String(Math.round(defaultBpp * (sellableVolumeKg || 10)))
  )

  const effectiveSellableVolume = sellableVolumeKg > 0 ? sellableVolumeKg : (totalVolumeKg || 0)

  const finance = useMemo(() => {
    return calculateFarmerProfitability({
      revenue,
      sellableVolumeKg: effectiveSellableVolume,
      costMode,
      bppPerKg: bppInput,
      totalCost: totalCostInput,
    })
  }, [revenue, effectiveSellableVolume, costMode, bppInput, totalCostInput])

  const isProfitable = finance.isProfitable
  const isLoss = finance.netProfit < 0

  return (
    <Card elevation={2} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Header Modul STEAM Math */}
        <Stack
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={1.5}
          sx={{ mb: 2.5 }}
        >
          <Stack alignItems="center" direction="row" spacing={1.5}>
            <Box
              sx={{
                alignItems: 'center',
                bgcolor: 'primary.50',
                borderRadius: 2,
                color: 'primary.main',
                display: 'flex',
                height: 42,
                justifyContent: 'center',
                width: 42,
                border: '1px solid rgba(3, 110, 69, 0.15)',
              }}
            >
              <CalculateRoundedIcon fontSize="medium" />
            </Box>
            <Box>
              <Stack alignItems="center" direction="row" spacing={1}>
                <Typography fontWeight={800} variant="h6">
                  Kalkulator Kelayakan Finansial & BEP Petani
                </Typography>
                <Chip
                  color="success"
                  label="STEAM: Math & Business"
                  size="small"
                  sx={{ fontWeight: 700, height: 22, fontSize: '0.7rem' }}
                />
              </Stack>
              <Typography color="text.secondary" variant="caption">
                Pilar Matematika Terapan & Kewirausahaan: Analisis Titik Impas (BEP), Laba Bersih, dan ROI Panen
              </Typography>
            </Box>
          </Stack>

          {/* Toggle Mode Biaya */}
          <ToggleButtonGroup
            aria-label="Mode Input Biaya Budidaya"
            exclusive
            onChange={(e, nextVal) => {
              if (nextVal) setCostMode(nextVal)
            }}
            size="small"
            value={costMode}
          >
            <ToggleButton sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }} value="perKg">
              BPP per Kg (Rp/kg)
            </ToggleButton>
            <ToggleButton sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }} value="total">
              Total Modal (Rp)
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {/* Input Parameter Biaya Modal */}
        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2.5, border: '1px solid #e2e8f0', mb: 2.5 }}>
          <Grid container alignItems="center" spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 5 }}>
              {costMode === 'perKg' ? (
                <TextField
                  fullWidth
                  label="Biaya Pokok Produksi (BPP) per Kg"
                  onChange={(e) => setBppInput(e.target.value)}
                  placeholder="Contoh: 3500"
                  size="small"
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                      endAdornment: <InputAdornment position="end">/ kg</InputAdornment>,
                    },
                  }}
                  type="number"
                  value={bppInput}
                />
              ) : (
                <TextField
                  fullWidth
                  label="Total Biaya Modal Budidaya / Panen"
                  onChange={(e) => setTotalCostInput(e.target.value)}
                  placeholder="Contoh: 150000"
                  size="small"
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                    },
                  }}
                  type="number"
                  value={totalCostInput}
                />
              )}
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 7 }}>
              <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Preset Standar Petani:
                </Typography>
                <Chip
                  clickable
                  label="Efisiensi Rendah (-15%)"
                  onClick={() => {
                    const val = Math.round(defaultBpp * 0.85)
                    setBppInput(String(val))
                    setTotalCostInput(String(Math.round(val * effectiveSellableVolume)))
                  }}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  clickable
                  color="primary"
                  label={`Standar ${commodity}`}
                  onClick={() => {
                    setBppInput(String(defaultBpp))
                    setTotalCostInput(String(Math.round(defaultBpp * effectiveSellableVolume)))
                  }}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  clickable
                  label="Biaya Intensif (+25%)"
                  onClick={() => {
                    const val = Math.round(defaultBpp * 1.25)
                    setBppInput(String(val))
                    setTotalCostInput(String(Math.round(val * effectiveSellableVolume)))
                  }}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Grid>
          </Grid>
        </Box>

        {/* Kartu Ringkasan Finansial Utama */}
        <Grid container spacing={2}>
          {/* 1. Laba Bersih */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: isLoss ? '#fef2f2' : isProfitable ? '#f0fdf4' : '#f8fafc',
                border: '1px solid',
                borderColor: isLoss ? '#fecaca' : isProfitable ? '#bbf7d0' : '#e2e8f0',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary" variant="caption" fontWeight={600}>
                  PROYEKSI LABA BERSIH
                </Typography>
                {isLoss ? (
                  <TrendingDownRoundedIcon color="error" fontSize="small" />
                ) : (
                  <TrendingUpRoundedIcon color="success" fontSize="small" />
                )}
              </Stack>
              <Box sx={{ my: 1 }}>
                <Typography
                  fontWeight={800}
                  variant="h5"
                  sx={{ color: isLoss ? 'error.main' : isProfitable ? 'success.main' : 'text.primary' }}
                >
                  {isLoss ? '-' : '+'}
                  {formatRupiah(Math.abs(finance.netProfit))}
                </Typography>
              </Box>
              <Chip
                color={isLoss ? 'error' : isProfitable ? 'success' : 'default'}
                label={isLoss ? '⚠️ Risiko Defisit' : isProfitable ? '✅ Laba Menguntungkan' : 'Titik Impas (BEP)'}
                size="small"
                sx={{ fontWeight: 700, fontSize: '0.72rem', alignSelf: 'flex-start' }}
              />
            </Box>
          </Grid>

          {/* 2. ROI & Margin */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Typography color="text.secondary" variant="caption" fontWeight={600}>
                RENTABILITAS MODAL (ROI)
              </Typography>
              <Box sx={{ my: 1 }}>
                <Typography fontWeight={800} variant="h5" color={finance.roiPercent >= 0 ? '#15803d' : '#b91c1c'}>
                  {finance.roiPercent >= 0 ? `+${finance.roiPercent}%` : `${finance.roiPercent}%`}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Margin Laba: <strong>{finance.profitMarginPercent}%</strong> dari omzet jual
              </Typography>
            </Box>
          </Grid>

          {/* 3. BEP Harga */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary" variant="caption" fontWeight={600}>
                  TITIK IMPAS HARGA (BEP)
                </Typography>
                <ScaleRoundedIcon color="action" fontSize="small" />
              </Stack>
              <Box sx={{ my: 1 }}>
                <Typography fontWeight={800} variant="h5">
                  {formatRupiah(finance.bepPricePerKg)}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Harga rata-rata aktual: <strong>{formatRupiah(finance.actualAvgPricePerKg)}/kg</strong>
              </Typography>
            </Box>
          </Grid>

          {/* 4. BEP Volume */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary" variant="caption" fontWeight={600}>
                  VOLUME MINIMAL IMPAS
                </Typography>
                <MonetizationOnRoundedIcon color="action" fontSize="small" />
              </Stack>
              <Box sx={{ my: 1 }}>
                <Typography fontWeight={800} variant="h5">
                  {formatNumber(finance.bepVolumeKg)} kg
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Dari total <strong>{formatNumber(effectiveSellableVolume)} kg</strong> panen layak jual
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Edukasi Kewirausahaan: Nilai Tambah Sortir AI */}
        <Box sx={{ mt: 2.5, p: 2, bgcolor: 'rgba(3, 110, 69, 0.04)', borderRadius: 2, border: '1px solid rgba(3, 110, 69, 0.12)' }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <CheckCircleRoundedIcon color="primary" sx={{ mt: 0.25, fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                💡 Keunggulan Finansial Sortir Mutu AI (Pencegah Tengkulak Flat-Rate):
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Dengan pemisahan Grade A dan Grade B terverifikasi, petani berhak menuntut premi harga pasar modern untuk Grade A dan tidak lagi dipaksa menerima harga borongan rata bawah (*as-is pricing*). Risiko kerugian afkir dapat dicegah sebelum barang dikirim.
              </Typography>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  )
}

