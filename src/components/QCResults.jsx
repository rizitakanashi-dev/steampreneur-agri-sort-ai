import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded'
import FlipCameraAndroidRoundedIcon from '@mui/icons-material/FlipCameraAndroidRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import PrintRoundedIcon from '@mui/icons-material/PrintRounded'
import RecyclingRoundedIcon from '@mui/icons-material/RecyclingRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { PieChart } from '@mui/x-charts/PieChart'

import { ScanCanvasOverlay } from './ScanCanvasOverlay.jsx'
import { QCPrintCertificate } from './QCPrintCertificate.jsx'
import { PostHarvestPathologyCards } from './PostHarvestPathologyCards.jsx'
import { getClassTheme } from '../utils/canvasOverlayHelper.js'

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

function formatRupiah(value) {
  return typeof value === 'number' && Number.isFinite(value) ? rupiahFormatter.format(value) : 'Belum tersedia'
}

function QualityIndicator({ color, icon: Icon, label, percentage, count, weight }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: 'center',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        flex: 1,
        minWidth: { xs: '100%', sm: 160 },
        p: 1.75,
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          bgcolor: `${color}18`,
          borderRadius: 2,
          color,
          display: 'flex',
          height: 42,
          justifyContent: 'center',
          width: 42,
        }}
      >
        <Icon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography color="text.secondary" noWrap variant="body2">
          {label}
        </Typography>
        <Typography color={color} fontWeight={800} variant="h6">
          {formatNumber(percentage)}%
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {count !== undefined ? `${count} butir` : `${formatNumber(weight)} kg`}
        </Typography>
      </Box>
    </Stack>
  )
}

function ActionRecommendationCard({ recommendationNote, rejectCount, rejectPercentage }) {
  if (recommendationNote) {
    const isWarning = (rejectCount && rejectCount > 0) || (rejectPercentage && rejectPercentage > 0)
    return (
      <Alert
        icon={isWarning ? <WarningAmberRoundedIcon /> : <CheckCircleRoundedIcon />}
        severity={isWarning ? 'warning' : 'success'}
        sx={{ borderRadius: 2 }}
      >
        <Typography fontWeight={700} variant="body2">
          Rekomendasi Tindakan Sortir:
        </Typography>
        <Typography variant="body2">{recommendationNote}</Typography>
      </Alert>
    )
  }

  if (typeof rejectPercentage === 'number' && rejectPercentage > 0) {
    return (
      <Alert icon={<RecyclingRoundedIcon />} severity="warning" sx={{ borderRadius: 2 }}>
        <Typography fontWeight={700} variant="body2">
          Pisahkan produk Reject sebelum pengiriman.
        </Typography>
        <Typography variant="body2">
          Sebanyak {formatNumber(rejectPercentage)}% terindikasi cacat/reject. Pisahkan segera untuk mencegah penularan pembusukan.
        </Typography>
      </Alert>
    )
  }

  return (
    <Alert icon={<LocalShippingRoundedIcon />} severity="info" sx={{ borderRadius: 2 }}>
      <Typography fontWeight={700} variant="body2">
        Batch siap dipasarkan.
      </Typography>
      <Typography variant="body2">
        Seluruh sampel berada dalam kondisi prima untuk dipasarkan ke mitra pengepul.
      </Typography>
    </Alert>
  )
}

