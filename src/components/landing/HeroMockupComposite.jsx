import { Box, Grid, Stack, Typography } from '@mui/material'
import AgricultureRoundedIcon from '@mui/icons-material/AgricultureRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded'
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import CurrencyExchangeRoundedIcon from '@mui/icons-material/CurrencyExchangeRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import SpaRoundedIcon from '@mui/icons-material/SpaRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_SHADOWS } from './tokens.js'

const WORKSPACE_MENU = [
  { label: 'Dashboard', icon: GridViewRoundedIcon, page: 'overview', active: true },
  { label: 'Batch QC Scanner', icon: QrCodeScannerRoundedIcon, page: 'scanner' },
  { label: 'Hasil Analisis QC', icon: AssessmentRoundedIcon, page: 'results' },
  { label: 'Rekap Data Panen', icon: TableChartRoundedIcon, page: 'results-list' },
  { label: 'Harga Pasar', icon: CurrencyExchangeRoundedIcon, page: 'pricing' },
]

const MARKET_PRICES = [
  { name: 'Tomat', price: 'Rp 12.000' },
  { name: 'Cabai Merah Keriting', price: 'Rp 45.000' },
  { name: 'Cabai Rawit Merah', price: 'Rp 42.000' },
  { name: 'Terung', price: 'Rp 10.000' },
]

