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
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded'
import PrintRoundedIcon from '@mui/icons-material/PrintRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { EMPTY_RECAP_FILTER, calculateBatchTotals, filterBatches, isFilterEmpty, listCommodities, sortBatchesByNewest } from '../business/harvestFilter.js'
import { downloadCsv } from '../utils/csvExporter.js'
import { deleteBatch } from '../business/harvestStorage.js'

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
  if (value === undefined || value === null || !Number.isFinite(Number(value))) {
    return null
  }
  return <Chip color={color} label={`${label} ${formatNumber(value)}%`} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
}

function getBatchEstimatedValue(batch) {
  if (!batch) return null
  return (
    batch.pricing?.estimated_economic_value ??
    batch.scanResult?.smart_pricing?.estimated_economic_value ??
    batch.hasil?.totalNilai ??
    null
  )
}

function BatchGradeDistribution({ batch }) {
  const commodity = batch?.komoditas || ''
  const isEggplant =
    commodity.toLowerCase().includes('terung') ||
    commodity.toLowerCase().includes('terong') ||
    batch?.inference?.commodity === 'terung'

  const hasInference = Boolean(batch?.inference || batch?.ai_scan_performed)

  const ratios =
    batch?.inference?.condition_ratios ||
    batch?.pricing?.condition_ratios ||
    batch?.scanResult?.smart_pricing?.condition_ratios ||
    batch?.scanResult?.inference_result?.condition_ratios ||
    {}

  // 1. Cek apakah Terung 3-Grade (Model v2: Grade A, Grade B, Reject)
  const isDirect3Grade =
    isEggplant &&
    (ratios.grade_a_percent !== undefined ||
      ratios.grade_b_percent !== undefined ||
      batch?.inference?.object_counts?.grade_a !== undefined) &&
    ratios.class_1_percent === undefined &&
    batch?.inference?.object_counts?.class_1 === undefined

  if (isDirect3Grade) {
    const valA = ratios.grade_a_percent ?? batch?.hasil?.persenA
    const valB = ratios.grade_b_percent ?? batch?.hasil?.persenB
    const valRej = ratios.reject_percent ?? ratios.reject_ratio_percent ?? batch?.hasil?.persenC

    return (
      <Stack direction="row" flexWrap="wrap">
        <GradeChip color="success" label="Grade A" value={valA} />
        <GradeChip color="warning" label="Grade B" value={valB} />
        <GradeChip color="error" label="Reject" value={valRej} />
      </Stack>
    )
  }

  // 2. Cek apakah Terung 4-Class (Model v1: Extra, Class 1, Class 2, Reject)
  const has4Class =
    isEggplant &&
    (ratios.extra_class_percent !== undefined ||
      ratios.extra_class_ratio_percent !== undefined ||
      ratios.class_1_percent !== undefined ||
      ratios.class_1_ratio_percent !== undefined ||
      batch?.pricing?.tier_breakdown?.extra_class !== undefined)

  if (has4Class) {
    const valExtra = ratios.extra_class_percent ?? ratios.extra_class_ratio_percent
    const valC1 = ratios.class_1_percent ?? ratios.class_1_ratio_percent
    const valC2 = ratios.class_2_percent ?? ratios.class_2_ratio_percent
    const valRej = ratios.reject_percent ?? ratios.reject_ratio_percent

    return (
      <Stack direction="row" flexWrap="wrap">
        <GradeChip color="success" label="Extra" value={valExtra} />
        <GradeChip color="info" label="Class 1" value={valC1} />
        <GradeChip color="warning" label="Class 2" value={valC2} />
        <GradeChip color="error" label="Reject" value={valRej} />
      </Stack>
    )
  }

  // 3. Tomat 2-Class (Segar vs Busuk)
  if (hasInference && (ratios.fresh_ratio_percent !== undefined || ratios.fresh_percent !== undefined)) {
    const valFresh = ratios.fresh_ratio_percent ?? ratios.fresh_percent
    const valRotten = ratios.rotten_ratio_percent ?? ratios.rotten_percent
    return (
      <Stack direction="row" flexWrap="wrap">
        <GradeChip color="success" label="Segar" value={valFresh} />
        <GradeChip color="error" label="Busuk" value={valRotten} />
      </Stack>
    )
  }

  // 4. Fallback ke batch.hasil (Grade A, Grade B, Reject)
  const result = batch?.hasil || {}
  if (result.persenA !== undefined || result.persenB !== undefined || result.persenC !== undefined) {
    return (
      <Stack direction="row" flexWrap="wrap">
        <GradeChip color="success" label="A" value={result.persenA} />
        <GradeChip color="warning" label="B" value={result.persenB} />
        <GradeChip color="error" label="Reject" value={result.persenC} />
      </Stack>
    )
  }

  return <Typography color="text.secondary" variant="caption">-</Typography>
}

