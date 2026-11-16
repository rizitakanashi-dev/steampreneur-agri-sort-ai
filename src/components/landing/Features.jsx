import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS } from './tokens.js'
import { FEATURE_STAGES } from './landingData.js'
import {
  DisplayHeadline,
  EditorialTextLink,
  GhostCategoryTag,
} from './AgriPrimitives.jsx'
import { FeatureMockup } from './FeatureMockups.jsx'

const CATEGORY_TAGS = {
  'yolo-3class': 'Visi Komputer · YOLO11n 3-Class',
  'multi-angle': 'Anti-Oklusi · Inspeksi 2-Sisi',
  'smart-pricing': 'Ekonomi Panen · BAPANAS & SP2KP',
  'recap-pwa': 'Dokumentasi · PWA & Sertifikat A4',
}

export function Features({ onOpenApp }) {
  return (
    <Box
      id="fitur"
      component="section"
      sx={{
        py: '80px',
        bgcolor: AGRI_COLORS.paperWhite,
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: '1200px !important', px: { xs: 2.5, sm: 3 } }}>
        <Stack spacing="80px">
          {FEATURE_STAGES.map((stage) => (
            <Grid
              key={stage.id}
              container
              spacing={{ xs: 4, md: 7 }}
              alignItems="center"
              direction={stage.reverse ? { xs: 'column', md: 'row-reverse' } : { xs: 'column', md: 'row' }}
            >
              <Grid size={{ xs: 12, md: 6.2 }}>
                <FeatureMockup type={stage.mockupType} />
              </Grid>

              <Grid size={{ xs: 12, md: 5.8 }}>
                <Stack spacing={2} sx={{ maxWidth: 460 }}>
                  <GhostCategoryTag>
                    {CATEGORY_TAGS[stage.id] || 'Modul Agri-Sort AI'}
                  </GhostCategoryTag>

                  <DisplayHeadline variant="section">
                    {stage.headline.charAt(0) + stage.headline.slice(1).toLowerCase()}
                  </DisplayHeadline>

                  <Typography
                    sx={{
                      fontFamily: AGRI_FONTS.sans,
                      fontWeight: 400,
                      fontSize: '1.0625rem',
                      lineHeight: 1.45,
                      color: AGRI_COLORS.slateMuted,
                    }}
                  >
                    {stage.body}
                  </Typography>

                  <Stack spacing={1} sx={{ pt: 0.5 }}>
                    {stage.bullets.map((bullet) => (
                      <Typography
                        key={bullet}
                        sx={{
                          fontFamily: AGRI_FONTS.sans,
                          fontSize: '0.96rem',
                          color: AGRI_COLORS.ink,
                          pb: 0.75,
                          borderBottom: `1px solid ${AGRI_COLORS.hairline}`,
                          '&:last-of-type': { borderBottom: 'none', pb: 0 },
                        }}
                      >
                        {bullet}
                      </Typography>
                    ))}
                  </Stack>

                  {onOpenApp && (
                    <Box>
                      <EditorialTextLink onClick={() => onOpenApp('scanner')}>
                        Buka modul ini →
                      </EditorialTextLink>
                    </Box>
                  )}
                </Stack>
              </Grid>
            </Grid>
          ))}
        </Stack>
      </Container>
    </Box>
  )
}
