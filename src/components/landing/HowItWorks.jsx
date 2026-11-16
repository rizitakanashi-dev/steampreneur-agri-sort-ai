import { Box, Chip, Container, Grid, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { HOW_IT_WORKS_STEPS } from './landingData.js'
import { DisplayHeadline } from './AgriPrimitives.jsx'
import { StepMotionVisual } from './ModuleMotionGraphics.jsx'

export function HowItWorks() {
  return (
    <Box
      id="cara-kerja"
      component="section"
      sx={{
        py: { xs: 10, md: 13 },
        bgcolor: AGRI_COLORS.mintBg,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3 } }}>
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', maxWidth: 700, mx: 'auto', mb: { xs: 6, md: 8 } }}>
          <DisplayHeadline variant="section">
            TIGA LANGKAH SORTIR OTOMATIS
          </DisplayHeadline>
          <Typography
            sx={{
              fontFamily: AGRI_FONTS.body,
              fontSize: { xs: '1rem', sm: '1.125rem' },
              lineHeight: 1.55,
              color: AGRI_COLORS.inkMuted,
            }}
          >
            Dari foto keranjang panen hingga sertifikat mutu QC A4 siap transaksi dalam satu alur kerja cepat.
          </Typography>
        </Stack>

        <Grid container spacing={3.5}>
          {HOW_IT_WORKS_STEPS.map((item, idx) => (
            <Grid key={item.step} size={{ xs: 12, md: 4 }}>
              <Stack
                spacing={2}
                sx={{
                  height: '100%',
                  p: 2.5,
                  borderRadius: AGRI_RADII.cards,
                  bgcolor: AGRI_COLORS.snow,
                  border: `1px solid ${AGRI_COLORS.mintBorder}`,
                }}
              >
                <Box sx={{ position: 'relative' }}>
                  <StepMotionVisual stepIndex={idx} />
                  <Chip
                    label={item.step}
                    size="small"
                    sx={{
                      position: 'absolute',
                      bottom: 10,
                      right: 10,
                      bgcolor: AGRI_COLORS.emerald,
                      color: AGRI_COLORS.snow,
                      fontFamily: AGRI_FONTS.ui,
                      fontWeight: 700,
                      fontSize: '0.7rem',
                    }}
                  />
                </Box>
                <Typography
                  sx={{
                    fontFamily: AGRI_FONTS.display,
                    fontWeight: 800,
                    fontSize: '1.3rem',
                    lineHeight: 1.15,
                    letterSpacing: '-0.01em',
                    color: AGRI_COLORS.ink,
                  }}
                >
                  {item.title}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: AGRI_FONTS.prose,
                    fontSize: '0.94rem',
                    lineHeight: 1.55,
                    color: AGRI_COLORS.inkMuted,
                  }}
                >
                  {item.description}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}
