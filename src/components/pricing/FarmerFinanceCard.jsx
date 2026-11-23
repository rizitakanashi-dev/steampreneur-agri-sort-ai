import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import { formatNumber, formatRupiah } from './formatters.js'

/**
 * Kartu finansial petani: HPP, titik impas (BEP), dan laba bersih.
 * Diekstrak dari PricingDashboard — state BPP & margin tetap dimiliki parent,
 * komponen ini murni presentasional (menerima props).
 */
export function FarmerFinanceCard({
  farmerFinance,
  targetPriceRec,
  targetMargin,
  bppInput,
  onBppChange,
  onTargetMarginChange,
  error,
}) {
  return (
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
            sx={{ fontWeight: 700, fontSize: '0.75rem' }}
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
              onChange={onBppChange}
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
              onChange={onTargetMarginChange}
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
  )
}

export default FarmerFinanceCard
