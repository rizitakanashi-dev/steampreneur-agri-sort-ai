import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import FlipCameraIosRoundedIcon from '@mui/icons-material/FlipCameraIosRounded'
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'

import { extractGreyscaleThumbnail } from '../utils/imageSimilarity.js'

/**
 * Komponen Live Camera Viewfinder untuk Agri-Sort AI
 * Mengakses webcam desktop atau kamera HP langsung dengan capture snapshot instan.
 */
export function LiveCameraViewfinder({ onCapture, disabled = false }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraState, setCameraState] = useState('initializing') // 'initializing' | 'active' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [facingMode, setFacingMode] = useState('environment') // 'environment' (belakang) | 'user' (depan)
  const [isCapturing, setIsCapturing] = useState(false)

  const stopStream = () => {
    const stream = streamRef.current
    streamRef.current = null

    if (videoRef.current) {
      try {
        videoRef.current.pause()
        videoRef.current.srcObject = null
      } catch {
        // Abaikan error saat reset video element
      }
    }

    if (stream) {
      // Hentikan hardware track di microtask berikutnya agar transisi DOM/halaman seketika tanpa jeda
      setTimeout(() => {
        stream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch (e) {
            console.warn('Gagal menghentikan track kamera:', e)
          }
        })
      }, 0)
    }
  }

  useEffect(() => {
    let isMounted = true

    const initCamera = async () => {
      stopStream()
      if (isMounted) {
        setCameraState('initializing')
        setErrorMessage('')
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setCameraState('error')
          setErrorMessage('Browser ini tidak mendukung akses kamera langsung. Silakan gunakan opsi Unggah Berkas.')
        }
        return
      }

      try {
        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)

        // Jika komponen sudah unmount sebelum promise getUserMedia selesai
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            if (!isMounted) {
              stream.getTracks().forEach((t) => t.stop())
              return
            }
            videoRef.current
              ?.play()
              .then(() => isMounted && setCameraState('active'))
              .catch(() => isMounted && setCameraState('active'))
          }
        } else {
          setCameraState('active')
        }
      } catch (err) {
        if (!isMounted) return
        console.warn('Gagal mengakses kamera:', err)
        setCameraState('error')
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage('Izin kamera ditolak. Berikan izin akses kamera pada browser Anda.')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setErrorMessage('Tidak ada perangkat kamera yang terdeteksi pada perangkat ini.')
        } else {
          setErrorMessage(`Tidak dapat membuka kamera (${err.message || 'Error'}). Silakan gunakan mode Unggah Berkas.`)
        }
      }
    }

    initCamera()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopStream()
      } else if (document.visibilityState === 'visible' && isMounted) {
        initCamera()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopStream()
    }
  }, [facingMode])

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  const handleCapturePhoto = () => {
    if (!videoRef.current || cameraState !== 'active' || isCapturing || disabled) return
    setIsCapturing(true)

    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      const w = video.videoWidth || 1280
      const h = video.videoHeight || 720
      canvas.width = w
      canvas.height = h

      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, w, h)

      const fingerprint = extractGreyscaleThumbnail(canvas, 16)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

      canvas.toBlob(
        (blob) => {
          setIsCapturing(false)
          if (blob && onCapture) {
            const fileName = `live_cam_${Date.now()}.jpg`
            const file = new File([blob], fileName, { type: 'image/jpeg' })
            onCapture(file, dataUrl, fingerprint)
          }
        },
        'image/jpeg',
        0.92
      )
    } catch (err) {
      setIsCapturing(false)
      console.error('Gagal mengambil snapshot frame kamera:', err)
    }
  }

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        overflow: 'hidden',
        bgcolor: '#0f172a',
        position: 'relative',
        minHeight: { xs: 260, sm: 360 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Video Viewfinder */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: '100%',
          maxHeight: 460,
          objectFit: 'contain',
          display: cameraState === 'active' ? 'block' : 'none',
        }}
      />

      {/* Frame Visual Overlay (Corner Guides) */}
      {cameraState === 'active' && (
        <Box
          sx={{
            position: 'absolute',
            inset: { xs: 16, sm: 24 },
            border: '2px dashed rgba(255, 255, 255, 0.4)',
            borderRadius: 2,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              color: '#fff',
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            Arahkan kamera tegak lurus ke keranjang panen (Top-Down View)
          </Typography>
        </Box>
      )}

      {/* State Loading */}
      {cameraState === 'initializing' && (
        <Stack spacing={2} alignItems="center" sx={{ color: '#fff', p: 3 }}>
          <CircularProgress color="inherit" size={36} />
          <Typography variant="body2">Mengaktifkan sensor kamera...</Typography>
        </Stack>
      )}

      {/* State Error */}
      {cameraState === 'error' && (
        <Box sx={{ p: 3, maxWidth: 440, textAlign: 'center', color: '#fff' }}>
          <VideocamOffRoundedIcon sx={{ fontSize: 48, color: '#f87171', mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Kamera Tidak Dapat Diakses
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
            {errorMessage}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            color="inherit"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => startCamera(facingMode)}
            sx={{ borderColor: 'rgba(255,255,255,0.4)' }}
          >
            Coba Hubungkan Ulang
          </Button>
        </Box>
      )}

      {/* Bar Kontrol Bawah (Tombol Capture & Ganti Kamera) */}
      {cameraState === 'active' && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          spacing={2}
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        >
          <Tooltip title="Ganti Kamera Depan / Belakang">
            <IconButton
              onClick={toggleFacingMode}
              disabled={disabled || isCapturing}
              sx={{
                bgcolor: 'rgba(0,0,0,0.5)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              }}
            >
              <FlipCameraIosRoundedIcon />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            color="primary"
            size="large"
            disabled={disabled || isCapturing}
            onClick={handleCapturePhoto}
            startIcon={isCapturing ? <CircularProgress size={20} color="inherit" /> : <CameraAltRoundedIcon />}
            sx={{
              borderRadius: 8,
              px: 3.5,
              py: 1.25,
              fontWeight: 800,
              fontSize: '1rem',
              boxShadow: '0 8px 24px rgba(3, 110, 69, 0.4)',
              bgcolor: '#047857',
              '&:hover': { bgcolor: '#065f46' },
            }}
          >
            {isCapturing ? 'Memproses...' : 'Ambil Foto & Scan'}
          </Button>
        </Stack>
      )}
    </Box>
  )
}
