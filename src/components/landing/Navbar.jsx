import { useEffect, useState } from 'react'
import {
  AppBar,
  Box,
  Button,
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
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import SpaRoundedIcon from '@mui/icons-material/SpaRounded'
import { FONTS, LANDING_COLORS, NAV_LINKS } from './constants.js'

export function Navbar({ onOpenApp }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleNavClick = (e, href) => {
    e.preventDefault()
    setMobileOpen(false)
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
    <>
      <AppBar
        elevation={0}
        position="sticky"
        sx={{
          bgcolor: scrolled ? 'rgba(245, 243, 233, 0.94)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: '1px solid',
          borderColor: scrolled ? LANDING_COLORS.border : 'transparent',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          top: 0,
          zIndex: 1100,
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Toolbar
            disableGutters
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: { xs: 68, md: 78 },
            }}
          >
            {/* BRAND LOGO */}
            <Box
              component="a"
              href="#beranda"
              onClick={(e) => handleNavClick(e, '#beranda')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  bgcolor: LANDING_COLORS.forestGreen,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: LANDING_COLORS.white,
                  boxShadow: '0 4px 12px rgba(23, 63, 50, 0.15)',
                  transition: 'transform 0.2s ease',
                  '&:hover': { transform: 'scale(1.05)' },
                }}
              >
                <SpaRoundedIcon sx={{ fontSize: 22, color: LANDING_COLORS.leafGreen }} />
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontFamily: FONTS.heading,
                    fontWeight: 800,
                    fontSize: { xs: '1.05rem', sm: '1.2rem' },
                    letterSpacing: '-0.02em',
                    color: LANDING_COLORS.forestGreen,
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
                  Precision Agriculture
                </Typography>
              </Box>
            </Box>

            {/* DESKTOP NAV LINKS */}
            <Stack
              alignItems="center"
              direction="row"
              spacing={3.5}
              sx={{ display: { xs: 'none', md: 'flex' } }}
            >
              {NAV_LINKS.map((link) => (
                <Typography
                  key={link.label}
                  component="a"
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  sx={{
                    fontFamily: FONTS.body,
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    color: LANDING_COLORS.darkText,
                    textDecoration: 'none',
                    position: 'relative',
                    transition: 'color 0.2s ease',
                    '&:hover': {
                      color: LANDING_COLORS.forestGreen,
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      width: '0%',
                      height: '2px',
                      bottom: -4,
                      left: 0,
                      bgcolor: LANDING_COLORS.leafGreen,
                      transition: 'width 0.2s ease',
                    },
                    '&:hover::after': {
                      width: '100%',
                    },
                  }}
                >
                  {link.label}
                </Typography>
              ))}
            </Stack>

            {/* RIGHT CTA BUTTON */}
            <Stack alignItems="center" direction="row" spacing={1.5}>
              <Button
                onClick={() => onOpenApp('overview')}
                variant="contained"
                endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  bgcolor: LANDING_COLORS.forestGreen,
                  color: LANDING_COLORS.white,
                  fontFamily: FONTS.body,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textTransform: 'none',
                  px: 2.75,
                  py: 1,
                  borderRadius: '10px',
                  boxShadow: '0 4px 14px rgba(23, 63, 50, 0.2)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: LANDING_COLORS.forestGreenLight,
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 18px rgba(23, 63, 50, 0.28)',
                  },
                }}
              >
                Buka Aplikasi
              </Button>

              {/* MOBILE HAMBURGER TOGGLE */}
              <IconButton
                aria-label="Buka menu navigasi"
                onClick={() => setMobileOpen(true)}
                sx={{
                  display: { xs: 'inline-flex', md: 'none' },
                  color: LANDING_COLORS.forestGreen,
                  bgcolor: 'rgba(23, 63, 50, 0.06)',
                  borderRadius: '10px',
                  p: 1,
                  '&:hover': { bgcolor: 'rgba(23, 63, 50, 0.12)' },
                }}
              >
                <MenuRoundedIcon />
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* MOBILE DRAWER */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: '82%',
            maxWidth: 320,
            bgcolor: LANDING_COLORS.warmCream,
            p: 3,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Stack alignItems="center" direction="row" sx={{ justifyContent: 'space-between', mb: 3 }}>
          <Stack alignItems="center" direction="row" spacing={1.25}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                bgcolor: LANDING_COLORS.forestGreen,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: LANDING_COLORS.white,
              }}
            >
              <SpaRoundedIcon sx={{ fontSize: 18, color: LANDING_COLORS.leafGreen }} />
            </Box>
            <Typography
              sx={{
                fontFamily: FONTS.heading,
                fontWeight: 800,
                fontSize: '1rem',
                color: LANDING_COLORS.forestGreen,
              }}
            >
              AGRI-SORT AI
            </Typography>
          </Stack>
          <IconButton
            aria-label="Tutup menu navigasi"
            onClick={() => setMobileOpen(false)}
            sx={{
              color: LANDING_COLORS.forestGreen,
              bgcolor: 'rgba(23, 63, 50, 0.06)',
              borderRadius: '8px',
              p: 0.75,
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <List disablePadding sx={{ my: 1 }}>
          {NAV_LINKS.map((link) => (
            <ListItem disablePadding key={link.label} sx={{ mb: 1 }}>
              <ListItemButton
                component="a"
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                sx={{
                  borderRadius: '8px',
                  py: 1.25,
                  px: 2,
                  '&:hover': { bgcolor: 'rgba(23, 63, 50, 0.08)' },
                }}
              >
                <ListItemText
                  primary={link.label}
                  primaryTypographyProps={{
                    fontFamily: FONTS.body,
                    fontWeight: 600,
                    fontSize: '1rem',
                    color: LANDING_COLORS.darkText,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 'auto', pt: 3, borderTop: `1px solid ${LANDING_COLORS.border}` }}>
          <Button
            fullWidth
            onClick={() => {
              setMobileOpen(false)
              onOpenApp('overview')
            }}
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}
            sx={{
              bgcolor: LANDING_COLORS.forestGreen,
              color: LANDING_COLORS.white,
              fontFamily: FONTS.body,
              fontWeight: 700,
              fontSize: '0.95rem',
              py: 1.25,
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(23, 63, 50, 0.2)',
              '&:hover': { bgcolor: LANDING_COLORS.forestGreenLight },
            }}
          >
            Buka Aplikasi
          </Button>
          <Typography
            align="center"
            sx={{
              fontFamily: FONTS.body,
              fontSize: '0.75rem',
              color: LANDING_COLORS.mutedText,
              mt: 2,
            }}
          >
            SMK Negeri 4 Payakumbuh • 2026
          </Typography>
        </Box>
      </Drawer>
    </>
  )
}
