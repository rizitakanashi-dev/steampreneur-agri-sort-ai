import { Box, Chip, Container, Grid, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { COMMODITY_MODELS, TARGET_USERS } from './landingData.js'
import { DisplayHeadline } from './AgriPrimitives.jsx'
import {
  FloatingChiliProp,
  FloatingEggplantProp,
  FloatingTomatoProp,
} from './FloatingMascots.jsx'

function CommodityVisual({ id }) {
  if (id === 'terung') return <FloatingEggplantProp size={76} />
  if (id === 'cabai') return <FloatingChiliProp size={76} />
  return <FloatingTomatoProp size={76} />
}

export function Commodities() {
  return (
    <Box
      id="komoditas"
      component="section"
      sx={{
        py: { xs: 10, md: 13 },
        bgcolor: AGRI_COLORS.mintBg,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3 } }}>
        {/* 3 Active YOLO11n 3-Class Commodities */}
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', maxWidth: 740, mx: 'auto', mb: 6 }}>
          <DisplayHeadline variant="section">
            TIGA MODEL AI 3-CLASS AKTIF
          </DisplayHeadline>
          <Typography
            sx={{
              fontFamily: AGRI_FONTS.body,
              fontSize: { xs: '1rem', sm: '1.125rem' },
              lineHeight: 1.55,
              color: AGRI_COLORS.inkMuted,
            }}
          >
            Tomat, Terung, dan Cabai kini terstandarisasi pada arsitektur YOLO11n 3-Class (Grade A, Grade B, Reject).
          </Typography>
        </Stack>

        <Grid container spacing={3} sx={{ mb: { xs: 8, md: 12 } }}>
          {COMMODITY_MODELS.map((item) => (
            <Grid key={item.id} size={{ xs: 12, md: 4 }}>
              <Stack
                spacing={2}
                sx={{
                  height: '100%',
                  p: 3.5,
                  borderRadius: AGRI_RADII.featurePanels,
                  bgcolor: AGRI_COLORS.snow,
                  border: `1px solid ${AGRI_COLORS.mintBorder}`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <CommodityVisual id={item.id} />
                  <Stack alignItems="flex-end" spacing={0.75}>
                    <Chip
                      label={item.badge}
                      size="small"
                      sx={{
                        bgcolor: AGRI_COLORS.mintSoft,
                        color: AGRI_COLORS.emerald,
                        fontFamily: AGRI_FONTS.ui,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        border: `1px solid ${AGRI_COLORS.mintBorder}`,
                      }}
                    />
                    <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.82rem', fontWeight: 700, color: AGRI_COLORS.goldMuted }}>
                      Acuan {item.refPrice}
                    </Typography>
                  </Stack>
                </Stack>

                <Box>
                  <Typography
                    sx={{
                      fontFamily: AGRI_FONTS.display,
                      fontWeight: 800,
                      fontSize: '1.65rem',
                      color: AGRI_COLORS.ink,
                      textTransform: 'uppercase',
                      lineHeight: 1.1,
                    }}
                  >
                    {item.name}
                  </Typography>
                  <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.82rem', fontStyle: 'italic', color: AGRI_COLORS.leafSlate }}>
                    {item.latin}
                  </Typography>
                </Box>

                <Typography sx={{ fontFamily: AGRI_FONTS.prose, fontSize: '0.92rem', lineHeight: 1.55, color: AGRI_COLORS.inkMuted }}>
                  {item.description}
                </Typography>

                <Stack spacing={1} sx={{ pt: 1 }}>
                  {item.grades.map((g) => (
                    <Box
                      key={g.name}
                      sx={{
                        p: 1.25,
                        borderRadius: AGRI_RADII.buttons,
                        bgcolor: AGRI_COLORS.mintBg,
                        border: `1px solid ${AGRI_COLORS.mintBorder}`,
                      }}
                    >
                      <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.78rem', fontWeight: 700, color: AGRI_COLORS.emerald }}>
                        {g.name}
                      </Typography>
                      <Typography sx={{ fontFamily: AGRI_FONTS.prose, fontSize: '0.8rem', color: AGRI_COLORS.inkMuted }}>
                        {g.spec}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </Grid>
          ))}
        </Grid>

        {/* Target Users */}
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', maxWidth: 700, mx: 'auto', mb: 5 }}>
          <DisplayHeadline component="h3" variant="subsection">
            DIRANCANG UNTUK SELURUH RANTAI PASOK
          </DisplayHeadline>
        </Stack>

        <Grid container spacing={3}>
          {TARGET_USERS.map((user) => {
            const Icon = user.icon
            return (
              <Grid key={user.role} size={{ xs: 12, md: 4 }}>
                <Stack
                  spacing={2}
                  sx={{
                    height: '100%',
                    p: 3.5,
                    borderRadius: AGRI_RADII.cards,
                    bgcolor: AGRI_COLORS.snow,
                    border: `1px solid ${AGRI_COLORS.mintBorder}`,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: AGRI_RADII.buttons,
                        bgcolor: AGRI_COLORS.mintSoft,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: AGRI_COLORS.emerald,
                      }}
                    >
                      <Icon />
                    </Box>
                    <Typography sx={{ fontFamily: AGRI_FONTS.body, fontWeight: 700, fontSize: '0.95rem', color: AGRI_COLORS.emerald }}>
                      {user.role}
                    </Typography>
                  </Stack>

                  <Typography sx={{ fontFamily: AGRI_FONTS.display, fontWeight: 800, fontSize: '1.22rem', color: AGRI_COLORS.ink }}>
                    {user.headline}
                  </Typography>

                  <Typography sx={{ fontFamily: AGRI_FONTS.prose, fontSize: '0.92rem', lineHeight: 1.55, color: AGRI_COLORS.inkMuted }}>
                    {user.benefit}
                  </Typography>

                  <Stack spacing={1} sx={{ pt: 0.5 }}>
                    {user.points.map((pt) => (
                      <Stack key={pt} direction="row" spacing={1} alignItems="center">
                        <CheckCircleRoundedIcon sx={{ fontSize: 17, color: AGRI_COLORS.emerald, flexShrink: 0 }} />
                        <Typography sx={{ fontFamily: AGRI_FONTS.body, fontSize: '0.86rem', color: AGRI_COLORS.ink }}>
                          {pt}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Grid>
            )
          })}
        </Grid>
      </Container>
    </Box>
  )
}
