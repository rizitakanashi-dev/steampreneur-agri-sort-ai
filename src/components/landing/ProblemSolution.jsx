import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { PROBLEM_VS_SOLUTION } from './landingData.js'
import { DisplayHeadline } from './AgriPrimitives.jsx'

export function ProblemSolution() {
  return (
    <Box
      component="section"
      sx={{
        py: { xs: 10, md: 13 },
        bgcolor: AGRI_COLORS.mintBg,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3 } }}>
        <Stack spacing={2} sx={{ maxWidth: 680, mb: { xs: 5, md: 7 } }}>
          <DisplayHeadline variant="section">
            AKHIRI TAKSIRAN KASAR DI KEBUN
          </DisplayHeadline>
          <Typography
            sx={{
              fontFamily: AGRI_FONTS.body,
              fontSize: { xs: '1rem', sm: '1.125rem' },
              lineHeight: 1.55,
              color: AGRI_COLORS.inkMuted,
            }}
          >
            Ubah proses sortir subjektif menjadi pembagian mutu dan estimasi harga yang terukur di setiap keranjang.
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          {PROBLEM_VS_SOLUTION.map((item) => (
            <Grid key={item.problemTitle} size={{ xs: 12, md: 4 }}>
              <Stack
                spacing={2}
                sx={{
                  height: '100%',
                  p: 3,
                  borderRadius: AGRI_RADII.cards,
                  bgcolor: AGRI_COLORS.snow,
                  border: `1px solid ${AGRI_COLORS.mintBorder}`,
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: AGRI_RADII.buttons,
                    bgcolor: '#FDF3F2',
                    border: '1px solid #F3CECB',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                    <CloseRoundedIcon sx={{ fontSize: 18, color: AGRI_COLORS.crimsonMuted }} />
                    <Typography sx={{ fontFamily: AGRI_FONTS.body, fontWeight: 700, fontSize: '0.92rem', color: '#78221D' }}>
                      {item.problemTitle}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontFamily: AGRI_FONTS.prose, fontSize: '0.86rem', lineHeight: 1.5, color: '#6E3C39' }}>
                    {item.problemDetail}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    flexGrow: 1,
                    p: 2,
                    borderRadius: AGRI_RADII.buttons,
                    bgcolor: AGRI_COLORS.mintSoft,
                    border: `1px solid ${AGRI_COLORS.mintBorder}`,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                    <CheckRoundedIcon sx={{ fontSize: 18, color: AGRI_COLORS.emerald }} />
                    <Typography sx={{ fontFamily: AGRI_FONTS.body, fontWeight: 700, fontSize: '0.92rem', color: AGRI_COLORS.ink }}>
                      {item.solutionTitle}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontFamily: AGRI_FONTS.prose, fontSize: '0.86rem', lineHeight: 1.5, color: AGRI_COLORS.inkMuted }}>
                    {item.solutionDetail}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}
