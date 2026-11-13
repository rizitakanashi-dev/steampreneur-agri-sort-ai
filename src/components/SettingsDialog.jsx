import { useState, useEffect, useRef } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import BalanceRoundedIcon from '@mui/icons-material/BalanceRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { checkBackendHealth } from '../services/scanService.js'
import {
  clearBatches,
  exportBatchesAsJson,
  importBatchesFromJson,
  readBatches,
} from '../business/harvestStorage.js'

export function SettingsDialog({ open, onClose, onDataChanged }) {
  const [tabIndex, setTabIndex] = useState(0)
  const [backendStatus, setBackendStatus] = useState({ loading: false, isOnline: false, latency: null, data: null })
  const [feedbackMsg, setFeedbackMsg] = useState(null)
  const [batchCount, setBatchCount] = useState(0)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const fileInputRef = useRef(null)

  const refreshHealth = async () => {
    setBackendStatus((prev) => ({ ...prev, loading: true }))
    const start = performance.now()
    try {
      const res = await checkBackendHealth(3500)
      const latencyMs = Math.round(performance.now() - start)
      setBackendStatus({
        loading: false,
        isOnline: res.isOnline,
        latency: latencyMs,
        data: res.data || null,
      })
    } catch {
      setBackendStatus({ loading: false, isOnline: false, latency: null, data: null })
    }
  }

  useEffect(() => {
    if (open) {
      refreshHealth()
      const existing = readBatches()
      setBatchCount(existing.length)
      setFeedbackMsg(null)
    }
  }, [open])

  const handleExportBackup = () => {
    try {
      const jsonStr = exportBatchesAsJson()
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().split('T')[0]
      a.download = `agrisort-cadangan-panen-${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setFeedbackMsg({ type: 'success', text: 'Berkas cadangan data panen berhasil diekspor (.json).' })
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Gagal mengekspor berkas cadangan data panen.' })
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result
        const res = importBatchesFromJson(text)
        if (res.success) {
          const updated = readBatches()
          setBatchCount(updated.length)
          setFeedbackMsg({
            type: 'success',
            text: `Berhasil mengimpor ${res.importedCount} rekaman panen! Total tersimpan saat ini: ${res.totalCount} batch.`,
          })
          onDataChanged?.()
        } else {
          setFeedbackMsg({ type: 'error', text: res.error || 'Gagal memproses berkas cadangan.' })
        }
      } catch {
        setFeedbackMsg({ type: 'error', text: 'Terjadi kesalahan saat membaca berkas cadangan.' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClearData = () => {
    clearBatches()
    setBatchCount(0)
    setConfirmResetOpen(false)
    setFeedbackMsg({
      type: 'success',
      text: 'Seluruh riwayat rekaman batch panen lokal berhasil dibersihkan.',
    })
    onDataChanged?.()
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                bgcolor: 'primary.main',
                color: 'common.white',
                borderRadius: 2,
                p: 0.8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SettingsRoundedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Pengaturan &amp; Info Sistem
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Agri-Sort AI &bull; Sayembara STEAMPreneur SMK Nasional 2026
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small" aria-label="Tutup dialog">
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)} variant="scrollable" scrollButtons="auto">
            <Tab label="Profil Tim &amp; Sekolah" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label="Konektivitas &amp; AI Engine" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label="Manajemen Data &amp; Cadangan" sx={{ textTransform: 'none', fontWeight: 700 }} />
          </Tabs>
        </Box>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          {/* TAB 0: PROFIL TIM & SEKOLAH */}
          {tabIndex === 0 && (
            <Stack spacing={2.5}>
              <Card elevation={0} sx={{ bgcolor: 'rgba(5, 150, 105, 0.06)', border: '1px solid #10b981', borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                    SMKN 4 PAYAKUMBUH — KOTA PAYAKUMBUH, SUMATERA BARAT
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Kompetensi Keahlian: <strong>Rekayasa Perangkat Lunak (RPL)</strong> &bull; Guru Pembimbing:{' '}
                    <strong>Rogi Auvi, S.Pd</strong>
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                    Inovasi: <em>Smart QC Sortasi Mutu Pertanian Berbasis Multi-Angle Computer Vision &amp; Triangulasi Harga Pangan</em>
                  </Typography>
                </CardContent>
              </Card>

              <Typography variant="subtitle2" fontWeight={800}>
                Susunan Tim Pengembang (STEAM Team):
              </Typography>

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                        <Avatar sx={{ bgcolor: '#036e45', width: 34, height: 34, fontSize: 13, fontWeight: 700 }}>FA</Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={800}>Faris Al Farizi</Typography>
                          <Typography variant="caption" color="text.secondary">Ketua Tim &amp; ML Engineer</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Arsitektur Model YOLO11, Tiled SAHI Slicing, Pure ONNX CPU Engine, dan dataset anotasi hortikultura.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                        <Avatar sx={{ bgcolor: '#0b8a5a', width: 34, height: 34, fontSize: 13, fontWeight: 700 }}>HA</Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={800}>Hieray Antovino</Typography>
                          <Typography variant="caption" color="text.secondary">Fullstack &amp; UI/UX Dev</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Frontend React 19, REST API SP2KP &amp; BAPANAS, Triangulasi harga komposit, dan sertifikat QC A4.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, height: '100%' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                        <Avatar sx={{ bgcolor: '#0284c7', width: 34, height: 34, fontSize: 13, fontWeight: 700 }}>AA</Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={800}>Ahmad Afif</Typography>
                          <Typography variant="caption" color="text.secondary">QA &amp; Technical Writer</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Otomasi pengujian unit (245 tests: 131 JS + 114 Python), audit kepatuhan proposal STEAMPreneur, dan dokumentasi review.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Stack>
          )}

          {/* TAB 1: KONEKTIVITAS & AI ENGINE */}
          {tabIndex === 1 && (
            <Stack spacing={2.5}>
              <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      FastAPI Backend Engine (Port 8000)
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      disabled={backendStatus.loading}
                      onClick={refreshHealth}
                      startIcon={backendStatus.loading ? <CircularProgress size={14} color="inherit" /> : <SyncRoundedIcon />}
                      sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 700 }}
                    >
                      {backendStatus.loading ? 'Memeriksa...' : 'Cek Status'}
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip
                      size="small"
                      icon={backendStatus.isOnline ? <CheckCircleRoundedIcon /> : <InfoOutlinedIcon />}
                      label={backendStatus.isOnline ? 'Online (Terhubung)' : 'Offline (Simulasi Lokal Aktif)'}
                      color={backendStatus.isOnline ? 'success' : 'default'}
                      sx={{ fontWeight: 800 }}
                    />
                    {backendStatus.latency !== null && (
                      <Typography variant="caption" color="text.secondary">
                        Latensi respons: <strong>{backendStatus.latency} ms</strong>
                      </Typography>
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Endpoint: <code>http://127.0.0.1:8000/api/v1</code> &bull; CORS: Diizinkan untuk client local dev &amp; demo.
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                    Integrasi Lembaga Negara &amp; Model AI
                  </Typography>
                  <List disablePadding>
                    <ListItem disablePadding sx={{ py: 0.75 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <AccountBalanceRoundedIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Panel Harga BAPANAS RI"
                        secondary="Live Feed resmi Pasar Ibuh Payakumbuh — Cache 12 jam (panelharga.badanpangan.go.id)"
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                    <Divider component="li" />
                    <ListItem disablePadding sx={{ py: 0.75 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <StorefrontRoundedIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="SP2KP Kementerian Perdagangan RI"
                        secondary="REST API resmi Pasar Ibuh Payakumbuh — Cache 12 jam (sp2kp.kemendag.go.id)"
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                    <Divider component="li" />
                    <ListItem disablePadding sx={{ py: 0.75 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <BalanceRoundedIcon color="info" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Mesin Triangulasi &amp; Konvergensi Harga"
                        secondary="Perhitungan harga komposit adil dan indeks konvergensi antar-lembaga secara real-time"
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                    <Divider component="li" />
                    <ListItem disablePadding sx={{ py: 0.75 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <VerifiedRoundedIcon color="secondary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Model Deteksi YOLO11n Multi-Class (Terung 3-Grade v2 / 4-Class &amp; Tomat 2-Class)"
                        secondary="Pure ONNX SIMD Runtime + SAHI Tiled Inference untuk deteksi objek kecil pada resolusi tinggi"
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Stack>
          )}

          {/* TAB 2: MANAJEMEN DATA & CADANGAN LAPANGAN */}
          {tabIndex === 2 && (
            <Stack spacing={2.5}>
              <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ borderRadius: 2 }}>
                <Typography variant="body2">
                  <strong>Penyimpanan Luring Lapangan:</strong> Fitur ini memungkinkan petani dan PPL (Penyuluh Pertanian Lapangan) mencadangkan (backup) atau memindahkan data rekapan panen antar-perangkat secara aman tanpa membutuhkan koneksi internet.
                </Typography>
              </Alert>

              <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight={800}>
                    Penyimpanan Data Lokal (Browser Storage)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Saat ini tersimpan: <strong>{batchCount} rekaman batch panen</strong> di dalam memori peramban.
                  </Typography>

                  {feedbackMsg && (
                    <Alert severity={feedbackMsg.type} sx={{ mt: 1.5, borderRadius: 1.5 }}>
                      {feedbackMsg.text}
                    </Alert>
                  )}

                  <input
                    type="file"
                    accept=".json,application/json"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={batchCount === 0}
                      onClick={handleExportBackup}
                      startIcon={<FileDownloadRoundedIcon />}
                      sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 700 }}
                    >
                      Ekspor Cadangan (.json)
                    </Button>

                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => fileInputRef.current?.click()}
                      startIcon={<FileUploadRoundedIcon />}
                      sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 700 }}
                    >
                      Impor Cadangan (.json)
                    </Button>

                    <Button
                      variant="outlined"
                      color="error"
                      disabled={batchCount === 0}
                      onClick={() => setConfirmResetOpen(true)}
                      startIcon={<DeleteOutlineRoundedIcon />}
                      sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 700 }}
                    >
                      Kosongkan Data
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight={800}>
                    Panduan Alur Lapangan &amp; Presentasi (STEAM Flow):
                  </Typography>
                  <List dense disablePadding sx={{ mt: 1 }}>
                    <ListItem disablePadding sx={{ py: 0.25 }}>
                      <ListItemText
                        primary="1. Batch QC Scanner:"
                        secondary="Ambil foto 2 sudut (Depan & Goyang Nampan) untuk mendeteksi mutu buah anti-oklusi dan verifikasi kamera diam."
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                    <ListItem disablePadding sx={{ py: 0.25 }}>
                      <ListItemText
                        primary="2. Hasil QC & Edukasi Sains:"
                        secondary="Perlihatkan kartu edukasi 5 patologi pascapanen & cetak Sertifikat Mutu Resmi ber-kop SMKN 4."
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                    <ListItem disablePadding sx={{ py: 0.25 }}>
                      <ListItemText
                        primary="3. Harga Pasar & Triangulasi:"
                        secondary="Tunjukkan perbandingan data live BAPANAS RI vs SP2KP Kemendag RI dan hitung titik impas (BEP)."
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            Versi Aplikasi: <strong>v1.0.0 (Build 2026-11-11)</strong>
          </Typography>
          <Button onClick={onClose} variant="contained" color="primary" sx={{ borderRadius: 2, fontWeight: 700 }}>
            Tutup
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG KONFIRMASI RESET DATA */}
      <Dialog open={confirmResetOpen} onClose={() => setConfirmResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Konfirmasi Pembersihan Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Apakah Anda yakin ingin mengosongkan seluruh riwayat batch panen lokal? Tindakan ini akan menghapus semua catatan panen yang tersimpan di memori peramban ini. Pastikan Anda telah mengekspor cadangan berkas jika masih memerlukannya.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmResetOpen(false)} color="inherit" sx={{ fontWeight: 700 }}>
            Batal
          </Button>
          <Button onClick={handleClearData} color="error" variant="contained" sx={{ fontWeight: 700, borderRadius: 2 }}>
            Ya, Bersihkan Data
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