export function QCResults({ batch, onBackToInput, onViewRecap }) {
  const [selectedDetection, setSelectedDetection] = useState(null)
  const [isCertModalOpen, setIsCertModalOpen] = useState(false)
  const [viewAngleMode, setViewAngleMode] = useState('compare') // 'compare' | 'front' | 'back'

  if (!batch?.hasil && !batch?.scanResult) {
    return (
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '50vh',
          px: 2,
          textAlign: 'center',
        }}
      >
        <AssessmentRoundedIcon color="disabled" sx={{ fontSize: 64, mb: 2 }} />
        <Typography gutterBottom variant="h5">
          Belum Ada Hasil Pemeriksaan QC
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 460, mb: 3 }} variant="body2">
          Ambil foto keranjang panen atau input parameter mutu dari tab QC Scanner untuk melihat analisis visual dan estimasi harga.
        </Typography>
        <Button onClick={onBackToInput} startIcon={<ArrowBackRoundedIcon />} variant="contained">
          Mulai Pemindaian Batch
        </Button>
      </Box>
    )
  }

  const { hasil, scanResult } = batch
  const hasAiScan = Boolean(scanResult?.inference_result)
  const inference = scanResult?.inference_result
  const pricing = scanResult?.smart_pricing
  const commodity = batch.komoditas || scanResult?.commodity || 'Tomat'
  const isEggplant = commodity.toLowerCase().includes('terung') || commodity.toLowerCase().includes('terong')
  const isMultiAngle = Boolean(
    batch.is_multi_angle ||
    scanResult?.is_multi_angle ||
    scanResult?.inspection_mode?.includes('multi')
  )
  const occlusion = scanResult?.occlusion_analysis

  const executionStatus =
    batch.execution_status ||
    scanResult?.execution_status ||
    (batch.is_simulated || scanResult?.is_simulated
      ? 'simulated'
      : (hasAiScan && (isEggplant || commodity.toLowerCase().includes('tomat'))
        ? 'ai_detected'
        : 'unsupported'))
  const statusDetails = batch.status_details || scanResult?.status_details || {}

  // Susun data untuk Donut PieChart
  let pieChartData = []
  if (hasAiScan && inference) {
    const counts = inference.object_counts || {}
    if (isEggplant && (counts.grade_a || counts.grade_b || counts.extra_class || counts.class_1 || counts.class_2 || counts.reject)) {
      const gradeACount = counts.grade_a ?? ((counts.extra_class || 0) + (counts.class_1 || 0))
      const gradeBCount = counts.grade_b ?? (counts.class_2 || 0)
      pieChartData = [
        { id: 0, value: gradeACount, label: 'Grade A', color: '#059669' },
        { id: 1, value: gradeBCount, label: 'Grade B', color: '#d97706' },
        { id: 2, value: counts.reject || 0, label: 'Reject', color: '#dc2626' },
      ].filter((d) => d.value > 0)
    } else if (counts.fresh_tomato || counts.rotten_tomato) {
      pieChartData = [
        { id: 0, value: counts.fresh_tomato || 0, label: 'Tomat Segar', color: '#047857' },
        { id: 1, value: counts.rotten_tomato || 0, label: 'Tomat Busuk', color: '#b91c1c' },
      ].filter((d) => d.value > 0)
    }
  }

  // Fallback proporsi dari hasil persentase batch jika data objek AI belum terisi
  if (pieChartData.length === 0 && hasil) {
    pieChartData = [
      { id: 0, value: hasil.persenA || 0, label: 'Grade A', color: '#289d67' },
      { id: 1, value: hasil.persenB || 0, label: 'Grade B', color: '#c68f2f' },
      { id: 2, value: hasil.persenC || 0, label: 'Reject', color: '#a94f46' },
    ].filter((d) => d.value > 0)
  }

  const photoFrontUrl =
    batch.fotoKeranjangFront ||
    batch.fotoKeranjang ||
    scanResult?.imagePreviewFront ||
    scanResult?.imagePreview
  const photoBackUrl = batch.fotoKeranjangBack || scanResult?.imagePreviewBack || null
  const hasDualPhoto = Boolean(isMultiAngle && photoBackUrl && photoFrontUrl)

  const detectionsFront =
    inference?.detections_front ||
    scanResult?.raw_front?.inference_result?.detections ||
    (inference?.detections ? inference.detections.filter((d) => d.angle_source !== 'back') : [])

  const detectionsBack =
    inference?.detections_back ||
    scanResult?.raw_back?.inference_result?.detections ||
    (inference?.detections ? inference.detections.filter((d) => d.angle_source === 'back') : [])

  const dimensionsFront =
    inference?.image_dimensions_front || inference?.image_dimensions || { width: 1280, height: 720 }
  const dimensionsBack =
    inference?.image_dimensions_back || inference?.image_dimensions || { width: 1280, height: 720 }

  const currentPhotoUrl =
    viewAngleMode === 'back' && photoBackUrl ? photoBackUrl : photoFrontUrl

  const currentDetections =
    viewAngleMode === 'back'
      ? detectionsBack
      : hasDualPhoto && viewAngleMode === 'front'
        ? detectionsFront
        : (inference?.detections || [])

  const currentDimensions =
    viewAngleMode === 'back' ? dimensionsBack : dimensionsFront

  const photoUrl = currentPhotoUrl

  return (
    <>
      <Stack className="qc-screen-only" spacing={3}>
        {/* Header Utama Hasil QC */}
        <Card elevation={2} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Stack alignItems="center" direction="row" spacing={1.25}>
                  {executionStatus === 'ai_detected' ? (
                    <AutoAwesomeRoundedIcon color="primary" sx={{ fontSize: 28 }} />
                  ) : (
                    <AssessmentRoundedIcon color="primary" sx={{ fontSize: 28 }} />
                  )}
                  <Typography fontWeight={800} variant="h5">
                    Hasil Pemeriksaan Mutu Panen
                  </Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
                  Batch ID: <strong>{batch.id}</strong> • Tanggal: {batch.tanggal} • Komoditas: <strong>{commodity}</strong>
                </Typography>
              </Box>

              <Stack alignItems={{ xs: 'flex-start', sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {isMultiAngle && executionStatus === 'ai_detected' && (
                  <Chip
                    color="success"
                    icon={<VerifiedRoundedIcon />}
                    label="🛡️ Multi-Angle Verified"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
                {isMultiAngle && executionStatus === 'needs_review' && (
                  <Chip
                    color="warning"
                    icon={<WarningAmberRoundedIcon />}
                    label="Multi-Angle (Perlu Review)"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
                {isMultiAngle && executionStatus === 'simulated' && (
                  <Chip
                    color="info"
                    icon={<AssessmentRoundedIcon />}
                    label="Multi-Angle (Simulasi)"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
                {executionStatus === 'ai_detected' && (
                  <Chip
                    color="success"
                    icon={<VerifiedRoundedIcon />}
                    label="AI Computer Vision (Optimal)"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
                {executionStatus === 'needs_review' && (
                  <Chip
                    color="warning"
                    icon={<WarningAmberRoundedIcon />}
                    label="Perlu Verifikasi Manual"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
                {executionStatus === 'simulated' && (
                  <Chip
                    color="info"
                    icon={<AssessmentRoundedIcon />}
                    label="Simulasi (Non-AI)"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
                {executionStatus === 'unsupported' && (
                  <Chip
                    color="default"
                    icon={<HelpOutlineRoundedIcon />}
                    label="Model AI Belum Didukung"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
                {executionStatus === 'model_unavailable' && (
                  <Chip
                    color="error"
                    icon={<ErrorOutlineRoundedIcon />}
                    label="Model AI Tidak Tersedia"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
                <Button
                  color="primary"
                  onClick={() => setIsCertModalOpen(true)}
                  size="small"
                  startIcon={<VerifiedRoundedIcon />}
                  sx={{ fontWeight: 700 }}
                  variant="outlined"
                >
                  Sertifikat QC
                </Button>
                <Tooltip title="Cetak atau simpan bukti QC resmi sebagai PDF (A4)">
                  <IconButton aria-label="Cetak bukti QC" onClick={() => window.print()} size="small">
                    <PrintRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Banner Peringatan Status Eksekusi */}
        {executionStatus === 'needs_review' && (
          <Alert
            severity="warning"
            icon={<WarningAmberRoundedIcon />}
            sx={{ borderRadius: 2.5, bgcolor: '#fffbeb', borderColor: '#fde68a' }}
          >
            <Typography variant="subtitle2" fontWeight={800} color="#92400e">
              ⚠️ Perlu Verifikasi Manual Petugas
            </Typography>
            <Typography variant="body2" color="#b45309" sx={{ mt: 0.5 }}>
              {statusDetails.message || 'Tingkat keyakinan deteksi rendah atau citra kurang optimal. Harap periksa kondisi fisik sampel secara langsung sebelum transaksi.'}
            </Typography>
          </Alert>
        )}
        {executionStatus === 'unsupported' && (
          <Alert
            severity="info"
            icon={<InfoOutlinedIcon />}
            sx={{ borderRadius: 2.5, bgcolor: '#f0f9ff', borderColor: '#bae6fd' }}
          >
            <Typography variant="subtitle2" fontWeight={800} color="#0369a1">
              ℹ️ Pencatatan Mutu Manual ({commodity})
            </Typography>
            <Typography variant="body2" color="#0c4a6e" sx={{ mt: 0.5 }}>
              {statusDetails.message || `Komoditas ${commodity} belum didukung oleh model Computer Vision AI. Hasil grading dan estimasi harga menggunakan acuan standar pasar manual.`}
            </Typography>
          </Alert>
        )}
        {executionStatus === 'model_unavailable' && (
          <Alert
            severity="error"
            icon={<ErrorOutlineRoundedIcon />}
            sx={{ borderRadius: 2.5, bgcolor: '#fef2f2', borderColor: '#fecaca' }}
          >
            <Typography variant="subtitle2" fontWeight={800} color="#991b1b">
              ⛔ Model AI Tidak Dapat Digunakan
            </Typography>
            <Typography variant="body2" color="#b91c1c" sx={{ mt: 0.5 }}>
              {statusDetails.message || `Model AI untuk ${commodity} tidak tersedia di server atau mengalami kendala runtime. Menampilkan data estimasi acuan lokal.`}
            </Typography>
          </Alert>
        )}
        {executionStatus === 'simulated' && (
          <Alert
            severity="info"
            icon={<InfoOutlinedIcon />}
            sx={{ borderRadius: 2.5, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}
          >
            <Typography variant="subtitle2" fontWeight={800} color="#334155">
              🔬 Hasil Simulasi Pengujian (Non-AI)
            </Typography>
            <Typography variant="body2" color="#475569" sx={{ mt: 0.5 }}>
              {statusDetails.message || 'Hasil pemindaian ini merupakan data sintetis simulasi untuk keperluan uji coba/demonstrasi non-AI.'}
            </Typography>
          </Alert>
        )}

        {/* Toolbar Mode Inspeksi Multi-Sudut (Jika Tersedia Dual-Angle) */}
        {hasDualPhoto && (
          <Card elevation={1} sx={{ borderRadius: 3, p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Stack
              alignItems={{ xs: 'flex-start', md: 'center' }}
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              spacing={2}
            >
              <Stack alignItems="center" direction="row" spacing={1.5}>
                <Box
                  sx={{
                    alignItems: 'center',
                    bgcolor: '#dcfce7',
                    borderRadius: 2,
                    color: '#16a34a',
                    display: 'flex',
                    height: 42,
                    justifyContent: 'center',
                    width: 42,
                  }}
                >
                  <ShieldRoundedIcon fontSize="medium" />
                </Box>
                <Box>
                  <Typography fontWeight={800} variant="subtitle1">
                    Inspeksi Anti-Kecurangan 2-Sisi (Dual-Angle Occlusion Verification)
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    Verifikasi rotasi fisik 360° melalui protokol Shake & Roll untuk mengeliminasi bias cacat tersembunyi
                  </Typography>
                </Box>
              </Stack>

              <ToggleButtonGroup
                aria-label="Mode tampilan inspeksi sudut"
                exclusive
                onChange={(e, nextVal) => {
                  if (nextVal) setViewAngleMode(nextVal)
                }}
                size="small"
                value={viewAngleMode}
              >
                <ToggleButton sx={{ fontWeight: 700, px: 1.5, textTransform: 'none' }} value="compare">
                  <CompareArrowsRoundedIcon sx={{ mr: 0.75, fontSize: 18 }} />
                  2-Sisi Bersandingan
                </ToggleButton>
                <ToggleButton sx={{ fontWeight: 700, px: 1.5, textTransform: 'none' }} value="front">
                  📸 Sisi 1 (Atas)
                </ToggleButton>
                <ToggleButton sx={{ fontWeight: 700, px: 1.5, textTransform: 'none' }} value="back">
                  <FlipCameraAndroidRoundedIcon sx={{ mr: 0.75, fontSize: 18 }} />
                  Sisi 2 (Balik)
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Card>
        )}

      {/* Bagian Visual: Canvas Bounding Box & Diagram Donat */}
      {hasDualPhoto && viewAngleMode === 'compare' ? (
        <Grid container spacing={2.5}>
          {/* Kolom Sisi 1: Permukaan Atas / Sebelum Goyang */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Box
                sx={{
                  alignItems: 'center',
                  bgcolor: '#f0fdf4',
                  borderBottom: '1px solid #bbf7d0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  p: 1.5,
                }}
              >
                <Typography color="#166534" fontWeight={800} variant="subtitle2">
                  📸 Sisi 1: Permukaan Atas (Sebelum Nampan Digoyang)
                </Typography>
                <Chip
                  color="success"
                  label={`${detectionsFront.length} Objek`}
                  size="small"
                  sx={{ fontWeight: 700 }}
                  variant="outlined"
                />
              </Box>
              <ScanCanvasOverlay
                commodity={commodity}
                detections={detectionsFront}
                imageDimensions={dimensionsFront}
                imageUrl={photoFrontUrl}
                onSelectDetection={(det) => setSelectedDetection(det)}
              />
            </Card>
          </Grid>

          {/* Kolom Sisi 2: Permukaan Bawah / Setelah Shake & Roll */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Box
                sx={{
                  alignItems: 'center',
                  bgcolor: '#eff6ff',
                  borderBottom: '1px solid #bfdbfe',
                  display: 'flex',
                  justifyContent: 'space-between',
                  p: 1.5,
                }}
              >
                <Typography color="#1e40af" fontWeight={800} variant="subtitle2">
                  🔄 Sisi 2: Permukaan Bawah (Setelah Shake & Roll Nampan)
                </Typography>
                <Chip
                  color="primary"
                  label={`${detectionsBack.length} Objek`}
                  size="small"
                  sx={{ fontWeight: 700 }}
                  variant="outlined"
                />
              </Box>
              <ScanCanvasOverlay
                commodity={commodity}
                detections={detectionsBack}
                imageDimensions={dimensionsBack}
                imageUrl={photoBackUrl}
                onSelectDetection={(det) => setSelectedDetection(det)}
              />
            </Card>
          </Grid>

          {/* Panel Statistik & Donut Chart saat Mode Bersandingan */}
          <Grid size={{ xs: 12 }}>
            <Card elevation={2} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Grid container alignItems="center" spacing={3}>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography fontWeight={700} variant="h6">
                        Agregasi Mutu 2-Sudut Pandang
                      </Typography>
                      <Inventory2RoundedIcon color="primary" />
                    </Stack>
                    {pieChartData.length > 0 ? (
                      <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'center', my: 1 }}>
                        <PieChart
                          height={200}
                          series={[
                            {
                              data: pieChartData,
                              innerRadius: 50,
                              outerRadius: 85,
                              paddingAngle: 3,
                              cornerRadius: 4,
                            },
                          ]}
                          width={280}
                        />
                      </Box>
                    ) : (
                      <Alert severity="info">Tidak ada data proporsi untuk ditampilkan.</Alert>
                    )}
                  </Grid>

                  <Grid size={{ xs: 12, md: 7 }}>
                    <Typography fontWeight={700} sx={{ mb: 1.5 }} variant="subtitle1">
                      Ringkasan Validasi Anti-Kecurangan Lot
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <Typography color="text.secondary" variant="caption">Objek Sisi 1</Typography>
                          <Typography fontWeight={800} variant="h6">{detectionsFront.length}</Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <Typography color="text.secondary" variant="caption">Objek Sisi 2</Typography>
                          <Typography fontWeight={800} variant="h6">{detectionsBack.length}</Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Box
                          sx={{
                            p: 1.5,
                            bgcolor: occlusion?.occlusion_bias_detected ? '#fffbeb' : '#f0fdf4',
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: occlusion?.occlusion_bias_detected ? '#fde68a' : '#bbf7d0',
                            textAlign: 'center',
                          }}
                        >
                          <Typography color="text.secondary" variant="caption">Disparitas Cacat</Typography>
                          <Typography
                            color={occlusion?.occlusion_bias_detected ? 'warning.main' : 'success.main'}
                            fontWeight={800}
                            variant="h6"
                          >
                            {occlusion?.defect_delta_percent !== undefined ? `+${occlusion.defect_delta_percent}%` : '0%'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                          <Typography color="text.secondary" variant="caption">Konsistensi Lot</Typography>
                          <Typography color="success.main" fontWeight={800} variant="h6">
                            {occlusion?.consistency_index_percent ?? 92}%
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    <Typography color="text.secondary" sx={{ mt: 2 }} variant="body2">
                      💡 <strong>Verifikasi Rotasi Stokastik:</strong> Deteksi bounding box memverifikasi bahwa seluruh butir buah telah bergeser/teracak secara fisik di atas nampan (Centroid Displacement Check), memastikan tidak ada buah busuk yang disembunyikan di bawah tumpukan.
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={2.5}>
          {/* Kolom Kiri: Visualisasi Canvas Citra (Jika ada foto) */}
          {photoUrl && (
            <Grid size={{ xs: 12, md: 7 }}>
              <ScanCanvasOverlay
                commodity={commodity}
                detections={currentDetections}
                imageDimensions={currentDimensions}
                imageUrl={currentPhotoUrl}
                onSelectDetection={(det) => setSelectedDetection(det)}
              />
            </Grid>
          )}

          {/* Kolom Kanan: Donut Chart Proporsi & Ringkasan Sampel */}
          <Grid size={{ xs: 12, md: photoUrl ? 5 : 12 }}>
            <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
                  <Typography fontWeight={700} variant="h6">
                    Proporsi Kondisi Sampel
                  </Typography>
                  <Inventory2RoundedIcon color="primary" />
                </Stack>

                {pieChartData.length > 0 ? (
                  <Box
                    sx={{
                      alignItems: 'center',
                      display: 'flex',
                      justifyContent: 'center',
                      my: 1,
                    }}
                  >
                    <PieChart
                      height={220}
                      series={[
                        {
                          data: pieChartData,
                          innerRadius: 55,
                          outerRadius: 95,
                          paddingAngle: 3,
                          cornerRadius: 4,
                        },
                      ]}
                      width={290}
                    />
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ my: 2 }}>
                    Tidak ada data proporsi untuk ditampilkan.
                  </Alert>
                )}

                <Divider sx={{ my: 1.5 }} />

                {/* Rincian Angka Sampel */}
                {hasAiScan && inference ? (
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography color="text.secondary" variant="body2">
                        Total Buah Terdeteksi:
                      </Typography>
                      <Typography fontWeight={700} variant="body2">
                        {inference.object_counts?.total || 0} butir
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography color="text.secondary" variant="body2">
                        Waktu Inferensi AI:
                      </Typography>
                      <Typography fontWeight={600} variant="body2">
                        {inference.inference_time_ms} ms
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography color="text.secondary" variant="body2">
                        Versi Model:
                      </Typography>
                      <Typography color="text.secondary" variant="caption">
                        {inference.model_version}
                      </Typography>
                    </Stack>
                  </Stack>
                ) : (
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography color="text.secondary" variant="body2">
                        Berat Total Batch:
                      </Typography>
                      <Typography fontWeight={700} variant="body2">
                        {formatNumber(batch.beratKg)} kg
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography color="text.secondary" variant="body2">
                        Metode Penilaian:
                      </Typography>
                      <Typography fontWeight={600} variant="body2">
                        Form Input Manual
                      </Typography>
                    </Stack>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Indikator Mutu Spesifik Komoditas */}
      <Card elevation={2} sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography fontWeight={700} sx={{ mb: 2 }} variant="h6">
            Indikator Mutu Deteksi ({commodity})
          </Typography>

          {hasAiScan && isEggplant ? (
            // Indikator 3 Kelas Terung (Grade A, Grade B, Reject)
            <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={2}>
              <QualityIndicator
                color="#059669"
                count={
                  inference?.object_counts?.grade_a ??
                  ((inference?.object_counts?.extra_class || 0) + (inference?.object_counts?.class_1 || 0))
                }
                icon={AssessmentRoundedIcon}
                label="Grade A (Mutu Utama)"
                percentage={
                  pricing?.condition_ratios?.grade_a_percent ??
                  ((pricing?.condition_ratios?.extra_class_percent || 0) +
                    (pricing?.condition_ratios?.class_1_percent || 0))
                }
              />
              <QualityIndicator
                color="#d97706"
                count={inference?.object_counts?.grade_b ?? (inference?.object_counts?.class_2 || 0)}
                icon={AssessmentRoundedIcon}
                label="Grade B (Mutu Standar)"
                percentage={
                  pricing?.condition_ratios?.grade_b_percent ??
                  (pricing?.condition_ratios?.class_2_percent || 0)
                }
              />
              <QualityIndicator
                color="#dc2626"
                count={inference?.object_counts?.reject || 0}
                icon={RecyclingRoundedIcon}
                label="Reject (Afkir)"
                percentage={pricing?.condition_ratios?.reject_percent || 0}
              />
            </Stack>
          ) : hasAiScan ? (
            // Indikator 2 Kelas Tomat
            <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={2}>
              <QualityIndicator
                color="#047857"
                count={inference?.object_counts?.fresh_tomato || 0}
                icon={CheckCircleRoundedIcon}
                label="Tomat Segar"
                percentage={inference?.condition_ratios?.fresh_ratio_percent || 0}
              />
              <QualityIndicator
                color="#b91c1c"
                count={inference?.object_counts?.rotten_tomato || 0}
                icon={RecyclingRoundedIcon}
                label="Tomat Busuk/Cacat"
                percentage={inference?.condition_ratios?.rotten_ratio_percent || 0}
              />
            </Stack>
          ) : (
            // Indikator Manual Grade A/B/Reject
            <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={2}>
              <QualityIndicator
                color="#289d67"
                icon={AssessmentRoundedIcon}
                label="Grade A"
                percentage={hasil.persenA}
                weight={hasil.beratA}
              />
              <QualityIndicator
                color="#c68f2f"
                icon={AssessmentRoundedIcon}
                label="Grade B"
                percentage={hasil.persenB}
                weight={hasil.beratB}
              />
              <QualityIndicator
                color="#a94f46"
                icon={RecyclingRoundedIcon}
                label="Reject"
                percentage={hasil.persenC}
                weight={hasil.beratC}
              />
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Kartu Estimasi Ekonomi & Smart Pricing (STEAM Math) */}
      <Card elevation={2} sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 2 }}
          >
            <Stack alignItems="center" direction="row" spacing={1}>
              <TrendingUpRoundedIcon color="primary" />
              <Typography fontWeight={700} variant="h6">
                Proyeksi Nilai Ekonomi (Smart Pricing)
              </Typography>
            </Stack>
            <Chip
              color="warning"
              label={pricing?.data_status === 'simulasi' ? 'Acuan Lokal (Simulasi)' : 'Simulasi'}
              size="small"
              variant="outlined"
            />
          </Stack>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ p: 2, bgcolor: 'rgba(3, 110, 69, 0.06)', borderRadius: 2, border: '1px solid rgba(3, 110, 69, 0.18)' }}>
                <Typography color="text.secondary" variant="body2">
                  Estimasi Nilai Jual Panen
                </Typography>
                <Typography color="primary.main" fontWeight={800} sx={{ mt: 0.5 }} variant="h5">
                  {formatRupiah(pricing?.estimated_economic_value ?? hasil?.totalNilai)}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="caption">
                  {batch.beratKg ? `Untuk bobot total ${batch.beratKg} kg` : 'Berdasarkan rasio sampel'}
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ p: 2, bgcolor: 'rgba(185, 28, 28, 0.05)', borderRadius: 2, border: '1px solid rgba(185, 28, 28, 0.18)' }}>
                <Typography color="text.secondary" variant="body2">
                  Potensi Risiko Susut / Afkir
                </Typography>
                <Typography color="error.main" fontWeight={800} sx={{ mt: 0.5 }} variant="h5">
                  {formatRupiah(pricing?.potential_loss_value ?? hasil?.nilaiC ?? 0)}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="caption">
                  Nilai yang hilang jika tidak disortir
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Typography color="text.secondary" variant="body2">
                  Harga Acuan Pasar
                </Typography>
                <Typography fontWeight={800} sx={{ mt: 0.5 }} variant="h5">
                  {formatRupiah(pricing?.reference_price_per_kg || 12000)}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="caption">
                  per kg ({pricing?.region || 'Sumatera Barat'})
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Notifikasi Deteksi Oklusi Cacat Tersembunyi */}
          {occlusion?.occlusion_bias_detected && (
            <Alert
              severity="warning"
              icon={<WarningAmberRoundedIcon />}
              sx={{ mt: 2.5, borderRadius: 2.5, bgcolor: '#fffbeb', borderColor: '#fde68a' }}
            >
              <Typography variant="subtitle2" fontWeight={800} color="#92400e">
                🛡️ Deteksi Bias Oklusi (Anti-Kecurangan 2-Sisi Berhasil)
              </Typography>
              <Typography variant="body2" color="#b45309" sx={{ mt: 0.5 }}>
                {occlusion.warning_message || `Terdeteksi disparitas cacat +${occlusion.defect_delta_percent}% pada sisi belakang sampel.`}
              </Typography>
              <Typography variant="caption" color="#92400e" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                Indeks Konsistensi Lot: {occlusion.consistency_index_percent ?? 85}% • Cacat berhasil dicegat sebelum masuk ke pasar modern.
              </Typography>
            </Alert>
          )}

          {/* Rekomendasi Tindakan */}
          <Box sx={{ mt: 2.5 }}>
            <ActionRecommendationCard
              recommendationNote={pricing?.recommendation_note}
              rejectCount={inference?.object_counts?.rotten_tomato || inference?.object_counts?.reject}
              rejectPercentage={inference?.condition_ratios?.rotten_ratio_percent || hasil?.persenC}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Kartu Edukasi Sains Patologi Pascapanen (Pilar S dari STEAM) */}
      <PostHarvestPathologyCards
        commodity={commodity}
        rejectCount={inference?.object_counts?.rotten_tomato || inference?.object_counts?.reject || 0}
        rejectPercent={inference?.condition_ratios?.rotten_ratio_percent || hasil?.persenC || 0}
      />

      {/* Tombol Aksi Navigasi */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Button
          fullWidth
          onClick={onBackToInput}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ maxWidth: { sm: 200 } }}
          variant="outlined"
        >
          Scan Batch Lain
        </Button>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            onClick={() => setIsCertModalOpen(true)}
            startIcon={<VerifiedRoundedIcon />}
            sx={{ minWidth: { sm: 190 } }}
            variant="outlined"
          >
            Lihat Sertifikat Resmi
          </Button>
          <Button
            onClick={onViewRecap}
            sx={{ minWidth: { sm: 200 } }}
            variant="contained"
          >
            Buka Rekap Data Panen
          </Button>
        </Stack>
      </Stack>
    </Stack>

    {/* Sertifikat Resmi untuk @media print */}
    <Box className="qc-print-only">
      <QCPrintCertificate batch={batch} />
    </Box>

    {/* Dialog Pratinjau Sertifikat QC di Layar Sebelum Cetak */}
    <Dialog
      fullWidth
      maxWidth="md"
      onClose={() => setIsCertModalOpen(false)}
      open={isCertModalOpen}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack alignItems="center" direction="row" spacing={1}>
          <VerifiedRoundedIcon color="primary" />
          <Typography fontWeight={700} variant="h6">
            Pratinjau Sertifikat Uji Mutu Digital
          </Typography>
        </Stack>
        <IconButton aria-label="Tutup" onClick={() => setIsCertModalOpen(false)} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 }, bgcolor: '#f9fafb' }}>
        <QCPrintCertificate
          batch={batch}
          onPrint={() => window.print()}
          showPrintButton
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={() => setIsCertModalOpen(false)} variant="outlined">
          Tutup
        </Button>
        <Button
          onClick={() => window.print()}
          startIcon={<PrintRoundedIcon />}
          variant="contained"
        >
          Cetak / Simpan PDF (A4)
        </Button>
      </DialogActions>
    </Dialog>
  </>
  )
}
