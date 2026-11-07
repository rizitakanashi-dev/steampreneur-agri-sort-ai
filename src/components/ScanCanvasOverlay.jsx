import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'

import {
  drawDetectionBox,
  formatConfidenceLabel,
  getClassTheme,
  scaleBoundingBox,
} from '../utils/canvasOverlayHelper.js'

/**
 * Komponen Interaktif Visualisasi Bounding Box Deteksi Citra Panen (Task FS-FE-02)
 *
 * Menampilkan citra panen dengan lapisan Canvas 2D di atasnya,
 * mendukung penskalaan dinamis (responsive resize) dan pewarnaan multi-kelas.
 */
export function ScanCanvasOverlay({
  imageUrl,
  detections = [],
  imageDimensions = { width: 1280, height: 720 },
  commodity = 'Tomat',
  initialShowAnnotations = true,
  onSelectDetection,
}) {
  const [showAnnotations, setShowAnnotations] = useState(initialShowAnnotations)
  const [selectedId, setSelectedId] = useState(null)
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })

  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const canvasRef = useRef(null)

  // Perbarui ukuran kanvas saat gambar termuat atau kontainer berubah ukuran
  const updateCanvasSize = () => {
    if (!imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)

    if (w > 0 && h > 0) {
      setCanvasDimensions({ width: w, height: h })
    }
  }

  // Pantau perubahan ukuran layar / elemen menggunakan ResizeObserver
  useEffect(() => {
    if (!imgRef.current) return

    const observer = new ResizeObserver(() => {
      updateCanvasSize()
    })

    observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [imageUrl])

  // Gambar bounding box pada kanvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Bersihkan canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Jika anotasi dinonaktifkan oleh pengguna, jangan gambar kotak
    if (!showAnnotations || !detections || detections.length === 0) {
      return
    }

    const originalDims = imageDimensions || {
      width: imgRef.current?.naturalWidth || 1280,
      height: imgRef.current?.naturalHeight || 720,
    }

    const displayDims = {
      width: canvas.width,
      height: canvas.height,
    }

    detections.forEach((det) => {
      const theme = getClassTheme(det.class_name)
      const scaled = scaleBoundingBox(det.box, originalDims, displayDims)
      const label = formatConfidenceLabel(det.class_name, det.confidence)
      const isSelected = selectedId === det.id

      drawDetectionBox(ctx, scaled, theme, label, isSelected)
    })
  }, [showAnnotations, detections, imageDimensions, canvasDimensions, selectedId])

  // Interaksi klik pada kanvas untuk memilih bounding box tertentu
  const handleCanvasClick = (e) => {
    if (!showAnnotations || !detections || detections.length === 0 || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const originalDims = imageDimensions || {
      width: imgRef.current?.naturalWidth || 1280,
      height: imgRef.current?.naturalHeight || 720,
    }

    const displayDims = {
      width: canvasRef.current.width,
      height: canvasRef.current.height,
    }

    // Cari objek deteksi yang berada di bawah kursor
    const clicked = detections.find((det) => {
      const scaled = scaleBoundingBox(det.box, originalDims, displayDims)
      return (
        clickX >= scaled.x &&
        clickX <= scaled.x + scaled.width &&
        clickY >= scaled.y &&
        clickY <= scaled.y + scaled.height
      )
    })

    const newSelectedId = clicked ? clicked.id : null
    setSelectedId(newSelectedId)
    if (onSelectDetection) {
      onSelectDetection(clicked || null)
    }
  }

  // Hitung jumlah objek per kelas untuk badge ringkasan visual
  const summaryCounts = detections.reduce((acc, d) => {
    const key = d.class_name || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return (
    <Card elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
      {/* Toolbar Kontrol & Filter Anotasi */}
      <Box
        sx={{
          alignItems: 'center',
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          justifyContent: 'space-between',
          px: 2,
          py: 1,
        }}
      >
        <Stack alignItems="center" direction="row" spacing={1}>
          <FormControlLabel
            control={
              <Switch
                checked={showAnnotations}
                color="primary"
                onChange={(e) => setShowAnnotations(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography fontWeight={600} variant="body2">
                Anotasi AI ({detections.length} objek)
              </Typography>
            }
            sx={{ m: 0 }}
          />
        </Stack>

        {/* Badge Hitungan Kelas */}
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {Object.entries(summaryCounts).map(([className, count]) => {
            const theme = getClassTheme(className)
            return (
              <Chip
                key={className}
                label={`${theme.badge}: ${count}`}
                size="small"
                sx={{
                  bgcolor: theme.fill.replace('0.18', '0.25').replace('0.20', '0.25'),
                  borderColor: theme.stroke,
                  color: theme.stroke,
                  fontWeight: 700,
                }}
                variant="outlined"
              />
            )
          })}
        </Stack>
      </Box>

      {/* Area Gambar Panen & Canvas Overlay */}
      <Box
        ref={containerRef}
        sx={{
          bgcolor: '#0f172a',
          cursor: showAnnotations && detections.length > 0 ? 'pointer' : 'default',
          display: 'flex',
          justifyContent: 'center',
          position: 'relative',
          width: '100%',
        }}
      >
        <img
          alt={`Keranjang Panen ${commodity}`}
          onLoad={updateCanvasSize}
          ref={imgRef}
          src={imageUrl}
          style={{
            display: 'block',
            maxHeight: '650px',
            maxWidth: '100%',
            objectFit: 'contain',
            width: '100%',
          }}
        />

        <canvas
          height={canvasDimensions.height}
          onClick={handleCanvasClick}
          ref={canvasRef}
          style={{
            height: '100%',
            left: 0,
            pointerEvents: 'auto',
            position: 'absolute',
            top: 0,
            width: '100%',
          }}
          width={canvasDimensions.width}
        />
      </Box>

      {/* Petunjuk Interaksi Pengguna */}
      <Box sx={{ bgcolor: 'action.hover', px: 2, py: 0.75 }}>
        <Typography color="text.secondary" variant="caption">
          {showAnnotations
            ? '💡 Klik pada kotak buah di gambar untuk melihat detail anotasi keyakinan model.'
            : 'Anotasi AI disembunyikan. Aktifkan switch di atas untuk melihat kotak deteksi.'}
        </Typography>
      </Box>
    </Card>
  )
}