export function HarvestRecap({ batches = [], onSelectBatch, onDeleteBatch }) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(5)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [batchToDelete, setBatchToDelete] = useState(null)
  const [filter, setFilter] = useState(EMPTY_RECAP_FILTER)
  const [exportStatus, setExportStatus] = useState('')

  const commodities = useMemo(() => listCommodities(batches), [batches])
  const sortedBatches = useMemo(() => sortBatchesByNewest(filterBatches(batches, filter)), [batches, filter])
  const visibleBatches = sortedBatches.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  const totals = calculateBatchTotals(visibleBatches)
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
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              label="Cari ID batch atau komoditas"
              onChange={handleFilterChange('search')}
              size="small"
              value={filter.search}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="recap-commodity-label" shrink>Komoditas</InputLabel>
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
              slotProps={{ inputLabel: { shrink: true } }}
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
              slotProps={{ inputLabel: { shrink: true } }}
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
              const estValue = getBatchEstimatedValue(batch)
              const execStatus =
                batch.execution_status ||
                batch.scanResult?.execution_status ||
                (batch.is_simulated || batch.scanResult?.is_simulated
                  ? 'simulated'
                  : (batch.ai_scan_performed ? 'ai_detected' : null))

              return (
                <TableRow hover key={batch.id}>
                  <TableCell>
                    <Stack alignItems="center" direction="row" spacing={0.75}>
                      <Typography fontWeight={700} variant="body2">{batch.id}</Typography>
                      {execStatus === 'ai_detected' && (
                        <Tooltip title="Dianalisis menggunakan AI Computer Vision (Optimal)">
                          <Chip
                            color="success"
                            icon={<AutoAwesomeRoundedIcon style={{ fontSize: 13 }} />}
                            label="AI"
                            size="small"
                            sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                          />
                        </Tooltip>
                      )}
                      {execStatus === 'needs_review' && (
                        <Tooltip title="Hasil AI Memerlukan Verifikasi Manual">
                          <Chip
                            color="warning"
                            icon={<WarningAmberRoundedIcon style={{ fontSize: 13 }} />}
                            label="Review"
                            size="small"
                            sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                          />
                        </Tooltip>
                      )}
                      {execStatus === 'simulated' && (
                        <Tooltip title="Data Pengujian Simulasi (Non-AI)">
                          <Chip
                            color="info"
                            label="Simulasi"
                            size="small"
                            sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                          />
                        </Tooltip>
                      )}
                    </Stack>
                    <Typography color="text.secondary" variant="caption">{batch.tanggal}</Typography>
                  </TableCell>
                  <TableCell>{batch.komoditas}</TableCell>
                  <TableCell align="right">{formatNumber(batch.beratKg ?? batch.volume_kg)} kg</TableCell>
                  <TableCell>
                    <BatchGradeDistribution batch={batch} />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{formatRupiah(estValue)}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" justifyContent="center" spacing={0.5}>
                      {onSelectBatch && (
                        <Tooltip title="Buka Hasil QC & Cetak Sertifikat">
                          <IconButton
                            aria-label={`Buka QC ${batch.id}`}
                            color="primary"
                            onClick={() => onSelectBatch(batch, { openCertificate: true })}
                            size="small"
                          >
                            <PrintRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Lihat detail ringkasan">
                        <IconButton aria-label={`Lihat detail ${batch.id}`} onClick={() => setSelectedBatch(batch)} size="small">
                          <VisibilityRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Hapus batch">
                        <IconButton
                          aria-label={`Hapus ${batch.id}`}
                          color="error"
                          onClick={() => setBatchToDelete(batch)}
                          size="small"
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow sx={{ bgcolor: '#f2f4f6' }}>
              <TableCell colSpan={2} sx={{ fontWeight: 800 }}>
                Total Halaman Ini ({visibleBatches.length} batch):
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatNumber(totals.totalBeratKg)} kg
              </TableCell>
              <TableCell />
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatRupiah(totals.totalNilai)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
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
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography fontWeight={700} variant="h6">Detail Batch Panen</Typography>
          {(() => {
            const status =
              selectedBatch?.execution_status ||
              selectedBatch?.scanResult?.execution_status ||
              (selectedBatch?.is_simulated ? 'simulated' : (selectedBatch?.ai_scan_performed ? 'ai_detected' : null))
            if (status === 'ai_detected') {
              return (
                <Chip
                  color="success"
                  icon={<AutoAwesomeRoundedIcon fontSize="small" />}
                  label="AI Optimal"
                  size="small"
                />
              )
            }
            if (status === 'needs_review') {
              return (
                <Chip
                  color="warning"
                  icon={<WarningAmberRoundedIcon fontSize="small" />}
                  label="Perlu Review"
                  size="small"
                />
              )
            }
            if (status === 'simulated') {
              return (
                <Chip
                  color="info"
                  label="Simulasi"
                  size="small"
                />
              )
            }
            return null
          })()}
        </DialogTitle>
        <DialogContent dividers>
          {selectedBatch && (
            <Stack spacing={1.25}>
              <Typography variant="body2"><strong>ID batch:</strong> {selectedBatch.id}</Typography>
              <Typography variant="body2"><strong>Tanggal:</strong> {selectedBatch.tanggal}</Typography>
              <Typography variant="body2"><strong>Komoditas:</strong> {selectedBatch.komoditas}</Typography>
              <Typography variant="body2"><strong>Berat total:</strong> {formatNumber(selectedBatch.beratKg ?? selectedBatch.volume_kg)} kg</Typography>
              {selectedBatch.kesegaranPersen !== undefined && (
                <Typography variant="body2"><strong>Kesegaran:</strong> {formatNumber(selectedBatch.kesegaranPersen)}%</Typography>
              )}
              {selectedBatch.ukuran && (
                <Typography variant="body2"><strong>Ukuran:</strong> {selectedBatch.ukuran}</Typography>
              )}
              {selectedBatch.cacatPersen !== undefined && (
                <Typography variant="body2"><strong>Cacat:</strong> {formatNumber(selectedBatch.cacatPersen)}%</Typography>
              )}
              <Box>
                <Typography sx={{ mb: 0.5 }} variant="body2"><strong>Distribusi mutu:</strong></Typography>
                <BatchGradeDistribution batch={selectedBatch} />
              </Box>
              <Typography variant="body2"><strong>Nilai estimasi:</strong> {formatRupiah(getBatchEstimatedValue(selectedBatch))}</Typography>
              <Typography color="text.secondary" variant="body2"><strong>Catatan:</strong> {selectedBatch.catatan || '-'}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, justifyContent: 'space-between' }}>
          <Button
            color="error"
            onClick={() => {
              const b = selectedBatch
              setSelectedBatch(null)
              setBatchToDelete(b)
            }}
            startIcon={<DeleteOutlineRoundedIcon />}
            variant="outlined"
          >
            Hapus Batch
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setSelectedBatch(null)} variant="outlined">Tutup</Button>
            {onSelectBatch && selectedBatch && (
              <Button
                onClick={() => {
                  const b = selectedBatch
                  setSelectedBatch(null)
                  onSelectBatch(b, { openCertificate: true })
                }}
                startIcon={<PrintRoundedIcon />}
                variant="contained"
              >
                Buka QC & Cetak Sertifikat
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>
      {/* Dialog Konfirmasi Hapus Batch */}
      <Dialog
        aria-labelledby="confirm-delete-batch-title"
        fullWidth
        maxWidth="xs"
        onClose={() => setBatchToDelete(null)}
        open={Boolean(batchToDelete)}
      >
        <DialogTitle id="confirm-delete-batch-title" sx={{ fontWeight: 700 }}>
          Konfirmasi Hapus Batch
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 1.5 }} variant="body2">
            Apakah Anda yakin ingin menghapus data batch <strong>{batchToDelete?.id}</strong> ({batchToDelete?.komoditas})?
          </Typography>
          <Alert severity="warning" sx={{ fontSize: '0.8125rem' }}>
            Tindakan ini permanen dan akan menghapus data batch dari penyimpanan lokal peramban.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setBatchToDelete(null)} variant="outlined">
            Batal
          </Button>
          <Button
            color="error"
            onClick={() => {
              if (batchToDelete) {
                const targetId = batchToDelete.id
                if (onDeleteBatch) {
                  onDeleteBatch(targetId)
                } else {
                  deleteBatch(targetId)
                }
                setBatchToDelete(null)
              }
            }}
            variant="contained"
          >
            Hapus Permanen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
