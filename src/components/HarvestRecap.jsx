import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import { EMPTY_RECAP_FILTER, filterBatches, isFilterEmpty, listCommodities, sortBatchesByNewest } from '../business/harvestFilter.js'
import { downloadCsv } from '../utils/csvExporter.js'

/** Jumlah kolom tabel; dipakai untuk colSpan pada baris empty state. */
const COLUMN_COUNT = 6

const rupiahFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

function formatRupiah(value) {
  return typeof value === 'number' && Number.isFinite(value) ? rupiahFormatter.format(value) : 'Belum tersedia'
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

function GradeChip({ label, value, color }) {
  return <Chip color={color} label={`${label} ${formatNumber(value)}%`} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
}

export function HarvestRecap({ batches = [] }) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(5)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [filter, setFilter] = useState(EMPTY_RECAP_FILTER)
  const [exportStatus, setExportStatus] = useState('')

  const commodities = useMemo(() => listCommodities(batches), [batches])
  const sortedBatches = useMemo(() => sortBatchesByNewest(filterBatches(batches, filter)), [batches, filter])
  const visibleBatches = sortedBatches.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  const filterActive = !isFilterEmpty(filter)

  const handleFilterChange = (field) => (event) => {
    setFilter((current) => ({ ...current, [field]: event.target.value }))
    setPage(0)
  }

  const handleResetFilter = () => {
    setFilter(EMPTY_RECAP_FILTER)
    setPage(0)
  }

  const handleExport = () => {
    downloadCsv(sortedBatches)
    setExportStatus(`${sortedBatches.length} baris yang tampil berhasil diunduh sebagai CSV.`)
  }

  if (batches.length === 0) {
    return (
      <Paper sx={{ border: '1px solid', borderColor: 'divider', p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
        <Typography color="text.secondary" variant="body2">Belum ada data panen tersimpan.</Typography>
      </Paper>
    )
  }

  return (
    <>
      <Paper sx={{ border: '1px solid', borderColor: 'divider', mb: 2, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              label="Cari ID batch atau komoditas"
              onChange={handleFilterChange('search')}
              size="small"
              value={filter.search}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="recap-commodity-label">Komoditas</InputLabel>
              <Select
                displayEmpty
                label="Komoditas"
                labelId="recap-commodity-label"
                onChange={handleFilterChange('komoditas')}
                value={filter.komoditas}
              >
                <MenuItem value="">Semua komoditas</MenuItem>
                {commodities.map((commodity) => <MenuItem key={commodity} value={commodity}>{commodity}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 1.75 }}>
            <TextField
              fullWidth
              InputLabelProps={{ shrink: true }}
              label="Dari"
              onChange={handleFilterChange('tanggalDari')}
              size="small"
              type="date"
              value={filter.tanggalDari}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 1.75 }}>
            <TextField
              fullWidth
              InputLabelProps={{ shrink: true }}
              label="Sampai"
              onChange={handleFilterChange('tanggalSampai')}
              size="small"
              type="date"
              value={filter.tanggalSampai}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 12, md: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: 'center', height: '100%' }}>
              <Tooltip title="Reset filter">
                <span>
                  <IconButton aria-label="Reset filter" disabled={!filterActive} onClick={handleResetFilter}>
                    <FilterAltOffRoundedIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Button
                disabled={sortedBatches.length === 0}
                fullWidth
                onClick={handleExport}
                startIcon={<DownloadRoundedIcon />}
                variant="outlined"
                sx={{ maxWidth: { sm: 200 } }}
              >
                Ekspor CSV
              </Button>
            </Stack>
          </Grid>
        </Grid>
        {exportStatus && (
          <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="caption">{exportStatus}</Typography>
        )}
      </Paper>

      <Paper sx={{ border: '1px solid', borderColor: 'divider' }}>
        <TableContainer sx={{ overflowX: 'auto' }}>
        <Table aria-label="Rekap data panen" size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f2f4f6' }}>
              <TableCell>ID / Tanggal</TableCell>
              <TableCell>Komoditas</TableCell>
              <TableCell align="right">Berat total</TableCell>
              <TableCell>Distribusi grade</TableCell>
              <TableCell align="right">Nilai estimasi</TableCell>
              <TableCell align="center">Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleBatches.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Typography align="center" color="text.secondary" sx={{ py: 3 }} variant="body2">
                    Data tidak ditemukan
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleBatches.map((batch) => {
              const result = batch.hasil || {}
              return (
                <TableRow hover key={batch.id}>
                  <TableCell>
                    <Typography fontWeight={700} variant="body2">{batch.id}</Typography>
                    <Typography color="text.secondary" variant="caption">{batch.tanggal}</Typography>
                  </TableCell>
                  <TableCell>{batch.komoditas}</TableCell>
                  <TableCell align="right">{formatNumber(batch.beratKg)} kg</TableCell>
                  <TableCell>
                    <GradeChip color="success" label="A" value={result.persenA} />
                    <GradeChip color="warning" label="B" value={result.persenB} />
                    <GradeChip color="error" label="Reject" value={result.persenC} />
                  </TableCell>
                  <TableCell align="right">{formatRupiah(result.totalNilai)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Lihat detail">
                      <IconButton aria-label={`Lihat detail ${batch.id}`} onClick={() => setSelectedBatch(batch)} size="small">
                        <VisibilityRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={sortedBatches.length}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
          labelRowsPerPage="Baris per halaman:"
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0) }}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
          sx={{ borderBottom: 'none' }}
        />
      </Paper>
      <Dialog fullWidth maxWidth="sm" onClose={() => setSelectedBatch(null)} open={Boolean(selectedBatch)}>
        <DialogTitle>Detail batch panen</DialogTitle>
        <DialogContent dividers>
          {selectedBatch && (
            <Stack spacing={1.25}>
              <Typography variant="body2"><strong>ID batch:</strong> {selectedBatch.id}</Typography>
              <Typography variant="body2"><strong>Tanggal:</strong> {selectedBatch.tanggal}</Typography>
              <Typography variant="body2"><strong>Komoditas:</strong> {selectedBatch.komoditas}</Typography>
              <Typography variant="body2"><strong>Berat total:</strong> {formatNumber(selectedBatch.beratKg)} kg</Typography>
              <Typography variant="body2"><strong>Kesegaran:</strong> {formatNumber(selectedBatch.kesegaranPersen)}%</Typography>
              <Typography variant="body2"><strong>Ukuran:</strong> {selectedBatch.ukuran}</Typography>
              <Typography variant="body2"><strong>Cacat:</strong> {formatNumber(selectedBatch.cacatPersen)}%</Typography>
              <Box><Typography sx={{ mb: 0.5 }} variant="body2"><strong>Distribusi mutu:</strong></Typography><GradeChip color="success" label="Grade A" value={selectedBatch.hasil?.persenA} /><GradeChip color="warning" label="Grade B" value={selectedBatch.hasil?.persenB} /><GradeChip color="error" label="Reject" value={selectedBatch.hasil?.persenC} /></Box>
              <Typography variant="body2"><strong>Nilai estimasi:</strong> {formatRupiah(selectedBatch.hasil?.totalNilai)}</Typography>
              <Typography color="text.secondary" variant="body2"><strong>Catatan:</strong> {selectedBatch.catatan || '-'}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelectedBatch(null)}>Tutup</Button></DialogActions>
      </Dialog>
    </>
  )
}
