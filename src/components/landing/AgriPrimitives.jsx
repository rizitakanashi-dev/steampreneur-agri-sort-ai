import { Box, Button, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'

/**
 * Primary CTA — Solid Agri-Sort AI Emerald button.
 */
export function AgriPrimaryButton({ children, sx = {}, ...props }) {
  return (
    <Button
      disableElevation
      variant="contained"
      sx={{
        bgcolor: AGRI_COLORS.emerald,
        color: AGRI_COLORS.snow,
        borderRadius: AGRI_RADII.buttons,
        px: '24px',
        py: '19.5px',
        fontFamily: AGRI_FONTS.body,
        fontWeight: 600,
        fontSize: '1rem',
        lineHeight: 1.2,
        letterSpacing: '0.015em',
        textTransform: 'none',
        transition: 'background-color 0.2s ease, transform 0.2s ease',
        '&:hover': {
          bgcolor: AGRI_COLORS.emeraldHover,
          transform: 'translateY(-1px)',
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

/**
 * Secondary CTA — Crisp white button with emerald border paired with AgriPrimaryButton.
 */
export function LightSecondaryButton({ children, sx = {}, ...props }) {
  return (
    <Button
      disableElevation
      variant="contained"
      sx={{
        bgcolor: AGRI_COLORS.snow,
        color: AGRI_COLORS.emeraldDark,
        border: `1.5px solid ${AGRI_COLORS.emerald}`,
        borderRadius: AGRI_RADII.buttons,
        px: '24px',
        py: '15px',
        fontFamily: AGRI_FONTS.body,
        fontWeight: 600,
        fontSize: '1rem',
        lineHeight: 1.2,
        letterSpacing: '0.013em',
        textTransform: 'none',
        transition: 'background-color 0.2s ease, transform 0.2s ease',
        '&:hover': {
          bgcolor: AGRI_COLORS.mintSoft,
          transform: 'translateY(-1px)',
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

/**
 * Header CTA Button — Solid emerald pill trigger on the mint-white navbar.
 */
export function HeaderActionButton({ children, sx = {}, ...props }) {
  return (
    <Button
      disableElevation
      sx={{
        bgcolor: AGRI_COLORS.emerald,
        color: AGRI_COLORS.snow,
        borderRadius: AGRI_RADII.buttonsLarge,
        px: '18px',
        py: '10px',
        fontFamily: AGRI_FONTS.body,
        fontWeight: 600,
        fontSize: '0.9rem',
        lineHeight: 1.2,
        letterSpacing: '0.013em',
        textTransform: 'none',
        transition: 'background-color 0.2s ease, transform 0.2s ease',
        '&:hover': {
          bgcolor: AGRI_COLORS.emeraldHover,
          transform: 'translateY(-1px)',
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

/**
 * Ghost Outlined Button — Clean white-mint switcher button on light sections.
 */
export function GhostOutlineButton({ children, sx = {}, ...props }) {
  return (
    <Button
      sx={{
        bgcolor: AGRI_COLORS.snow,
        color: AGRI_COLORS.ink,
        border: `1px solid ${AGRI_COLORS.mintBorder}`,
        borderRadius: AGRI_RADII.buttons,
        px: '16px',
        py: '10px',
        fontFamily: AGRI_FONTS.body,
        fontWeight: 600,
        fontSize: '0.9375rem',
        textTransform: 'none',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          bgcolor: AGRI_COLORS.mintSoft,
          borderColor: AGRI_COLORS.emerald,
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

/**
 * Bold Display Headline — All-caps weight 800 heading (deep forest ink on mint, white on gradient stages).
 */
export function DisplayHeadline({
  children,
  component = 'h2',
  variant = 'section',
  onDark = false,
  sx = {},
}) {
  const sizeMap = {
    display: { xs: '2.35rem', sm: '3.15rem', md: '3.75rem' },
    hero: { xs: '2.2rem', sm: '2.95rem', md: '3.4rem' },
    section: { xs: '1.9rem', sm: '2.45rem', md: '2.95rem' },
    subsection: { xs: '1.5rem', sm: '1.9rem', md: '2.2rem' },
  }

  const lineHeightMap = {
    display: 0.94,
    hero: 0.96,
    section: 1.0,
    subsection: 1.16,
  }

  return (
    <Typography
      component={component}
      sx={{
        fontFamily: AGRI_FONTS.display,
        fontWeight: 800,
        fontSize: sizeMap[variant] || sizeMap.section,
        lineHeight: lineHeightMap[variant] || 1.0,
        letterSpacing: '-0.01em',
        textTransform: 'uppercase',
        color: onDark ? AGRI_COLORS.snow : AGRI_COLORS.ink,
        ...sx,
      }}
    >
      {children}
    </Typography>
  )
}

/**
 * Self-contained harvest-themed gradient stage card (24px radius, zero shadow).
 */
export function FeatureStageCard({ gradient, children, sx = {} }) {
  return (
    <Box
      sx={{
        position: 'relative',
        background: gradient,
        borderRadius: AGRI_RADII.featurePanels,
        p: { xs: 3.5, sm: 5, md: 6 },
        overflow: 'visible',
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

/**
 * High-contrast dark screen bezel for real product UI mockups inside light mint & gradient stages.
 */
export function ProductDeviceFrame({ title, statusLabel = 'AI READY', children, sx = {} }) {
  return (
    <Box
      sx={{
        bgcolor: AGRI_COLORS.appChrome,
        borderRadius: AGRI_RADII.cards,
        border: '1px solid rgba(11, 59, 40, 0.2)',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(210, 237, 224, 0.14)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: AGRI_COLORS.crimson }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: AGRI_COLORS.gold }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: AGRI_COLORS.leafGlow }} />
          {title && (
            <Typography
              sx={{
                ml: 1,
                fontFamily: AGRI_FONTS.ui,
                fontSize: '0.78rem',
                fontWeight: 500,
                color: AGRI_COLORS.sageMist,
              }}
            >
              {title}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: AGRI_COLORS.leafGlow,
            }}
          />
          <Typography
            sx={{
              fontFamily: AGRI_FONTS.ui,
              fontSize: '0.7rem',
              fontWeight: 600,
              color: AGRI_COLORS.leafGlow,
              letterSpacing: '0.04em',
            }}
          >
            {statusLabel}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ bgcolor: AGRI_COLORS.appSurface }}>{children}</Box>
    </Box>
  )
}
