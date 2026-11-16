import { Box, Grid, LinearProgress, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { ProductDeviceFrame } from './AgriPrimitives.jsx'
import { CsvArchiveMotion, LiveYoloScanMotion } from './ScanMotionGraphic.jsx'

function ScannerMockup() {
  const rows = [
    { label: 'Grade A — Mutu Prima', value: 68, count: '17 buah', color: AGRI_COLORS.leafGlow },
    { label: 'Grade B — Standar', value: 24, count: '6 buah', color: AGRI_COLORS.gold },
    { label: 'Reject — Afkir', value: 8, count: '2 buah', color: AGRI_COLORS.crimson },
  ]
  return (
    <ProductDeviceFrame statusLabel="5.3ms ONNX" title="yolo11n-3class-detector">
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={1.75}>
          <LiveYoloScanMotion height={175} badgeText="DETEKSI LANGSUNG 3-CLASS" />
          {rows.map((r) => (
            <Box key={r.label}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.82rem', color: AGRI_COLORS.snow }}>
                  {r.label}
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.82rem', fontWeight: 600, color: r.color }}>
                  {r.count} ({r.value}%)
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={r.value}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: AGRI_COLORS.appChrome,
                  '& .MuiLinearProgress-bar': { bgcolor: r.color, borderRadius: 4 },
                }}
              />
            </Box>
          ))}
        </Stack>
      </Box>
    </ProductDeviceFrame>
  )
}

function MultiAngleMockup() {
  return (
    <ProductDeviceFrame statusLabel="ZERO-DEFECT ESCAPE" title="multi-angle-verification">
      <Box sx={{ p: 2.5 }}>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ p: 1.5, borderRadius: AGRI_RADII.buttons, bgcolor: AGRI_COLORS.appChrome }}>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.72rem', color: AGRI_COLORS.teal, fontWeight: 700 }}>
                SISI DEPAN
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.95rem', color: AGRI_COLORS.snow, fontWeight: 700, mt: 0.5 }}>
                12 A · 3 B · 0 Reject
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.74rem', color: AGRI_COLORS.sageMist, mt: 0.5 }}>
                Hash: f8a2...19c4
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ p: 1.5, borderRadius: AGRI_RADII.buttons, bgcolor: AGRI_COLORS.appChrome }}>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.72rem', color: AGRI_COLORS.gold, fontWeight: 700 }}>
                SESUDAH GOYANG
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.95rem', color: AGRI_COLORS.snow, fontWeight: 700, mt: 0.5 }}>
                10 A · 3 B · 2 Reject
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.74rem', color: AGRI_COLORS.sageMist, mt: 0.5 }}>
                Hash: 4d9b...80e1 (Unik)
              </Typography>
            </Box>
          </Grid>
        </Grid>
        <Box
          sx={{
            mt: 2,
            p: 1.75,
            borderRadius: AGRI_RADII.buttons,
            bgcolor: 'rgba(233, 166, 75, 0.14)',
            border: `1px solid ${AGRI_COLORS.gold}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
          }}
        >
          <WarningAmberRoundedIcon sx={{ color: AGRI_COLORS.gold, fontSize: 22 }} />
          <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.82rem', color: AGRI_COLORS.snow }}>
            Disparitas cacat terdeteksi (+13%). Reject dikunci maksimal 2 buah sebelum pengemasan.
          </Typography>
        </Box>
      </Box>
    </ProductDeviceFrame>
  )
}

function PricingMockup() {
  const tiers = [
    { tier: 'Grade A (1.15x)', weight: '12.0 kg', price: 'Rp 13.800/kg', total: 'Rp 165.600', color: AGRI_COLORS.leafGlow },
    { tier: 'Grade B (0.80x)', weight: '6.0 kg', price: 'Rp 9.600/kg', total: 'Rp 57.600', color: AGRI_COLORS.gold },
    { tier: 'Reject (0x)', weight: '2.0 kg', price: 'Rp 0/kg', total: 'Rp 0', color: AGRI_COLORS.crimson },
  ]
  return (
    <ProductDeviceFrame statusLabel="BAPANAS + SP2KP" title="smart-pricing-engine">
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={1.25}>
          {tiers.map((t) => (
            <Box
              key={t.tier}
              sx={{
                px: 1.75,
                py: 1.25,
                borderRadius: AGRI_RADII.buttons,
                bgcolor: AGRI_COLORS.appChrome,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.84rem', fontWeight: 700, color: t.color }}>
                  {t.tier}
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.76rem', color: AGRI_COLORS.sageMist }}>
                  {t.weight} x {t.price}
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.95rem', fontWeight: 700, color: AGRI_COLORS.snow }}>
                {t.total}
              </Typography>
            </Box>
          ))}
          <Box sx={{ pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.84rem', color: AGRI_COLORS.sageMist }}>
              Total Nilai Batch Tomat (20 kg)
            </Typography>
            <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '1.15rem', fontWeight: 700, color: AGRI_COLORS.gold }}>
              Rp 223.200
            </Typography>
          </Box>
        </Stack>
      </Box>
    </ProductDeviceFrame>
  )
}

function CertificateMockup() {
  return (
    <ProductDeviceFrame statusLabel="PWA OFFLINE" title="certificate-and-csv-export">
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Box
            sx={{
              p: 1.75,
              borderRadius: AGRI_RADII.buttons,
              bgcolor: AGRI_COLORS.appChrome,
              border: `1px solid ${AGRI_COLORS.leafGlow}`,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckCircleRoundedIcon sx={{ color: AGRI_COLORS.leafGlow, fontSize: 20 }} />
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.88rem', fontWeight: 700, color: AGRI_COLORS.snow }}>
                SERTIFIKAT QC TERVERIFIKASI #BATCH-TMT-042
              </Typography>
            </Stack>
            <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.78rem', color: AGRI_COLORS.sageMist, mt: 0.75 }}>
              Engine: Ultralytics YOLO11n (3-Class Tomato Quality) · Cetak A4 &amp; Ekspor CSV RFC 4180 siap.
            </Typography>
          </Box>
          <CsvArchiveMotion />
        </Stack>
      </Box>
    </ProductDeviceFrame>
  )
}

export function FeatureMockup({ type }) {
  if (type === 'multiAngle') return <MultiAngleMockup />
  if (type === 'pricing') return <PricingMockup />
  if (type === 'certificate') return <CertificateMockup />
  return <ScannerMockup />
}
