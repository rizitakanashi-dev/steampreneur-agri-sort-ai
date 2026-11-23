import { useState } from 'react'
import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { PREVIEW_TABS } from './landingData.js'
import {
  AgriPrimaryButton,
  AvatarPresenceBubble,
  DisplayHeadline,
  EditorialTextLink,
  FloatingArtifactCard,
  GhostCategoryTag,
  GhostOutlineButton,
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
        py: '80px',
        bgcolor: AGRI_COLORS.paperWhite,
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: 1200, px: { xs: 2.5, sm: 3 } }}>
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', maxWidth: 740, mx: 'auto', mb: 5 }}>
          <DisplayHeadline variant="hero">
            Lihat setiap modul bekerja secara{' '}
            <Box component="span" sx={{ fontStyle: 'italic' }}>
              langsung.
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
            Simulasi interaktif untuk dashboard harga pasar, pemindai YOLO11n 3-Class, diagram grade, dan arsip panen.
          </Typography>
        </Stack>

        <Stack
          direction="row"
          flexWrap="wrap"
          justifyContent="center"
          gap={1.25}
          sx={{ mb: 5 }}
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
                  sx={{ py: '9px', px: '20px', minHeight: 40, fontSize: '0.9375rem' }}
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

        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
          <Grid size={{ xs: 12, md: 6.8 }}>
            <Box
              sx={{
                bgcolor: AGRI_COLORS.mistSurface,
                borderRadius: AGRI_RADII.cards,
                p: { xs: 2, sm: 3.5 },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <GhostCategoryTag>Mode Pratinjau Interaktif</GhostCategoryTag>
                <AvatarPresenceBubble initials="AI" bg="#E3F3EA" color="#034D32" label={current.label} />
              </Box>
              <FloatingArtifactCard
                parallaxFactor={-0.014}
                statusLabel="Aktif"
                title={current.label}
              >
                <DashboardModuleMotion moduleId={current.id} />
              </FloatingArtifactCard>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 5.2 }}>
            <Stack spacing={2}>
              <GhostCategoryTag>
                Modul 0{activeIndex + 1} · {current.label}
              </GhostCategoryTag>
              <DisplayHeadline component="h3" variant="subsection">
                {current.title}
              </DisplayHeadline>
              <Typography
                sx={{
                  fontFamily: AGRI_FONTS.sans,
                  fontSize: '1.0625rem',
                  lineHeight: 1.45,
                  color: AGRI_COLORS.slateMuted,
                }}
              >
                {current.description}
              </Typography>

              <Stack spacing={1} sx={{ pt: 0.5 }}>
                {current.highlights.map((hl) => (
                  <Typography
                    key={hl}
                    sx={{
                      fontFamily: AGRI_FONTS.sans,
                      fontSize: '0.96rem',
                      color: AGRI_COLORS.ink,
                      pb: 0.75,
                      borderBottom: `1px solid ${AGRI_COLORS.hairline}`,
                      '&:last-of-type': { borderBottom: 'none', pb: 0 },
                    }}
                  >
                    {hl}
                  </Typography>
                ))}
              </Stack>

              <Stack direction="row" spacing={2.5} alignItems="center" sx={{ pt: 1 }}>
                <AgriPrimaryButton onClick={() => onOpenApp(current.appTarget)}>
                  Buka {current.label}
                </AgriPrimaryButton>
                <EditorialTextLink onClick={() => onOpenApp('scanner')}>
                  Coba scan →
                </EditorialTextLink>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
