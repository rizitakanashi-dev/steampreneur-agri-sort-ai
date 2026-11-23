import { Box, Container, Grid, Stack, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS } from './tokens.js'
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
        top: el.getBoundingClientRect().top + window.pageYOffset - 72,
        behavior: 'smooth',
      })
    }
  }

  return (
    <Box
      id="tentang-kami"
      component="footer"
      sx={{
        bgcolor: AGRI_COLORS.paperWhite,
        color: AGRI_COLORS.ink,
        borderTop: `1px solid ${AGRI_COLORS.hairline}`,
        py: '80px',
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: 1200, px: { xs: 2.5, sm: 3 } }}>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1.5}>
              <Typography sx={{ fontFamily: AGRI_FONTS.serif, fontWeight: 400, fontSize: '1.5rem', color: AGRI_COLORS.ink }}>
                Agri-Sort AI
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.95rem', lineHeight: 1.5, color: AGRI_COLORS.slateMuted }}>
                {TEAM_INFO.tagline} — {TEAM_INFO.supportingTagline}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.88rem', color: AGRI_COLORS.ashTag }}>
                {TEAM_INFO.school} · {TEAM_INFO.competition}
              </Typography>
            </Stack>
          </Grid>

          <Grid size={{ xs: 6, sm: 4, md: 2.5 }}>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontWeight: 500, fontSize: '0.95rem', color: AGRI_COLORS.ink, mb: 1.5 }}>
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
                    fontFamily: AGRI_FONTS.sans,
                    fontSize: '0.94rem',
                    color: AGRI_COLORS.slateMuted,
                    textDecoration: 'none',
                    '&:hover': { color: AGRI_COLORS.ink, textDecoration: 'underline', textUnderlineOffset: '4px' },
                  }}
                >
                  {link.label}
                </Typography>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 6, sm: 4, md: 2.5 }}>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontWeight: 500, fontSize: '0.95rem', color: AGRI_COLORS.ink, mb: 1.5 }}>
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
                    fontFamily: AGRI_FONTS.sans,
                    fontSize: '0.94rem',
                    color: AGRI_COLORS.slateMuted,
                    '&:hover': { color: AGRI_COLORS.ink, textDecoration: 'underline', textUnderlineOffset: '4px' },
                  }}
                >
                  {mod.label}
                </Typography>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontWeight: 500, fontSize: '0.95rem', color: AGRI_COLORS.ink, mb: 1.5 }}>
              Tim Pengembang
            </Typography>
            <Stack spacing={1}>
              {TEAM_INFO.members.map((member) => (
                <Box key={member.name}>
                  <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.92rem', color: AGRI_COLORS.ink }}>
                    {member.name}
                  </Typography>
                  <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.82rem', color: AGRI_COLORS.slateMuted }}>
                    {member.role}
                  </Typography>
                </Box>
              ))}
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.84rem', color: AGRI_COLORS.ashTag, pt: 0.5 }}>
                Pembimbing: {TEAM_INFO.mentor}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
