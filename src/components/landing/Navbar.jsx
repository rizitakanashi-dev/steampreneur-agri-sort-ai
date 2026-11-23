import { useMemo, useRef, useState } from 'react'
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
import { AgriPrimaryButton, EditorialTextLink, HeaderActionButton } from './AgriPrimitives.jsx'
import { useActiveSection, useNavbarScrollProgress } from './useScrollChoreography.js'

export function Navbar({ onOpenApp }) {
  const progressBarRef = useRef(null)
  const scrolled = useNavbarScrollProgress(progressBarRef)
  const [mobileOpen, setMobileOpen] = useState(false)

  const sectionIds = useMemo(
    () => NAV_LINKS.map((l) => l.href.replace('#', '')),
    []
  )
  const activeSection = useActiveSection(sectionIds)

  const handleNavClick = (e, href) => {
    e.preventDefault()
    setMobileOpen(false)
    const element = document.querySelector(href)
    if (element) {
      const offsetPosition = element.getBoundingClientRect().top + window.pageYOffset - 72
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
    }
  }

  return (
    <>
      <AppBar
        elevation={0}
        position="fixed"
        sx={{
          bgcolor: scrolled ? 'rgba(255, 255, 255, 0.96)' : 'transparent',
          borderBottom: scrolled ? '1px solid rgba(23, 25, 28, 0.06)' : '1px solid transparent',
          boxShadow: 'none',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        {/* Reading Progress Hairline */}
        <Box
          ref={progressBarRef}
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '2px',
            width: '100%',
            bgcolor: AGRI_COLORS.emerald,
            transformOrigin: 'left center',
            transform: 'scaleX(0)',
            willChange: 'transform',
          }}
        />

        <Container maxWidth="lg" sx={{ maxWidth: 1200, px: { xs: 2.5, sm: 3 } }}>
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 72 }}>
            {/* Wordmark Left */}
            <Box
              component="a"
              href="#beranda"
              onClick={(e) => handleNavClick(e, '#beranda')}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25, textDecoration: 'none' }}
            >
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: AGRI_RADII.buttons,
                  bgcolor: AGRI_COLORS.ink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: AGRI_COLORS.paperWhite,
                }}
              >
                <SpaRoundedIcon sx={{ fontSize: 17 }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: AGRI_FONTS.serif,
                  fontWeight: 400,
                  fontSize: '1.35rem',
                  letterSpacing: '-0.02em',
                  color: AGRI_COLORS.ink,
                }}
              >
                Agri-Sort AI
              </Typography>
            </Box>

            {/* Centered Whisper-Quiet Nav Links */}
            <Stack direction="row" spacing={3.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {NAV_LINKS.map((link) => {
                const isCurrent = activeSection === link.href.replace('#', '')
                return (
                  <Box
                    key={link.href}
                    component="a"
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    sx={{
                      position: 'relative',
                      py: '2px',
                      fontFamily: AGRI_FONTS.sans,
                      fontWeight: isCurrent ? 500 : 400,
                      fontSize: '1rem',
                      color: isCurrent ? AGRI_COLORS.ink : AGRI_COLORS.slateMuted,
                      textDecoration: 'none',
                      transition: 'color 0.2s ease',
                      '&:hover': {
                        color: AGRI_COLORS.ink,
                        textDecoration: 'underline',
                        textUnderlineOffset: '4px',
                      },
                    }}
                  >
                    {link.label}
                  </Box>
                )
              })}
            </Stack>

            {/* Right Text Link + Filled Pill CTA */}
            <Stack direction="row" spacing={2.5} alignItems="center">
              <EditorialTextLink
                onClick={() => onOpenApp('scanner')}
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, py: '2px' }}
              >
                Scan QC →
              </EditorialTextLink>
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
            bgcolor: AGRI_COLORS.paperWhite,
            color: AGRI_COLORS.ink,
            p: 2.5,
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontFamily: AGRI_FONTS.serif, fontWeight: 400, fontSize: '1.25rem', color: AGRI_COLORS.ink }}>
            Agri-Sort AI
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
                sx={{ borderRadius: AGRI_RADII.images }}
              >
                <ListItemText
                  primary={link.label}
                  primaryTypographyProps={{ fontFamily: AGRI_FONTS.sans, fontWeight: 400, color: AGRI_COLORS.ink }}
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
