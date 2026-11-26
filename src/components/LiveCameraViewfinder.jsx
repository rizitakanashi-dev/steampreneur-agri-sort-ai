import { forwardRef, useImperativeHandle, useEffect, useRef, useState, useCallback } from 'react'
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
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import BlurOnRoundedIcon from '@mui/icons-material/BlurOnRounded'
import FlipCameraIosRoundedIcon from '@mui/icons-material/FlipCameraIosRounded'
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'

import { extractGreyscaleThumbnail, isSceneStationary } from '../utils/imageSimilarity.js'

// Registry modul untuk melacak seluruh active MediaStream agar tidak ada hardware track kamera yang tertinggal
const activeStreams = new Set()

/**
 * Menghentikan seluruh active media stream kamera secara seketika dan sinkron.
 * Dipanggil saat navigasi keluar modul scanner atau unmount.
 */
export function stopAllActiveCameraStreams() {
  activeStreams.forEach((stream) => {
    try {
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch {}
        })
      }
    } catch {}
  })
  activeStreams.clear()
}

/**
 * Komponen Live Camera Viewfinder untuk Agri-Sort AI
 * Mengakses webcam desktop atau kamera HP langsung dengan capture snapshot instan.
 */
export const LiveCameraViewfinder = forwardRef(function LiveCameraViewfinder({ onCapture, disabled = false, variant = 'default', autoDetect = false, onTorchStateChange, topOverlay, topRightOverlay }, ref) {
  const isImmersive = variant === 'immersive'
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  // Kontainer viewfinder — dipakai agar hasil foto = persis area yang terlihat (WYSIWYG)
  const containerRef = useRef(null)
  const [cameraState, setCameraState] = useState('initializing') // 'initializing' | 'active' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [facingMode, setFacingMode] = useState('environment') // 'environment' (belakang) | 'user' (depan)
  const [isCapturing, setIsCapturing] = useState(false)
  // Torch (lampu kilat) — dideteksi via track capabilities
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  // Issue #30 fase 5: kualitas citra real-time + auto-detect saat scene stabil
  const [qualityStatus, setQualityStatus] = useState(null) // null | 'dark' | 'blur'
  // Orientasi native-like: dimensi frame stream + orientasi viewport
  const [videoDims, setVideoDims] = useState(null) // { w, h }
  // Area gambar kamera yang benar-benar terlihat (objectFit: contain) — agar garis
  // panduan & label menempel ke gambar, bukan melar ke band gelap atas/bawah
  const [contentRect, setContentRect] = useState(null)
  const [isPortraitViewport, setIsPortraitViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(orientation: portrait)').matches : true
  )

  const isMountedRef = useRef(true)
  const sessionRef = useRef(0)

  // Ikuti perubahan orientasi layar (portrait <-> landscape)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = (e) => setIsPortraitViewport(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const stopStream = () => {
    // Invalidate request getUserMedia yang sedang berjalan
    sessionRef.current += 1

    const stream = streamRef.current
    streamRef.current = null

    // 1. Ambil stream dari video element jika ada
    let videoStream = null
    if (videoRef.current) {
      try {
        videoStream = videoRef.current.srcObject
        videoRef.current.pause()
        videoRef.current.srcObject = null
      } catch (e) {
        console.warn('Gagal mereset video element:', e)
      }
    }

    // 2. Hentikan hardware track dari streamRef SECARA SINKRON DAN SEKETIKA
    if (stream && typeof stream.getTracks === 'function') {
      activeStreams.delete(stream)
      stream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          console.warn('Gagal menghentikan track kamera:', e)
        }
      })
    }

    // 3. Hentikan hardware track dari video element (jika objek berbeda) SECARA SINKRON
    if (videoStream && videoStream !== stream && typeof videoStream.getTracks === 'function') {
      activeStreams.delete(videoStream)
      videoStream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          console.warn('Gagal menghentikan track video element:', e)
        }
      })
    }
  }

  const startCamera = async (targetFacing = facingMode) => {
    stopStream()
    const currentSession = ++sessionRef.current

    if (isMountedRef.current) {
      setCameraState('initializing')
      setErrorMessage('')
      setVideoDims(null)
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (isMountedRef.current) {
        setCameraState('error')
        setErrorMessage('Browser ini tidak mendukung akses kamera langsung. Silakan gunakan opsi Unggah Berkas.')
      }
      return
    }

    try {
      // Ideal 1080p-class: sekali foto memuat bidang luas & detail untuk YOLO11.
      // Petunjuk orientasi mengikuti layar — sebagian browser menghormati (frame
      // portrait), sisanya tetap landscape dan ditangani rotasi CSS di atas
      const portraitNow = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(orientation: portrait)').matches : false
      const constraints = {
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: portraitNow ? 1080 : 1920 },
          height: { ideal: portraitNow ? 1920 : 1080 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Jika komponen sudah unmount atau ada sesi baru saat promise getUserMedia selesai
      if (!isMountedRef.current || currentSession !== sessionRef.current) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop()
          } catch {}
        })
        return
      }

      activeStreams.add(stream)
      streamRef.current = stream

      // Issue #30 fase 4: deteksi dukungan torch (lampu kilat) per perangkat —
      // hanya tampil jika kamera benar-benar mendukung applyConstraints torch
      try {
        const track = stream.getVideoTracks?.()[0]
        const caps = typeof track?.getCapabilities === 'function' ? track.getCapabilities() : null
        const supported = Boolean(caps?.torch)
        isMountedRef.current && setTorchSupported(supported)
        isMountedRef.current && setTorchOn(false)
        onTorchStateChange?.({ supported, on: false })
      } catch {
        isMountedRef.current && setTorchSupported(false)
        onTorchStateChange?.({ supported: false, on: false })
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          if (!isMountedRef.current || currentSession !== sessionRef.current) {
            stream.getTracks().forEach((t) => {
              try {
                t.stop()
              } catch {}
            })
            return
          }
          isMountedRef.current && setVideoDims({ w: videoRef.current.videoWidth, h: videoRef.current.videoHeight })
          videoRef.current
            ?.play()
            .then(() => isMountedRef.current && setCameraState('active'))
            .catch(() => isMountedRef.current && setCameraState('active'))
        }
      } else {
        setCameraState('active')
      }
    } catch (err) {
      if (!isMountedRef.current || currentSession !== sessionRef.current) return
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

  useEffect(() => {
    isMountedRef.current = true
    startCamera(facingMode)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopStream()
      } else if (document.visibilityState === 'visible' && isMountedRef.current) {
        startCamera(facingMode)
      }
    }

    const handlePageHide = () => {
      stopStream()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)

    return () => {
      isMountedRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
      stopStream()
    }
  }, [facingMode])

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  // Kontrol eksternal (issue #30): shutter & flip di bottom action bar
  // memanggil method ini via ref — guard internal tetap berlaku
  useImperativeHandle(
    ref,
    () => ({
      capture: handleCapturePhoto,
      flip: toggleFacingMode,
      toggleTorch,
      rotateView: handleRotateView,
    }),
    [cameraState, isCapturing, disabled, facingMode, torchSupported, torchOn]
  )

  /** Nyalakan/matikan lampu kilat jika kamera mendukung torch */
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track || !torchSupported) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] })
      setTorchOn((prev) => {
        const next = !prev
        onTorchStateChange?.({ supported: true, on: next })
        return next
      })
    } catch (err) {
      console.error('Gagal mengatur lampu kilat (torch):', err)
    }
  }

  /** Toggle Auto-Detect bila dipanggil dari luar (tidak wajib) */
  // (state auto-detect dikendalikan parent via prop `autoDetect`)

  // Issue #30 fase 5: sampler kualitas citra + auto-detect (immersive saja).
  // Sampling 1.25x/detik pada kanvas 64x48 — sangat ringan.
  useEffect(() => {
    if (!isImmersive || cameraState !== 'active') return undefined
    const qualityStatusRef = { current: null }
    const lastThumbRef = { current: null }
    const stableCountRef = { current: 0 }
    const cooldownUntilRef = { current: 0 }
    const samplerCanvas = document.createElement('canvas')

    const tick = () => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || isCapturing || disabled) return
      try {
        samplerCanvas.width = 64
        samplerCanvas.height = 48
        const ctx = samplerCanvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(video, 0, 0, 64, 48)
        const px = ctx.getImageData(0, 0, 64, 48).data
        let sum = 0
        let gradSum = 0
        let count = 0
        for (let y = 0; y < 48; y++) {
          for (let x = 0; x < 64; x++) {
            const i = (y * 64 + x) * 4
            const g = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
            sum += g
            count += 1
            if (x < 63) {
              const j = (y * 64 + x + 1) * 4
              const g2 = px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114
              gradSum += Math.abs(g - g2)
            }
          }
        }
        const brightness = sum / Math.max(1, count)
        const blurScore = gradSum / Math.max(1, count - 48)
        const nextStatus = brightness < 55 ? 'dark' : blurScore < 5 ? 'blur' : 'ok'
        if (nextStatus !== qualityStatusRef.current) {
          qualityStatusRef.current = nextStatus
          setQualityStatus(nextStatus === 'ok' ? null : nextStatus)
        }

        // Auto-Detect: kapture otomatis saat scene stabil >= 3 sampel
        // (~2.4 detik tenang), tidak blur/gelap, dan melewati cooldown 5 detik
        if (autoDetect && nextStatus === 'ok' && Date.now() > cooldownUntilRef.current) {
          const thumb = extractGreyscaleThumbnail(samplerCanvas, 16)
          const last = lastThumbRef.current
          if (last && isSceneStationary(thumb, last)) {
            stableCountRef.current += 1
          } else {
            stableCountRef.current = 0
          }
          lastThumbRef.current = thumb
          if (stableCountRef.current >= 3) {
            stableCountRef.current = 0
            cooldownUntilRef.current = Date.now() + 5000
            handleCapturePhoto()
          }
        }
      } catch (err) {
        console.warn('Gagal sampling kualitas citra kamera:', err)
      }
    }

    const id = window.setInterval(tick, 800)
    return () => window.clearInterval(id)
  }, [isImmersive, cameraState, autoDetect, isCapturing, disabled])

  // Rotasi kamera: basis otomatis (portrait layar + stream landscape → ±90°)
  // + offset manual yang TERSIMPAN (localStorage) — pengguna tap sampai tegak,
  // dan foto tersimpan selalu mengikuti persis apa yang terlihat di preview.
  const needsRotation = Boolean(
    isImmersive && isPortraitViewport && videoDims && videoDims.w > videoDims.h
  )
  const ROTATION_STORAGE_KEY = 'agrisort-cam-rotation-offset'
  const [rotationOffset, setRotationOffset] = useState(() => {
    try {
      return Number(localStorage.getItem(ROTATION_STORAGE_KEY)) || 0
    } catch {
      return 0
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(ROTATION_STORAGE_KEY, String(rotationOffset))
    } catch {
      /* private mode: abaikan */
    }
  }, [rotationOffset])

  const totalRotation =
    ((((needsRotation ? (facingMode === 'environment' ? 90 : -90) : 0) + rotationOffset) % 360) + 360) % 360
  // Hanya 90/270 yang butuh elemen video berdimensi tukar (landscape↔portrait).
  // Offset 180 TIDAK — kalau ikut dipaksa elemen besar, video meluber melebihi layar.
  const swapLayout = totalRotation === 90 || totalRotation === 270

  // Ukur area gambar yang terlihat (contain) + kotak panduan yang di-CLAMP ke dalam
  // kontainer (tidak boleh meluber melewati tepi/navbar)
  // Posisi vertikal baris kontrol atas = tengah area gelap di atas gambar kamera
  const overlayTop = contentRect ? Math.max((contentRect.top - 32) / 2, 8) : 8

  const updateContentRect = useCallback(() => {
    const cont = containerRef.current
    if (!cont || !videoDims || cameraState !== 'active') {
      setContentRect(null)
      return
    }
    const cw = cont.clientWidth
    const ch = cont.clientHeight
    const { w, h } = videoDims
    let scale, dw, dh
    if (swapLayout) {
      scale = Math.min(cw / h, ch / w)
      dw = h * scale
      dh = w * scale
    } else {
      scale = Math.min(cw / w, ch / h)
      dw = w * scale
      dh = h * scale
    }
    const contentTop = (ch - dh) / 2
    const pad = 10
    const gTop = Math.max(contentTop - pad, 4)
    const gLeft = Math.max(((cw - dw) / 2) - pad, 4)
    const gRight = Math.min(((cw + dw) / 2) + pad, cw - 4)
    const gBottom = Math.min(((ch + dh) / 2) + pad, ch - 4)
    setContentRect({ top: contentTop, guides: { top: gTop, left: gLeft, width: gRight - gLeft, height: gBottom - gTop } })
  }, [videoDims, cameraState, swapLayout])

  useEffect(() => {
    updateContentRect()
    window.addEventListener('resize', updateContentRect)
    return () => window.removeEventListener('resize', updateContentRect)
  }, [updateContentRect])

  const handleRotateView = () => setRotationOffset((prev) => (prev + 90) % 360)

  const handleCapturePhoto = () => {
    if (!videoRef.current || cameraState !== 'active' || isCapturing || disabled) return
    setIsCapturing(true)

    try {
      const video = videoRef.current
      const w = video.videoWidth || 1280
      const h = video.videoHeight || 720

      // --- WYSIWYG: hasil foto = persis apa yang terlihat di preview ---
      // 1) Lurkan frame sensor sesuai rotasi tampilan (auto + kalibrasi manual)
      const swap = totalRotation === 90 || totalRotation === 270
      const rw = swap ? h : w
      const rh = swap ? w : h
      const upright = document.createElement('canvas')
      upright.width = rw
      upright.height = rh
      const uctx = upright.getContext('2d')
      if (totalRotation === 0) {
        uctx.drawImage(video, 0, 0, w, h)
      } else {
        uctx.translate(rw / 2, rh / 2)
        uctx.rotate((totalRotation * Math.PI) / 180)
        uctx.drawImage(video, -w / 2, -h / 2, w, h)
      }

      // 2) Capture = frame UTUH yang terlihat di preview (objectFit: contain →
      //    seluruh frame kamera terlihat) — tanpa zoom, tanpa crop tambahan
      const canvas = document.createElement('canvas')
      canvas.width = rw
      canvas.height = rh
      const ctx = canvas.getContext('2d')
      ctx.drawImage(upright, 0, 0)

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
      ref={containerRef}
      sx={{
        borderRadius: isImmersive ? 0 : 2.5,
        overflow: 'hidden',
        bgcolor: '#0f172a',
        position: 'relative',
        minHeight: isImmersive ? 'calc(100dvh - 140px - env(safe-area-inset-top) - env(safe-area-inset-bottom))' : { xs: 260, sm: 360 },
        flex: isImmersive ? 1 : undefined,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Video Viewfinder */}

      {/* Torch dipindah ke bottom action bar parent (dikendalikan via ref) */}

      {/* Indikator kualitas citra real-time (issue #30): blur / cahaya rendah */}
      {isImmersive && cameraState === 'active' && qualityStatus && (
        <Box
          sx={{
            position: 'absolute',
            // Di DALAM gambar kamera (seperti pill "Arahkan kamera" di bawah, tapi di atas)
            top: contentRect ? contentRect.top + 10 : 12,
            left: contentRect ? contentRect.guides.left + 10 : 12,
            zIndex: 15,
            px: 1.25,
            py: 0.5,
            borderRadius: 2,
            bgcolor: 'rgba(15, 23, 42, 0.78)',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            border: '1px solid rgba(251, 191, 36, 0.4)',
          }}
        >
          {qualityStatus === 'dark' ? <LightModeRoundedIcon sx={{ fontSize: 17 }} /> : <BlurOnRoundedIcon sx={{ fontSize: 17 }} />}
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>
            {qualityStatus === 'dark' ? 'Cahaya rendah — tambah penerangan' : 'Citra blur — tahan kamera lebih stabil'}
          </Typography>
        </Box>
      )}

      <video
        ref={videoRef}
        playsInline
        muted
        style={
          swapLayout
            ? {
                // Rotasi 90/270: elemen berdimensi tukar, absolut di tengah
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 'calc(100dvh - 140px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
                height: '100vw',
                maxWidth: 'none',
                transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                objectFit: 'contain',
                display: 'block',
              }
            : {
                width: '100%',
                // Immersive: TANPA ZOOM (objectFit contain) — frame kamera utuh terlihat.
                // Rotasi 180 (kalibrasi manual) cukup CSS rotate — ukuran elemen normal.
                height: isImmersive ? 'calc(100dvh - 140px - env(safe-area-inset-top) - env(safe-area-inset-bottom))' : 'auto',
                maxHeight: isImmersive ? 'none' : 460,
                objectFit: isImmersive ? 'contain' : 'contain',
                transform: totalRotation === 180 ? 'rotate(180deg)' : undefined,
                display: cameraState === 'active' ? 'block' : 'none',
              }
        }
      />

      {/* Slot kanan-atas DI DALAM gambar kamera (indikator langkah 2-Sisi) —
          SENDBARIS sendiri di BAWAH chip kualitas (baris 1 = chip kiri,
          baris 2 = pill langkah kanan) → mustahil berdesakan */}
      {topRightOverlay && cameraState === 'active' && (
        <Box
          sx={{
            position: 'absolute',
            top: contentRect ? contentRect.top + 56 : 60,
            right: contentRect ? contentRect.guides.left + 10 : 12,
            zIndex: 25,
          }}
        >
          {topRightOverlay}
        </Box>
      )}

      {/* Slot kontrol atas (✕/⚡/menu) — diposisikan di tengah area gelap antara
          navbar dan gambar kamera, menyesuaikan tinggi letterbox otomatis */}
      {topOverlay && (
        <Box
          sx={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: overlayTop,
            zIndex: 30,
          }}
        >
          {topOverlay}
        </Box>
      )}

      {/* Frame Visual Overlay (Corner Guides) — mengikuti area gambar kamera, di-CLAMP */}
      {cameraState === 'active' && (
        <Box
          sx={{
            position: 'absolute',
            ...(contentRect
              ? {
                  top: contentRect.guides.top,
                  left: contentRect.guides.left,
                  width: contentRect.guides.width,
                  height: contentRect.guides.height,
                  boxSizing: 'border-box',
                }
              : { inset: { xs: 16, sm: 24 } }),
            border: '2px dashed rgba(255, 255, 255, 0.4)',
            borderRadius: 2,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
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
        <Stack spacing={2} sx={{alignItems: 'center',  color: '#fff', p: 3 }}>
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

      {/* Bar Kontrol Bawah (Tombol Capture & Ganti Kamera) — disembunyikan
          di mode immersive: digantikan bottom action bar milik halaman */}
      {cameraState === 'active' && !isImmersive && (
        <Stack
          direction="row"
          spacing={2}
          sx={{alignItems: 'center', justifyContent: 'center', 
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        >
          <Tooltip title="Ganti Kamera Depan / Belakang">
            <IconButton
              aria-label="Ganti kamera depan atau belakang"
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
})
