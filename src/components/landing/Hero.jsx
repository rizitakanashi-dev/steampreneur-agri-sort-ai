import { Box, Container, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS } from './tokens.js'
import { AgriPrimaryButton, DisplayHeadline, LightSecondaryButton } from './AgriPrimitives.jsx'
import { HeroMockupComposite } from './HeroMockupComposite.jsx'
import { useHeroConvergenceScroll } from './useScrollChoreography.js'

export function Hero({ onOpenApp }) {
  const [trackRef, isConverged] = useHeroConvergenceScroll()

  const handleScrollToHowItWorks = (e) => {
    e.preventDefault()
    const el = document.querySelector('#cara-kerja')
    if (el) {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.pageYOffset - 72,
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
        pt: { xs: 14, md: 18 },
        pb: { xs: 8, md: 12 },
        bgcolor: AGRI_COLORS.paperWhite,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 60% 34%, rgba(251, 225, 209, 0.55) 0%, rgba(227, 243, 234, 0.45) 36%, rgba(255, 255, 255, 0) 68%)',
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          maxWidth: 1200,
          px: { xs: 2.5, sm: 3 },
          position: 'relative',
        }}
      >
        {/* ZONE 1: Top Centered Editorial Headline + Pill CTA Pair */}
        <Stack
          spacing={2.5}
          sx={{alignItems: 'center', 
            textAlign: 'center',
            maxWidth: 560,
            mx: 'auto',
            position: 'relative',
            zIndex: 4,
            mb: { xs: 5, md: 10 },
          }}
        >
          <DisplayHeadline component="h1" variant="display" sx={{ fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.15rem' } }}>
            Analitik panen AI untuk hasil cepat dan{' '}
            <Box component="span" sx={{ fontStyle: 'italic' }}>
              tanpa bias
            </Box>
          </DisplayHeadline>

          <Typography
            sx={{
              fontFamily: AGRI_FONTS.sans,
              fontWeight: 400,
              fontSize: '1.0625rem',
              lineHeight: 1.45,
              color: AGRI_COLORS.ink,
              maxWidth: 510,
            }}
          >
            Agri-Sort AI adalah platform visi komputer YOLO11n 3-Class yang memetakan mutu Tomat, Terung, dan Cabai serta menghitung nilai jual pasar secara presisi.
          </Typography>

          <Box
            sx={{
              width: '100%',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              pt: 0.5,
            }}
          >
            <AgriPrimaryButton
              onClick={() => onOpenApp('scanner')}
              sx={{ bgcolor: AGRI_COLORS.ink, borderColor: AGRI_COLORS.ink }}
            >
              Mulai sekarang
            </AgriPrimaryButton>
            <LightSecondaryButton href="#cara-kerja" onClick={handleScrollToHowItWorks}>
              Lihat cara kerja
            </LightSecondaryButton>
          </Box>
        </Stack>

        {/* ZONE 2: Dedicated Open Stage Below Hero Text where the 4 Scattered Cards Unite into the Full Dashboard */}
        <HeroMockupComposite trackRef={trackRef} isConverged={isConverged} onOpenApp={onOpenApp} />
      </Container>
    </Box>
  )
}
