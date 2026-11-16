import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import SpaRoundedIcon from '@mui/icons-material/SpaRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { FONTS, LANDING_COLORS } from './constants.js'

export function FinalCTA({ onOpenApp }) {
  return (
    <Box
      component="section"
      sx={{
        bgcolor: LANDING_COLORS.forestGreen,
        color: LANDING_COLORS.white,
        py: { xs: 9, sm: 11, md: 15 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* BACKGROUND DECORATIVE ORGANIC GLOWS */}
      <Box
        sx={{
          position: 'absolute',
          top: -120,
          right: -100,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(117, 169, 106, 0.22) 0%, rgba(23, 63, 50, 0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -100,
          left: -80,
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(233, 166, 75, 0.15) 0%, rgba(23, 63, 50, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, px: { xs: 2.5, sm: 3 } }}>
        <Stack
          alignItems="center"
          spacing={3.5}
          sx={{
            textAlign: 'center',
          }}
        >
          {/* BADGE */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'rgba(255, 255, 255, 0.12)',
              px: 2,
              py: 0.75,
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <SpaRoundedIcon sx={{ fontSize: 16, color: LANDING_COLORS.leafGreen }} />
            <Typography
              sx={{
                fontFamily: FONTS.body,
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: LANDING_COLORS.white,
              }}
            >
              MULAI SEKARANG TANPA BIAYA MESIN
            </Typography>
          </Box>

          {/* MAIN HEADLINE */}
          <Typography
            component="h2"
            sx={{
              fontFamily: FONTS.heading,
              fontSize: { xs: '2.1rem', sm: '2.9rem', md: '3.4rem' },
              fontWeight: 900,
              lineHeight: { xs: 1.2, sm: 1.15 },
              letterSpacing: '-0.03em',
              color: LANDING_COLORS.white,
            }}
          >
            Saatnya Mengelola Hasil Panen dengan Lebih Cerdas.
          </Typography>

          {/* SUPPORTING TEXT */}
          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: { xs: '1.02rem', sm: '1.15rem' },
              lineHeight: 1.65,
              color: 'rgba(255, 255, 255, 0.85)',
              maxWidth: 640,
            }}
          >
            Kenali kualitas hasil panen, pahami estimasi nilainya, dan kelola data pertanian dalam satu platform digital.
          </Typography>

          {/* PRIMARY CTA BUTTON */}
          <Box sx={{ pt: 1.5 }}>
            <Button
              onClick={() => onOpenApp('overview')}
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                bgcolor: LANDING_COLORS.white,
                color: LANDING_COLORS.forestGreen,
                fontFamily: FONTS.body,
                fontWeight: 800,
                fontSize: '1.05rem',
                textTransform: 'none',
                px: 4.5,
                py: 1.8,
                borderRadius: '14px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                '&:hover': {
                  bgcolor: '#FAF8F2',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
                },
              }}
            >
              Mulai Gunakan Agri-Sort AI
            </Button>
          </Box>

          {/* VALUE PILLS */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1.25, sm: 3 }}
            alignItems="center"
            sx={{ pt: 2 }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleRoundedIcon sx={{ fontSize: 16, color: LANDING_COLORS.leafGreen }} />
              <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.82)' }}>
                Tersimpan di Browser (Aman &amp; Cepat)
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleRoundedIcon sx={{ fontSize: 16, color: LANDING_COLORS.leafGreen }} />
              <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.82)' }}>
                Format Resmi Standar Cetak A4
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleRoundedIcon sx={{ fontSize: 16, color: LANDING_COLORS.leafGreen }} />
              <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.82)' }}>
                Responsif HP &amp; Laptop
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
