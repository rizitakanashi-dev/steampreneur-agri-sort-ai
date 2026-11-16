import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { FONTS, LANDING_COLORS } from './constants.js'

export function HowItWorks() {
  return (
    <Box
      id="cara-kerja"
      component="section"
      sx={{
        py: { xs: 8, sm: 10, md: 14 },
        bgcolor: LANDING_COLORS.creamLight,
        position: 'relative',
        borderTop: `1px solid ${LANDING_COLORS.border}`,
        borderBottom: `1px solid ${LANDING_COLORS.border}`,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3, md: 4 } }}>
        {/* SECTION HEADER */}
        <Stack
          alignItems="center"
          spacing={2}
          sx={{
            textAlign: 'center',
            maxWidth: 720,
            mx: 'auto',
            mb: { xs: 6, sm: 8, md: 9 },
          }}
        >
          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: LANDING_COLORS.leafGreen,
            }}
          >
            LANGKAH PENGGUNAAN
          </Typography>

          <Typography
            component="h2"
            sx={{
              fontFamily: FONTS.heading,
              fontSize: { xs: '1.9rem', sm: '2.5rem', md: '2.85rem' },
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.025em',
              color: LANDING_COLORS.forestGreen,
            }}
          >
            Tiga Langkah Menuju Pengelolaan Panen yang Lebih Baik.
          </Typography>

          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: { xs: '0.98rem', sm: '1.08rem' },
              lineHeight: 1.65,
              color: LANDING_COLORS.mutedText,
            }}
          >
            Mulai dari pencatatan hasil panen hingga memahami estimasi nilai jualnya.
          </Typography>
        </Stack>

        {/* 3 STEPS GRID / TIMELINE */}
        <Grid container spacing={3.5} sx={{ position: 'relative' }}>
          {/* STEP 1: INPUT HASIL PANEN */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                bgcolor: LANDING_COLORS.white,
                borderRadius: '20px',
                border: `1px solid ${LANDING_COLORS.border}`,
                boxShadow: '0 6px 24px rgba(23, 63, 50, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 14px 32px rgba(23, 63, 50, 0.09)',
                },
              }}
            >
              <CardContent sx={{ p: { xs: 3, sm: 3.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* STEP BADGE & NUMBER */}
                <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between', mb: 2 }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      bgcolor: LANDING_COLORS.forestGreen,
                      color: LANDING_COLORS.white,
                      fontFamily: FONTS.stats,
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    01
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: FONTS.body,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: LANDING_COLORS.leafGreen,
                      bgcolor: LANDING_COLORS.leafGreenLight,
                      px: 1.5,
                      py: 0.4,
                      borderRadius: '6px',
                    }}
                  >
                    TAHAP AWAL
                  </Typography>
                </Stack>

                <Typography
                  sx={{
                    fontFamily: FONTS.heading,
                    fontWeight: 800,
                    fontSize: '1.3rem',
                    color: LANDING_COLORS.forestGreen,
                    mb: 1,
                  }}
                >
                  Input Hasil Panen
                </Typography>

                <Typography
                  sx={{
                    fontFamily: FONTS.body,
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    color: LANDING_COLORS.darkText,
                    opacity: 0.85,
                    mb: 3,
                  }}
                >
                  Masukkan jenis komoditas, berat hasil panen, dan parameter kualitas.
                </Typography>

                {/* VISUAL MOCKUP 1: INPUT FORM */}
                <Box
                  sx={{
                    mt: 'auto',
                    p: 2,
                    bgcolor: LANDING_COLORS.warmCream,
                    borderRadius: '12px',
                    border: `1px solid ${LANDING_COLORS.border}`,
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: LANDING_COLORS.forestGreen, mb: 1.25 }}>
                    Form Input Panen
                  </Typography>

                  <Stack spacing={1}>
                    <Box sx={{ p: 1, bgcolor: LANDING_COLORS.white, borderRadius: '8px', border: `1px solid ${LANDING_COLORS.borderLight}` }}>
                      <Typography sx={{ fontSize: '0.65rem', color: LANDING_COLORS.mutedText }}>Pilih Komoditas</Typography>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: LANDING_COLORS.darkText }}>Tomat Segar (Lokal)</Typography>
                    </Box>

                    <Box sx={{ p: 1, bgcolor: LANDING_COLORS.white, borderRadius: '8px', border: `1px solid ${LANDING_COLORS.borderLight}` }}>
                      <Typography sx={{ fontSize: '0.65rem', color: LANDING_COLORS.mutedText }}>Berat Total Panen</Typography>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: LANDING_COLORS.darkText }}>100 kg</Typography>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
                      <CameraAltRoundedIcon sx={{ fontSize: 16, color: LANDING_COLORS.leafGreen }} />
                      <Typography sx={{ fontSize: '0.72rem', color: LANDING_COLORS.forestGreen, fontWeight: 600 }}>
                        Foto Keranjang Siap Diperiksa
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* STEP 2: ANALISIS KUALITAS */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                bgcolor: LANDING_COLORS.white,
                borderRadius: '20px',
                border: `1px solid ${LANDING_COLORS.border}`,
                boxShadow: '0 6px 24px rgba(23, 63, 50, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 14px 32px rgba(23, 63, 50, 0.09)',
                },
              }}
            >
              <CardContent sx={{ p: { xs: 3, sm: 3.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* STEP BADGE & NUMBER */}
                <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between', mb: 2 }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      bgcolor: LANDING_COLORS.leafGreen,
                      color: LANDING_COLORS.white,
                      fontFamily: FONTS.stats,
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    02
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: FONTS.body,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: LANDING_COLORS.forestGreen,
                      bgcolor: 'rgba(23, 63, 50, 0.08)',
                      px: 1.5,
                      py: 0.4,
                      borderRadius: '6px',
                    }}
                  >
                    PENGOLAHAN
                  </Typography>
                </Stack>

                <Typography
                  sx={{
                    fontFamily: FONTS.heading,
                    fontWeight: 800,
                    fontSize: '1.3rem',
                    color: LANDING_COLORS.forestGreen,
                    mb: 1,
                  }}
                >
                  Analisis Kualitas
                </Typography>

                <Typography
                  sx={{
                    fontFamily: FONTS.body,
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    color: LANDING_COLORS.darkText,
                    opacity: 0.85,
                    mb: 3,
                  }}
                >
                  Sistem mengolah data dan menampilkan distribusi hasil berdasarkan grade.
                </Typography>

                {/* VISUAL MOCKUP 2: GRADING RESULT INTERFACE */}
                <Box
                  sx={{
                    mt: 'auto',
                    p: 2,
                    bgcolor: LANDING_COLORS.warmCream,
                    borderRadius: '12px',
                    border: `1px solid ${LANDING_COLORS.border}`,
                  }}
                >
                  <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between', mb: 1.25 }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: LANDING_COLORS.forestGreen }}>
                      Distribusi Grade Panen
                    </Typography>
                    <Chip label="Terpetakan" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: LANDING_COLORS.leafGreen, color: '#fff' }} />
                  </Stack>

                  <Stack spacing={1}>
                    <Box sx={{ p: 1, bgcolor: LANDING_COLORS.white, borderRadius: '8px', borderLeft: `3px solid ${LANDING_COLORS.forestGreen}` }}>
                      <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: LANDING_COLORS.darkText }}>Grade A (Prima)</Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: LANDING_COLORS.forestGreen }}>75% • 75 kg</Typography>
                      </Stack>
                    </Box>

                    <Box sx={{ p: 1, bgcolor: LANDING_COLORS.white, borderRadius: '8px', borderLeft: `3px solid ${LANDING_COLORS.leafGreen}` }}>
                      <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: LANDING_COLORS.darkText }}>Grade B (Standar)</Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: LANDING_COLORS.leafGreen }}>20% • 20 kg</Typography>
                      </Stack>
                    </Box>

                    <Box sx={{ p: 1, bgcolor: LANDING_COLORS.white, borderRadius: '8px', borderLeft: '3px solid #d9534f' }}>
                      <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: LANDING_COLORS.darkText }}>Grade C (Tolak)</Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#d9534f' }}>5% • 5 kg</Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* STEP 3: PANTAU HASILNYA */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                bgcolor: LANDING_COLORS.white,
                borderRadius: '20px',
                border: `1px solid ${LANDING_COLORS.border}`,
                boxShadow: '0 6px 24px rgba(23, 63, 50, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 14px 32px rgba(23, 63, 50, 0.09)',
                },
              }}
            >
              <CardContent sx={{ p: { xs: 3, sm: 3.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* STEP BADGE & NUMBER */}
                <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between', mb: 2 }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      bgcolor: LANDING_COLORS.harvestGold,
                      color: LANDING_COLORS.darkText,
                      fontFamily: FONTS.stats,
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    03
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: FONTS.body,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: LANDING_COLORS.darkText,
                      bgcolor: LANDING_COLORS.harvestGoldLight,
                      px: 1.5,
                      py: 0.4,
                      borderRadius: '6px',
                    }}
                  >
                    KEPUTUSAN JUAL
                  </Typography>
                </Stack>

                <Typography
                  sx={{
                    fontFamily: FONTS.heading,
                    fontWeight: 800,
                    fontSize: '1.3rem',
                    color: LANDING_COLORS.forestGreen,
                    mb: 1,
                  }}
                >
                  Pantau Hasilnya
                </Typography>

                <Typography
                  sx={{
                    fontFamily: FONTS.body,
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    color: LANDING_COLORS.darkText,
                    opacity: 0.85,
                    mb: 3,
                  }}
                >
                  Lihat ringkasan hasil panen, estimasi nilai, dan riwayat pencatatan.
                </Typography>

                {/* VISUAL MOCKUP 3: ANALYTICS DASHBOARD PREVIEW */}
                <Box
                  sx={{
                    mt: 'auto',
                    p: 2,
                    bgcolor: LANDING_COLORS.warmCream,
                    borderRadius: '12px',
                    border: `1px solid ${LANDING_COLORS.border}`,
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: LANDING_COLORS.forestGreen, mb: 1 }}>
                    Ringkasan Nilai Panen
                  </Typography>

                  <Box sx={{ p: 1.25, bgcolor: LANDING_COLORS.forestGreen, borderRadius: '8px', color: LANDING_COLORS.white, mb: 1 }}>
                    <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)' }}>Estimasi Nilai Total</Typography>
                    <Typography sx={{ fontFamily: FONTS.stats, fontWeight: 800, fontSize: '1.05rem', color: LANDING_COLORS.white }}>
                      Rp 1.520.000
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <Box sx={{ flex: 1, p: 0.8, bgcolor: LANDING_COLORS.white, borderRadius: '6px', textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.62rem', color: LANDING_COLORS.mutedText }}>Tersimpan</Typography>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: LANDING_COLORS.forestGreen }}>Rekap Lokal</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 0.8, bgcolor: LANDING_COLORS.white, borderRadius: '6px', textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.62rem', color: LANDING_COLORS.mutedText }}>Sertifikat</Typography>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: LANDING_COLORS.forestGreen }}>Cetak A4 / CSV</Typography>
                    </Box>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
