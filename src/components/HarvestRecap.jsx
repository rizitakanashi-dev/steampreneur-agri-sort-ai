import { useMemo, useState } from 'react'
import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
  Button,
} from '@mui/material'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'

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

  const sortedBatches = useMemo(() => [...batches].sort((a, b) => {
    const dateDifference = String(b.tanggal).localeCompare(String(a.tanggal))
    return dateDifference || String(b.dicatatPada || '').localeCompare(String(a.dicatatPada || ''))
  }), [batches])
  const visibleBatches = sortedBatches.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  if (batches.length === 0) {
    return (
      <Paper sx={{ border: '1px solid', borderColor: 'divider', p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
        <Typography color="text.secondary" variant="body2">Belum ada data panen tersimpan.</Typography>
      </Paper>
    )
  }

  return (
    <>
      <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
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
        />
      </TableContainer>

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
