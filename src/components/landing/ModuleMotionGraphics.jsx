import { Box, Chip, Grid, LinearProgress, Stack, Typography } from '@mui/material'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { LiveYoloScanMotion } from './ScanMotionGraphic.jsx'
import {
  barGrow,
  floatVertical,
  flowDash,
  pulseNode,
  reducedMotionSx,
} from './motionKeyframes.js'

/**
 * Motion graphics replacing screenshots inside HowItWorks steps (0, 1, 2).
 */
export function StepMotionVisual({ stepIndex }) {
  if (stepIndex === 0) {
    return (
      <Box
        sx={{
          height: 195,
          borderRadius: AGRI_RADII.buttons,
          bgcolor: '#0A251B',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Stack direction="row" spacing={0.75}>
          {['Tomat', 'Terung', 'Cabai'].map((item, idx) => (
            <Chip
              key={item}
              label={item}
              size="small"
              sx={{
                bgcolor: idx === 0 ? AGRI_COLORS.leafGlow : 'rgba(255,255,255,0.08)',
                color: idx === 0 ? '#04110C' : AGRI_COLORS.snow,
                fontFamily: AGRI_FONTS.ui,
                fontWeight: 700,
                fontSize: '0.7rem',
              }}
            />
          ))}
        </Stack>

        <Box
          sx={{
            mx: 'auto',
            width: '76%',
            height: 100,
            borderRadius: '12px',
            border: `2px dashed ${AGRI_COLORS.leafGlow}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            bgcolor: 'rgba(52, 199, 123, 0.08)',
            animation: `${pulseNode} 2.6s ease-in-out infinite`,
            ...reducedMotionSx,
          }}
        >
          <CameraAltRoundedIcon sx={{ color: AGRI_COLORS.leafGlow, fontSize: 30 }} />
          <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.74rem', fontWeight: 600, color: AGRI_COLORS.snow }}>
            Bidik Keranjang Panen
          </Typography>
        </Box>
        <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.68rem', color: AGRI_COLORS.sageMist, textAlign: 'center' }}>
          Kamera Langsung / Unggah Foto
        </Typography>
      </Box>
    )
  }

  if (stepIndex === 1) {
    const grades = [
      { label: 'Grade A', pct: 68, color: AGRI_COLORS.leafGlow },
      { label: 'Grade B', pct: 24, color: AGRI_COLORS.gold },
      { label: 'Reject', pct: 8, color: AGRI_COLORS.crimson },
    ]
    return (
      <Box
        sx={{
          height: 195,
          borderRadius: AGRI_RADII.buttons,
          bgcolor: '#0A251B',
          p: 2.25,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 1.5,
        }}
      >
        {grades.map((g, idx) => (
          <Box key={g.label}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.76rem', fontWeight: 700, color: AGRI_COLORS.snow }}>
                {g.label}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.76rem', fontWeight: 700, color: g.color }}>
                {g.pct}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={g.pct}
              sx={{
                height: 10,
                borderRadius: 5,
                bgcolor: 'rgba(255,255,255,0.08)',
                transformOrigin: 'left',
                animation: `${barGrow} 2.8s ease-in-out infinite`,
                animationDelay: `${idx * 0.3}s`,
                ...reducedMotionSx,
                '& .MuiLinearProgress-bar': { bgcolor: g.color, borderRadius: 5 },
              }}
            />
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box
      sx={{
        height: 195,
        borderRadius: AGRI_RADII.buttons,
        bgcolor: '#0A251B',
        p: 2.25,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Box
        sx={{
          p: 1.25,
          borderRadius: '10px',
          bgcolor: AGRI_COLORS.appSurface,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.74rem', color: AGRI_COLORS.sageMist }}>
          Acuan BAPANAS + SP2KP
        </Typography>
        <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.82rem', fontWeight: 800, color: AGRI_COLORS.gold }}>
          Rp 12.000/kg
        </Typography>
      </Box>

      <Box
        sx={{
          p: 1.5,
          borderRadius: '10px',
          bgcolor: 'rgba(52, 199, 123, 0.14)',
          border: `1px solid ${AGRI_COLORS.leafGlow}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          animation: `${floatVertical} 3s ease-in-out infinite`,
          ...reducedMotionSx,
        }}
      >
        <VerifiedRoundedIcon sx={{ color: AGRI_COLORS.leafGlow, fontSize: 28 }} />
        <Box>
          <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.78rem', fontWeight: 700, color: AGRI_COLORS.snow }}>
            Sertifikat Mutu QC A4
          </Typography>
          <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.68rem', color: AGRI_COLORS.sageMist }}>
            Total Nilai: Rp 223.200 · Siap Cetak &amp; CSV
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * Interactive-style animated Motion Graphics replacing screenshots inside DashboardPreview tabs.
 */
export function DashboardModuleMotion({ moduleId }) {
  if (moduleId === 'scanner') {
    return (
      <Stack spacing={1.5}>
        <LiveYoloScanMotion height={250} badgeText="MULTI-ANGLE · TOMAT / TERUNG / CABAI 3-CLASS" />
        <Grid container spacing={1.25}>
          {[
            { label: 'Sisi 1: Kamera Depan', val: 'Terdeteksi 20 buah', color: AGRI_COLORS.leafGlow },
            { label: 'Sisi 2: Goyang Nampan', val: 'Anti-Oklusi Aktif', color: AGRI_COLORS.gold },
          ].map((s) => (
            <Grid key={s.label} size={{ xs: 6 }}>
              <Box sx={{ p: 1.25, borderRadius: '10px', bgcolor: AGRI_COLORS.appChrome }}>
                <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.7rem', color: AGRI_COLORS.sageMist }}>
                  {s.label}
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.8rem', fontWeight: 700, color: s.color }}>
                  {s.val}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Stack>
    )
  }

  if (moduleId === 'results') {
    return (
      <Box sx={{ p: 2.5, borderRadius: AGRI_RADII.cards, bgcolor: '#081D15', minHeight: 320, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.8rem', fontWeight: 700, color: AGRI_COLORS.snow }}>
            DONUT SEBARAN GRADE &amp; SMART PRICING
          </Typography>
          <Chip label="3-CLASS YOLO11N" size="small" sx={{ bgcolor: 'rgba(52,199,123,0.16)', color: AGRI_COLORS.leafGlow, fontWeight: 700, fontSize: '0.68rem' }} />
        </Stack>

        <Grid container spacing={2} alignItems="center" sx={{ my: 1.5 }}>
          <Grid size={{ xs: 12, sm: 5 }} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ position: 'relative', width: 156, height: 156, animation: `${floatVertical} 3.6s ease-in-out infinite`, ...reducedMotionSx }}>
              <svg viewBox="0 0 120 120" width="156" height="156" aria-hidden="true">
                <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
                <circle
                  cx="60" cy="60" r="44" fill="none" stroke="#34C77B" strokeWidth="14"
                  strokeDasharray="188 276" strokeDashoffset="0" transform="rotate(-90 60 60)"
                />
                <circle
                  cx="60" cy="60" r="44" fill="none" stroke="#E9A64B" strokeWidth="14"
                  strokeDasharray="66 276" strokeDashoffset="-188" transform="rotate(-90 60 60)"
                />
                <circle
                  cx="60" cy="60" r="44" fill="none" stroke="#D9534F" strokeWidth="14"
                  strokeDasharray="22 276" strokeDashoffset="-254" transform="rotate(-90 60 60)"
                />
              </svg>
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontFamily: AGRI_FONTS.display, fontWeight: 800, fontSize: '1.2rem', color: AGRI_COLORS.snow }}>
                  92%
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.66rem', color: AGRI_COLORS.sageMist }}>
                  Layak Jual
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 7 }}>
            <Stack spacing={1.2}>
              {[
                { g: 'Grade A (1.15x)', val: '68% · Rp 165.600', color: AGRI_COLORS.leafGlow },
                { g: 'Grade B (0.80x)', val: '24% · Rp 57.600', color: AGRI_COLORS.gold },
                { g: 'Reject (0x)', val: '8% · Pemisahan Afkir', color: AGRI_COLORS.crimson },
              ].map((row) => (
                <Box key={row.g} sx={{ p: 1.25, borderRadius: '10px', bgcolor: AGRI_COLORS.appChrome, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color, flexShrink: 0 }} />
                  <Box>
                    <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.76rem', fontWeight: 700, color: row.color }}>
                      {row.g}
                    </Typography>
                    <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.82rem', fontWeight: 600, color: AGRI_COLORS.snow }}>
                      {row.val}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Box>
    )
  }

  if (moduleId === 'recap') {
    const ledger = [
      { id: '#TMT-042', comm: 'Tomat · 20 kg', split: 'A 68% · B 24% · R 8%', price: 'Rp 223.200' },
      { id: '#TRG-019', comm: 'Terung · 15 kg', split: 'A 74% · B 20% · R 6%', price: 'Rp 152.100' },
      { id: '#CBI-008', comm: 'Cabai · 10 kg', split: 'A 80% · B 15% · R 5%', price: 'Rp 436.800' },
    ]
    return (
      <Box sx={{ p: 2.5, borderRadius: AGRI_RADII.cards, bgcolor: '#081D15', minHeight: 320, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ px: 1.5, py: 1, borderRadius: '10px', bgcolor: AGRI_COLORS.appChrome, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchRoundedIcon sx={{ color: AGRI_COLORS.leafGlow, fontSize: 18 }} />
          <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.78rem', color: AGRI_COLORS.sageMist }}>
            Cari batch real-time (Tomat, Terung, Cabai)...
          </Typography>
        </Box>
        {ledger.map((row, idx) => (
          <Box
            key={row.id}
            sx={{
              p: 1.5,
              borderRadius: '10px',
              bgcolor: AGRI_COLORS.appSurface,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              animation: `${floatVertical} 3.2s ease-in-out infinite`,
              animationDelay: `${idx * 0.35}s`,
              ...reducedMotionSx,
            }}
          >
            <Box>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.8rem', fontWeight: 700, color: AGRI_COLORS.snow }}>
                {row.id} — {row.comm}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.7rem', color: AGRI_COLORS.sageMist }}>
                {row.split}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.84rem', fontWeight: 700, color: AGRI_COLORS.gold }}>
              {row.price}
            </Typography>
          </Box>
        ))}
      </Box>
    )
  }

  // Default: 'dashboard'
  return (
    <Box sx={{ p: 2.5, borderRadius: AGRI_RADII.cards, bgcolor: '#081D15', minHeight: 320, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 1.75 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center">
          <SyncRoundedIcon sx={{ color: AGRI_COLORS.leafGlow, fontSize: 18, animation: `${pulseNode} 2s ease-in-out infinite`, ...reducedMotionSx }} />
          <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.78rem', fontWeight: 700, color: AGRI_COLORS.snow }}>
            LIVE HARGA BAPANAS &amp; SP2KP KEMENDAG RI
          </Typography>
        </Stack>
        <Chip label="PWA SIAP OFFLINE" size="small" sx={{ bgcolor: 'rgba(52,199,123,0.16)', color: AGRI_COLORS.leafGlow, fontSize: '0.66rem', fontWeight: 700 }} />
      </Stack>

      <Grid container spacing={1.25}>
        {[
          { comm: 'Tomat', price: 'Rp 12.000/kg', delta: '+4.2%' },
          { comm: 'Terung', price: 'Rp 10.000/kg', delta: '+2.8%' },
          { comm: 'Cabai', price: 'Rp 42.000/kg', delta: '+6.1%' },
        ].map((c) => (
          <Grid key={c.comm} size={{ xs: 4 }}>
            <Box sx={{ p: 1.25, borderRadius: '10px', bgcolor: AGRI_COLORS.appChrome }}>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.7rem', color: AGRI_COLORS.sageMist }}>
                {c.comm}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.84rem', fontWeight: 700, color: AGRI_COLORS.snow, mt: 0.25 }}>
                {c.price}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.68rem', fontWeight: 700, color: AGRI_COLORS.leafGlow }}>
                {c.delta} stabil
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Animated Trend Wave SVG */}
      <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: AGRI_COLORS.appChrome }}>
        <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.7rem', color: AGRI_COLORS.sageMist, mb: 0.5 }}>
          Grafik Alur Kualitas Batch Harian
        </Typography>
        <svg viewBox="0 0 360 72" width="100%" height="68" aria-hidden="true">
          <path
            d="M 8 56 Q 60 44, 108 40 T 204 26 T 296 18 L 352 10"
            fill="none"
            stroke="#34C77B"
            strokeWidth="3.5"
            strokeDasharray="10 6"
            style={{ animation: `${flowDash} 1.8s linear infinite` }}
          />
          <circle cx="108" cy="40" r="4.5" fill="#E9A64B" />
          <circle cx="204" cy="26" r="4.5" fill="#34C77B" />
          <circle cx="352" cy="10" r="5" fill="#34C77B" />
        </svg>
      </Box>
    </Box>
  )
}
