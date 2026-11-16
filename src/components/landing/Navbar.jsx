import { useEffect, useState } from 'react'
import {
  AppBar,
  Box,
  Container,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SpaRoundedIcon from '@mui/icons-material/SpaRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { NAV_LINKS } from './landingData.js'
import { AgriPrimaryButton, HeaderActionButton } from './AgriPrimitives.jsx'

export function Navbar({ onOpenApp }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleNavClick = (e, href) => {
    e.preventDefault()
    setMobileOpen(false)
    const element = document.querySelector(href)
    if (element) {
      const offsetPosition = element.getBoundingClientRect().top + window.pageYOffset - 80
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
    }
  }

  return (
    <>
      <AppBar
        elevation={0}
        position="fixed"
        sx={{
          bgcolor: scrolled ? 'rgba(242, 251, 246, 0.92)' : 'rgba(242, 251, 246, 0.72)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid',
          borderColor: scrolled ? AGRI_COLORS.mintBorder : 'rgba(197, 227, 211, 0.5)',
          transition: 'background-color 0.25s ease, border-color 0.25s ease',
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: { xs: 68, md: 76 } }}>
            {/* Wordmark Left */}
            <Box
              component="a"
              href="#beranda"
              onClick={(e) => handleNavClick(e, '#beranda')}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25, textDecoration: 'none' }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: AGRI_RADII.buttons,
                  bgcolor: AGRI_COLORS.emerald,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: AGRI_COLORS.snow,
                }}
              >
                <SpaRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: AGRI_FONTS.display,
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  letterSpacing: '-0.01em',
                  color: AGRI_COLORS.ink,
                  textTransform: 'uppercase',
                }}
              >
                AGRI-SORT AI
              </Typography>
            </Box>

            {/* Centered Text Links */}
            <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {NAV_LINKS.map((link) => (
                <Box
                  key={link.href}
                  component="a"
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: AGRI_RADII.buttons,
                    fontFamily: AGRI_FONTS.body,
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    letterSpacing: '0.013em',
                    color: AGRI_COLORS.ink,
                    textDecoration: 'none',
                    '&:hover': { bgcolor: AGRI_COLORS.mintSoft, color: AGRI_COLORS.emerald },
                  }}
                >
                  {link.label}
                </Box>
              ))}
            </Stack>

            {/* Right Action + Mobile Toggle */}
            <Stack direction="row" spacing={1} alignItems="center">
              <HeaderActionButton
                onClick={() => onOpenApp('overview')}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Buka Aplikasi
              </HeaderActionButton>
              <IconButton
                aria-label="Buka menu navigasi"
                onClick={() => setMobileOpen(true)}
                sx={{ display: { xs: 'inline-flex', md: 'none' }, color: AGRI_COLORS.ink }}
              >
                <MenuRoundedIcon />
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            bgcolor: AGRI_COLORS.mintBg,
            color: AGRI_COLORS.ink,
            p: 2.5,
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontFamily: AGRI_FONTS.display, fontWeight: 800, fontSize: '1.05rem', color: AGRI_COLORS.ink }}>
            AGRI-SORT AI
          </Typography>
          <IconButton aria-label="Tutup menu" onClick={() => setMobileOpen(false)} sx={{ color: AGRI_COLORS.ink }}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
        <List>
          {NAV_LINKS.map((link) => (
            <ListItem key={link.href} disablePadding>
              <ListItemButton
                component="a"
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                sx={{ borderRadius: AGRI_RADII.buttons }}
              >
                <ListItemText
                  primary={link.label}
                  primaryTypographyProps={{ fontFamily: AGRI_FONTS.body, fontWeight: 600, color: AGRI_COLORS.ink }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ mt: 2 }}>
          <AgriPrimaryButton fullWidth onClick={() => { setMobileOpen(false); onOpenApp('overview') }}>
            Buka Aplikasi
          </AgriPrimaryButton>
        </Box>
      </Drawer>
    </>
  )
}
