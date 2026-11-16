import { useState } from 'react'
import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { PREVIEW_TABS } from './landingData.js'
import {
  AgriPrimaryButton,
  DisplayHeadline,
  GhostOutlineButton,
  ProductDeviceFrame,
} from './AgriPrimitives.jsx'
import { DashboardModuleMotion } from './ModuleMotionGraphics.jsx'

export function DashboardPreview({ onOpenApp }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const current = PREVIEW_TABS[activeIndex]

  return (
    <Box
      id="dashboard"
      component="section"
      sx={{
        py: { xs: 10, md: 13 },
        bgcolor: AGRI_COLORS.mintSoft,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3 } }}>
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', maxWidth: 740, mx: 'auto', mb: 5 }}>
          <DisplayHeadline variant="section">
            PRATINJAU MODUL APLIKASI
          </DisplayHeadline>
          <Typography
            sx={{
              fontFamily: AGRI_FONTS.body,
              fontSize: { xs: '1rem', sm: '1.125rem' },
              lineHeight: 1.55,
              color: AGRI_COLORS.inkMuted,
            }}
          >
            Simulasi alur kerja interaktif untuk dashboard harga, pemindai YOLO11n 3-Class, visualisasi grade, dan rekap data panen.
          </Typography>
        </Stack>

        {/* Tab Selector Row */}
        <Stack
          direction="row"
          flexWrap="wrap"
          justifyContent="center"
          gap={1.5}
          sx={{ mb: 4 }}
        >
          {PREVIEW_TABS.map((tab, idx) => {
            const Icon = tab.icon
            const isActive = idx === activeIndex
            if (isActive) {
              return (
                <AgriPrimaryButton
                  key={tab.id}
                  onClick={() => setActiveIndex(idx)}
                  startIcon={<Icon />}
                  sx={{ py: '12px', px: '20px' }}
                >
                  {tab.label}
                </AgriPrimaryButton>
              )
            }
            return (
              <GhostOutlineButton
                key={tab.id}
                onClick={() => setActiveIndex(idx)}
                startIcon={<Icon />}
              >
                {tab.label}
              </GhostOutlineButton>
            )
          })}
        </Stack>

        <Box
          sx={{
            bgcolor: AGRI_COLORS.snow,
            borderRadius: AGRI_RADII.featurePanels,
            border: `1px solid ${AGRI_COLORS.mintBorder}`,
            p: { xs: 2.5, sm: 4 },
          }}
        >
          <Grid container spacing={{ xs: 3, md: 5 }} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <ProductDeviceFrame statusLabel={current.label.toUpperCase()} title={`agri-sort-ai/#${current.appTarget}`}>
                <Box sx={{ p: 1.5 }}>
                  <DashboardModuleMotion moduleId={current.id} />
                </Box>
              </ProductDeviceFrame>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={2.5}>
                <DisplayHeadline component="h3" variant="subsection">
                  {current.title}
                </DisplayHeadline>
                <Typography
                  sx={{
                    fontFamily: AGRI_FONTS.prose,
                    fontSize: '0.98rem',
                    lineHeight: 1.55,
                    color: AGRI_COLORS.inkMuted,
                  }}
                >
                  {current.description}
                </Typography>

                <Stack spacing={1.25}>
                  {current.highlights.map((hl) => (
                    <Stack key={hl} direction="row" spacing={1.25} alignItems="center">
                      <CheckCircleRoundedIcon sx={{ fontSize: 18, color: AGRI_COLORS.emerald, flexShrink: 0 }} />
                      <Typography sx={{ fontFamily: AGRI_FONTS.body, fontSize: '0.9rem', color: AGRI_COLORS.ink }}>
                        {hl}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>

                <Box sx={{ pt: 1 }}>
                  <AgriPrimaryButton
                    onClick={() => onOpenApp(current.appTarget)}
                    endIcon={<ArrowForwardRoundedIcon />}
                  >
                    Buka {current.label}
                  </AgriPrimaryButton>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  )
}
