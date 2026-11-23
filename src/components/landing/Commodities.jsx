import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { COMMODITY_MODELS, TARGET_USERS } from './landingData.js'
import {
  DisplayHeadline,
  EditorialNeutralCard,
  GhostCategoryTag,
} from './AgriPrimitives.jsx'
import {
  FloatingChiliProp,
  FloatingEggplantProp,
  FloatingTomatoProp,
} from './FloatingMascots.jsx'

function CommodityVisual({ id }) {
  if (id === 'terung') return <FloatingEggplantProp size={52} />
  if (id === 'cabai') return <FloatingChiliProp size={52} />
  return <FloatingTomatoProp size={52} />
}

export function Commodities() {
  return (
    <Box
      id="komoditas"
      component="section"
      sx={{
        py: '80px',
        bgcolor: AGRI_COLORS.fogSurface,
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: 1200, px: { xs: 2.5, sm: 3 } }}>
        <Stack spacing={2} sx={{ maxWidth: 740, mb: 6 }}>
          <DisplayHeadline variant="hero">
            Tiga model AI 3-Class untuk hortikultura{' '}
            <Box component="span" sx={{ fontStyle: 'italic' }}>
              unggulan.
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
            Tomat, Terung, dan Cabai diklasifikasikan seragam ke Grade A, Grade B, dan Reject sesuai standar pasar modern.
          </Typography>
        </Stack>

        <Grid container spacing={3} sx={{ mb: '80px' }}>
          {COMMODITY_MODELS.map((item) => (
            <Grid key={item.id} size={{ xs: 12, md: 4 }}>
              <EditorialNeutralCard sx={{ height: '100%', p: '32px 24px' }}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <CommodityVisual id={item.id} />
                    <Box sx={{ textAlign: 'right' }}>
                      <GhostCategoryTag>{item.badge}</GhostCategoryTag>
                      <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.94rem', fontWeight: 500, color: AGRI_COLORS.emerald }}>
                        Acuan {item.refPrice}
                      </Typography>
                    </Box>
                  </Stack>

                  <Box>
                    <Typography sx={{ fontFamily: AGRI_FONTS.serif, fontWeight: 400, fontSize: '1.85rem', color: AGRI_COLORS.ink, lineHeight: 1.2 }}>
                      {item.name}
                    </Typography>
                    <GhostCategoryTag sx={{ fontStyle: 'italic' }}>
                      {item.latin}
                    </GhostCategoryTag>
                  </Box>

                  <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '1rem', lineHeight: 1.5, color: AGRI_COLORS.ink }}>
                    {item.description}
                  </Typography>

                  <Stack spacing={1} sx={{ pt: 1 }}>
                    {item.grades.map((g) => (
                      <Box
                        key={g.name}
                        sx={{
                          p: 1.5,
                          borderRadius: AGRI_RADII.images,
                          bgcolor: AGRI_COLORS.paperWhite,
                        }}
                      >
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.84rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
                          {g.name}
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.84rem', color: AGRI_COLORS.slateMuted }}>
                          {g.spec}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              </EditorialNeutralCard>
            </Grid>
          ))}
        </Grid>

        <Stack spacing={2} sx={{ maxWidth: 680, mb: 5 }}>
          <DisplayHeadline variant="section">
            Dirancang untuk seluruh rantai pasok panen.
          </DisplayHeadline>
        </Stack>

        <Grid container spacing={3}>
          {TARGET_USERS.map((user) => (
            <Grid key={user.role} size={{ xs: 12, md: 4 }}>
              <EditorialNeutralCard sx={{ height: '100%', p: '32px 24px' }}>
                <Stack spacing={1.75}>
                  <GhostCategoryTag>{user.role}</GhostCategoryTag>

                  <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontWeight: 500, fontSize: '1.25rem', color: AGRI_COLORS.ink }}>
                    {user.headline}
                  </Typography>

                  <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '1rem', lineHeight: 1.5, color: AGRI_COLORS.ink }}>
                    {user.benefit}
                  </Typography>

                  <Stack spacing={0.75} sx={{ pt: 0.5 }}>
                    {user.points.map((pt) => (
                      <Typography key={pt} sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.9rem', color: AGRI_COLORS.slateMuted }}>
                        · {pt}
                      </Typography>
                    ))}
                  </Stack>
                </Stack>
              </EditorialNeutralCard>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}
