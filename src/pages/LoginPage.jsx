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
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined'
import SpaRoundedIcon from '@mui/icons-material/SpaRounded'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII, AGRI_SHADOWS } from '../components/landing/tokens.js'
import {
  authenticateGoogleBackend,
  loginWithGmailBackend,
  resetPasswordWithOtpBackend,
  sendOtpToGmailBackend,
} from '../business/authStorage.js'

export function LoginPage({ onLoginSuccess, onSwitchToRegister, onBackToLanding }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [successBanner, setSuccessBanner] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State Dialog Lupa Kata Sandi (Reset Password via 6-Digit OTP Gmail)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1: Input Gmail -> 2: Input OTP & Password Baru
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotInfo, setForgotInfo] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Container untuk Tombol Resmi Bawaan Google Identity Services (accounts.google.com/gsi/client)
  const googleButtonContainerRef = useRef(null)
  const [googleSdkReady, setGoogleSdkReady] = useState(false)
  const googleClientId = (import.meta.env?.VITE_GOOGLE_CLIENT_ID || '').trim()

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
          if (authRes.ok && typeof onLoginSuccess === 'function') {
            onLoginSuccess(authRes.user)
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
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
        // Adaptif: tidak melebihi lebar kontainer (dulu tetap 400px → meluber
        // di layar sempit & halaman bisa digeser ke samping)
        width: Math.min(400, googleButtonContainerRef.current?.clientWidth || 400),
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
  }, [googleClientId, onLoginSuccess])

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')
    setSuccessBanner('')
    setIsSubmitting(true)

    const result = await loginWithGmailBackend({ email, password })
    setIsSubmitting(false)

    if (!result.ok) {
      setErrors(result.errors || {})
      return
    }

    setErrors({})
    if (typeof onLoginSuccess === 'function') {
      onLoginSuccess(result.user)
    }
  }

  const handleOpenForgotModal = () => {
    setForgotEmail(email.trim())
    setForgotOtp('')
    setNewPassword('')
    setConfirmNewPassword('')
    setForgotError('')
    setForgotInfo('')
    setForgotStep(1)
    setForgotOpen(true)
  }

  // Langkah 1 Lupa Sandi: Kirim 6-Digit Kode OTP ke Inbox Gmail
  const handleSendResetOtp = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotInfo('')
    setIsSendingOtp(true)
    const res = await sendOtpToGmailBackend(forgotEmail, 'reset_password')
    setIsSendingOtp(false)

    if (!res.ok) {
      setForgotError(res.message)
      return
    }

    setForgotInfo(res.message)
    setForgotStep(2)
  }

  // Langkah 2 Lupa Sandi: Verifikasi OTP & Simpan Kata Sandi Baru
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    setForgotError('')
    setIsResetting(true)

    const res = await resetPasswordWithOtpBackend({
      email: forgotEmail,
      otpCode: forgotOtp,
      newPassword,
      confirmNewPassword,
    })
    setIsResetting(false)

    if (!res.ok) {
      setForgotError(res.message)
      return
    }

    setForgotOpen(false)
    setEmail(forgotEmail.trim().toLowerCase())
    setPassword('')
    setSuccessBanner('Kata sandi berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.')
  }

  const hasNewMinLength = newPassword.length >= 8
  const hasNewLetterAndNumber = /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword)

  return (
    <Box
      sx={{
        minHeight: ['100vh', '100dvh'],
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
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack
            direction="row"
            spacing={1.25}
            onClick={onBackToLanding}
            sx={{alignItems: 'center',  cursor: 'pointer' }}
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
            // HP: label pendek "Beranda" agar navbar muat lega satu baris;
            // desktop: label lengkap
            sx={{
              color: AGRI_COLORS.ink,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: AGRI_RADII.buttons,
              px: 2,
              border: `1px solid ${AGRI_COLORS.hairline}`,
              bgcolor: AGRI_COLORS.paperWhite,
              '&:hover': { bgcolor: AGRI_COLORS.blushMint },
              '& .MuiButton-startIcon': { mr: { xs: 0.25, sm: 0.75 } },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Kembali ke Beranda</Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Beranda</Box>
          </Button>
        </Stack>
      </Container>

      {/* Main Login Card */}
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
            {/* Header Judul Login */}
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
                Masuk ke Agri-Sort AI
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: AGRI_COLORS.slateMuted, mt: 1, maxWidth: 420, mx: 'auto' }}
              >
                Gunakan akun Gmail atau akun Google resmi Anda untuk melanjutkan ke Dashboard Quality Control.
              </Typography>
            </Box>

            {/* Tombol Resmi Bawaan Google Identity Services */}
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
                      // Pengaman ganda: elemen internal Google punya lebar inline;
                      // dipaksa maksimum selebar kontainer agar tak pernah meluber
                      '& > div, & > div > div': { width: '100% !important', maxWidth: 400 },
                      '& iframe': { width: '100% !important', maxWidth: 400 },
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
                  Tombol <strong>Login dengan Google Resmi</strong> membutuhkan{' '}
                  <code>VITE_GOOGLE_CLIENT_ID</code> di dalam file <code>.env</code>.
                </Alert>
              )}
            </Box>

            <Divider sx={{ color: AGRI_COLORS.slateMuted, fontSize: '0.8rem', fontWeight: 500 }}>
              atau masuk dengan Gmail &amp; Password
            </Divider>

            {successBanner && <Alert severity="success">{successBanner}</Alert>}
            {generalError && <Alert severity="error">{generalError}</Alert>}

            {/* Form Login Manual Gmail & Password */}
            <Box component="form" noValidate onSubmit={handleLoginSubmit}>
              <Stack spacing={2}>
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
                  helperText={errors.email}
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

                <Box>
                  <TextField
                    fullWidth
                    required
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    placeholder="Masukkan kata sandi Anda"
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

                  <Stack direction="row" sx={{justifyContent: 'flex-end',  mt: 0.75 }}>
                    <Button
                      size="small"
                      onClick={handleOpenForgotModal}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        color: AGRI_COLORS.emerald,
                        p: 0,
                        minWidth: 'auto',
                        '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                      }}
                    >
                      Lupa Kata Sandi?
                    </Button>
                  </Stack>
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={isSubmitting}
                  sx={{
                    mt: 0.5,
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
                  {isSubmitting ? (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <CircularProgress size={18} color="inherit" />
                      <span>Memverifikasi Akun...</span>
                    </Stack>
                  ) : (
                    'Masuk ke Aplikasi →'
                  )}
                </Button>
              </Stack>
            </Box>

            {/* Tautan Pindah ke Halaman Register */}
            <Box sx={{ textAlign: 'center', pt: 0.5 }}>
              <Typography variant="body2" sx={{ color: AGRI_COLORS.slateMuted }}>
                Belum punya akun Agri-Sort AI?{' '}
                <Box
                  component="button"
                  type="button"
                  onClick={onSwitchToRegister}
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
                  Daftar di sini
                </Box>
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Container>

      {/* DIALOG LUPA KATA SANDI (RESET PASSWORD VIA KODE OTP 6-DIGIT GMAIL) */}
      <Dialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
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
              sx={{justifyContent: 'space-between', alignItems: 'center',  width: '100%' }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                {forgotStep === 1 ? (
                  <LockResetRoundedIcon sx={{ color: AGRI_COLORS.emerald }} />
                ) : (
                  <MarkEmailReadOutlinedIcon sx={{ color: AGRI_COLORS.emerald }} />
                )}
                <Typography fontWeight={700} variant="subtitle1">
                  {forgotStep === 1 ? 'Lupa Kata Sandi' : 'Reset Sandi via OTP Gmail'}
                </Typography>
              </Stack>
              <IconButton size="small" onClick={() => setForgotOpen(false)}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>

            {forgotStep === 1 ? (
              <Box component="form" onSubmit={handleSendResetOtp}>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                    Masukkan alamat <strong>@gmail.com</strong> Anda yang terdaftar. Kami akan mengirimkan 6-digit Kode OTP ke kotak masuk Gmail Anda untuk mengatur ulang kata sandi.
                  </Typography>

                  {forgotError && <Alert severity="error">{forgotError}</Alert>}

                  <TextField
                    fullWidth
                    required
                    type="email"
                    label="Alamat Gmail Terdaftar"
                    placeholder="nama@gmail.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
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

                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{justifyContent: 'flex-end',  width: '100%', pt: 0.5 }}
                  >
                    <Button
                      variant="outlined"
                      onClick={() => setForgotOpen(false)}
                      sx={{ textTransform: 'none', borderRadius: AGRI_RADII.buttons }}
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isSendingOtp}
                      sx={{
                        bgcolor: AGRI_COLORS.emerald,
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: AGRI_RADII.buttons,
                        px: 2.5,
                        boxShadow: 'none',
                        '&:hover': { bgcolor: AGRI_COLORS.emeraldHover, boxShadow: 'none' },
                      }}
                    >
                      {isSendingOtp ? (
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <CircularProgress size={16} color="inherit" />
                          <span>Mengirim OTP...</span>
                        </Stack>
                      ) : (
                        'Kirim Kode OTP →'
                      )}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleResetPasswordSubmit}>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                    Kode OTP 6-digit telah dikirim ke kotak masuk Gmail{' '}
                    <strong>{forgotEmail.trim().toLowerCase()}</strong>. Masukkan kode OTP dan kata sandi baru Anda:
                  </Typography>

                  {forgotInfo && <Alert severity="success">{forgotInfo}</Alert>}
                  {forgotError && <Alert severity="error">{forgotError}</Alert>}

                  <TextField
                    fullWidth
                    required
                    label="Kode OTP 6-Digit"
                    placeholder="Masukkan 6 digit kode OTP"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                          letterSpacing: forgotOtp ? '8px' : 'normal',
                          fontSize: forgotOtp ? '1.25rem' : '0.95rem',
                          fontWeight: forgotOtp ? 700 : 400,
                        },
                      },
                    }}
                  />

                  <TextField
                    fullWidth
                    required
                    type={showNewPassword ? 'text' : 'password'}
                    label="Password Baru"
                    placeholder="Minimal 8 karakter (huruf & angka)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                              aria-label="Tampilkan atau sembunyikan password baru"
                              onClick={() => setShowNewPassword((prev) => !prev)}
                              edge="end"
                              size="small"
                            >
                              {showNewPassword ? (
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

                  <Stack direction="row" spacing={1.5} sx={{alignItems: 'center',  px: 0.5 }}>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <CheckCircleRoundedIcon
                        sx={{
                          fontSize: 15,
                          color: hasNewMinLength ? AGRI_COLORS.emerald : '#cbd5e1',
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          color: hasNewMinLength ? AGRI_COLORS.emerald : AGRI_COLORS.slateMuted,
                          fontWeight: hasNewMinLength ? 700 : 400,
                        }}
                      >
                        Min. 8 karakter
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <CheckCircleRoundedIcon
                        sx={{
                          fontSize: 15,
                          color: hasNewLetterAndNumber ? AGRI_COLORS.emerald : '#cbd5e1',
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          color: hasNewLetterAndNumber ? AGRI_COLORS.emerald : AGRI_COLORS.slateMuted,
                          fontWeight: hasNewLetterAndNumber ? 700 : 400,
                        }}
                      >
                        Kombinasi huruf &amp; angka
                      </Typography>
                    </Stack>
                  </Stack>

                  <TextField
                    fullWidth
                    required
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    label="Konfirmasi Password Baru"
                    placeholder="Ketik ulang password baru"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
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
                              aria-label="Tampilkan atau sembunyikan konfirmasi password baru"
                              onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                              edge="end"
                              size="small"
                            >
                              {showConfirmNewPassword ? (
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

                  <Stack
                    direction="row"
                    sx={{justifyContent: 'space-between', alignItems: 'center',  width: '100%', pt: 0.5 }}
                  >
                    <Button
                      size="small"
                      disabled={isSendingOtp}
                      onClick={handleSendResetOtp}
                      sx={{ textTransform: 'none', fontWeight: 600, color: AGRI_COLORS.emerald }}
                    >
                      Kirim Ulang OTP
                    </Button>

                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isResetting}
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
                      {isResetting ? 'Menyimpan...' : 'Simpan Sandi Baru'}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
      </Dialog>
    </Box>
  )
}
export default LoginPage

