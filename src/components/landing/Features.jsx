import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { AGRI_COLORS, AGRI_FONTS } from './tokens.js'
import { FEATURE_STAGES } from './landingData.js'
import { DisplayHeadline, FeatureStageCard } from './AgriPrimitives.jsx'
import { FeatureMockup } from './FeatureMockups.jsx'
import {
  AgriBotMascot,
  FloatingChiliProp,
  FloatingEggplantProp,
  FloatingTomatoProp,
} from './FloatingMascots.jsx'

function StageMascot({ type }) {
  const sharedSx = {
    position: 'absolute',
    bottom: { xs: -26, md: -36 },
    right: { xs: 12, md: -28 },
    zIndex: 4,
  }
  if (type === 'eggplant') return <FloatingEggplantProp size={{ xs: 88, md: 118 }} sx={sharedSx} />
  if (type === 'chili') return <FloatingChiliProp size={{ xs: 88, md: 112 }} sx={sharedSx} />
  if (type === 'bot') return <AgriBotMascot size={{ xs: 102, md: 132 }} sx={sharedSx} />
  return <FloatingTomatoProp size={{ xs: 90, md: 115 }} sx={sharedSx} />
}

export function Features() {
  return (
    <Box
      id="fitur"
      component="section"
      sx={{
        py: { xs: 8, md: 12 },
        bgcolor: AGRI_COLORS.mintSoft,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Stack spacing={{ xs: 9, md: 12 }}>
          {FEATURE_STAGES.map((stage) => (
            <FeatureStageCard key={stage.id} gradient={stage.gradient}>
              <StageMascot type={stage.mascot} />
              <Grid
                container
                spacing={{ xs: 4, md: 6 }}
                alignItems="center"
                direction={stage.reverse ? { xs: 'column', md: 'row-reverse' } : { xs: 'column', md: 'row' }}
              >
                <Grid size={{ xs: 12, md: 6 }}>
                  <FeatureMockup type={stage.mockupType} />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={2.5} sx={{ maxWidth: 460 }}>
                    <DisplayHeadline onDark variant="section">
                      {stage.headline}
                    </DisplayHeadline>
                    <Typography
                      sx={{
                        fontFamily: AGRI_FONTS.prose,
                        fontSize: { xs: '1rem', sm: '1.08rem' },
                        lineHeight: 1.55,
                        letterSpacing: '0.01em',
                        color: AGRI_COLORS.snow,
                      }}
                    >
                      {stage.body}
                    </Typography>
                    <Stack spacing={1.25} sx={{ pt: 0.5 }}>
                      {stage.bullets.map((bullet) => (
                        <Stack key={bullet} direction="row" spacing={1.25} alignItems="center">
                          <CheckCircleRoundedIcon sx={{ fontSize: 19, color: AGRI_COLORS.leafGlow, flexShrink: 0 }} />
                          <Typography sx={{ fontFamily: AGRI_FONTS.body, fontSize: '0.94rem', color: AGRI_COLORS.snow }}>
                            {bullet}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </FeatureStageCard>
          ))}
        </Stack>
      </Container>
    </Box>
  )
}
