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
import BrandLogo from '../BrandLogo.jsx'
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

/**
 * Mulai aksi begitu scroll body sudah tidak dikunci. MUI Drawer/Modal
 * memasang overflow:hidden di <body> selama terbuka; scroll yang jalan
 * sebelum kunci lepas jadi mendorong tembok (delay saat drawer menutup).
 */
function runWhenScrollable(fn, tries = 0) {
  const locked =
    typeof document !== 'undefined' &&
    document.body &&
    (document.body.style.overflow === 'hidden' ||
      getComputedStyle(document.body).overflow === 'hidden')
  if (!locked || tries > 16) {
    fn()
    return
  }
  requestAnimationFrame(() => runWhenScrollable(fn, tries + 1))
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
  const [pinnedSection, setPinnedSection] = useState(null)
  const rafScrollRef = useRef(null)
  // ID sesi scroll: setiap tekan menu menaikkan ID — animasi/callback lama
  // yang menyisip otomatis gugur sehingga tidak ada tarik-menarik antar loop
  const scrollSessionRef = useRef(0)
  // Saat link ditekan: highlight dikunci ke tujuan selama animasi scroll,
  // sehingga tidak kedip melewati section-section di tengah
  const currentSection = pinnedSection || activeSection

  /**
   * Scroll animasi kustom ber-easing konsisten.
   * Native `behavior:'smooth'` Chrome durasinya variabel & melompat pada
   * jarak jauh di halaman berat — terasa patah-patah. Animasi rAF ini
   * memberi laju konstan (easeInOutCubic) dan bisa diinterupsi pengguna.
   */
  const smoothScrollTo = (targetY, session) => {
    const startY = window.pageYOffset
    const dist = targetY - startY
    const isCurrent = () => scrollSessionRef.current === session
    const detach = () => {
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
      window.removeEventListener('keydown', cancel)
    }
    const stop = () => {
      if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current)
      rafScrollRef.current = null
      detach()
    }
    const finish = () => {
      stop()
      // Lepas pin hanya jika tidak ada tekan baru yang menggantikan sesi ini
      if (isCurrent()) setPinnedSection(null)
    }
    // Interupsi manual (user scroll/touch/tombol) saat animasi berjalan
    const cancel = () => {
      if (!isCurrent()) return
      scrollSessionRef.current++
      stop()
      setPinnedSection(null)
    }
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (Math.abs(dist) < 2) {
      window.scrollTo(0, targetY)
      finish()
      return
    }
    // Klik menu adalah interaksi eksplisit: selalu dianimasikan.
    // Pengguna reduced-motion tetap mendapat glide, hanya lebih singkat.
    const base = reduced ? 350 : 450
    const duration = Math.min(1000, Math.max(base, Math.abs(dist) * 0.45))
    const t0 = performance.now()
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const step = (now) => {
      // Sesi digantikan tekan baru: berhenti diam-diam, jangan tarik-menarik
      if (!isCurrent()) return
      const p = Math.min(1, (now - t0) / duration)
      window.scrollTo(0, startY + dist * ease(p))
      if (p < 1) {
        rafScrollRef.current = requestAnimationFrame(step)
      } else {
        finish()
      }
    }
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchstart', cancel, { passive: true })
    window.addEventListener('keydown', cancel)
    rafScrollRef.current = requestAnimationFrame(step)
  }

  const handleNavClick = (e, href) => {
    e.preventDefault()
    setMobileOpen(false)
    const element = document.querySelector(href)
    if (element) {
      const offsetPosition = element.getBoundingClientRect().top + window.pageYOffset - 72
      // Sesi baru menggantikan sesi lama secara tegas: animasi lama berhenti,
      // callback tertunda batal, hanya satu loop scroll yang pernah aktif
      const session = ++scrollSessionRef.current
      setPinnedSection(href.slice(1))
      // Scroll mulai di frame pertama setelah tekan — tanpa jeda artifisial;
      // runWhenScrollable hanya menunggu kunci scroll body drawer lepas
      runWhenScrollable(() => {
        if (scrollSessionRef.current !== session) return
        smoothScrollTo(offsetPosition, session)
      })
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
              <BrandLogo size={30} />
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
                const isCurrent = currentSection === link.href.replace('#', '')
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
        transitionDuration={{ enter: 220, exit: 110 }}
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
            <BrandLogo size={30} />
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
            const isCurrent = currentSection === link.href.replace('#', '')
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
                    transition: 'background-color 0.15s ease, color 0.15s ease',
                    // Feedback tekan yang jelas: item gelap sesaat saat ditekan
                    '&:active': { bgcolor: 'rgba(3, 78, 50, 0.16)' },
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
