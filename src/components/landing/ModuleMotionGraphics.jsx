import { Box, Grid, LinearProgress, Stack, Typography } from '@mui/material'
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
 * Clean light-paper motion graphics replacing screenshots inside HowItWorks steps (0, 1, 2).
 */
export function StepMotionVisual({ stepIndex }) {
  if (stepIndex === 0) {
    return (
      <Box
        sx={{
          height: 190,
          borderRadius: AGRI_RADII.images,
          bgcolor: AGRI_COLORS.paperWhite,
          border: `1px solid ${AGRI_COLORS.hairline}`,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={0.75}>
          {['Tomat', 'Terung', 'Cabai'].map((item, idx) => (
            <Box
              key={item}
              sx={{
                px: 1.25,
                py: 0.4,
                borderRadius: AGRI_RADII.buttons,
                bgcolor: idx === 0 ? AGRI_COLORS.emerald : AGRI_COLORS.mistSurface,
                color: idx === 0 ? AGRI_COLORS.paperWhite : AGRI_COLORS.ink,
                fontFamily: AGRI_FONTS.sans,
                fontSize: '0.72rem',
                fontWeight: 500,
              }}
            >
              {item}
            </Box>
          ))}
        </Stack>

        <Box
          sx={{
            mx: 'auto',
            width: '78%',
            height: 92,
            borderRadius: '14px',
            border: `1.5px dashed ${AGRI_COLORS.emerald}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            bgcolor: AGRI_COLORS.fogSurface,
            animation: `${pulseNode} 2.6s ease-in-out infinite`,
            ...reducedMotionSx,
          }}
        >
          <CameraAltRoundedIcon sx={{ color: AGRI_COLORS.emerald, fontSize: 28 }} />
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.76rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
            Bidik Keranjang Panen
          </Typography>
        </Box>

        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.72rem', color: AGRI_COLORS.slateMuted, textAlign: 'center' }}>
          Kamera langsung atau unggah foto
        </Typography>
      </Box>
    )
  }

  if (stepIndex === 1) {
    const grades = [
      { label: 'Grade A', pct: 68, color: AGRI_COLORS.emerald },
      { label: 'Grade B', pct: 24, color: AGRI_COLORS.gold },
      { label: 'Reject', pct: 8, color: AGRI_COLORS.crimson },
    ]
    return (
      <Box
        sx={{
          height: 190,
          borderRadius: AGRI_RADII.images,
          bgcolor: AGRI_COLORS.paperWhite,
          border: `1px solid ${AGRI_COLORS.hairline}`,
          p: 2.25,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 1.5,
        }}
      >
        {grades.map((g, idx) => (
          <Box key={g.label}>
            <Stack direction="row" sx={{justifyContent: 'space-between',  mb: 0.4 }}>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
                {g.label}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', fontWeight: 600, color: g.color }}>
                {g.pct}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={g.pct}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: AGRI_COLORS.mistSurface,
                transformOrigin: 'left',
                animation: `${barGrow} 2.8s ease-in-out infinite`,
                animationDelay: `${idx * 0.3}s`,
                ...reducedMotionSx,
                '& .MuiLinearProgress-bar': { bgcolor: g.color, borderRadius: 4 },
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
        height: 190,
        borderRadius: AGRI_RADII.images,
        bgcolor: AGRI_COLORS.paperWhite,
        border: `1px solid ${AGRI_COLORS.hairline}`,
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
          bgcolor: AGRI_COLORS.fogSurface,
          border: `1px solid ${AGRI_COLORS.hairline}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.75rem', color: AGRI_COLORS.slateMuted }}>
          Acuan SP2KP Kemendag
        </Typography>
        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', fontWeight: 600, color: AGRI_COLORS.emerald }}>
          Rp 12.000/kg
        </Typography>
      </Box>

      <Box
        sx={{
          p: 1.5,
          borderRadius: '12px',
          bgcolor: AGRI_COLORS.blushMint,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          animation: `${floatVertical} 3s ease-in-out infinite`,
          ...reducedMotionSx,
        }}
      >
        <VerifiedRoundedIcon sx={{ color: AGRI_COLORS.deepEmerald, fontSize: 26 }} />
        <Box>
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.8rem', fontWeight: 600, color: AGRI_COLORS.deepEmerald }}>
            Sertifikat Mutu QC A4
          </Typography>
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.7rem', color: AGRI_COLORS.deepEmerald }}>
            Total Nilai: Rp 223.200 · Siap Cetak
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * Light-paper animated Motion Graphics inside DashboardPreview floating artifact card.
 */
export function DashboardModuleMotion({ moduleId }) {
  if (moduleId === 'scanner') {
    return (
      <Stack spacing={1.5}>
        <LiveYoloScanMotion height={240} badgeText="Multi-Angle · Tomat / Terung / Cabai 3-Class" />
        <Grid container spacing={1.25}>
          {[
            { label: 'Sisi 1: Kamera Depan', val: 'Terdeteksi 20 buah', color: AGRI_COLORS.emerald },
            { label: 'Sisi 2: Goyang Nampan', val: 'Anti-Oklusi Aktif', color: AGRI_COLORS.gold },
          ].map((s) => (
            <Grid key={s.label} size={{ xs: 6 }}>
              <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: AGRI_COLORS.fogSurface, border: `1px solid ${AGRI_COLORS.hairline}` }}>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.72rem', color: AGRI_COLORS.slateMuted }}>
                  {s.label}
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', fontWeight: 600, color: s.color }}>
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
      <Box sx={{ p: 2, borderRadius: AGRI_RADII.images, bgcolor: AGRI_COLORS.fogSurface, minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
            Sebaran Grade &amp; Smart Pricing
          </Typography>
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.74rem', color: AGRI_COLORS.ashTag }}>
            YOLO11n 3-Class
          </Typography>
        </Stack>

        <Grid container spacing={2} sx={{ alignItems: 'center', my: 1.5 }}>
          <Grid size={{ xs: 12, sm: 5 }} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ position: 'relative', width: 152, height: 152, animation: `${floatVertical} 3.6s ease-in-out infinite`, ...reducedMotionSx }}>
              <svg viewBox="0 0 120 120" width="152" height="152" aria-hidden="true">
                <circle cx="60" cy="60" r="44" fill="none" stroke={AGRI_COLORS.hairline} strokeWidth="14" />
                <circle
                  cx="60" cy="60" r="44" fill="none" stroke="#036E45" strokeWidth="14"
                  strokeDasharray="188 276" strokeDashoffset="0" transform="rotate(-90 60 60)"
                />
                <circle
                  cx="60" cy="60" r="44" fill="none" stroke="#C68F2F" strokeWidth="14"
                  strokeDasharray="66 276" strokeDashoffset="-188" transform="rotate(-90 60 60)"
                />
                <circle
                  cx="60" cy="60" r="44" fill="none" stroke="#A94F46" strokeWidth="14"
                  strokeDasharray="22 276" strokeDashoffset="-254" transform="rotate(-90 60 60)"
                />
              </svg>
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontFamily: AGRI_FONTS.serif, fontWeight: 400, fontSize: '1.45rem', color: AGRI_COLORS.ink }}>
                  92%
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.68rem', color: AGRI_COLORS.slateMuted }}>
                  Layak Jual
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 7 }}>
            <Stack spacing={1.1}>
              {[
                { g: 'Grade A (1.15x)', val: '68% · Rp 165.600', color: AGRI_COLORS.emerald },
                { g: 'Grade B (0.80x)', val: '24% · Rp 57.600', color: AGRI_COLORS.gold },
                { g: 'Reject (0x)', val: '8% · Pemisahan Afkir', color: AGRI_COLORS.crimson },
              ].map((row) => (
                <Box key={row.g} sx={{ p: 1.25, borderRadius: '12px', bgcolor: AGRI_COLORS.paperWhite, border: `1px solid ${AGRI_COLORS.hairline}`, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: row.color, flexShrink: 0 }} />
                  <Box>
                    <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.76rem', fontWeight: 600, color: row.color }}>
                      {row.g}
                    </Typography>
                    <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
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
      <Box sx={{ p: 2, borderRadius: AGRI_RADII.images, bgcolor: AGRI_COLORS.fogSurface, minHeight: 300, display: 'flex', flexDirection: 'column', gap: 1.35 }}>
        <Box sx={{ px: 1.5, py: 1, borderRadius: '12px', bgcolor: AGRI_COLORS.paperWhite, border: `1px solid ${AGRI_COLORS.hairline}`, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchRoundedIcon sx={{ color: AGRI_COLORS.smokePlaceholder, fontSize: 18 }} />
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', color: AGRI_COLORS.smokePlaceholder }}>
            Cari batch real-time (Tomat, Terung, Cabai)...
          </Typography>
        </Box>
        {ledger.map((row, idx) => (
          <Box
            key={row.id}
            sx={{
              p: 1.5,
              borderRadius: '12px',
              bgcolor: AGRI_COLORS.paperWhite,
              border: `1px solid ${AGRI_COLORS.hairline}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              animation: `${floatVertical} 3.2s ease-in-out infinite`,
              animationDelay: `${idx * 0.35}s`,
              ...reducedMotionSx,
            }}
          >
            <Box>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
                {row.id} — {row.comm}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.74rem', color: AGRI_COLORS.slateMuted }}>
                {row.split}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.85rem', fontWeight: 600, color: AGRI_COLORS.emerald }}>
              {row.price}
            </Typography>
          </Box>
        ))}
      </Box>
    )
  }

  // Default: 'dashboard' — Matches real Agri-Sort AI Dashboard UI
  return (
    <Box sx={{ p: 2, borderRadius: AGRI_RADII.images, bgcolor: '#F4F6F8', minHeight: 300, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Box
        sx={{
          bgcolor: '#036E45',
          color: '#FFFFFF',
          borderRadius: '14px',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.68rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.16)', display: 'inline-block', px: 1, py: 0.25, borderRadius: '9999px', mb: 0.75 }}>
            ✔ Sistem siap digunakan
          </Typography>
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '1.15rem', fontWeight: 800 }}>
            Sortir cerdas, panen maksimal.
          </Typography>
          <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.76rem', color: 'rgba(255,255,255,0.86)', mt: 0.25 }}>
            Ubah data panen menjadi keputusan QC dan harga yang lebih jelas.
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={1.25}>
        {[
          { label: 'Batch tersimpan', val: '4 Batch', sub: 'Tersimpan di browser ini' },
          { label: 'Komoditas terdaftar', val: '3 Komoditas', sub: 'Terung, Tomat, Cabai' },
          { label: 'Sumber acuan harga', val: 'SP2KP Tersimpan', sub: 'Pasar Ibuh Payakumbuh' },
        ].map((c) => (
          <Grid key={c.label} size={{ xs: 4 }}>
            <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: '#FFFFFF', border: '1px solid #E3E8E7' }}>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.68rem', color: '#68747A' }}>
                {c.label}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.92rem', fontWeight: 800, color: '#1D2326', my: 0.25 }}>
                {c.val}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.64rem', color: '#68747A' }}>
                {c.sub}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={1.25}>
        <Grid size={{ xs: 7 }}>
          <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#FFFFFF', border: '1px solid #E3E8E7', height: '100%' }}>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', fontWeight: 700, color: '#1D2326', mb: 0.75 }}>
              Harga acuan pasar · SP2KP
            </Typography>
            {[
              { n: 'Tomat', p: 'Rp 12.000/kg' },
              { n: 'Cabai Rawit Merah', p: 'Rp 42.000/kg' },
              { n: 'Terung', p: 'Rp 10.000/kg' },
            ].map((r) => (
              <Box key={r.n} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.74rem', color: '#1D2326' }}>
                  • {r.n}
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.74rem', fontWeight: 600, color: '#036E45' }}>
                  {r.p}
                </Typography>
              </Box>
            ))}
          </Box>
        </Grid>
        <Grid size={{ xs: 5 }}>
          <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#FFFFFF', border: '1px solid #E3E8E7', height: '100%' }}>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', fontWeight: 700, color: '#1D2326', mb: 0.5 }}>
              Batch Panen Terakhir
            </Typography>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.76rem', fontWeight: 600, color: '#1D2326' }}>
              Tomat (4 kg)
            </Typography>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.74rem', color: '#036E45', fontWeight: 600, mt: 0.25 }}>
              Rp 42.293
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
