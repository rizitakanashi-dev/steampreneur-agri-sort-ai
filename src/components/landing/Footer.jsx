import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import SpaRoundedIcon from '@mui/icons-material/SpaRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import { FONTS, LANDING_COLORS, NAV_LINKS, TEAM_INFO } from './constants.js'

export function Footer({ onOpenApp }) {
  const handleNavClick = (e, href) => {
    e.preventDefault()
    const element = document.querySelector(href)
    if (element) {
      const topOffset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - topOffset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  return (
    <Box
      id="tentang-kami"
      component="footer"
      sx={{
        bgcolor: '#0e261f',
        color: LANDING_COLORS.white,
        pt: { xs: 8, sm: 10, md: 12 },
        pb: { xs: 5, sm: 6 },
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3, md: 4 } }}>
        <Grid container spacing={{ xs: 5, md: 6 }}>
          {/* BRAND COLUMN */}
          <Grid size={{ xs: 12, md: 4.5 }}>
            <Stack spacing={2.5}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '10px',
                    bgcolor: LANDING_COLORS.leafGreen,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: LANDING_COLORS.forestGreen,
                  }}
                >
                  <SpaRoundedIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontFamily: FONTS.heading,
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      letterSpacing: '-0.02em',
                      color: LANDING_COLORS.white,
                      lineHeight: 1.1,
                    }}
                  >
                    AGRI-SORT AI
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: FONTS.body,
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: LANDING_COLORS.leafGreen,
                    }}
                  >
                    Precision Agriculture Platform
                  </Typography>
                </Box>
              </Stack>

              <Typography
                sx={{
                  fontFamily: FONTS.body,
                  fontSize: '0.88rem',
                  lineHeight: 1.65,
                  color: 'rgba(255, 255, 255, 0.72)',
                }}
              >
                Platform digital pemilahan kualitas hasil panen, pemetaan grade mutu hortikultura, dan transparansi estimasi nilai jual untuk mendukung kesejahteraan petani dan pengumpul Indonesia.
              </Typography>

              <Box
                sx={{
                  p: 1.75,
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Typography sx={{ fontFamily: FONTS.heading, fontSize: '0.78rem', fontWeight: 700, color: LANDING_COLORS.harvestGold, mb: 0.5 }}>
                  Tagline Resmi:
                </Typography>
                <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.82rem', color: LANDING_COLORS.white, fontWeight: 600, fontStyle: 'italic' }}>
                  "{TEAM_INFO.tagline}"
                </Typography>
                <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  {TEAM_INFO.supportingTagline}
                </Typography>
              </Box>
            </Stack>
          </Grid>

          {/* QUICK NAVIGATION */}
          <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
            <Typography
              sx={{
                fontFamily: FONTS.heading,
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: LANDING_COLORS.white,
                mb: 2.5,
              }}
            >
              Navigasi
            </Typography>

            <Stack spacing={1.5}>
              {NAV_LINKS.map((link) => (
                <Typography
                  key={link.label}
                  component="a"
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  sx={{
                    fontFamily: FONTS.body,
                    fontSize: '0.88rem',
                    color: 'rgba(255, 255, 255, 0.68)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                    '&:hover': { color: LANDING_COLORS.leafGreen },
                  }}
                >
                  {link.label}
                </Typography>
              ))}
            </Stack>
          </Grid>

          {/* APPLICATION MODULES */}
          <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
            <Typography
              sx={{
                fontFamily: FONTS.heading,
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: LANDING_COLORS.white,
                mb: 2.5,
              }}
            >
              Fitur Aplikasi
            </Typography>

            <Stack spacing={1.5}>
              {[
                { label: 'Dashboard Utama', target: 'overview' },
                { label: 'Batch QC Scanner', target: 'scanner' },
                { label: 'Hasil Analisis Mutu', target: 'results' },
                { label: 'Rekap Data Panen', target: 'results-list' },
                { label: 'Smart Pricing & BAPANAS', target: 'pricing' },
              ].map((item) => (
                <Typography
                  key={item.label}
                  component="button"
                  onClick={() => onOpenApp(item.target)}
                  sx={{
                    background: 'none',
                    border: 'none',
                    p: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: FONTS.body,
                    fontSize: '0.88rem',
                    color: 'rgba(255, 255, 255, 0.68)',
                    transition: 'color 0.2s ease',
                    '&:hover': { color: LANDING_COLORS.leafGreen },
                  }}
                >
                  {item.label}
                </Typography>
              ))}
            </Stack>
          </Grid>

          {/* PROJECT IDENTITY & TEAM */}
          <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
            <Typography
              sx={{
                fontFamily: FONTS.heading,
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: LANDING_COLORS.white,
                mb: 2.5,
              }}
            >
              Tim Pengembang
            </Typography>

            <Stack spacing={1.75}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <SchoolRoundedIcon sx={{ fontSize: 18, color: LANDING_COLORS.leafGreen, mt: 0.25 }} />
                <Box>
                  <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.85rem', fontWeight: 700, color: LANDING_COLORS.white }}>
                    {TEAM_INFO.school}
                  </Typography>
                  <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    {TEAM_INFO.location}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="flex-start">
                <EmojiEventsRoundedIcon sx={{ fontSize: 18, color: LANDING_COLORS.harvestGold, mt: 0.25 }} />
                <Box>
                  <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
                    {TEAM_INFO.competition}
                  </Typography>
                </Box>
              </Stack>

              <Box sx={{ pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.5)', mb: 0.75 }}>
                  Anggota Tim Siswa RPL:
                </Typography>
                {TEAM_INFO.members.map((m) => (
                  <Typography key={m.name} sx={{ fontFamily: FONTS.body, fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.45 }}>
                    • <strong>{m.name}</strong> ({m.role})
                  </Typography>
                ))}
                <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.75rem', color: LANDING_COLORS.leafGreen, mt: 0.75 }}>
                  Guru Pembimbing: {TEAM_INFO.mentor}
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>

        {/* BOTTOM COPYRIGHT & COMPLIANCE BAR */}
        <Box
          sx={{
            mt: { xs: 6, sm: 8 },
            pt: 3.5,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: '0.78rem',
              color: 'rgba(255, 255, 255, 0.55)',
            }}
          >
            © 2026 Agri-Sort AI. STEAMPreneur SMK Tingkat Nasional — SMK Negeri 4 Payakumbuh.
          </Typography>

          <Stack direction="row" spacing={3}>
            <Typography
              component="button"
              onClick={() => onOpenApp('overview')}
              sx={{
                background: 'none',
                border: 'none',
                p: 0,
                cursor: 'pointer',
                fontFamily: FONTS.body,
                fontSize: '0.78rem',
                color: LANDING_COLORS.leafGreen,
                fontWeight: 600,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Masuk ke Aplikasi →
            </Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  )
}
