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
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import AppsRoundedIcon from '@mui/icons-material/AppsRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import PreviewRoundedIcon from '@mui/icons-material/PreviewRounded'
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import { NAV_LINKS } from './landingData.js'
import { AgriPrimaryButton, EditorialTextLink, HeaderActionButton } from './AgriPrimitives.jsx'
import { useActiveSection, useNavbarScrollProgress } from './useScrollChoreography.js'

const DRAWER_ICONS = {
  '#beranda': HomeRoundedIcon,
  '#fitur': AppsRoundedIcon,
  '#cara-kerja': HelpOutlineRoundedIcon,
  '#dashboard': PreviewRoundedIcon,
  '#komoditas': CategoryRoundedIcon,
  '#tentang-kami': GroupsRoundedIcon,
}

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
            <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center' }}>
              <EditorialTextLink
                onClick={() => onOpenApp('scanner')}
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, py: '2px' }}
              >
                Scan QC →
              </EditorialTextLink>
              <HeaderActionButton
                onClick={() => onOpenApp('overview')}
                // Di HP/tablet tombol cukup ada di dalam drawer (anti dobel);
                // di desktop hamburger tidak ada, jadi CTA navbar yang tampil
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
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
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1.25} useFlexGap sx={{ alignItems: 'center' }}>
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
            <Typography sx={{ fontFamily: AGRI_FONTS.serif, fontWeight: 400, fontSize: '1.25rem', color: AGRI_COLORS.ink }}>
              Agri-Sort AI
            </Typography>
          </Stack>
          <IconButton aria-label="Tutup menu" onClick={() => setMobileOpen(false)} sx={{ color: AGRI_COLORS.ink }}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
        <Box
          aria-hidden="true"
          sx={{ height: '1px', bgcolor: AGRI_COLORS.hairline, mx: -2.5, mt: 2 }}
        />
        <Typography
          component="div"
          sx={{
            pt: 2,
            pb: 1,
            px: 0.5,
            fontFamily: AGRI_FONTS.sans,
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: AGRI_COLORS.slateMuted,
          }}
        >
          NAVIGASI
        </Typography>
        <List sx={{ pt: 0 }} disablePadding>
          {NAV_LINKS.map((link) => {
            const isCurrent = activeSection === link.href.replace('#', '')
            const IconComp = DRAWER_ICONS[link.href] || AppsRoundedIcon
            return (
              <ListItem key={link.href} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component="a"
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  sx={{
                    borderRadius: AGRI_RADII.images,
                    py: 1,
                    px: 1,
                    transition: 'background-color 0.2s ease, color 0.2s ease',
                    ...(isCurrent
                      ? { bgcolor: AGRI_COLORS.blushMint, '&:hover': { bgcolor: AGRI_COLORS.blushMint } }
                      : { '&:hover': { bgcolor: AGRI_COLORS.fogSurface } }),
                  }}
                >
                  {/* Kotak ikon ala drawer aplikasi: aktif = emerald pekat, istirahat = mist */}
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      mr: 1.5,
                      borderRadius: '10px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isCurrent ? AGRI_COLORS.deepEmerald : AGRI_COLORS.mistSurface,
                      color: isCurrent ? AGRI_COLORS.paperWhite : AGRI_COLORS.ashTag,
                      transition: 'background-color 0.2s ease, color 0.2s ease',
                    }}
                  >
                    <IconComp sx={{ fontSize: 19 }} />
                  </Box>
                  <ListItemText
                    primary={link.label}
                    primaryTypographyProps={{
                      fontFamily: AGRI_FONTS.sans,
                      fontWeight: isCurrent ? 700 : 400,
                      color: isCurrent ? AGRI_COLORS.deepEmerald : AGRI_COLORS.ink,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
        {/* CTA dipin di dasar drawer: tidak melayang di tengah ruang kosong */}
        <Box sx={{ mt: 'auto', pt: 2, pb: 0.5, borderTop: `1px solid ${AGRI_COLORS.hairline}` }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 1.25,
              fontFamily: AGRI_FONTS.sans,
              color: AGRI_COLORS.slateMuted,
            }}
          >
            SMK Negeri 4 Payakumbuh · STEAMPreneur 2026
          </Typography>
          <AgriPrimaryButton fullWidth onClick={() => { setMobileOpen(false); onOpenApp('overview') }}>
            Buka Aplikasi
          </AgriPrimaryButton>
        </Box>
      </Drawer>
    </>
  )
}
