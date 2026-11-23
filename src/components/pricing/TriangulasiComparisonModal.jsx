import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Alert,
} from '@mui/material'
import BalanceRoundedIcon from '@mui/icons-material/BalanceRounded'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { COMMODITY_OPTIONS } from '../../business/priceReference.js'
import { mapComparisonKeyToCommodity } from './governmentComparisonData.js'
import { formatRupiah } from './formatters.js'

/**
 * Dialog triangulasi harga resmi pemerintah (BAPANAS vs SP2KP Kemendag).
 * Diekstrak dari PricingDashboard — state modal tetap dimiliki parent.
 */
export function TriangulasiComparisonModal({
  open,
  onClose,
  effectiveComparisonList,
  commodity,
  isTriangulasiActive,
  onSelectTriangulationCommodity,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        <IconButton aria-label="Tutup modal perbandingan harga" onClick={onClose} size="small">
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
                    onClick={() => onSelectTriangulationCommodity(row)}
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
                          <Chip size="small" label="Aktif" color="success" sx={{ height: 22, fontSize: '0.75rem', fontWeight: 800 }} />
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
                        sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22 }}
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
                            onSelectTriangulationCommodity(row)
                          }}
                          sx={{ textTransform: 'none', py: 0.25, px: 1.25, fontSize: '0.75rem', fontWeight: 700, borderRadius: 1.5 }}
                        >
                          {isCurrentCommodity ? 'Sedang Aktif' : 'Gunakan'}
                        </Button>
                      ) : (
                        <Tooltip title="Data acuan pasar Kemendag RI">
                          <Chip label="Referensi" size="small" variant="outlined" sx={{ fontSize: '0.75rem', height: 22 }} />
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
        <Button onClick={onClose} variant="contained" color="primary">
          Tutup
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default TriangulasiComparisonModal
