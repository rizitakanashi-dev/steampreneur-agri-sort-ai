import { Box, Grid, LinearProgress, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { AvatarPresenceBubble, FloatingArtifactCard } from './AgriPrimitives.jsx'
import { CsvArchiveMotion, LiveYoloScanMotion } from './ScanMotionGraphic.jsx'

function StageWrapper({ children, avatarInitials, avatarLabel, avatarBg, avatarColor }) {
  return (
    <Box
      sx={{
        bgcolor: AGRI_COLORS.mistSurface,
        borderRadius: AGRI_RADII.cards,
        p: { xs: 2.5, sm: 4 },
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <AvatarPresenceBubble
          initials={avatarInitials}
          bg={avatarBg}
          color={avatarColor}
          label={avatarLabel}
        />
      </Box>
      {children}
    </Box>
  )
}

function ScannerMockup() {
  const rows = [
    { label: 'Grade A — Mutu Prima', value: 68, count: '17 buah', color: AGRI_COLORS.emerald },
    { label: 'Grade B — Standar', value: 24, count: '6 buah', color: AGRI_COLORS.gold },
    { label: 'Reject — Afkir', value: 8, count: '2 buah', color: AGRI_COLORS.crimson },
  ]
  return (
    <StageWrapper
      avatarInitials="FA"
      avatarBg="#E3F3EA"
      avatarColor="#034D32"
      avatarLabel="YOLO11n 3-Class Engine"
    >
      <FloatingArtifactCard parallaxFactor={-0.015} statusLabel="5.3ms ONNX" title="Detektor Mutu 3-Class">
        <Stack spacing={1.75}>
          <LiveYoloScanMotion height={175} badgeText="Deteksi Langsung 3-Class" />
          {rows.map((r) => (
            <Box key={r.label}>
              <Stack direction="row" sx={{justifyContent: 'space-between',  mb: 0.4 }}>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', color: AGRI_COLORS.ink }}>
                  {r.label}
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', fontWeight: 500, color: r.color }}>
                  {r.count} ({r.value}%)
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={r.value}
                sx={{
                  height: 6,
                  borderRadius: 4,
                  bgcolor: AGRI_COLORS.mistSurface,
                  '& .MuiLinearProgress-bar': { bgcolor: r.color, borderRadius: 4 },
                }}
              />
            </Box>
          ))}
        </Stack>
      </FloatingArtifactCard>
    </StageWrapper>
  )
}

function MultiAngleMockup() {
  return (
    <StageWrapper
      avatarInitials="HA"
      avatarBg="#EAF0F8"
      avatarColor="#1E3F66"
      avatarLabel="Anti-Oklusi 2-Sisi"
    >
      <FloatingArtifactCard parallaxFactor={0.015} statusLabel="Zero-Defect Escape" title="Verifikasi 2-Sisi Keranjang">
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ p: 1.5, borderRadius: AGRI_RADII.images, bgcolor: AGRI_COLORS.fogSurface, border: `1px solid ${AGRI_COLORS.hairline}` }}>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.74rem', color: AGRI_COLORS.teal, fontWeight: 500 }}>
                Sisi Depan
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.96rem', color: AGRI_COLORS.ink, fontWeight: 500, mt: 0.5 }}>
                12 A · 3 B · 0 Reject
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.74rem', color: AGRI_COLORS.slateMuted, mt: 0.5 }}>
                Hash: f8a2...19c4
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Box sx={{ p: 1.5, borderRadius: AGRI_RADII.images, bgcolor: AGRI_COLORS.fogSurface, border: `1px solid ${AGRI_COLORS.hairline}` }}>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.74rem', color: AGRI_COLORS.gold, fontWeight: 500 }}>
                Sesudah Goyang
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.96rem', color: AGRI_COLORS.ink, fontWeight: 500, mt: 0.5 }}>
                10 A · 3 B · 2 Reject
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.74rem', color: AGRI_COLORS.slateMuted, mt: 0.5 }}>
                Hash: 4d9b...80e1 (Unik)
              </Typography>
            </Box>
          </Grid>
        </Grid>
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: AGRI_RADII.images,
            bgcolor: '#FEF6EA',
            border: '1px solid #F0D4A8',
          }}
        >
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.84rem', color: '#6E470B' }}>
            Selisih cacat +13% terdeteksi di sisi bawah — kelas Reject dikunci pada nilai maksimum 2 buah.
          </Typography>
        </Box>
      </FloatingArtifactCard>
    </StageWrapper>
  )
}

function PricingMockup() {
  const tiers = [
    { tier: 'Grade A (1.15x)', weight: '12.0 kg', price: 'Rp 13.800/kg', total: 'Rp 165.600', color: AGRI_COLORS.emerald },
    { tier: 'Grade B (0.80x)', weight: '6.0 kg', price: 'Rp 9.600/kg', total: 'Rp 57.600', color: AGRI_COLORS.gold },
    { tier: 'Reject (0x)', weight: '2.0 kg', price: 'Rp 0/kg', total: 'Rp 0', color: AGRI_COLORS.crimson },
  ]
  return (
    <StageWrapper
      avatarInitials="AA"
      avatarBg="#FBF0E4"
      avatarColor="#6E4212"
      avatarLabel="Analis Harga Pasar"
    >
      <FloatingArtifactCard parallaxFactor={-0.015} statusLabel="SP2KP Live" title="Kalkulator Smart Pricing">
        <Stack spacing={1.25}>
          {tiers.map((t) => (
            <Box
              key={t.tier}
              sx={{
                px: 1.75,
                py: 1.25,
                borderRadius: AGRI_RADII.images,
                bgcolor: AGRI_COLORS.fogSurface,
                border: `1px solid ${AGRI_COLORS.hairline}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.84rem', fontWeight: 500, color: t.color }}>
                  {t.tier}
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.76rem', color: AGRI_COLORS.slateMuted }}>
                  {t.weight} x {t.price}
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.94rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
                {t.total}
              </Typography>
            </Box>
          ))}
          <Box sx={{ pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.86rem', color: AGRI_COLORS.slateMuted }}>
              Total Nilai Batch Tomat (20 kg)
            </Typography>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '1.08rem', fontWeight: 500, color: AGRI_COLORS.emerald }}>
              Rp 223.200
            </Typography>
          </Box>
        </Stack>
      </FloatingArtifactCard>
    </StageWrapper>
  )
}

function CertificateMockup() {
  return (
    <StageWrapper
      avatarInitials="QC"
      avatarBg="#E3F3EA"
      avatarColor="#034D32"
      avatarLabel="Sertifikat Resmi A4"
    >
      <FloatingArtifactCard parallaxFactor={0.015} statusLabel="PWA Offline" title="Arsip Batch & Sertifikat QC">
        <Stack spacing={1.5}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: AGRI_RADII.images,
              bgcolor: AGRI_COLORS.fogSurface,
              border: `1px solid ${AGRI_COLORS.hairline}`,
            }}
          >
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.86rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
              Sertifikat QC Terverifikasi #BATCH-TMT-042
            </Typography>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', color: AGRI_COLORS.slateMuted, mt: 0.4 }}>
              Engine: Ultralytics YOLO11n (3-Class Tomato Quality)
            </Typography>
          </Box>
          <CsvArchiveMotion />
        </Stack>
      </FloatingArtifactCard>
    </StageWrapper>
  )
}

export function FeatureMockup({ type }) {
  if (type === 'multiAngle') return <MultiAngleMockup />
  if (type === 'pricing') return <PricingMockup />
  if (type === 'certificate') return <CertificateMockup />
  return <ScannerMockup />
}
