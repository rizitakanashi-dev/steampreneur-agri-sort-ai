import { Box, Grid, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { ProductDeviceFrame } from './AgriPrimitives.jsx'
import { LiveYoloScanMotion } from './ScanMotionGraphic.jsx'
import {
  AgriBotMascot,
  FloatingChiliProp,
  FloatingEggplantProp,
  FloatingHarvestBadge,
  FloatingTomatoProp,
} from './FloatingMascots.jsx'

const LIVE_CLASSES = [
  { label: 'GRADE A', count: '14 butir (70%)', color: AGRI_COLORS.leafGlow },
  { label: 'GRADE B', count: '4 butir (20%)', color: AGRI_COLORS.gold },
  { label: 'REJECT', count: '2 butir (10%)', color: AGRI_COLORS.crimson },
]

export function HeroMockupComposite() {
  return (
    <Box sx={{ position: 'relative', py: { xs: 2, md: 3 } }}>
      <FloatingHarvestBadge
        size={74}
        sx={{
          position: 'absolute',
          top: -22,
          left: { xs: 4, md: -24 },
          zIndex: 3,
          transform: 'rotate(-12deg)',
        }}
      />
      <FloatingTomatoProp
        size={96}
        sx={{
          position: 'absolute',
          top: -28,
          right: { xs: 4, md: -22 },
          zIndex: 3,
        }}
      />
      <FloatingEggplantProp
        size={94}
        sx={{
          position: 'absolute',
          bottom: -24,
          left: { xs: -6, md: -28 },
          zIndex: 3,
        }}
      />
      <AgriBotMascot
        size={{ xs: 108, sm: 128 }}
        sx={{
          position: 'absolute',
          bottom: -26,
          right: { xs: -4, md: -24 },
          zIndex: 4,
        }}
      />

      <ProductDeviceFrame statusLabel="YOLO11N 3-CLASS" title="agri-sort-qc-scanner">
        <Grid container>
          {/* Sidebar App Chrome */}
          <Grid
            size={{ xs: 12, sm: 4 }}
            sx={{
              bgcolor: AGRI_COLORS.appChrome,
              p: 2,
              borderRight: { sm: '1px solid rgba(183, 211, 198, 0.12)' },
              borderBottom: { xs: '1px solid rgba(183, 211, 198, 0.12)', sm: 'none' },
            }}
          >
            <Stack spacing={1.25}>
              <Typography
                sx={{
                  fontFamily: AGRI_FONTS.ui,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: AGRI_COLORS.leafSlate,
                }}
              >
                MODEL AI AKTIF
              </Typography>
              {[
                { name: 'Tomat 3-Class', active: true, price: 'Rp 12.000/kg' },
                { name: 'Terung 3-Class', active: false, price: 'Rp 10.000/kg' },
                { name: 'Cabai 3-Class', active: false, price: 'Rp 42.000/kg' },
              ].map((item) => (
                <Box
                  key={item.name}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: AGRI_RADII.buttons,
                    bgcolor: item.active ? 'rgba(16, 163, 101, 0.24)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid',
                    borderColor: item.active ? AGRI_COLORS.leafGlow : 'rgba(183, 211, 198, 0.1)',
                  }}
                >
                  <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.82rem', fontWeight: 600, color: AGRI_COLORS.snow }}>
                    {item.name}
                  </Typography>
                  <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.72rem', color: AGRI_COLORS.sageMist }}>
                    Acuan {item.price}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Grid>

          {/* Main Inference Surface */}
          <Grid size={{ xs: 12, sm: 8 }} sx={{ p: 2.25 }}>
            <Stack spacing={2}>
              <LiveYoloScanMotion height={205} badgeText="MULTI-ANGLE 2-SISI TERVERIFIKASI" />

              <Grid container spacing={1}>
                {LIVE_CLASSES.map((cls) => (
                  <Grid key={cls.label} size={{ xs: 4 }}>
                    <Box
                      sx={{
                        p: 1.25,
                        borderRadius: AGRI_RADII.buttons,
                        bgcolor: AGRI_COLORS.appChrome,
                        border: '1px solid rgba(183, 211, 198, 0.12)',
                      }}
                    >
                      <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.68rem', fontWeight: 700, color: cls.color }}>
                        {cls.label}
                      </Typography>
                      <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.78rem', fontWeight: 600, color: AGRI_COLORS.snow, mt: 0.25 }}>
                        {cls.count}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Box
                sx={{
                  px: 1.5,
                  py: 1.1,
                  borderRadius: AGRI_RADII.buttons,
                  bgcolor: AGRI_COLORS.appChrome,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.78rem', color: AGRI_COLORS.sageMist }}>
                  Estimasi Nilai Panen (10 kg)
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.92rem', fontWeight: 700, color: AGRI_COLORS.gold }}>
                  Rp 115.800
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </ProductDeviceFrame>
      <FloatingChiliProp
        size={72}
        sx={{
          position: 'absolute',
          top: '46%',
          right: { xs: -12, md: -32 },
          zIndex: 2,
          display: { xs: 'none', sm: 'block' },
        }}
      />
    </Box>
  )
}
