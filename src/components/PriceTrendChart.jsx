import { Box, Stack, Typography } from '@mui/material'
import { LineChart } from '@mui/x-charts/LineChart'

const rupiahFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/**
 * Grafik tren harga.
 *
 * Library: @mui/x-charts (Opsi A) — dipilih karena peerDependency-nya sudah cocok
 * dengan @mui/material@9 yang terpasang, sehingga tidak perlu menambah library grafik
 * terpisah. Hanya menerima titik data yang benar-benar ada; tidak membuat tren sendiri.
 */
export function PriceTrendChart({ history = [], commodity }) {
  if (history.length < 2) {
    return (
      <Box sx={{ alignItems: 'center', bgcolor: '#f7f9fa', borderRadius: 2, display: 'flex', justifyContent: 'center', minHeight: 260, px: 2 }}>
        <Typography color="text.secondary" textAlign="center" variant="body2">
          Belum ada data historis harga yang cukup untuk menggambar tren.
        </Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={1}>
      <LineChart
        height={260}
        series={[{
          color: '#036e45',
          curve: 'linear',
          data: history.map((point) => point.pricePerKg),
          label: 'Harga referensi (Rp/kg)',
          showMark: true,
          valueFormatter: (value) => `Rp${rupiahFormatter.format(value ?? 0)}`,
        }]}
        xAxis={[{ data: history.map((point) => point.label), scaleType: 'point', tickLabelStyle: { fontSize: 11 } }]}
        yAxis={[{ label: 'Rp/kg', width: 68, valueFormatter: (value) => rupiahFormatter.format(value) }]}
      />
      <Typography color="text.secondary" variant="caption">
        {history.length} titik data contoh untuk {commodity}. Bukan data BAPANAS resmi.
      </Typography>
    </Stack>
  )
}
