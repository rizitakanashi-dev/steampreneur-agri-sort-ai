import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS } from './tokens.js'
import { PROBLEM_VS_SOLUTION } from './landingData.js'
import {
  DisplayHeadline,
  EditorialNeutralCard,
  EditorialTextLink,
  GhostCategoryTag,
} from './AgriPrimitives.jsx'

export function ProblemSolution({ onOpenApp }) {
  return (
    <Box
      component="section"
      sx={{
        py: '80px',
        bgcolor: AGRI_COLORS.fogSurface,
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: 1200, px: { xs: 2.5, sm: 3 } }}>
        <Stack spacing={2} sx={{ maxWidth: 740, mb: 6 }}>
          <DisplayHeadline variant="hero">
            Mengganti taksiran kasar dengan{' '}
            <Box component="span" sx={{ fontStyle: 'italic' }}>
              data mutu
            </Box>{' '}
            yang terukur.
          </DisplayHeadline>
          <Typography
            sx={{
              fontFamily: AGRI_FONTS.sans,
              fontWeight: 430,
              fontSize: '1.125rem',
              lineHeight: 1.45,
              color: AGRI_COLORS.slateMuted,
              maxWidth: 560,
            }}
          >
            Setiap keranjang panen dinilai berdasarkan komposisi mutu riil, bukan perkiraan visual yang subjektif.
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          {PROBLEM_VS_SOLUTION.map((item, idx) => (
            <Grid key={item.problemTitle} size={{ xs: 12, md: 4 }}>
              <EditorialNeutralCard sx={{ height: '100%', p: '32px 24px' }}>
                <Stack spacing={2} sx={{ height: '100%', justifyContent: 'space-between' }}>
                  <Box>
                    <GhostCategoryTag sx={{ mb: 1.5 }}>
                      Tantangan 0{idx + 1} · Sortasi Lapangan
                    </GhostCategoryTag>
                    <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '1.25rem', fontWeight: 500, color: AGRI_COLORS.ink, mb: 1 }}>
                      {item.solutionTitle}
                    </Typography>
                    <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '1rem', lineHeight: 1.5, color: AGRI_COLORS.ink, mb: 1.5 }}>
                      {item.solutionDetail}
                    </Typography>
                    <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.9rem', lineHeight: 1.5, color: AGRI_COLORS.slateMuted }}>
                      Mengatasi: {item.problemDetail.toLowerCase()}
                    </Typography>
                  </Box>

                  {onOpenApp && (
                    <Box>
                      <EditorialTextLink onClick={() => onOpenApp('scanner')}>
                        Uji di scanner →
                      </EditorialTextLink>
                    </Box>
                  )}
                </Stack>
              </EditorialNeutralCard>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}
