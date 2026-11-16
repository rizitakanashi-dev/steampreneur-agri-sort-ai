import { useState } from 'react'
import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS } from './tokens.js'
import { HOW_IT_WORKS_STEPS } from './landingData.js'
import {
  DisplayHeadline,
  EditorialNeutralCard,
  EditorialTextLink,
  GhostCategoryTag,
} from './AgriPrimitives.jsx'
import { StepMotionVisual } from './ModuleMotionGraphics.jsx'

export function HowItWorks({ onOpenApp }) {
  const [selectedStep, setSelectedStep] = useState(0)

  return (
    <Box
      id="cara-kerja"
      component="section"
      sx={{
        py: '80px',
        bgcolor: AGRI_COLORS.fogSurface,
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: '1200px !important', px: { xs: 2.5, sm: 3 } }}>
        <Stack spacing={2} sx={{ maxWidth: 740, mb: 6 }}>
          <DisplayHeadline variant="hero">
            Tiga langkah menuju sortir panen yang{' '}
            <Box component="span" sx={{ fontStyle: 'italic' }}>
              transparan.
            </Box>
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
            Dari foto keranjang panen hingga sertifikat mutu QC A4 siap transaksi dalam satu alur kerja ringkas.
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          {HOW_IT_WORKS_STEPS.map((item, idx) => {
            const isSelected = idx === selectedStep
            return (
              <Grid key={item.step} size={{ xs: 12, md: 4 }}>
                <EditorialNeutralCard
                  sx={{
                    height: '100%',
                    p: '24px 20px',
                    cursor: 'pointer',
                    outline: isSelected ? `1px solid ${AGRI_COLORS.emerald}` : '1px solid transparent',
                    transition: 'outline-color 0.2s ease',
                  }}
                >
                  <Stack
                    spacing={2}
                    onClick={() => setSelectedStep(idx)}
                    sx={{ height: '100%', justifyContent: 'space-between' }}
                  >
                    <Box>
                      <StepMotionVisual stepIndex={idx} />
                      <GhostCategoryTag sx={{ mt: 2.5, mb: 0.75 }}>
                        Langkah 0{idx + 1}
                      </GhostCategoryTag>
                      <Typography
                        sx={{
                          fontFamily: AGRI_FONTS.sans,
                          fontWeight: 500,
                          fontSize: '1.25rem',
                          lineHeight: 1.25,
                          color: AGRI_COLORS.ink,
                          mb: 1,
                        }}
                      >
                        {item.title.charAt(0) + item.title.slice(1).toLowerCase()}
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: AGRI_FONTS.sans,
                          fontSize: '1rem',
                          lineHeight: 1.5,
                          color: AGRI_COLORS.ink,
                        }}
                      >
                        {item.description}
                      </Typography>
                    </Box>

                    {onOpenApp && (
                      <Box>
                        <EditorialTextLink
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenApp(idx === 2 ? 'results' : 'scanner')
                          }}
                        >
                          Jalankan langkah 0{idx + 1} →
                        </EditorialTextLink>
                      </Box>
                    )}
                  </Stack>
                </EditorialNeutralCard>
              </Grid>
            )
          })}
        </Grid>
      </Container>
    </Box>
  )
}
