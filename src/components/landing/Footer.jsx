import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import SpaRoundedIcon from '@mui/icons-material/SpaRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { NAV_LINKS, TEAM_INFO } from './landingData.js'

const APP_MODULES = [
  { label: 'Dashboard Utama', page: 'overview' },
  { label: 'Batch QC Scanner', page: 'scanner' },
  { label: 'Input Hasil Panen', page: 'input' },
  { label: 'Smart Pricing', page: 'pricing' },
  { label: 'Rekap Data Panen', page: 'results-list' },
]

export function Footer({ onOpenApp }) {
  const handleNavClick = (e, href) => {
    e.preventDefault()
    const el = document.querySelector(href)
    if (el) {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.pageYOffset - 80,
        behavior: 'smooth',
      })
    }
  }

  return (
    <Box
      id="tentang-kami"
      component="footer"
      sx={{
        bgcolor: AGRI_COLORS.canopyDeep,
        color: AGRI_COLORS.snow,
        pt: { xs: 8, md: 10 },
        pb: { xs: 6, md: 8 },
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3 } }}>
        <Grid container spacing={4}>
          {/* Brand Column */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: AGRI_RADII.buttons,
                    bgcolor: AGRI_COLORS.leafGlow,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: AGRI_COLORS.emeraldDark,
                  }}
                >
                  <SpaRoundedIcon sx={{ fontSize: 22 }} />
                </Box>
                <Typography
                  sx={{
                    fontFamily: AGRI_FONTS.display,
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    letterSpacing: '-0.01em',
                    textTransform: 'uppercase',
                  }}
                >
                  AGRI-SORT AI
                </Typography>
              </Stack>

              <Typography
                sx={{
                  fontFamily: AGRI_FONTS.prose,
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                  color: AGRI_COLORS.sageMist,
                }}
              >
                {TEAM_INFO.tagline} — {TEAM_INFO.supportingTagline}
              </Typography>

              <Typography
                sx={{
                  fontFamily: AGRI_FONTS.body,
                  fontSize: '0.88rem',
                  color: '#9BC8B2',
                }}
              >
                {TEAM_INFO.school} · {TEAM_INFO.competition}
              </Typography>
            </Stack>
          </Grid>

          {/* Navigation Column */}
          <Grid size={{ xs: 6, sm: 4, md: 2.5 }}>
            <Typography
              sx={{
                fontFamily: AGRI_FONTS.body,
                fontWeight: 600,
                fontSize: '1rem',
                letterSpacing: '0.013em',
                color: AGRI_COLORS.snow,
                mb: 2,
              }}
            >
              Navigasi
            </Typography>
            <Stack spacing={1}>
              {NAV_LINKS.map((link) => (
                <Typography
                  key={link.href}
                  component="a"
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  sx={{
                    fontFamily: AGRI_FONTS.prose,
                    fontSize: '1rem',
                    lineHeight: 1.5,
                    color: AGRI_COLORS.sageMist,
                    textDecoration: 'none',
                    '&:hover': { color: AGRI_COLORS.snow },
                  }}
                >
                  {link.label}
                </Typography>
              ))}
            </Stack>
          </Grid>

          {/* Modules Column */}
          <Grid size={{ xs: 6, sm: 4, md: 2.5 }}>
            <Typography
              sx={{
                fontFamily: AGRI_FONTS.body,
                fontWeight: 600,
                fontSize: '1rem',
                letterSpacing: '0.013em',
                color: AGRI_COLORS.snow,
                mb: 2,
              }}
            >
              Modul Aplikasi
            </Typography>
            <Stack spacing={1}>
              {APP_MODULES.map((mod) => (
                <Typography
                  key={mod.page}
                  component="button"
                  onClick={() => onOpenApp(mod.page)}
                  sx={{
                    textAlign: 'left',
                    border: 'none',
                    bgcolor: 'transparent',
                    p: 0,
                    cursor: 'pointer',
                    fontFamily: AGRI_FONTS.prose,
                    fontSize: '1rem',
                    lineHeight: 1.5,
                    color: AGRI_COLORS.sageMist,
                    '&:hover': { color: AGRI_COLORS.snow },
                  }}
                >
                  {mod.label}
                </Typography>
              ))}
            </Stack>
          </Grid>

          {/* Team Column */}
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <Typography
              sx={{
                fontFamily: AGRI_FONTS.body,
                fontWeight: 600,
                fontSize: '1rem',
                letterSpacing: '0.013em',
                color: AGRI_COLORS.snow,
                mb: 2,
              }}
            >
              Tim Pengembang
            </Typography>
            <Stack spacing={1}>
              {TEAM_INFO.members.map((member) => (
                <Box key={member.name}>
                  <Typography sx={{ fontFamily: AGRI_FONTS.prose, fontSize: '0.96rem', color: AGRI_COLORS.snow }}>
                    {member.name}
                  </Typography>
                  <Typography sx={{ fontFamily: AGRI_FONTS.prose, fontSize: '0.84rem', color: AGRI_COLORS.sageMist }}>
                    {member.role}
                  </Typography>
                </Box>
              ))}
              <Typography sx={{ fontFamily: AGRI_FONTS.prose, fontSize: '0.86rem', color: '#9BC8B2', pt: 0.5 }}>
                Pembimbing: {TEAM_INFO.mentor}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
