import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS } from './tokens.js'
import { TEAM_INFO } from './landingData.js'
import {
  AgriPrimaryButton,
  DisplayHeadline,
  EditorialAccentCard,
  LightSecondaryButton,
} from './AgriPrimitives.jsx'

export function FinalCTA({ onOpenApp }) {
  return (
    <Box
      component="section"
      sx={{
        py: '80px',
        bgcolor: AGRI_COLORS.paperWhite,
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: 1200, px: { xs: 2.5, sm: 3 } }}>
        {/* Rare Single Editorial Accent Card on #FFFFFF Canvas */}
        <EditorialAccentCard sx={{ p: { xs: 4, sm: '40px' } }}>
          <Grid container spacing={{ xs: 4, md: 6 }} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 7.5 }}>
              <Stack spacing={2}>
                <Typography
                  sx={{
                    fontFamily: AGRI_FONTS.sans,
                    fontWeight: 450,
                    fontSize: '1.625rem',
                    lineHeight: 1.18,
                    letterSpacing: '-0.23px',
                    color: AGRI_COLORS.deepEmerald,
                  }}
                >
                  Standarisasi mutu yang berpihak pada nilai panen petani.
                </Typography>

                <Typography
                  sx={{
                    fontFamily: AGRI_FONTS.sans,
                    fontWeight: 430,
                    fontSize: '1.125rem',
                    lineHeight: 1.5,
                    color: AGRI_COLORS.deepEmerald,
                  }}
                >
                  “Dengan memadukan deteksi YOLO11n 3-Class dan triangulasi harga BAPANAS serta SP2KP Kemendag, petani dan pengepul memiliki acuan kualitas objektif sebelum transaksi berlangsung.”
                </Typography>

                <Typography
                  sx={{
                    fontFamily: AGRI_FONTS.sans,
                    fontWeight: 400,
                    fontSize: '0.875rem',
                    color: AGRI_COLORS.deepEmerald,
                  }}
                >
                  {TEAM_INFO.school} · {TEAM_INFO.competition}
                </Typography>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4.5 }}>
              <Stack spacing={2} sx={{ alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
                <DisplayHeadline
                  variant="subsection"
                  sx={{ color: AGRI_COLORS.deepEmerald, textAlign: { md: 'right' } }}
                >
                  Siap digunakan di smartphone &amp; laptop.
                </DisplayHeadline>

                <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                  <AgriPrimaryButton onClick={() => onOpenApp('scanner')}>
                    Mulai Scan QC
                  </AgriPrimaryButton>
                  <LightSecondaryButton
                    onClick={() => onOpenApp('overview')}
                    sx={{ borderColor: AGRI_COLORS.deepEmerald, color: AGRI_COLORS.deepEmerald }}
                  >
                    Masuk Dashboard
                  </LightSecondaryButton>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </EditorialAccentCard>
      </Container>
    </Box>
  )
}
