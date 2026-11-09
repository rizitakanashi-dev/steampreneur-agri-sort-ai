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
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import PrintRoundedIcon from '@mui/icons-material/PrintRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import FlipCameraAndroidRoundedIcon from '@mui/icons-material/FlipCameraAndroidRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import { LiveCameraViewfinder } from './LiveCameraViewfinder.jsx'
import { ScanCanvasOverlay } from './ScanCanvasOverlay.jsx'
import { QCPrintCertificate } from './QCPrintCertificate.jsx'
import { scanHarvestImage, scanMultiAngleHarvestImages } from '../services/scanService.js'
import { aggregateMultiAngleScanResults } from '../business/multiAngleHelper.js'
import { saveBatch } from '../business/harvestStorage.js'
import { REFERENCE_PRICES_PER_KG } from '../business/priceReference.js'
import { calculateHarvest, calculateHarvestValue } from '../business/harvestCalculation.js'
import { getTodayDateString } from '../business/harvestValidation.js'

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

  // State Multi-Sudut (Anti-Kecurangan / Occlusion-Free)
  const [isMultiAngleMode, setIsMultiAngleMode] = useState(false)
  const [multiStep, setMultiStep] = useState(1) // 1: Foto Sisi 1 (Depan), 2: Foto Sisi 2 (Belakang / Goyang Nampan)
  const [imageFileFront, setImageFileFront] = useState(null)
  const [imagePreviewFront, setImagePreviewFront] = useState(null)
  const [imageFileBack, setImageFileBack] = useState(null)
  const [imagePreviewBack, setImagePreviewBack] = useState(null)
  const [activeAngleView, setActiveAngleView] = useState(0) // 0: Sisi Depan, 1: Sisi Belakang

  // State proses scan
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanResult, setScanResult] = useState(null)

  // State modal simpan rekap
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [isCertModalOpen, setIsCertModalOpen] = useState(false)
  const [saveWeight, setSaveWeight] = useState('')
  const [saveNotes, setSaveNotes] = useState('')
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  const fileInputRef = useRef(null)
  const fileInputRefFront = useRef(null)
  const fileInputRefBack = useRef(null)

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
    if (!isMultiAngleMode) {
      setImageFile(file)
      setImagePreview(previewUrl)
      setScanError('')
      await triggerInference(file, previewUrl, selectedCommodity, confidenceThreshold)
    } else {
      if (multiStep === 1) {
        setImageFileFront(file)
        setImagePreviewFront(previewUrl)
        setScanError('')
        setMultiStep(2)
      } else {
        setImageFileBack(file)
        setImagePreviewBack(previewUrl)
        setScanError('')
        await triggerMultiInference(
          imageFileFront,
          file,
          imagePreviewFront,
          previewUrl,
          selectedCommodity,
          confidenceThreshold
        )
      }
    }
  }

  // Handle pemrosesan berkas untuk sisi spesifik (Multi-Angle)
  const handleProcessFileForSide = (file, side = 'front') => {
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

    // Pengecekan instan anti-kecurangan berkas kembar antara Sisi 1 dan Sisi 2
    if (side === 'back' && imageFileFront) {
      if (
        imageFileFront.size === file.size &&
        (imageFileFront.name === file.name || imageFileFront.lastModified === file.lastModified)
      ) {
        setScanError(
          'Peringatan Anti-Kecurangan: Foto Sisi 2 terdeteksi identik dengan Sisi 1 (file kembar). Harap pilih foto berbeda setelah nampan digoyang!'
        )
        return
      }
    } else if (side === 'front' && imageFileBack) {
      if (
        imageFileBack.size === file.size &&
        (imageFileBack.name === file.name || imageFileBack.lastModified === file.lastModified)
      ) {
        setScanError(
          'Peringatan Anti-Kecurangan: Foto Sisi 1 terdeteksi identik dengan Sisi 2 (file kembar). Harap pilih foto berbeda setelah nampan digoyang!'
        )
        return
      }
    }

    setScanError('')
    setScanResult(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      if (side === 'front') {
        setImageFileFront(file)
        setImagePreviewFront(dataUrl)
      } else {
        setImageFileBack(file)
        setImagePreviewBack(dataUrl)
      }
    }
    reader.readAsDataURL(file)
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
    if (!isDragging) setIsDragging(false)
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
    setImageFileFront(null)
    setImagePreviewFront(null)
    setImageFileBack(null)
    setImagePreviewBack(null)
    setMultiStep(1)
    setActiveAngleView(0)
    setScanResult(null)
    setScanError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (fileInputRefFront.current) fileInputRefFront.current.value = ''
    if (fileInputRefBack.current) fileInputRefBack.current.value = ''
  }

  // Eksekusi inferensi AI Sudut Tunggal
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

  // Eksekusi inferensi AI Multi-Sudut (Dual-Shot Aggregation)
  const triggerMultiInference = async (fileFront, fileBack, previewFront, previewBack, commodity, conf) => {
    if (!fileFront || !fileBack) {
      setScanError('Kedua sisi foto (Depan & Belakang/Goyang Nampan) wajib tersedia.')
      return
    }

    const isSameSize = fileFront.size > 0 && fileFront.size === fileBack.size
    const isSamePreview = Boolean(previewFront && previewBack && previewFront === previewBack)
    const isSameMeta = fileFront.name === fileBack.name || fileFront.lastModified === fileBack.lastModified

    if (isSamePreview || (isSameSize && isSameMeta)) {
      setScanError(
        'Peringatan Anti-Kecurangan: Berkas foto Sisi 1 dan Sisi 2 identik (file kembar terdeteksi). Harap pilih foto berbeda setelah nampan digoyang untuk verifikasi anti-kecurangan!'
      )
      return
    }

    setIsScanning(true)
    setScanError('')
    try {
      let finalResult = null

      // 1. Coba panggil endpoint resmi multi-sudut backend POST /api/v1/qc/scan-multi
      try {
        const response = await scanMultiAngleHarvestImages({
          imageFront: fileFront,
          imageBack: fileBack,
          commodity,
          confidenceThreshold: conf,
        })
        if (response?.data) {
          const d = response.data
          const agg = d.multi_angle_aggregation || {}
          const isEgg = String(commodity).toLowerCase().includes('terung')

          finalResult = {
            ...d,
            is_multi_angle: true,
            imagePreview: previewFront,
            imagePreviewFront: previewFront,
            imagePreviewBack: previewBack,
            occlusion_analysis: agg.occlusion_analysis || {},
            inference_result: {
              object_counts: isEgg
                ? {
                    extra_class:
                    agg.combined_object_counts?.extra_class_combined ??
                    d.front_view?.object_counts?.['extra-class'] ??
                    0,
                  class_1:
                    agg.combined_object_counts?.class_1_combined ??
                    d.front_view?.object_counts?.['class-1'] ??
                    0,
                  class_2:
                    agg.combined_object_counts?.class_2_combined ??
                    d.front_view?.object_counts?.['class-2'] ??
                    0,
                  reject:
                    agg.combined_object_counts?.reject_combined ??
                    d.front_view?.object_counts?.reject ??
                    0,
                  total: agg.combined_object_counts?.total_samples_observed ?? 1,
                }
              : {
                  fresh_tomato:
                    agg.combined_object_counts?.fresh_tomato_combined ??
                    d.front_view?.object_counts?.['fresh-tomato'] ??
                    0,
                  rotten_tomato:
                    agg.combined_object_counts?.rotten_tomato_combined ??
                    d.front_view?.object_counts?.['rotten-tomato'] ??
                    0,
                  total: agg.combined_object_counts?.total_samples_observed ?? 1,
                },
              condition_ratios: agg.weighted_condition_ratios || d.smart_pricing?.condition_ratios || {},
              detections: d.front_view?.detections || [],
              detections_front: d.front_view?.detections || [],
              detections_back: d.back_view?.detections || [],
              image_dimensions: d.front_view?.image_dimensions || { width: 1280, height: 720 },
              image_dimensions_front: d.front_view?.image_dimensions || { width: 1280, height: 720 },
              image_dimensions_back: d.back_view?.image_dimensions || { width: 1280, height: 720 },
              inference_time_ms:
                (d.front_view?.inference_time_ms || 0) + (d.back_view?.inference_time_ms || 0),
            },
            smart_pricing: d.smart_pricing,
            business_grading: d.business_grading,
          }
        }
      } catch (backendMultiErr) {
        // Jika error dari backend adalah validasi anti-kecurangan berkas identik / duplikat, jangan telan errornya!
        if (
          backendMultiErr?.code === 'DUPLICATE_MULTI_ANGLE_IMAGES' ||
          backendMultiErr?.message?.toLowerCase().includes('identik') ||
          backendMultiErr?.message?.toLowerCase().includes('kembar')
        ) {
          throw backendMultiErr
        }
        console.warn('Backend multi-scan fallback to client aggregation:', backendMultiErr)
      }

      // 2. Client-side fallback jika endpoint multi gagal
      if (!finalResult) {
        const [resFront, resBack] = await Promise.all([
          scanHarvestImage({ imageFile: fileFront, commodity, confidenceThreshold: conf }),
          scanHarvestImage({ imageFile: fileBack, commodity, confidenceThreshold: conf }),
        ])
        const aggregated = aggregateMultiAngleScanResults(
          resFront?.data || resFront,
          resBack?.data || resBack,
          saveWeight ? Number(saveWeight.replace(',', '.')) : 10,
          commodity
        )
        finalResult = {
          ...aggregated,
          imagePreview: previewFront,
          imagePreviewFront: previewFront,
          imagePreviewBack: previewBack,
          inference_result: {
            ...aggregated.inference_result,
            detections_front: resFront?.data?.inference_result?.detections || [],
            detections_back: resBack?.data?.inference_result?.detections || [],
            image_dimensions_front: resFront?.data?.inference_result?.image_dimensions || { width: 1280, height: 720 },
            image_dimensions_back: resBack?.data?.inference_result?.image_dimensions || { width: 1280, height: 720 },
          },
        }
      }

      setScanResult(finalResult)
    } catch (err) {
      console.error('Multi-angle inference error:', err)
      setScanError(err.message || 'Gagal memproses pemindaian multi-sudut.')
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

    if (scanResult.business_grading?.grade_breakdown) {
      const gb = scanResult.business_grading.grade_breakdown
      persenA = Math.round(gb.grade_a_percent || 0)
      persenB = Math.round(gb.grade_b_percent || 0)
      persenC = Math.round(gb.reject_percent || 0)
    } else if (selectedCommodity.toLowerCase().includes('terung')) {
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

    // Defensive clamping mencegah error floating rounding (misal 51% + 50% = 101%)
    if (persenA + persenC > 100) {
      persenC = Math.max(0, 100 - persenA)
    }

    const calculatedInput = {
      tanggal: getTodayDateString(),
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
      fotoKeranjang: scanResult.imagePreviewFront || scanResult.imagePreview || imagePreview,
      fotoKeranjangFront: scanResult.imagePreviewFront || null,
      fotoKeranjangBack: scanResult.imagePreviewBack || null,
      is_multi_angle: Boolean(scanResult.is_multi_angle),
      fotoNama: scanResult.is_multi_angle
        ? `${selectedCommodity.toLowerCase()}_multi_scan.jpg`
        : (imageFile?.name || `${selectedCommodity.toLowerCase()}_scan.jpg`),
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

          {/* Mode Inspeksi: Sudut Tunggal vs Multi-Sudut (Anti-Kecurangan / Goyang Nampan) */}
          <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ShieldRoundedIcon color={isMultiAngleMode ? 'success' : 'action'} />
                  <Typography variant="subtitle2" fontWeight={800}>
                    Mode Inspeksi: {isMultiAngleMode ? 'Multi-Sudut (2 Sisi — Goyang Nampan)' : 'Sudut Tunggal (1 Sisi Standar)'}
                  </Typography>
                  <Chip
                    label={isMultiAngleMode ? '🛡️ Anti-Bias Oklusi' : 'Cepat'}
                    size="small"
                    color={isMultiAngleMode ? 'success' : 'default'}
                    variant={isMultiAngleMode ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {isMultiAngleMode
                    ? 'Memeriksa 2 sisi (Depan & Belakang setelah nampan digoyang) untuk mendeteksi pembusukan tersembunyi.'
                    : 'Pengambilan 1 foto cepat tampak atas untuk penilaian mutu standar.'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant={isMultiAngleMode ? 'contained' : 'outlined'}
                color={isMultiAngleMode ? 'success' : 'inherit'}
                onClick={() => {
                  setIsMultiAngleMode((prev) => !prev)
                  handleClearImage()
                }}
                startIcon={<FlipCameraAndroidRoundedIcon />}
                sx={{ borderRadius: 2, fontWeight: 700, flexShrink: 0 }}
              >
                {isMultiAngleMode ? 'Beralih ke 1 Sisi' : 'Aktifkan Mode Multi-Sudut'}
              </Button>
            </Stack>
          </Box>
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
                {/* 1. KONDISI MODE MULTI-SUDUT AKTIF */}
                {isMultiAngleMode ? (
                  <Box>
                    {/* Stepper Indikator 2 Langkah */}
                    <Box sx={{ mb: 2.5, p: 2, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={`Langkah ${multiStep} dari 2`}
                            color="success"
                            size="small"
                            sx={{ fontWeight: 800 }}
                          />
                          <Typography variant="subtitle2" fontWeight={800} color="#166534">
                            {multiStep === 1
                              ? 'Langkah 1: Potret Sisi Depan / Tampak Atas'
                              : 'Langkah 2: Goyang Nampan / Balikkan Buah, lalu Potret Sisi Belakang'}
                          </Typography>
                        </Stack>
                        {multiStep === 2 && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            onClick={() => {
                              setImageFileFront(null)
                              setImagePreviewFront(null)
                              setMultiStep(1)
                            }}
                            startIcon={<RefreshRoundedIcon />}
                            sx={{ borderRadius: 1.5, fontSize: '0.75rem' }}
                          >
                            Ambil Ulang Sisi 1
                          </Button>
                        )}
                      </Stack>
                      <Typography variant="caption" color="#15803d" sx={{ display: 'block', mt: 0.5 }}>
                        {multiStep === 1
                          ? 'Arahkan kamera ke sampel panen dan tekan tombol potret.'
                          : 'Goyang nampan perlahan atau balikkan buah sampel secara acak agar sisi bawahnya terlihat oleh kamera.'}
                      </Typography>
                    </Box>

                    {/* Pratinjau Sisi 1 jika sedang di Langkah 2 */}
                    {multiStep === 2 && imagePreviewFront && (
                      <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box
                            component="img"
                            src={imagePreviewFront}
                            alt="Pratinjau Sisi 1 (Depan)"
                            sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1.5, border: '1px solid #94a3b8' }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <CheckCircleRoundedIcon color="success" sx={{ fontSize: 18 }} />
                              <Typography variant="body2" fontWeight={700}>
                                Sisi 1 (Depan) Siap &amp; Tersimpan
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              Sekarang ambil foto Sisi 2 di bawah untuk menyelesaikan analisis multi-sudut.
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    )}

                    <LiveCameraViewfinder
                      key={`viewfinder-step-${multiStep}`}
                      onCapture={handleLiveCameraCapture}
                      disabled={isScanning}
                    />

                    {isScanning && (
                      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ mt: 2 }}>
                        <CircularProgress size={20} color="primary" />
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          Sedang menganalisis 2 sudut foto dengan model YOLO11 {selectedCommodity}...
                        </Typography>
                      </Stack>
                    )}
                  </Box>
                ) : (
                  /* 2. KONDISI MODE SUDUT TUNGGAL */
                  <Box>
                    {imagePreview ? (
                      <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#0f172a', textAlign: 'center' }}>
                        <Box
                          component="img"
                          src={imagePreview}
                          alt="Pratinjau Hasil Foto Kamera"
                          sx={{ maxHeight: 380, maxWidth: '100%', objectFit: 'contain' }}
                        />
                        <IconButton
                          onClick={handleClearImage}
                          size="small"
                          disabled={isScanning}
                          sx={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            bgcolor: 'rgba(0,0,0,0.65)',
                            color: '#fff',
                            '&:hover': { bgcolor: '#dc2626' },
                          }}
                          title="Ambil Ulang Foto"
                        >
                          <DeleteOutlineRoundedIcon />
                        </IconButton>

                        <Box sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid', borderColor: 'divider' }}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1.5}>
                            <Box sx={{ textAlign: 'left' }}>
                              <Typography variant="body2" fontWeight={700}>
                                Foto Berhasil Diambil
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Kamera dinonaktifkan sementara untuk menghemat daya.
                              </Typography>
                            </Box>
                            <Button
                              variant="outlined"
                              color="inherit"
                              size="small"
                              disabled={isScanning}
                              onClick={handleClearImage}
                              startIcon={<RefreshRoundedIcon />}
                              sx={{ borderRadius: 2 }}
                            >
                              Ambil Ulang / Buka Kamera
                            </Button>
                          </Stack>
                        </Box>
                      </Box>
                    ) : (
                      <LiveCameraViewfinder
                        onCapture={handleLiveCameraCapture}
                        disabled={isScanning}
                      />
                    )}

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
              </Box>
            )}

            {/* TAB 1: UPLOAD FILE */}
            {activeTab === 1 && (
              <Box>
                {isMultiAngleMode ? (
                  <Box>
                    <input
                      ref={fileInputRefFront}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target?.files?.[0]
                        if (f) handleProcessFileForSide(f, 'front')
                      }}
                    />
                    <input
                      ref={fileInputRefBack}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target?.files?.[0]
                        if (f) handleProcessFileForSide(f, 'back')
                      }}
                    />

                    <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
                      Mode Multi-Sudut Aktif: Unggah 2 berkas foto (Sisi Depan dan Sisi Belakang setelah sampel digoyang) untuk mendeteksi cacat tersembunyi.
                    </Alert>

                    <Grid container spacing={2}>
                      {/* SISI 1: DEPAN */}
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Card variant="outlined" sx={{ borderRadius: 2.5, p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                            <Typography variant="subtitle2" fontWeight={800}>
                              1. Sisi Depan / Tampak Atas
                            </Typography>
                            {imagePreviewFront && (
                              <Chip label="Terpilih ✓" size="small" color="success" sx={{ fontWeight: 700, height: 22 }} />
                            )}
                          </Stack>

                          {imagePreviewFront ? (
                            <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#0f172a', textAlign: 'center', mb: 1 }}>
                              <Box
                                component="img"
                                src={imagePreviewFront}
                                alt="Pratinjau Sisi Depan"
                                sx={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain' }}
                              />
                              <Button
                                size="small"
                                variant="contained"
                                color="inherit"
                                onClick={() => fileInputRefFront.current?.click()}
                                sx={{ position: 'absolute', bottom: 8, right: 8, fontSize: '0.72rem' }}
                              >
                                Ganti Foto
                              </Button>
                            </Box>
                          ) : (
                            <Box
                              onClick={() => fileInputRefFront.current?.click()}
                              sx={{
                                border: '2px dashed #94a3b8',
                                borderRadius: 2,
                                p: 3,
                                textAlign: 'center',
                                cursor: 'pointer',
                                bgcolor: '#f8fafc',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 180,
                                '&:hover': { bgcolor: '#f1f5f9', borderColor: 'primary.main' },
                              }}
                            >
                              <CloudUploadRoundedIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                              <Typography variant="body2" fontWeight={700}>
                                Klik untuk Unggah Foto Sisi 1
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                Tampak atas keranjang / nampan
                              </Typography>
                            </Box>
                          )}
                        </Card>
                      </Grid>

                      {/* SISI 2: BELAKANG / GOYANG NAMPAN */}
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Card variant="outlined" sx={{ borderRadius: 2.5, p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                            <Typography variant="subtitle2" fontWeight={800}>
                              2. Sisi Belakang (Setelah Dibalik)
                            </Typography>
                            {imagePreviewBack && (
                              <Chip label="Terpilih ✓" size="small" color="success" sx={{ fontWeight: 700, height: 22 }} />
                            )}
                          </Stack>

                          {imagePreviewBack ? (
                            <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#0f172a', textAlign: 'center', mb: 1 }}>
                              <Box
                                component="img"
                                src={imagePreviewBack}
                                alt="Pratinjau Sisi Belakang"
                                sx={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain' }}
                              />
                              <Button
                                size="small"
                                variant="contained"
                                color="inherit"
                                onClick={() => fileInputRefBack.current?.click()}
                                sx={{ position: 'absolute', bottom: 8, right: 8, fontSize: '0.72rem' }}
                              >
                                Ganti Foto
                              </Button>
                            </Box>
                          ) : (
                            <Box
                              onClick={() => fileInputRefBack.current?.click()}
                              sx={{
                                border: '2px dashed #94a3b8',
                                borderRadius: 2,
                                p: 3,
                                textAlign: 'center',
                                cursor: 'pointer',
                                bgcolor: '#f8fafc',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 180,
                                '&:hover': { bgcolor: '#f1f5f9', borderColor: 'primary.main' },
                              }}
                            >
                              <FlipCameraAndroidRoundedIcon sx={{ fontSize: 40, color: '#059669', mb: 1 }} />
                              <Typography variant="body2" fontWeight={700}>
                                Klik untuk Unggah Foto Sisi 2
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                Foto setelah sampel dibalik / nampan digoyang
                              </Typography>
                            </Box>
                          )}
                        </Card>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 2.5, textAlign: 'center' }}>
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        disabled={!imageFileFront || !imageFileBack || isScanning}
                        onClick={() =>
                          triggerMultiInference(
                            imageFileFront,
                            imageFileBack,
                            imagePreviewFront,
                            imagePreviewBack,
                            selectedCommodity,
                            confidenceThreshold
                          )
                        }
                        startIcon={isScanning ? <CircularProgress size={18} color="inherit" /> : <ShieldRoundedIcon />}
                        sx={{ borderRadius: 2.5, fontWeight: 700, px: 4, py: 1.25 }}
                      >
                        {isScanning ? 'Menganalisis 2 Sudut...' : 'Mulai Pindai AI 2-Sudut (Multi-Angle)'}
                      </Button>
                      {(!imageFileFront || !imageFileBack) && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          * Harap lengkapi kedua foto (Sisi 1 &amp; Sisi 2) untuk memulai analisis
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ) : (
                  /* Single file upload */
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
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle1" fontWeight={800} color="#166534">
                        {scanResult.is_multi_angle
                          ? `Inspeksi Multi-Sudut (2 Sisi) Berhasil — ${selectedCommodity}`
                          : `Deteksi AI Berhasil — ${selectedCommodity}`}
                      </Typography>
                      {scanResult.is_multi_angle && (
                        <Chip
                          icon={<ShieldRoundedIcon />}
                          label="🛡️ Multi-Angle Verified"
                          size="small"
                          color="success"
                          sx={{ fontWeight: 800 }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Waktu Inferensi: {inference?.inference_time_ms || 0} ms &bull; Total Terdeteksi: {inference?.detections?.length || 0} butir
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1.25} flexWrap="wrap">
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    startIcon={<RefreshRoundedIcon />}
                    onClick={handleClearImage}
                    sx={{ borderRadius: 2 }}
                  >
                    Pindai Ulang
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<VerifiedRoundedIcon />}
                    onClick={() => setIsCertModalOpen(true)}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    Sertifikat QC
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<SaveRoundedIcon />}
                    onClick={() => setIsSaveModalOpen(true)}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    Simpan ke Rekap
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

          {/* Notifikasi Peringatan Bias Oklusi (Anti-Kecurangan 2-Sisi) */}
          {scanResult.occlusion_analysis?.occlusion_bias_detected && (
            <Alert
              severity="warning"
              icon={<WarningAmberRoundedIcon />}
              sx={{ borderRadius: 2.5, bgcolor: '#fffbeb', borderColor: '#fde68a' }}
            >
              <Typography variant="subtitle2" fontWeight={800} color="#92400e">
                🛡️ Deteksi Bias Oklusi (Anti-Kecurangan Berhasil Menangkap Cacat Tersembunyi)
              </Typography>
              <Typography variant="body2" color="#b45309" sx={{ mt: 0.5 }}>
                {scanResult.occlusion_analysis.warning_message ||
                  `Terdeteksi disparitas cacat +${scanResult.occlusion_analysis.defect_delta_percent}% pada sisi belakang sampel panen.`}
              </Typography>
              <Typography variant="caption" color="#92400e" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                Indeks Konsistensi Lot: {scanResult.occlusion_analysis.consistency_index_percent ?? 85}% • Buah afkir berhasil dicegat dari percampuran Grade A.
              </Typography>
            </Alert>
          )}

          {/* Tab Pemilih Sudut Visualisasi (Hanya muncul jika pemindaian Multi-Sudut) */}
          {scanResult.is_multi_angle && scanResult.imagePreviewBack && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
              <Tabs
                value={activeAngleView}
                onChange={(_, val) => setActiveAngleView(val)}
                sx={{ minHeight: 38 }}
              >
                <Tab
                  label="Visualisasi Sisi 1 (Depan / Tampak Atas)"
                  icon={<CheckCircleRoundedIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ fontWeight: 700, minHeight: 38, textTransform: 'none' }}
                />
                <Tab
                  label="Visualisasi Sisi 2 (Belakang / Goyang Nampan)"
                  icon={<FlipCameraAndroidRoundedIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ fontWeight: 700, minHeight: 38, textTransform: 'none' }}
                />
              </Tabs>
            </Box>
          )}

          {/* Canvas Overlay Anotasi AI */}
          <ScanCanvasOverlay
            commodity={selectedCommodity}
            detections={
              scanResult.is_multi_angle && scanResult.imagePreviewBack
                ? activeAngleView === 0
                  ? scanResult.inference_result?.detections_front || scanResult.inference_result?.detections || []
                  : scanResult.inference_result?.detections_back || scanResult.inference_result?.detections || []
                : inference?.detections || []
            }
            imageDimensions={
              scanResult.is_multi_angle && scanResult.imagePreviewBack
                ? activeAngleView === 0
                  ? scanResult.inference_result?.image_dimensions_front || scanResult.inference_result?.image_dimensions
                  : scanResult.inference_result?.image_dimensions_back || scanResult.inference_result?.image_dimensions
                : inference?.image_dimensions
            }
            imageUrl={
              scanResult.is_multi_angle && scanResult.imagePreviewBack
                ? activeAngleView === 0
                  ? scanResult.imagePreviewFront || scanResult.imagePreview
                  : scanResult.imagePreviewBack || scanResult.imagePreview
                : scanResult.imagePreview
            }
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
                        {formatRupiah(pricing.reference_price_per_kg || pricing.base_price_per_kg || REFERENCE_PRICES_PER_KG[selectedCommodity] || 10000)} <Typography component="span" variant="caption">/ kg</Typography>
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

      {/* DIALOG PRATINJAU SERTIFIKAT MUTU QC */}
      <Dialog
        open={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <VerifiedRoundedIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              Sertifikat Mutu QC Resmi (A4)
            </Typography>
          </Stack>
          <IconButton onClick={() => setIsCertModalOpen(false)} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
          {scanResult && (
            <QCPrintCertificate
              batch={{
                id: scanResult.scan_id || 'QC-SCAN',
                tanggal: getTodayDateString(),
                komoditas: selectedCommodity,
                beratKg: Number(saveWeight ? saveWeight.replace(',', '.') : 10) || 10,
                fotoKeranjang: scanResult.imagePreview,
                ai_scan_performed: true,
                inference: inference,
                pricing: pricing,
                scanResult: scanResult,
                business_grading: scanResult.business_grading,
              }}
              showPrintButton
              onPrint={() => window.print()}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsCertModalOpen(false)} color="inherit">
            Tutup
          </Button>
          <Button
            onClick={() => window.print()}
            variant="contained"
            color="primary"
            startIcon={<PrintRoundedIcon />}
          >
            Cetak / Unduh PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
