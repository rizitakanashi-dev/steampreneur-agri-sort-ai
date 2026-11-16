import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded'
import { AGRI_COLORS, AGRI_FONTS } from './tokens.js'
import { AgriPrimaryButton, DisplayHeadline, LightSecondaryButton } from './AgriPrimitives.jsx'
import { HeroMockupComposite } from './HeroMockupComposite.jsx'

export function Hero({ onOpenApp }) {
  const handleScrollToHowItWorks = (e) => {
    e.preventDefault()
    const el = document.querySelector('#cara-kerja')
    if (el) {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.pageYOffset - 80,
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
        minHeight: { md: '90vh' },
        display: 'flex',
        alignItems: 'center',
        pt: { xs: 13, md: 14 },
        pb: { xs: 10, md: 12 },
        background: 'radial-gradient(ellipse at 78% 22%, rgba(52, 199, 123, 0.22) 0%, rgba(242, 251, 246, 0) 56%), radial-gradient(circle at 12% 84%, rgba(233, 166, 75, 0.12) 0%, rgba(242, 251, 246, 0) 42%), linear-gradient(180deg, #F4FCF8 0%, #E6F6ED 100%)',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, px: { xs: 2.5, sm: 3 } }}>
        <Grid container spacing={{ xs: 6, md: 5 }} alignItems="center">
          {/* Left 50% — All-caps weight 800 headline + body + CTA pair */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3}>
              <DisplayHeadline component="h1" variant="display">
                SORTIR PANEN CERDAS DENGAN AI KOMPUTER
              </DisplayHeadline>

              <Typography
                sx={{
                  fontFamily: AGRI_FONTS.body,
                  fontWeight: 400,
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  lineHeight: 1.55,
                  letterSpacing: '0.01em',
                  color: AGRI_COLORS.inkMuted,
                  maxWidth: 440,
                }}
              >
                Deteksi mutu 3-Class (Grade A, Grade B, Reject) untuk Tomat, Terung, dan Cabai dalam hitungan detik, lengkap dengan Smart Pricing BAPANAS &amp; SP2KP Kemendag.
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{ pt: 1 }}
              >
                <LightSecondaryButton
                  href="#cara-kerja"
                  onClick={handleScrollToHowItWorks}
                  startIcon={<QrCodeScannerRoundedIcon />}
                >
                  Lihat Cara Kerja
                </LightSecondaryButton>
                <AgriPrimaryButton
                  onClick={() => onOpenApp('scanner')}
                  endIcon={<ArrowForwardRoundedIcon />}
                >
                  Buka QC Scanner
                </AgriPrimaryButton>
              </Stack>

              <Typography
                sx={{
                  fontFamily: AGRI_FONTS.body,
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: AGRI_COLORS.emerald,
                  letterSpacing: '0.01em',
                }}
              >
                Tomat · Terung · Cabai · Siap Offline PWA &amp; Sertifikat QC A4
              </Typography>
            </Stack>
          </Grid>

          {/* Right 50% — Agri-Sort UI Composite + Overlapping 3D Harvest Mascots */}
          <Grid size={{ xs: 12, md: 6 }}>
            <HeroMockupComposite />
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