function FloatingCursorBadge({ initials, bg, border, arrowSide = 'top-right', sx = {} }) {
  const arrowStyle =
    arrowSide === 'top-right'
      ? { top: -8, right: -8, transform: 'rotate(0deg)' }
      : { top: -10, left: -10, transform: 'rotate(-75deg)' }

  return (
    <Box
      sx={{
        position: 'absolute',
        zIndex: 10,
        pointerEvents: 'none',
        opacity: { xs: 0, md: 'var(--scatter-inv, 1)' },
        ...sx,
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '9999px',
            bgcolor: bg,
            border: `1.5px solid ${border}`,
            color: AGRI_COLORS.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: AGRI_FONTS.sans,
            fontWeight: 600,
            fontSize: '0.75rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {initials}
        </Box>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          aria-hidden="true"
          style={{ position: 'absolute', ...arrowStyle }}
        >
          <polygon points="14,2 2,7 7,10 10,15" fill={AGRI_COLORS.ink} />
        </svg>
      </Box>
    </Box>
  )
}

/**
 * Faithful Agri-Sort AI Dashboard Preview with Scroll Convergence:
 * - At `scrollY = 0` (`--scatter-inv = 1`, `--shell-opacity = 0`):
 *   The dashboard cards fan out cleanly BELOW the Hero CTA buttons (never overlapping the headline/subhead!).
 * - As the user scrolls down (`--scatter-inv -> 0`, `--shell-opacity -> 1`):
 *   All cards glide inward and lock together with the Left Sidebar & Green Banner (`Sortir cerdas, panen maksimal.`)
 *   to form the exact Agri-Sort AI Dashboard in the open space below the Hero.
 */
export function HeroMockupComposite({ onOpenApp, isConverged, trackRef }) {
  return (
    <Box
      ref={trackRef}
      style={{
        '--converge-p': 0,
        '--scatter-inv': 1,
        '--shell-opacity': 0,
      }}
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 1180,
        mx: 'auto',
        zIndex: 2,
      }}
    >
      {/* Outer Dashboard Window Frame (Materializes smoothly as cards converge) */}
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '24px',
          bgcolor: '#F4F6F8',
          border: '1px solid #DFE5E2',
          boxShadow: '0 32px 72px -16px rgba(10, 38, 26, 0.16), 0 0 0 1px rgba(4, 23, 43, 0.05)',
          opacity: { xs: 1, md: 'var(--shell-opacity, 0)' },
          transform: {
            xs: 'none',
            md: 'scale(calc(0.97 + 0.03 * var(--shell-opacity, 0)))',
          },
          pointerEvents: 'none',
          willChange: 'transform, opacity',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          borderRadius: '24px',
          overflow: { xs: 'hidden', md: 'visible' },
        }}
      >
        <Grid container sx={{ minHeight: { md: 640 } }}>
          {/* LEFT SIDEBAR — Exact match to Agri-Sort AI AppShell */}
          <Grid
            size={{ xs: 12, md: 2.7 }}
            sx={{
              display: { xs: 'none', md: 'flex' },
              bgcolor: '#FFFFFF',
              borderRight: '1px solid #E3E8E7',
              borderTopLeftRadius: '24px',
              borderBottomLeftRadius: '24px',
              p: 2.25,
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: 'var(--shell-opacity, 0)',
              transform: 'translate3d(calc((1 - var(--shell-opacity, 0)) * -28px), 0, 0)',
              pointerEvents: isConverged ? 'auto' : 'none',
              willChange: 'transform, opacity',
            }}
          >
            <Stack spacing={2}>
              {/* Brand Header */}
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 0.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: '#036E45',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AgricultureRoundedIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.92rem', fontWeight: 700, color: '#1D2326', lineHeight: 1.15 }}>
                    Agri-Sort AI
                  </Typography>
                  <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.7rem', color: '#68747A' }}>
                    Precision Agriculture
                  </Typography>
                </Box>
              </Stack>

              {/* Halaman Depan Outlined Pill */}
              <Box
                component="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.75,
                  py: 1,
                  borderRadius: '9999px',
                  border: '1px solid #C5DDD3',
                  bgcolor: '#F5FAF8',
                  color: '#036E45',
                  fontFamily: AGRI_FONTS.sans,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <HomeRoundedIcon sx={{ fontSize: 16 }} />
                Halaman Depan (Landing)
              </Box>

              {/* WORKSPACE Section */}
              <Box>
                <Typography
                  sx={{
                    px: 1,
                    mb: 1,
                    fontFamily: AGRI_FONTS.sans,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: '#68747A',
                  }}
                >
                  WORKSPACE
                </Typography>
                <Stack spacing={0.5}>
                  {WORKSPACE_MENU.map((item) => {
                    const Icon = item.icon
                    return (
                      <Box
                        key={item.label}
                        component="button"
                        onClick={() => onOpenApp?.(item.page)}
                        sx={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          px: 1.5,
                          py: 1,
                          borderRadius: '9999px',
                          border: 'none',
                          textAlign: 'left',
                          bgcolor: item.active ? '#D5E6DF' : 'transparent',
                          color: item.active ? '#034D32' : '#3E4C52',
                          fontFamily: AGRI_FONTS.sans,
                          fontSize: '0.8rem',
                          fontWeight: item.active ? 700 : 500,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: item.active ? '#D5E6DF' : '#F4F6F8' },
                        }}
                      >
                        <Icon sx={{ fontSize: 17 }} />
                        {item.label}
                      </Box>
                    )
                  })}
                </Stack>
              </Box>

              {/* SYSTEM Section */}
              <Box>
                <Typography
                  sx={{
                    px: 1,
                    mb: 0.75,
                    fontFamily: AGRI_FONTS.sans,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: '#68747A',
                  }}
                >
                  SYSTEM
                </Typography>
                <Box
                  component="button"
                  onClick={() => onOpenApp?.('overview')}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 1.5,
                    py: 1,
                    borderRadius: '9999px',
                    border: 'none',
                    bgcolor: 'transparent',
                    color: '#3E4C52',
                    fontFamily: AGRI_FONTS.sans,
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#F4F6F8' },
                  }}
                >
                  <SettingsRoundedIcon sx={{ fontSize: 17 }} />
                  Pengaturan &amp; Info Sistem
                </Box>
              </Box>
            </Stack>

            {/* Sidebar Footer */}
            <Stack
              direction="row"
              spacing={1.25}
              alignItems="center"
              sx={{ pt: 2, borderTop: '1px solid #E3E8E7' }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: '#D5E6DF',
                  color: '#034D32',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: AGRI_FONTS.sans,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                AS
              </Box>
              <Box>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.76rem', fontWeight: 700, color: '#1D2326' }}>
                  SMKN 4 Payakumbuh
                </Typography>
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.66rem', color: '#68747A' }}>
                  STEAMPreneur 2026
                </Typography>
              </Box>
            </Stack>
          </Grid>

          {/* RIGHT MAIN WORKSPACE — Exact match to Agri-Sort AI Dashboard */}
          <Grid size={{ xs: 12, md: 9.3 }} sx={{ p: { xs: 2, sm: 3, md: 3.5 } }}>
            <Stack spacing={2.5}>
              {/* Top Page Subtitle */}
              <Box
                sx={{
                  pb: 1.25,
                  borderBottom: '1px solid #E3E8E7',
                  opacity: { xs: 1, md: 'var(--shell-opacity, 0)' },
                  willChange: 'opacity',
                }}
              >
                <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.84rem', color: '#4B585E' }}>
                  Pantau kualitas panen dan peluang harga dalam satu tampilan.
                </Typography>
              </Box>

              {/* GREEN HERO BANNER CARD ("Sortir cerdas, panen maksimal.") */}
              <Box
                sx={{
                  bgcolor: '#036E45',
                  color: '#FFFFFF',
                  borderRadius: '16px',
                  p: { xs: 2.5, sm: 3.5 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 3,
                  boxShadow: '0 12px 28px -8px rgba(3, 110, 69, 0.28)',
                  opacity: { xs: 1, md: 'calc(0.15 + 0.85 * var(--shell-opacity, 0))' },
                  transform: {
                    xs: 'none',
                    md: 'translate3d(0, calc(24px * var(--scatter-inv, 1)), 0) scale(calc(0.96 + 0.04 * var(--converge-p, 0)))',
                  },
                  willChange: 'transform, opacity',
                }}
              >
                <Stack spacing={1.5} sx={{ maxWidth: 460 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.6,
                      alignSelf: 'flex-start',
                      px: 1.25,
                      py: 0.35,
                      borderRadius: '9999px',
                      bgcolor: 'rgba(255, 255, 255, 0.16)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                    Sistem siap digunakan
                  </Box>

                  <Typography
                    sx={{
                      fontFamily: AGRI_FONTS.sans,
                      fontWeight: 800,
                      fontSize: { xs: '1.45rem', sm: '1.85rem' },
                      letterSpacing: '-0.025em',
                      lineHeight: 1.15,
                    }}
                  >
                    Sortir cerdas, panen maksimal.
                  </Typography>

                  <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.88rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.5 }}>
                    Ubah data panen menjadi keputusan QC dan harga yang lebih jelas untuk tim lapangan.
                  </Typography>

                  <Box sx={{ pt: 0.5 }}>
                    <Box
                      component="button"
                      onClick={() => onOpenApp?.('scanner')}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 2.25,
                        py: 1.1,
                        borderRadius: '10px',
                        border: 'none',
                        bgcolor: '#FFFFFF',
                        color: '#036E45',
                        fontFamily: AGRI_FONTS.sans,
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#F2F7F4' },
                      }}
                    >
                      Mulai scan batch
                      <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
                    </Box>
                  </Box>
                </Stack>

                <Box
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    width: 148,
                    height: 148,
                    flexShrink: 0,
                    borderRadius: '22px',
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    mr: { md: 4 },
                  }}
                >
                  <SpaRoundedIcon sx={{ fontSize: 38, color: '#8BE2B5' }} />
                  <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)' }}>
                    Precision Agriculture
                  </Typography>
                </Box>
              </Box>

              {/* 3 KPI CARDS ROW — Scattered around the lower Hero at scroll=0 (strictly below buttons!), uniting on scroll */}
              <Grid container spacing={2}>
                {/* KPI 1: Batch tersimpan — Floats Top-Left beside Hero Headline at scroll=0 */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box
                    sx={{
                      position: 'relative',
                      bgcolor: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E3E8E7',
                      boxShadow: AGRI_SHADOWS.artifact,
                      p: 2.25,
                      transform: {
                        xs: 'none',
                        md: 'translate3d(calc(-335px * var(--scatter-inv, 1)), calc(-410px * var(--scatter-inv, 1)), 0) rotate(calc(-2deg * var(--scatter-inv, 1)))',
                      },
                      willChange: 'transform',
                    }}
                  >
                    <FloatingCursorBadge
                      initials="FA"
                      bg="#D6F2E3"
                      border="#036E45"
                      arrowSide="top-right"
                      sx={{ left: -14, top: -12 }}
                    />
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', color: '#68747A' }}>
                          Batch tersimpan
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '1.45rem', fontWeight: 800, color: '#1D2326', my: 0.4 }}>
                          4 Batch
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.7rem', color: '#68747A' }}>
                          Tersimpan di browser ini
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          bgcolor: '#E6F2EC',
                          color: '#036E45',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <LocalShippingRoundedIcon sx={{ fontSize: 18 }} />
                      </Box>
                    </Stack>
                  </Box>
                </Grid>

                {/* KPI 2: Komoditas terdaftar — Fades in cleanly as Dashboard assembles */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box
                    sx={{
                      bgcolor: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E3E8E7',
                      boxShadow: AGRI_SHADOWS.artifact,
                      p: 2.25,
                      opacity: { xs: 1, md: 'var(--shell-opacity, 0)' },
                      transform: {
                        xs: 'none',
                        md: 'translate3d(0px, calc(16px * var(--scatter-inv, 1)), 0) scale(calc(0.95 + 0.05 * var(--converge-p, 0)))',
                      },
                      willChange: 'transform, opacity',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', color: '#68747A' }}>
                          Komoditas terdaftar
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '1.45rem', fontWeight: 800, color: '#1D2326', my: 0.4 }}>
                          3 Komoditas
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.7rem', color: '#68747A' }}>
                          Terung, Tomat, Cabai
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          bgcolor: '#E8F1F8',
                          color: '#1976D2',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />
                      </Box>
                    </Stack>
                  </Box>
                </Grid>

                {/* KPI 3: Sumber acuan harga — Floats Mid-Right beside Hero Headline at scroll=0 */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box
                    sx={{
                      position: 'relative',
                      bgcolor: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E3E8E7',
                      boxShadow: AGRI_SHADOWS.artifact,
                      p: 2.25,
                      transform: {
                        xs: 'none',
                        md: 'translate3d(calc(85px * var(--scatter-inv, 1)), calc(-350px * var(--scatter-inv, 1)), 0) rotate(calc(2deg * var(--scatter-inv, 1)))',
                      },
                      willChange: 'transform',
                    }}
                  >
                    <FloatingCursorBadge
                      initials="HA"
                      bg="#DCE8FA"
                      border="#28559A"
                      arrowSide="top-left"
                      sx={{ right: -12, top: -12 }}
                    />
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', color: '#68747A' }}>
                          Sumber acuan harga
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '1.45rem', fontWeight: 800, color: '#1D2326', my: 0.4 }}>
                          BAPANAS Live
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.7rem', color: '#68747A' }}>
                          Pasar Ibuh Payakumbuh
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          bgcolor: '#E6F2EC',
                          color: '#036E45',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />
                      </Box>
                    </Stack>
                  </Box>
                </Grid>
              </Grid>

              {/* BOTTOM 2-COLUMN ROW: Harga acuan pasar + Batch Panen Terakhir */}
              <Grid container spacing={2} alignItems="stretch">
                {/* Left: Harga acuan pasar — Floats Bottom-Left below Hero CTA at scroll=0 */}
                <Grid size={{ xs: 12, md: 6.8 }}>
                  <Box
                    sx={{
                      height: '100%',
                      bgcolor: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E3E8E7',
                      boxShadow: AGRI_SHADOWS.artifact,
                      p: 2.5,
                      transform: {
                        xs: 'none',
                        md: 'translate3d(calc(-260px * var(--scatter-inv, 1)), calc(-230px * var(--scatter-inv, 1)), 0) scale(calc(1 - 0.14 * var(--scatter-inv, 1)))',
                      },
                      willChange: 'transform',
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.4 }}>
                      <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.92rem', fontWeight: 700, color: '#1D2326' }}>
                        Harga acuan pasar
                      </Typography>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1.1,
                          py: 0.25,
                          borderRadius: '9999px',
                          bgcolor: '#289D67',
                          color: '#FFFFFF',
                          fontFamily: AGRI_FONTS.sans,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircleRoundedIcon sx={{ fontSize: 12 }} />
                        BAPANAS Terverifikasi
                      </Box>
                    </Stack>
                    <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.72rem', color: '#68747A', mb: 2 }}>
                      Panel BAPANAS • Pasar Ibuh Payakumbuh
                    </Typography>

                    <Stack spacing={1}>
                      {MARKET_PRICES.map((item) => (
                        <Box
                          key={item.name}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: 0.85,
                            borderBottom: '1px solid #EEF2F1',
                            '&:last-of-type': { borderBottom: 'none', pb: 0 },
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#289D67' }} />
                            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', color: '#1D2326' }}>
                              {item.name}
                            </Typography>
                          </Stack>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', fontWeight: 600, color: '#1D2326', lineHeight: 1.1 }}>
                              {item.price}
                            </Typography>
                            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.66rem', color: '#68747A' }}>
                              per kg
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Grid>

                {/* Right: Batch Panen Terakhir — Floats Bottom-Right below Hero CTA at scroll=0 */}
                <Grid size={{ xs: 12, md: 5.2 }}>
                  <Box
                    sx={{
                      height: '100%',
                      bgcolor: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E3E8E7',
                      boxShadow: AGRI_SHADOWS.artifact,
                      p: 2.5,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transform: {
                        xs: 'none',
                        md: 'translate3d(calc(45px * var(--scatter-inv, 1)), calc(-220px * var(--scatter-inv, 1)), 0) scale(calc(1 - 0.12 * var(--scatter-inv, 1)))',
                      },
                      willChange: 'transform',
                    }}
                  >
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.92rem', fontWeight: 700, color: '#1D2326' }}>
                          Batch Panen Terakhir
                        </Typography>
                        <Box
                          sx={{
                            px: 1.1,
                            py: 0.25,
                            borderRadius: '9999px',
                            border: '1px solid #74B896',
                            color: '#036E45',
                            fontFamily: AGRI_FONTS.sans,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                          }}
                        >
                          panen-1794536845996
                        </Box>
                      </Stack>

                      <Box
                        sx={{
                          p: 2,
                          borderRadius: '12px',
                          bgcolor: '#F4F6F8',
                          border: '1px solid #E3E8E7',
                          mb: 2,
                        }}
                      >
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.92rem', fontWeight: 600, color: '#1D2326', mb: 0.75 }}>
                          Tomat
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', color: '#3E4C52' }}>
                          Berat Total: 4 kg
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', color: '#3E4C52', my: 0.25 }}>
                          Estimasi Nilai: Rp 42.293
                        </Typography>
                        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.7rem', color: '#68747A' }}>
                          Tanggal: 2026-11-13
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      component="button"
                      onClick={() => onOpenApp?.('results')}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.75,
                        py: 1.1,
                        borderRadius: '8px',
                        border: 'none',
                        bgcolor: '#036E45',
                        color: '#FFFFFF',
                        fontFamily: AGRI_FONTS.sans,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#034D32' },
                      }}
                    >
                      Buka Hasil &amp; Sertifikat
                      <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}
