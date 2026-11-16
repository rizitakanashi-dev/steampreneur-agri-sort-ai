import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import { FONTS, LANDING_COLORS } from './constants.js'

export function Hero({ onOpenApp }) {
  const handleScrollToHowItWorks = (e) => {
    e.preventDefault()
    const element = document.querySelector('#cara-kerja')
    if (element) {
      const topOffset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - topOffset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  return (
    <Box
      id="beranda"
      component="section"
      sx={{
        position: 'relative',
        pt: { xs: 4, sm: 6, md: 8 },
        pb: { xs: 8, sm: 10, md: 14 },
        overflow: 'hidden',
      }}
    >
      {/* SUBTLE BACKGROUND ORGANIC ACCENTS */}
      <Box
        sx={{
          position: 'absolute',
          top: -120,
          right: -100,
          width: 540,
          height: 540,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(117, 169, 106, 0.12) 0%, rgba(245, 243, 233, 0) 70%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 20,
          left: -80,
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(233, 166, 75, 0.08) 0%, rgba(245, 243, 233, 0) 70%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, px: { xs: 2.5, sm: 3, md: 4 } }}>
        <Grid container spacing={{ xs: 6, md: 6, lg: 8 }} alignItems="center">
          {/* LEFT COLUMN - TEXT CONTENT */}
          <Grid size={{ xs: 12, md: 6.5 }}>
            <Stack spacing={{ xs: 2.5, sm: 3 }}>
              {/* INTRODUCTORY BADGE */}
              <Box>
                <Chip
                  icon={<AutoAwesomeRoundedIcon sx={{ fontSize: '15px !important', color: `${LANDING_COLORS.leafGreen} !important` }} />}
                  label="INOVASI TEKNOLOGI PERTANIAN"
                  sx={{
                    bgcolor: 'rgba(23, 63, 50, 0.07)',
                    color: LANDING_COLORS.forestGreen,
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    letterSpacing: '0.08em',
                    border: '1px solid',
                    borderColor: 'rgba(23, 63, 50, 0.12)',
                    py: 0.5,
                    px: 0.5,
                    borderRadius: '20px',
                  }}
                />
              </Box>

              {/* MAIN HEADLINE */}
              <Typography
                component="h1"
                sx={{
                  fontFamily: FONTS.heading,
                  fontSize: { xs: '2.3rem', sm: '3.1rem', md: '3.5rem', lg: '3.85rem' },
                  fontWeight: 900,
                  lineHeight: { xs: 1.15, sm: 1.12, md: 1.08 },
                  letterSpacing: '-0.035em',
                  color: LANDING_COLORS.forestGreen,
                }}
              >
                Panen Terukur.{' '}
                <Box
                  component="span"
                  sx={{
                    color: LANDING_COLORS.leafGreen,
                    display: 'inline',
                  }}
                >
                  Mutu Terpetakan.
                </Box>{' '}
                Nilai Jual Lebih Terarah.
              </Typography>

              {/* SUPPORTING DESCRIPTION */}
              <Typography
                sx={{
                  fontFamily: FONTS.body,
                  fontSize: { xs: '1.05rem', sm: '1.15rem' },
                  lineHeight: 1.65,
                  color: LANDING_COLORS.darkText,
                  opacity: 0.88,
                  maxWidth: 560,
                }}
              >
                Kelola kualitas hasil panen dan dapatkan estimasi nilai jual melalui satu platform digital yang praktis, informatif, dan mudah digunakan.
              </Typography>

              {/* CTA BUTTON GROUP */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ pt: 1 }}
              >
                <Button
                  onClick={() => onOpenApp('overview')}
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{
                    bgcolor: LANDING_COLORS.forestGreen,
                    color: LANDING_COLORS.white,
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                    px: 3.5,
                    py: 1.6,
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(23, 63, 50, 0.22)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': {
                      bgcolor: LANDING_COLORS.forestGreenLight,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 28px rgba(23, 63, 50, 0.3)',
                    },
                  }}
                >
                  Mulai Sekarang
                </Button>

                <Button
                  onClick={handleScrollToHowItWorks}
                  variant="outlined"
                  size="large"
                  startIcon={<PlayCircleOutlineRoundedIcon sx={{ color: LANDING_COLORS.leafGreen }} />}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.7)',
                    borderColor: LANDING_COLORS.border,
                    color: LANDING_COLORS.forestGreen,
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                    px: 3,
                    py: 1.6,
                    borderRadius: '12px',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: LANDING_COLORS.white,
                      borderColor: LANDING_COLORS.forestGreen,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Pelajari Cara Kerja
                </Button>
              </Stack>

              {/* SUPPORTING TEXT & VALUE TAGS */}
              <Stack spacing={1.5} sx={{ pt: 1 }}>
                <Typography
                  sx={{
                    fontFamily: FONTS.body,
                    fontSize: '0.85rem',
                    color: LANDING_COLORS.mutedText,
                    fontWeight: 500,
                  }}
                >
                  Solusi digital untuk pengelolaan hasil panen hortikultura.
                </Typography>

                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <CheckCircleRoundedIcon sx={{ fontSize: 16, color: LANDING_COLORS.leafGreen }} />
                    <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.82rem', fontWeight: 600, color: LANDING_COLORS.darkText }}>
                      Standardisasi Mutu Grade A, B, & Tolak
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <TrendingUpRoundedIcon sx={{ fontSize: 16, color: LANDING_COLORS.leafGreen }} />
                    <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.82rem', fontWeight: 600, color: LANDING_COLORS.darkText }}>
                      Acuan Harga Pasar Terkoneksi
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <ShieldRoundedIcon sx={{ fontSize: 16, color: LANDING_COLORS.leafGreen }} />
                    <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.82rem', fontWeight: 600, color: LANDING_COLORS.darkText }}>
                      Sertifikat Mutu Digital
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </Stack>
          </Grid>

          {/* RIGHT COLUMN - VISUAL COMPOSITION */}
          <Grid size={{ xs: 12, md: 5.5 }}>
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                pt: { xs: 2, md: 0 },
              }}
            >
              {/* MAIN IMAGE CONTAINER */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 480,
                  height: { xs: 360, sm: 440, md: 470 },
                  borderRadius: '24px',
                  overflow: 'hidden',
                  boxShadow: '0 24px 60px rgba(23, 63, 50, 0.16)',
                  border: `2px solid ${LANDING_COLORS.white}`,
                }}
              >
                <Box
                  component="img"
                  src="/images/harvest-crate.jpg"
                  alt="Keranjang hasil panen hortikultura segar berkualitas"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scale(1.02)',
                    transition: 'transform 0.4s ease',
                    '&:hover': { transform: 'scale(1.05)' },
                  }}
                />

                {/* GRADIENT OVERLAY */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(23, 63, 50, 0.6) 0%, rgba(23, 63, 50, 0.05) 50%, rgba(0,0,0,0) 100%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* BOTTOM BADGE ON IMAGE */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    right: 16,
                    bgcolor: 'rgba(255, 255, 255, 0.92)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '14px',
                    p: 1.75,
                    border: '1px solid rgba(255,255,255,0.8)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  }}
                >
                  <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between' }}>
                    <Box>
                      <Typography sx={{ fontFamily: FONTS.heading, fontWeight: 800, fontSize: '0.9rem', color: LANDING_COLORS.forestGreen }}>
                        Hortikultura Segar Terstandar
                      </Typography>
                      <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.75rem', color: LANDING_COLORS.mutedText }}>
                        Tomat • Cabai Rawit Hijau • Terung
                      </Typography>
                    </Box>
                    <Chip
                      label="Aktif Dipantau"
                      size="small"
                      sx={{
                        bgcolor: LANDING_COLORS.leafGreenLight,
                        color: LANDING_COLORS.forestGreen,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                      }}
                    />
                  </Stack>
                </Box>
              </Box>

              {/* FLOATING SAAS DASHBOARD PREVIEW CARD */}
              <Box
                sx={{
                  position: 'absolute',
                  top: { xs: -24, sm: -28 },
                  right: { xs: -8, sm: -20, md: -28 },
                  bgcolor: LANDING_COLORS.white,
                  borderRadius: '16px',
                  p: 2.25,
                  maxWidth: 240,
                  boxShadow: '0 16px 40px rgba(23, 63, 50, 0.15)',
                  border: `1px solid ${LANDING_COLORS.border}`,
                  zIndex: 2,
                }}
              >
                <Stack spacing={1.25}>
                  <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between' }}>
                    <Typography sx={{ fontFamily: FONTS.heading, fontWeight: 800, fontSize: '0.8rem', color: LANDING_COLORS.forestGreen }}>
                      Batch #QC-2026-TOM
                    </Typography>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: LANDING_COLORS.leafGreen }} />
                  </Stack>

                  <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.72rem', color: LANDING_COLORS.mutedText }}>
                    Total Berat: <strong>100 kg</strong>
                  </Typography>

                  {/* MINI GRADE PROGRESS BARS */}
                  <Stack spacing={0.6}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: LANDING_COLORS.darkText }}>Grade A (Prima)</Typography>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: LANDING_COLORS.forestGreen }}>72%</Typography>
                    </Stack>
                    <Box sx={{ width: '100%', height: 6, bgcolor: '#f0f2f0', borderRadius: 3, overflow: 'hidden' }}>
                      <Box sx={{ width: '72%', height: '100%', bgcolor: LANDING_COLORS.forestGreen, borderRadius: 3 }} />
                    </Box>

                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: LANDING_COLORS.darkText }}>Grade B</Typography>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: LANDING_COLORS.leafGreen }}>21%</Typography>
                    </Stack>
                    <Box sx={{ width: '100%', height: 6, bgcolor: '#f0f2f0', borderRadius: 3, overflow: 'hidden' }}>
                      <Box sx={{ width: '21%', height: '100%', bgcolor: LANDING_COLORS.leafGreen, borderRadius: 3 }} />
                    </Box>

                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: LANDING_COLORS.darkText }}>Reject</Typography>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#d9534f' }}>7%</Typography>
                    </Stack>
                    <Box sx={{ width: '100%', height: 6, bgcolor: '#f0f2f0', borderRadius: 3, overflow: 'hidden' }}>
                      <Box sx={{ width: '7%', height: '100%', bgcolor: '#d9534f', borderRadius: 3 }} />
                    </Box>
                  </Stack>

                  <Box sx={{ pt: 0.5, borderTop: `1px solid ${LANDING_COLORS.borderLight}` }}>
                    <Typography sx={{ fontSize: '0.68rem', color: LANDING_COLORS.mutedText }}>Estimasi Nilai Panen</Typography>
                    <Typography sx={{ fontFamily: FONTS.stats, fontWeight: 800, fontSize: '0.95rem', color: LANDING_COLORS.forestGreen }}>
                      Rp 1.480.000
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* FLOATING PILL 1 - GRADE A */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: { xs: 80, sm: 90 },
                  left: { xs: -12, sm: -24 },
                  bgcolor: LANDING_COLORS.white,
                  borderRadius: '12px',
                  py: 1,
                  px: 1.75,
                  boxShadow: '0 12px 30px rgba(23, 63, 50, 0.14)',
                  border: `1px solid ${LANDING_COLORS.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  zIndex: 2,
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    bgcolor: LANDING_COLORS.forestGreen,
                    color: LANDING_COLORS.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONTS.heading,
                    fontWeight: 800,
                    fontSize: '0.85rem',
                  }}
                >
                  A
                </Box>
                <Box>
                  <Typography sx={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: '0.78rem', color: LANDING_COLORS.darkText, lineHeight: 1.1 }}>
                    Grade A Unggul
                  </Typography>
                  <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.68rem', color: LANDING_COLORS.leafGreen, fontWeight: 600 }}>
                    Kualitas Komersial Penuh
                  </Typography>
                </Box>
              </Box>

              {/* FLOATING PILL 2 - ESTIMASI AKURAT */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -16,
                  right: { xs: 12, sm: 24 },
                  bgcolor: LANDING_COLORS.forestGreen,
                  color: LANDING_COLORS.white,
                  borderRadius: '12px',
                  py: 1,
                  px: 1.75,
                  boxShadow: '0 12px 28px rgba(23, 63, 50, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  zIndex: 2,
                }}
              >
                <TrendingUpRoundedIcon sx={{ fontSize: 18, color: LANDING_COLORS.harvestGold }} />
                <Typography sx={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: '0.78rem' }}>
                  Acuan Resmi BAPANAS
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
