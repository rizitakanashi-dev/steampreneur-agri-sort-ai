import { useState, useRef, useEffect } from 'react'
import {
  Alert,
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
  InputAdornment,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FlipCameraIosRoundedIcon from '@mui/icons-material/FlipCameraIosRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import RecyclingRoundedIcon from '@mui/icons-material/RecyclingRounded'

import { LiveCameraViewfinder } from './LiveCameraViewfinder.jsx'
import { ScanCanvasOverlay } from './ScanCanvasOverlay.jsx'
import { scanHarvestImage } from '../services/scanService.js'
import { saveBatch } from '../business/harvestStorage.js'
import { REFERENCE_PRICES_PER_KG } from '../business/priceReference.js'
import { calculateHarvest, calculateHarvestValue } from '../business/harvestCalculation.js'

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatRupiah(val) {
  return typeof val === 'number' && Number.isFinite(val) ? rupiahFormatter.format(val) : '-'
}

const COMMODITIES = [
  {
    id: 'Terung',
    name: 'Terung (Eggplant)',
    badge: 'YOLO11 4-Class',
    badgeColor: 'primary',
    classes: ['Extra Class', 'Class I', 'Class II', 'Reject'],
    defaultConf: 0.20,
    emoji: '🍆',
    supported: true,
  },
  {
    id: 'Tomat',
    name: 'Tomat (Tomato)',
    badge: 'YOLO11 2-Class',
    badgeColor: 'success',
    classes: ['Tomat Segar', 'Tomat Busuk'],
    defaultConf: 0.35,
    emoji: '🍅',
    supported: true,
  },
  {
    id: 'Cabai Rawit Hijau',
    name: 'Cabai Rawit Hijau',
    badge: 'Pencatatan Lapangan',
    badgeColor: 'default',
    classes: ['Grade A', 'Grade B', 'Reject'],
    defaultConf: 0.35,
    emoji: '🌶️',
    supported: false,
  },
]

export function BatchQCScanner({ onBatchSaved, onViewResults, onOpenManualForm }) {
  const [selectedCommodity, setSelectedCommodity] = useState('Terung')
  const [activeTab, setActiveTab] = useState(0) // 0: Live Camera, 1: Upload File
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.20)
  const [showSensitivitySetting, setShowSensitivitySetting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // State gambar
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  // State proses scan
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanResult, setScanResult] = useState(null)

  // State modal simpan rekap
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [saveWeight, setSaveWeight] = useState('')
  const [saveNotes, setSaveNotes] = useState('')
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  const fileInputRef = useRef(null)

  // Sesuaikan default confidence saat berganti komoditas
  const handleSelectCommodity = (commId) => {
    setSelectedCommodity(commId)
    const comm = COMMODITIES.find((c) => c.id === commId)
    if (comm) {
      setConfidenceThreshold(comm.defaultConf)
    }
    // Jika ganti komoditas setelah scan, reset scan result agar tidak bias
    if (scanResult) {
      setScanResult(null)
    }
  }

  // Handle capture dari Live Camera
  const handleLiveCameraCapture = async (file, previewUrl) => {
    setImageFile(file)
    setImagePreview(previewUrl)
    setScanError('')
    // Langsung jalankan inferensi AI otomatis seketika foto diambil
    await triggerInference(file, previewUrl, selectedCommodity, confidenceThreshold)
  }

  // Handle pemrosesan berkas citra (baik via file dialog maupun drag and drop)
  const handleProcessFile = (file) => {
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setScanError('Format file tidak didukung. Harap gunakan format JPG, PNG, atau WebP.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setScanError('Ukuran gambar melebihi batas 10 MB. Silakan gunakan foto yang lebih kecil.')
      return
    }

    setImageFile(file)
    setScanError('')
    setScanResult(null)
    setActiveTab(1) // Beralih otomatis ke tab Pratinjau Berkas
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      setImagePreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // Handle pilih berkas gambar via input file
  const handleFileChange = (e) => {
    const file = e.target?.files?.[0]
    if (file) {
      handleProcessFile(file)
    }
  }

  // Handle Drag & Drop Events
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) {
      handleProcessFile(file)
    }
  }

  const handleClearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setScanResult(null)
    setScanError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Eksekusi inferensi AI
  const triggerInference = async (file, previewUrl, commodity, conf) => {
    if (!file) return
    setIsScanning(true)
    setScanError('')
    try {
      const response = await scanHarvestImage({
        imageFile: file,
        commodity: commodity,
        confidenceThreshold: conf,
      })

      if (response?.data) {
        setScanResult({
          ...response.data,
          imagePreview: previewUrl,
        })
      } else {
        setScanError('Server tidak mengembalikan data deteksi yang valid.')
      }
    } catch (err) {
      console.error('Inference error:', err)
      setScanError(err.message || 'Gagal memproses gambar pada server backend.')
    } finally {
      setIsScanning(false)
    }
  }

  // Simpan hasil scan ke Rekap Data Panen (Storage)
  const handleConfirmSaveToRecap = () => {
    if (!scanResult) return

    const parsedWeight = saveWeight ? Number(saveWeight.replace(',', '.')) : 10
    const inf = scanResult.inference_result
    const pricing = scanResult.smart_pricing
    const totalObjs = inf?.object_counts?.total || 1

    let persenA = 0
    let persenB = 0
    let persenC = 0

    if (selectedCommodity.toLowerCase().includes('terung')) {
      const extra = inf?.object_counts?.extra_class || 0
      const c1 = inf?.object_counts?.class_1 || 0
      const c2 = inf?.object_counts?.class_2 || 0
      const rej = inf?.object_counts?.reject || 0
      persenA = Math.round(((extra + c1) / (totalObjs || 1)) * 100)
      persenB = Math.round((c2 / (totalObjs || 1)) * 100)
      persenC = Math.round((rej / (totalObjs || 1)) * 100)
    } else {
      const fresh = inf?.object_counts?.fresh_tomato || 0
      const rotten = inf?.object_counts?.rotten_tomato || 0
      persenA = Math.round((fresh / (totalObjs || 1)) * 100)
      persenB = 0
      persenC = Math.round((rotten / (totalObjs || 1)) * 100)
    }

    const calculatedInput = {
      tanggal: new Date().toISOString().slice(0, 10),
      komoditas: selectedCommodity,
      beratKg: parsedWeight,
      kesegaranPersen: persenA,
      cacatPersen: persenC,
      ukuran: 'Sedang',
      catatan: saveNotes || 'Dipindai otomatis via Batch QC Scanner',
    }

    const calculation = calculateHarvest(calculatedInput)
    const basePrice = REFERENCE_PRICES_PER_KG[selectedCommodity] || 12000
    const valueCalc = calculateHarvestValue({
      ...calculatedInput,
      hargaAcuanPerKg: basePrice,
    })

    const newBatch = saveBatch({
      ...calculatedInput,
      fotoKeranjang: imagePreview,
      fotoNama: imageFile?.name || `${selectedCommodity.toLowerCase()}_scan.jpg`,
      ai_scan_performed: true,
      inference: inf,
      pricing: pricing,
      scanResult: scanResult,
      hasil: {
        persenA: calculation.persentase.gradeA,
        persenB: calculation.persentase.gradeB,
        persenC: calculation.persentase.reject,
        beratA: calculation.beratKg.gradeA,
        beratB: calculation.beratKg.gradeB,
        beratC: calculation.beratKg.reject,
        nilaiA: valueCalc.nilai.gradeA,
        nilaiB: valueCalc.nilai.gradeB,
        nilaiC: valueCalc.nilai.reject,
        totalNilai: pricing?.estimated_economic_value ?? valueCalc.totalNilai,
      },
      dicatatPada: new Date().toISOString(),
    })

    setIsSaveModalOpen(false)
    setSaveSuccessMsg(`Batch ${newBatch.id} berhasil dicatat ke Rekap Data Panen!`)
    if (onBatchSaved) {
      onBatchSaved(newBatch)
    }
  }

  const isEggplant = selectedCommodity.toLowerCase().includes('terung')
  const inference = scanResult?.inference_result
  const counts = inference?.object_counts || {}
  const pricing = scanResult?.smart_pricing

  // Deteksi apakah model menghasilkan 1 bounding box raksasa yang menutupi seluruh gambar
  const firstBox = inference?.detections?.[0]?.box
  const imgDims = inference?.image_dimensions
  const isGlobalBoundingBox = Boolean(
    inference?.detections?.length === 1 &&
      firstBox &&
      imgDims &&
      imgDims.width > 0 &&
      imgDims.height > 0 &&
      (firstBox.x2 - firstBox.x1) * (firstBox.y2 - firstBox.y1) > 0.5 * imgDims.width * imgDims.height
  )

  return (
    <Stack spacing={3}>
      {/* 1. KARTU SELEKSI KOMODITAS UTAMA (PROMINENT DI ATAS) */}
      <Card elevation={2} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Pilih Komoditas Panen
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pilih buah yang akan dipindai agar sistem memuat model AI yang sesuai.
              </Typography>
            </Box>
            <Tooltip title="Atur sensitivitas threshold keyakinan model AI">
              <Button
                size="small"
                variant="outlined"
                startIcon={<TuneRoundedIcon />}
                onClick={() => setShowSensitivitySetting((prev) => !prev)}
                sx={{ borderRadius: 2 }}
              >
                Sensitivitas: {Math.round(confidenceThreshold * 100)}%
              </Button>
            </Tooltip>
          </Stack>

          {/* Opsi Sensitivitas Slider */}
          {showSensitivitySetting && (
            <Box sx={{ mb: 2.5, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Confidence Threshold (Batas Keyakinan Deteksi): {confidenceThreshold.toFixed(2)}
                </Typography>
                <Chip
                  size="small"
                  label={isEggplant ? 'Rekomendasi Terung: 0.20' : 'Rekomendasi Tomat: 0.35'}
                  color="info"
                  variant="outlined"
                />
              </Stack>
              <Slider
                value={confidenceThreshold}
                min={0.05}
                max={0.80}
                step={0.05}
                onChange={(_, val) => setConfidenceThreshold(val)}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                Nilai lebih rendah (0.15 - 0.25) mendeteksi lebih banyak buah terung yang saling bertumpuk di keranjang.
              </Typography>
            </Box>
          )}

          {/* Tombol Pilihan Komoditas */}
          <Grid container spacing={1.5}>
            {COMMODITIES.map((c) => {
              const isSelected = selectedCommodity === c.id
              return (
                <Grid key={c.id} size={{ xs: 12, sm: 4 }}>
                  <Button
                    fullWidth
                    onClick={() => handleSelectCommodity(c.id)}
                    variant={isSelected ? 'contained' : 'outlined'}
                    color={isSelected ? 'primary' : 'inherit'}
                    sx={{
                      p: 1.75,
                      borderRadius: 2.5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      bgcolor: isSelected ? 'rgba(3, 110, 69, 0.08)' : 'transparent',
                      color: isSelected ? 'primary.dark' : 'text.primary',
                      '&:hover': {
                        bgcolor: isSelected ? 'rgba(3, 110, 69, 0.14)' : '#f8fafc',
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', mb: 0.75 }}>
                      <Typography fontSize="1.6rem">{c.emoji}</Typography>
                      <Chip
                        label={c.badge}
                        size="small"
                        color={isSelected ? 'primary' : 'default'}
                        variant={isSelected ? 'filled' : 'outlined'}
                        sx={{ fontSize: '0.7rem', height: 22, fontWeight: 700 }}
                      />
                    </Stack>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {c.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
                      Kelas: {c.classes.join(', ')}
                    </Typography>
                  </Button>
                </Grid>
              )
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* 2. TAMPILAN SCANNER (JIKA BELUM ADA HASIL SCAN) */}
      {!scanResult && (
        <Card
          elevation={2}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            borderRadius: 3,
            position: 'relative',
            border: isDragging ? '2px dashed #047857' : '1px solid transparent',
            bgcolor: isDragging ? 'rgba(4, 120, 87, 0.04)' : 'inherit',
            transition: 'all 0.2s',
          }}
        >
          {isDragging && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                bgcolor: 'rgba(240, 253, 244, 0.92)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                borderRadius: 3,
                border: '3px dashed #047857',
              }}
            >
              <CloudUploadRoundedIcon sx={{ fontSize: 64, color: '#047857', mb: 1.5 }} />
              <Typography variant="h6" fontWeight={800} color="#047857">
                Lepaskan Berkas Foto di Sini
              </Typography>
              <Typography variant="body2" color="#065f46">
                Foto keranjang {selectedCommodity} akan segera disiapkan untuk dianalisis
              </Typography>
            </Box>
          )}

          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Tabs
              value={activeTab}
              onChange={(_, val) => setActiveTab(val)}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}
            >
              <Tab
                icon={<VideocamRoundedIcon />}
                iconPosition="start"
                label="Live Kamera Langsung"
                sx={{ fontWeight: 700 }}
              />
              <Tab
                icon={<PhotoLibraryRoundedIcon />}
                iconPosition="start"
                label="Unggah Berkas Citra"
                sx={{ fontWeight: 700 }}
              />
            </Tabs>

            {scanError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setScanError('')}>
                {scanError}
              </Alert>
            )}

            {/* Banner Panduan Pengambilan Sampel untuk Petani/Penilai */}
            <Alert
              severity="info"
              icon={<InfoOutlinedIcon />}
              sx={{ mb: 2.5, borderRadius: 2, bgcolor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}
            >
              <Typography variant="body2" fontWeight={700}>
                Tips Akurasi AI ({selectedCommodity}):
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: '#15803d' }}>
                {isEggplant
                  ? 'Model mendeteksi mutu buah per butir. Untuk akurasi optimal, ambil 2–5 buah sampel dari keranjang dan letakkan berjajar di atas nampan/alas datar (hindari tumpukan padat pasar berlapis).'
                  : 'Arahkan kamera tegak lurus (top-down view) dengan pencahayaan memadai agar buah terdeteksi jelas.'}
              </Typography>
            </Alert>

            {/* TAB 0: LIVE CAMERA */}
            {activeTab === 0 && (
              <Box>
                <LiveCameraViewfinder
                  onCapture={handleLiveCameraCapture}
                  disabled={isScanning}
                />
                {isScanning && (
                  <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ mt: 2 }}>
                    <CircularProgress size={20} color="primary" />
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      Sedang menganalisis foto dengan model YOLO11 {selectedCommodity}...
                    </Typography>
                  </Stack>
                )}
              </Box>
            )}

            {/* TAB 1: UPLOAD FILE */}
            {activeTab === 1 && (
              <Box>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                {imagePreview ? (
                  <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#0f172a', textAlign: 'center' }}>
                    <Box
                      component="img"
                      src={imagePreview}
                      alt="Pratinjau Panen"
                      sx={{ maxHeight: 380, maxWidth: '100%', objectFit: 'contain' }}
                    />
                    <IconButton
                      onClick={handleClearImage}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        bgcolor: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        '&:hover': { bgcolor: '#dc2626' },
                      }}
                      title="Ganti Foto"
                    >
                      <DeleteOutlineRoundedIcon />
                    </IconButton>

                    <Box sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid', borderColor: 'divider' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1.5}>
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="body2" fontWeight={700}>
                            {imageFile?.name || 'Citra Panen Terpilih'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Siap dipindai dengan model {selectedCommodity}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          color="primary"
                          size="large"
                          disabled={isScanning}
                          onClick={() => triggerInference(imageFile, imagePreview, selectedCommodity, confidenceThreshold)}
                          startIcon={isScanning ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeRoundedIcon />}
                          sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}
                        >
                          {isScanning ? 'Menganalisis...' : 'Mulai Pindai AI Sekarang'}
                        </Button>
                      </Stack>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    sx={{
                      border: '2px dashed',
                      borderColor: isDragging ? 'primary.main' : '#94a3b8',
                      borderRadius: 2.5,
                      p: { xs: 3, sm: 5 },
                      textAlign: 'center',
                      cursor: 'pointer',
                      bgcolor: isDragging ? 'rgba(3, 110, 69, 0.08)' : '#f8fafc',
                      '&:hover': { bgcolor: '#f1f5f9', borderColor: 'primary.main' },
                      transition: 'all 0.2s',
                    }}
                  >
                    <CloudUploadRoundedIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1.5 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Klik untuk Pilih Foto atau Tarik &amp; Lepaskan (Drag &amp; Drop) ke Sini
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Ambil foto tampak atas (top-down) keranjang {selectedCommodity} &bull; JPG, PNG, atau WebP (maks. 10 MB)
                    </Typography>
                    <Button variant="outlined" sx={{ mt: 2, borderRadius: 2 }} startIcon={<CloudUploadRoundedIcon />}>
                      Pilih Berkas dari Komputer
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. HASIL SCAN INSTAN LANGSUNG MUNCUL DI SINI! */}
      {scanResult && (
        <Stack spacing={3}>
          {saveSuccessMsg && (
            <Alert severity="success" onClose={() => setSaveSuccessMsg('')}>
              {saveSuccessMsg}
            </Alert>
          )}

          {/* Bar Kontrol Aksi Atas Hasil Scan */}
          <Card elevation={2} sx={{ borderRadius: 3, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <CardContent sx={{ p: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ sm: 'center' }}
                spacing={1.5}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CheckCircleRoundedIcon color="success" sx={{ fontSize: 32 }} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800} color="#166534">
                      Deteksi AI Berhasil — {selectedCommodity}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Waktu Inferensi: {inference?.inference_time_ms || 0} ms &bull; Total Terdeteksi: {inference?.detections?.length || 0} butir
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1.25}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    startIcon={<RefreshRoundedIcon />}
                    onClick={handleClearImage}
                    sx={{ borderRadius: 2 }}
                  >
                    Pindai Ulang / Foto Baru
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<SaveRoundedIcon />}
                    onClick={() => setIsSaveModalOpen(true)}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    Simpan ke Rekap Panen
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* Notifikasi Edukasi jika terdeteksi tumpukan padat sebagai 1 box global */}
          {isGlobalBoundingBox && (
            <Alert
              severity="warning"
              icon={<InfoOutlinedIcon />}
              sx={{ borderRadius: 2.5, bgcolor: '#fffbeb', borderColor: '#fde68a' }}
            >
              <Typography variant="subtitle2" fontWeight={800} color="#92400e">
                Terdeteksi Sebagai 1 Sampel Global (Tumpukan Padat Keranjang)
              </Typography>
              <Typography variant="body2" color="#b45309" sx={{ mt: 0.5 }}>
                Model mendeteksi seluruh area keranjang sebagai 1 sampel global dengan label{' '}
                <strong>{firstBox ? inference?.detections?.[0]?.class_name : 'Reject'}</strong>.
                Untuk menghitung persentase butir per butir (Extra Class, Class I, Class II, dan Reject),
                disarankan mengambil <strong>2–5 buah sampel terung</strong> dan meletakkannya berjajar di atas
                nampan/meja datar (tidak bertumpuk tebal).
              </Typography>
            </Alert>
          )}

          {/* Canvas Overlay Anotasi AI */}
          <ScanCanvasOverlay
            commodity={selectedCommodity}
            detections={inference?.detections || []}
            imageDimensions={inference?.image_dimensions}
            imageUrl={scanResult.imagePreview}
          />

          {/* Kartu Ringkasan Kelas Mutu */}
          <Card elevation={2} sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>
                Distribusi Mutu Hasil Deteksi ({selectedCommodity})
              </Typography>

              {isEggplant ? (
                // 4 KELAS TERUNG
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(5, 150, 105, 0.08)', border: '1px solid #059669' }}>
                      <Typography variant="caption" fontWeight={700} color="#059669">
                        Extra Class (Super)
                      </Typography>
                      <Typography variant="h5" fontWeight={800} color="#059669">
                        {counts.extra_class || 0} <Typography component="span" variant="caption">butir</Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pricing?.condition_ratios?.extra_class_percent || 0}% proporsi
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(2, 132, 199, 0.08)', border: '1px solid #0284c7' }}>
                      <Typography variant="caption" fontWeight={700} color="#0284c7">
                        Class 1 (Standar)
                      </Typography>
                      <Typography variant="h5" fontWeight={800} color="#0284c7">
                        {counts.class_1 || 0} <Typography component="span" variant="caption">butir</Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pricing?.condition_ratios?.class_1_percent || 0}% proporsi
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(217, 119, 6, 0.08)', border: '1px solid #d97706' }}>
                      <Typography variant="caption" fontWeight={700} color="#d97706">
                        Class 2 (Lokal)
                      </Typography>
                      <Typography variant="h5" fontWeight={800} color="#d97706">
                        {counts.class_2 || 0} <Typography component="span" variant="caption">butir</Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pricing?.condition_ratios?.class_2_percent || 0}% proporsi
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(220, 38, 38, 0.08)', border: '1px solid #dc2626' }}>
                      <Typography variant="caption" fontWeight={700} color="#dc2626">
                        Reject (Afkir)
                      </Typography>
                      <Typography variant="h5" fontWeight={800} color="#dc2626">
                        {counts.reject || 0} <Typography component="span" variant="caption">butir</Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pricing?.condition_ratios?.reject_percent || 0}% proporsi
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              ) : (
                // 2 KELAS TOMAT
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, sm: 6 }}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(4, 120, 87, 0.08)', border: '1px solid #047857' }}>
                      <Typography variant="caption" fontWeight={700} color="#047857">
                        Tomat Segar
                      </Typography>
                      <Typography variant="h5" fontWeight={800} color="#047857">
                        {counts.fresh_tomato || 0} <Typography component="span" variant="caption">butir</Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {inference?.condition_ratios?.fresh_ratio_percent || 0}% kesegaran
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 6 }}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(185, 28, 28, 0.08)', border: '1px solid #b91c1c' }}>
                      <Typography variant="caption" fontWeight={700} color="#b91c1c">
                        Tomat Busuk / Cacat
                      </Typography>
                      <Typography variant="h5" fontWeight={800} color="#b91c1c">
                        {counts.rotten_tomato || 0} <Typography component="span" variant="caption">butir</Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {inference?.condition_ratios?.rotten_ratio_percent || 0}% cacat
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              )}

              {/* Rekomendasi Pintar Smart Pricing */}
              {pricing && (
                <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                        Estimasi Smart Pricing ({pricing.price_tier || 'Grade Komersial'})
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pricing.recommendation_note || 'Pemeriksaan kualitas selesai.'}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                      <Typography variant="caption" color="text.secondary">
                        Harga Acuan Pasar:
                      </Typography>
                      <Typography variant="h6" fontWeight={800} color="primary.dark">
                        {formatRupiah(pricing.base_price_per_kg)} <Typography component="span" variant="caption">/ kg</Typography>
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* DIALOG SIMPAN KE REKAP DATA PANEN */}
      <Dialog open={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Simpan ke Rekap Data Panen</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info" icon={<InfoOutlinedIcon />}>
              Hasil deteksi AI ({selectedCommodity}) akan dicatat ke dalam database rekap lokal.
            </Alert>
            <TextField
              label="Estimasi Berat Timbangan (kg)"
              value={saveWeight}
              onChange={(e) => setSaveWeight(e.target.value)}
              placeholder="Contoh: 15"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }}
              helperText="Opsional. Default 10 kg jika dikosongkan."
              fullWidth
            />
            <TextField
              label="Catatan Panen"
              value={saveNotes}
              onChange={(e) => setSaveNotes(e.target.value)}
              placeholder="Contoh: Panen pagi keranjang 3"
              multiline
              rows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsSaveModalOpen(false)} color="inherit">
            Batal
          </Button>
          <Button onClick={handleConfirmSaveToRecap} variant="contained" color="primary">
            Simpan Sekarang
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
