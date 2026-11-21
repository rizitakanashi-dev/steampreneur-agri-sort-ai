import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import SpaRoundedIcon from '@mui/icons-material/SpaRounded'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII, AGRI_SHADOWS } from '../components/landing/tokens.js'
import {
  authenticateGoogleBackend,
  registerWithGmailBackend,
  sendOtpToGmailBackend,
  validateRegistrationInput,
  verifyOtpBackend,
} from '../business/authStorage.js'

export function RegisterPage({ onRegisterSuccess, onSwitchToLogin, onBackToLanding }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State Verifikasi OTP Gmail (6-Digit) saat Pendaftaran Manual
  const [otpStepOpen, setOtpStepOpen] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpInfoMsg, setOtpInfoMsg] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)

  // Container untuk Tombol Resmi Bawaan Google Identity Services (accounts.google.com/gsi/client)
  const googleButtonContainerRef = useRef(null)
  const [googleSdkReady, setGoogleSdkReady] = useState(false)
  const googleClientId = (import.meta.env?.VITE_GOOGLE_CLIENT_ID || '').trim()

  // Render Tombol Resmi Bawaan Google (Google Identity Services SDK)
  useEffect(() => {
    if (!googleClientId || typeof window === 'undefined') return

    let intervalId = null

    const initOfficialGoogleSignIn = () => {
      if (!window.google?.accounts?.id || !googleButtonContainerRef.current) return false

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        ux_mode: 'popup',
        callback: async (response) => {
          if (!response?.credential) {
            setGeneralError('Gagal mendapatkan token kredensial resmi dari Google.')
            return
          }
          setGeneralError('')
          setIsSubmitting(true)
          const authRes = await authenticateGoogleBackend({
            idToken: response.credential,
          })
          setIsSubmitting(false)
          if (authRes.ok && typeof onRegisterSuccess === 'function') {
            onRegisterSuccess(authRes.user)
          } else {
            setGeneralError(
              authRes.errors?.email || 'Autentikasi dengan server Google gagal.'
            )
          }
        },
      })

      googleButtonContainerRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleButtonContainerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signup_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 400,
        locale: 'id',
      })
      setGoogleSdkReady(true)
      return true
    }

    if (!initOfficialGoogleSignIn()) {
      intervalId = window.setInterval(() => {
        if (initOfficialGoogleSignIn()) {
          window.clearInterval(intervalId)
        }
      }, 250)
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [googleClientId, onRegisterSuccess])

  // Langkah 1 Pendaftaran Manual: Validasi form -> Kirim Kode OTP 6-Digit Nyata ke Inbox Gmail
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')

    const validation = validateRegistrationInput({
      fullName,
      email,
      password,
      confirmPassword,
    })

    if (!validation.isValid) {
      setErrors(validation.errors || {})
      return
    }

    setErrors({})
    setIsSendingOtp(true)
    const signup = await registerWithGmailBackend({
      fullName: validation.sanitized.fullName,
      email: validation.sanitized.email,
      password,
      confirmPassword,
    })
    setIsSendingOtp(false)

    if (!signup.ok) {
      setGeneralError(signup.errors?.email || 'Gagal memulai pendaftaran.')
      return
    }

    if (!signup.confirmationRequired && signup.user) {
      if (typeof onRegisterSuccess === 'function') onRegisterSuccess(signup.user)
      return
    }

    setOtpCode('')
    setOtpError('')
    setOtpInfoMsg(signup.message || 'Kode verifikasi telah dikirim ke email Anda.')
    setOtpStepOpen(true)
  }

  // Langkah 2 Pendaftaran Manual: Verifikasi Kode OTP 6-Digit dari Gmail -> Simpan Akun di Server
  const handleVerifyOtpAndCompleteRegister = async (e) => {
    e.preventDefault()
    setOtpError('')

    if (String(otpCode || '').trim().length !== 6) {
      setOtpError('Masukkan 6-digit kode OTP yang dikirim ke inbox Gmail Anda.')
      return
    }

    setIsSubmitting(true)
    const verifyRes = await verifyOtpBackend(email, otpCode, 'register')
    setIsSubmitting(false)
    if (!verifyRes.ok) {
      setOtpError(verifyRes.message)
      return
    }

    setOtpStepOpen(false)
    if (typeof onRegisterSuccess === 'function') onRegisterSuccess(verifyRes.user)
  }

  const handleResendOtp = async () => {
    setOtpError('')
    setIsSendingOtp(true)
    const otpRes = await sendOtpToGmailBackend(email, 'register')
    setIsSendingOtp(false)
    if (otpRes.ok) {
      setOtpInfoMsg('Kode OTP baru telah dikirim ulang ke inbox Gmail Anda.')
    } else {
      setOtpError(otpRes.message)
    }
  }

  const hasMinLength = password.length >= 8
  const hasLetterAndNumber = /[A-Za-z]/.test(password) && /[0-9]/.test(password)

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: AGRI_COLORS.mistSurface,
        color: AGRI_COLORS.ink,
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(circle at 80% 18%, rgba(227, 243, 234, 0.7) 0%, rgba(242, 245, 243, 0.9) 55%, #F2F5F3 100%)',
      }}
    >
      {/* Top Header Bar */}
      <Container maxWidth="lg" sx={{ pt: { xs: 2.5, sm: 3.5 }, px: { xs: 2.5, sm: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            onClick={onBackToLanding}
            sx={{ cursor: 'pointer' }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: AGRI_RADII.buttons,
                bgcolor: AGRI_COLORS.ink,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: AGRI_COLORS.paperWhite,
              }}
            >
              <SpaRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography
              sx={{
                fontFamily: AGRI_FONTS.serif,
                fontWeight: 400,
                fontSize: '1.35rem',
                letterSpacing: '-0.02em',
                color: AGRI_COLORS.ink,
              }}
            >
              Agri-Sort AI
            </Typography>
          </Stack>

          <Button
            startIcon={<ArrowBackRoundedIcon fontSize="small" />}
            onClick={onBackToLanding}
            sx={{
              color: AGRI_COLORS.ink,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: AGRI_RADII.buttons,
              px: 2,
              border: `1px solid ${AGRI_COLORS.hairline}`,
              bgcolor: AGRI_COLORS.paperWhite,
              '&:hover': { bgcolor: AGRI_COLORS.blushMint },
            }}
          >
            Kembali ke Beranda
          </Button>
        </Stack>
      </Container>

      {/* Main Registration Card */}
      <Container
        maxWidth="sm"
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: { xs: 4, sm: 6 },
          px: { xs: 2, sm: 3 },
        }}
      >
        <Box
          sx={{
            width: '100%',
            bgcolor: AGRI_COLORS.paperWhite,
            borderRadius: AGRI_RADII.cards,
            boxShadow: AGRI_SHADOWS.artifact,
            border: `1px solid ${AGRI_COLORS.hairline}`,
            p: { xs: 3, sm: 4.5 },
          }}
        >
          <Stack spacing={2.5}>
            {/* Header Judul Register */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                component="h1"
                sx={{
                  fontFamily: AGRI_FONTS.serif,
                  fontWeight: 400,
                  fontSize: { xs: '1.85rem', sm: '2.25rem' },
                  letterSpacing: '-0.02em',
                  color: AGRI_COLORS.ink,
                  lineHeight: 1.15,
                }}
              >
                Buat Akun Agri-Sort AI
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: AGRI_COLORS.slateMuted, mt: 1, maxWidth: 420, mx: 'auto' }}
              >
                Daftarkan Gmail Anda atau lanjutkan dengan Google resmi untuk mengakses aplikasi Agri-Sort AI.
              </Typography>
            </Box>

            {/* Tombol Resmi Bawaan Google Identity Services (Tanpa UI Tiruan/Simulasi) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              {googleClientId ? (
                <>
                  <Box
                    ref={googleButtonContainerRef}
                    sx={{
                      minHeight: 44,
                      display: 'flex',
                      justifyContent: 'center',
                      width: '100%',
                    }}
                  />
                  {!googleSdkReady && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Memuat komponen resmi Google Sign-In...
                    </Typography>
                  )}
                </>
              ) : (
                <Alert severity="warning" sx={{ width: '100%', fontSize: '0.82rem' }}>
                  Tombol <strong>Daftar dengan Google Resmi</strong> membutuhkan{' '}
                  <code>VITE_GOOGLE_CLIENT_ID</code> di dalam file <code>.env</code>. Tidak ada login Google tiruan yang diizinkan demi keamanan akun.
                </Alert>
              )}
            </Box>

            <Divider sx={{ color: AGRI_COLORS.slateMuted, fontSize: '0.8rem', fontWeight: 500 }}>
              atau daftar dengan Gmail &amp; Password
            </Divider>

            {generalError && <Alert severity="error">{generalError}</Alert>}

            {/* Form Opsi 2: Input Gmail & Password Manual (Wajib Verifikasi OTP Inbox Gmail) */}
            <Box component="form" noValidate onSubmit={handleManualSubmit}>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  required
                  label="Nama Lengkap"
                  placeholder="Masukkan nama lengkap Anda"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }))
                  }}
                  error={Boolean(errors.fullName)}
                  helperText={errors.fullName}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlineRoundedIcon fontSize="small" sx={{ color: AGRI_COLORS.slateMuted }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  fullWidth
                  required
                  type="email"
                  label="Alamat Gmail"
                  placeholder="nama@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
                  }}
                  error={Boolean(errors.email)}
                  helperText={errors.email || 'Kode OTP 6-digit akan dikirim ke kotak masuk @gmail.com ini'}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailOutlinedIcon fontSize="small" sx={{ color: AGRI_COLORS.slateMuted }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  fullWidth
                  required
                  type={showPassword ? 'text' : 'password'}
                  label="Password"
                  placeholder="Minimal 8 karakter (huruf & angka)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
                  }}
                  error={Boolean(errors.password)}
                  helperText={errors.password}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon fontSize="small" sx={{ color: AGRI_COLORS.slateMuted }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="Tampilkan atau sembunyikan password"
                            onClick={() => setShowPassword((prev) => !prev)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? (
                              <VisibilityOffOutlinedIcon fontSize="small" />
                            ) : (
                              <VisibilityOutlinedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                {/* Indikator Kekuatan Password */}
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 0.5 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <CheckCircleRoundedIcon
                      sx={{
                        fontSize: 15,
                        color: hasMinLength ? AGRI_COLORS.emerald : '#cbd5e1',
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: hasMinLength ? AGRI_COLORS.emerald : AGRI_COLORS.slateMuted,
                        fontWeight: hasMinLength ? 700 : 400,
                      }}
                    >
                      Min. 8 karakter
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <CheckCircleRoundedIcon
                      sx={{
                        fontSize: 15,
                        color: hasLetterAndNumber ? AGRI_COLORS.emerald : '#cbd5e1',
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: hasLetterAndNumber ? AGRI_COLORS.emerald : AGRI_COLORS.slateMuted,
                        fontWeight: hasLetterAndNumber ? 700 : 400,
                      }}
                    >
                      Kombinasi huruf &amp; angka
                    </Typography>
                  </Stack>
                </Stack>

                <TextField
                  fullWidth
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  label="Konfirmasi Password"
                  placeholder="Ketik ulang password Anda"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: '' }))
                    }
                  }}
                  error={Boolean(errors.confirmPassword)}
                  helperText={errors.confirmPassword}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon fontSize="small" sx={{ color: AGRI_COLORS.slateMuted }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="Tampilkan atau sembunyikan konfirmasi password"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            edge="end"
                            size="small"
                          >
                            {showConfirmPassword ? (
                              <VisibilityOffOutlinedIcon fontSize="small" />
                            ) : (
                              <VisibilityOutlinedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={isSubmitting || isSendingOtp}
                  sx={{
                    mt: 1,
                    py: 1.45,
                    borderRadius: AGRI_RADII.buttons,
                    bgcolor: AGRI_COLORS.emerald,
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.975rem',
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: AGRI_COLORS.emeraldHover,
                      boxShadow: 'none',
                    },
                  }}
                >
                  {isSendingOtp ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} color="inherit" />
                      <span>Mengirim Kode OTP ke Gmail...</span>
                    </Stack>
                  ) : (
                    'Daftar Akun & Kirim OTP ke Gmail →'
                  )}
                </Button>
              </Stack>
            </Box>

            {/* Tautan Pindah ke Halaman Login */}
            {typeof onSwitchToLogin === 'function' && (
              <Box sx={{ textAlign: 'center', pt: 0.5 }}>
                <Typography variant="body2" sx={{ color: AGRI_COLORS.slateMuted }}>
                  Sudah punya akun Agri-Sort AI?{' '}
                  <Box
                    component="button"
                    type="button"
                    onClick={onSwitchToLogin}
                    sx={{
                      background: 'none',
                      border: 'none',
                      p: 0,
                      color: AGRI_COLORS.emerald,
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Masuk di sini
                  </Box>
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      </Container>

      {/* DIALOG VERIFIKASI KODE OTP 6-DIGIT GMAIL ASLI */}
      <Dialog
        open={otpStepOpen}
        onClose={() => setOtpStepOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '20px',
              p: 1,
            },
          },
        }}
      >
        <Box sx={{ p: 2.5 }}>
          <Stack spacing={2.25}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ width: '100%' }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <MarkEmailReadOutlinedIcon sx={{ color: AGRI_COLORS.emerald }} />
                <Typography fontWeight={700} variant="subtitle1">
                  Verifikasi Kode OTP Gmail
                </Typography>
              </Stack>
              <IconButton size="small" onClick={() => setOtpStepOpen(false)}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
              Kami telah mengirimkan 6-digit kode OTP ke kotak masuk Gmail{' '}
              <strong>{email.trim().toLowerCase()}</strong>. Buka aplikasi Gmail Anda dan masukkan kodenya di bawah ini:
            </Typography>

            {otpInfoMsg && <Alert severity="success">{otpInfoMsg}</Alert>}

            {otpError && <Alert severity="error">{otpError}</Alert>}

            <Box component="form" onSubmit={handleVerifyOtpAndCompleteRegister}>
              <Stack spacing={2.25}>
                <TextField
                  fullWidth
                  required
                  label="Kode OTP 6-Digit"
                  placeholder="Masukkan 6 digit kode OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  sx={{
                    '& input::placeholder': {
                      letterSpacing: 'normal',
                      fontSize: '0.92rem',
                      fontWeight: 400,
                    },
                  }}
                  slotProps={{
                    htmlInput: {
                      maxLength: 6,
                      inputMode: 'numeric',
                      style: {
                        textAlign: 'center',
                        letterSpacing: otpCode ? '8px' : 'normal',
                        fontSize: otpCode ? '1.25rem' : '0.95rem',
                        fontWeight: otpCode ? 700 : 400,
                      },
                    },
                  }}
                />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ width: '100%', pt: 0.5 }}
                >
                  <Button
                    size="small"
                    disabled={isSendingOtp}
                    onClick={handleResendOtp}
                    sx={{ textTransform: 'none', fontWeight: 600, color: AGRI_COLORS.emerald }}
                  >
                    Kirim Ulang Kode OTP
                  </Button>

                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting}
                    sx={{
                      bgcolor: AGRI_COLORS.emerald,
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: AGRI_RADII.buttons,
                      px: 3,
                      py: 1,
                      boxShadow: 'none',
                      '&:hover': { bgcolor: AGRI_COLORS.emeraldHover, boxShadow: 'none' },
                    }}
                  >
                    Verifikasi &amp; Masuk
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  )
}
export default RegisterPage
