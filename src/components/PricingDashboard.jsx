import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
  Typography,
} from '@mui/material'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { calculateMinimumPrice, parseNumeric } from '../business/harvestCalculation.js'
import { calculateRevenueProjection, calculateWeightedPricePerKg } from '../business/harvestProjection.js'
import { COMMODITY_OPTIONS, PRICE_HISTORY, PRICE_REFERENCE_SOURCE, REFERENCE_PRICES_PER_KG, getReferencePricePerKg } from '../business/priceReference.js'
import { PriceTrendChart } from './PriceTrendChart.jsx'

const rupiahFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

function formatRupiah(value) {
  return typeof value === 'number' && Number.isFinite(value) ? rupiahFormatter.format(value) : '-'
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

export function PricingDashboard() {
  const [commodity, setCommodity] = useState(COMMODITY_OPTIONS[0])
  const [volumeKg, setVolumeKg] = useState('500')
  const [persenA, setPersenA] = useState('72')
  const [persenB, setPersenB] = useState('18')
  const [includeReject, setIncludeReject] = useState(false)
  const [error, setError] = useState('')

  const history = PRICE_HISTORY[commodity] || []
  const referencePrice = getReferencePricePerKg(commodity)

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
  const bppInput = 15000

  return (
    <Stack spacing={3}>
      <Alert icon={<InfoOutlinedIcon />} severity="info">
        <Typography fontWeight={700} variant="body2">Data harga bersifat simulasi.</Typography>
        <Typography variant="body2">
          Sumber: {PRICE_REFERENCE_SOURCE.label}. Terakhir diperbarui {PRICE_REFERENCE_SOURCE.updatedAt}. {PRICE_REFERENCE_SOURCE.note}
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack alignItems="center" direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Harga referensi per komoditas</Typography>
                <Chip color="warning" label="Simulasi" size="small" />
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                Diperbarui: {PRICE_REFERENCE_SOURCE.updatedAt}
              </Typography>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 360 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f2f4f6' }}>
                      <TableCell>Komoditas</TableCell>
                      <TableCell align="right">Harga acuan Grade A</TableCell>
                      <TableCell align="right">Titik tren</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {COMMODITY_OPTIONS.map((option) => (
                      <TableRow hover key={option} selected={option === commodity}>
                        <TableCell>{option}</TableCell>
                        <TableCell align="right">{formatRupiah(REFERENCE_PRICES_PER_KG[option])} / kg</TableCell>
                        <TableCell align="right">{(PRICE_HISTORY[option] || []).length}</TableCell>
                      </TableRow>
                    ))}
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
              <PriceTrendChart commodity={commodity} history={history} />
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
                  InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
                  inputMode="decimal"
                  label="Volume panen"
                  onChange={(event) => setVolumeKg(event.target.value)}
                  size="small"
                  value={volumeKg}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    fullWidth
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    inputMode="decimal"
                    label="Grade A"
                    onChange={(event) => setPersenA(event.target.value)}
                    size="small"
                    value={persenA}
                  />
                  <TextField
                    fullWidth
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
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
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
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

            <Card>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography gutterBottom variant="h6">BPP dan harga minimum</Typography>
                <Typography color="text.secondary" variant="body2">
                  BPP contoh Rp{numberFormatter.format(bppInput)} / kg. Harga minimum hanya dapat dihitung setelah tim
                  menetapkan kebijakan margin atau markup di spesifikasi.
                </Typography>
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Kebijakan margin/markup belum disetujui, sehingga rekomendasi harga minimum tidak ditampilkan.
                </Alert>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
                  {[{ type: 'markup', percent: 20 }, { type: 'margin', percent: 20 }].map((policy) => (
                    <Button
                      key={policy.type}
                      fullWidth
                      onClick={() => {
                        try {
                          setError(`Contoh ${policy.type} 20%: harga minimum ${formatRupiah(calculateMinimumPrice({ bppPerKg: bppInput, policy }))} / kg`)
                        } catch (calculationError) {
                          setError(calculationError.message)
                        }
                      }}
                      variant="outlined"
                    >
                      Coba {policy.type} 20%
                    </Button>
                  ))}
                </Stack>
                {error && <Alert severity="info" sx={{ mt: 2 }}>{error}</Alert>}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  )
}
