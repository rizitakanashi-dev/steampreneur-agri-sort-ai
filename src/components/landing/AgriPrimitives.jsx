import { Box, Button, Typography } from '@mui/material'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII, AGRI_SHADOWS } from './tokens.js'
import { useStageReveal } from './useScrollChoreography.js'

/**
 * Primary Pill CTA — Filled lozenge (#036E45 Agri Emerald or #17191C Ink, 9999px radius, no shadow).
 */
export function AgriPrimaryButton({ children, sx = {}, ...props }) {
  return (
    <Button
      disableElevation
      variant="contained"
      sx={{
        bgcolor: AGRI_COLORS.emerald,
        color: AGRI_COLORS.paperWhite,
        border: `1px solid ${AGRI_COLORS.emerald}`,
        borderRadius: AGRI_RADII.buttons,
        px: '22px',
        py: '10px',
        minHeight: 44,
        fontFamily: AGRI_FONTS.sans,
        fontWeight: 450,
        fontSize: '1rem',
        lineHeight: 1.2,
        textTransform: 'none',
        transition: 'background-color 0.2s ease, transform 0.2s ease',
        '&:hover': {
          bgcolor: AGRI_COLORS.deepEmerald,
          borderColor: AGRI_COLORS.deepEmerald,
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
 * Ghost Pill Secondary CTA — Transparent fill with 1px ink outline, matched pill geometry.
 */
export function LightSecondaryButton({ children, sx = {}, ...props }) {
  return (
    <Button
      disableElevation
      variant="outlined"
      sx={{
        bgcolor: 'transparent',
        color: AGRI_COLORS.ink,
        border: `1px solid ${AGRI_COLORS.ink}`,
        borderRadius: AGRI_RADII.buttons,
        px: '22px',
        py: '10px',
        minHeight: 44,
        fontFamily: AGRI_FONTS.sans,
        fontWeight: 450,
        fontSize: '1rem',
        lineHeight: 1.2,
        textTransform: 'none',
        transition: 'background-color 0.2s ease, transform 0.2s ease',
        '&:hover': {
          bgcolor: AGRI_COLORS.mistSurface,
          borderColor: AGRI_COLORS.ink,
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
 * Header Pill Action — Quiet filled emerald lozenge in top navigation.
 */
export function HeaderActionButton({ children, sx = {}, ...props }) {
  return (
    <AgriPrimaryButton sx={{ py: '8px', px: '20px', minHeight: 38, fontSize: '0.9375rem', ...sx }} {...props}>
      {children}
    </AgriPrimaryButton>
  )
}

/**
 * Inline Text Link with trailing arrow glyph (→), underlined only on hover.
 */
export function EditorialTextLink({ children, onClick, href, sx = {} }) {
  return (
    <Box
      component={href ? 'a' : 'button'}
      href={href}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        border: 'none',
        bgcolor: 'transparent',
        p: 0,
        py: '12px',
        cursor: 'pointer',
        fontFamily: AGRI_FONTS.sans,
        fontWeight: 400,
        fontSize: '1rem',
        color: AGRI_COLORS.ink,
        textDecoration: 'none',
        '&:hover': { textDecoration: 'underline', textUnderlineOffset: '4px' },
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

/**
 * Ghost-like Typographic Category Label (14px weight 400 #8C9690, no background, no border).
 */
export function GhostCategoryTag({ children, sx = {} }) {
  return (
    <Typography
      sx={{
        fontFamily: AGRI_FONTS.sans,
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: 1.4,
        color: AGRI_COLORS.ashTag,
        ...sx,
      }}
    >
      {children}
    </Typography>
  )
}

/**
 * Circular Avatar Bubble (40px diameter) with 2-letter monogram + directional cursor pointer.
 */
export function AvatarPresenceBubble({ initials = 'FA', bg = '#E3F3EA', color = '#034D32', label }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: AGRI_RADII.buttons,
            bgcolor: bg,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: AGRI_FONTS.sans,
            fontWeight: 500,
            fontSize: '0.78rem',
            letterSpacing: '-0.01em',
          }}
        >
          {initials}
        </Box>
        <svg
          width="13"
          height="13"
          viewBox="0 0 13 13"
          aria-hidden="true"
          style={{ position: 'absolute', bottom: -3, right: -4 }}
        >
          <polygon points="1,1 12,5 7,7 5,12" fill={color} />
        </svg>
      </Box>
      {label && (
        <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.76rem', color: AGRI_COLORS.slateMuted }}>
          {label}
        </Typography>
      )}
    </Box>
  )
}

/**
 * Unselected Tab Pill Button (Ghost style).
 */
export function GhostOutlineButton({ children, sx = {}, ...props }) {
  return (
    <Button
      sx={{
        bgcolor: 'transparent',
        color: AGRI_COLORS.ink,
        border: `1px solid ${AGRI_COLORS.hairline}`,
        borderRadius: AGRI_RADII.buttons,
        px: '20px',
        py: '9px',
        minHeight: 40,
        fontFamily: AGRI_FONTS.sans,
        fontWeight: 430,
        fontSize: '0.9375rem',
        textTransform: 'none',
        '&:hover': {
          bgcolor: AGRI_COLORS.mistSurface,
          borderColor: AGRI_COLORS.ink,
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
 * Editorial Serif Display Headline — Weight 400 regular across 90px / 64px / 44px scales.
 */
export function DisplayHeadline({
  children,
  component = 'h2',
  variant = 'section',
  sx = {},
}) {
  const sizeMap = {
    display: { xs: '2.75rem', sm: '4.1rem', md: '5.5rem' }, // up to 88-90px
    hero: { xs: '2.25rem', sm: '3.25rem', md: '4rem' },     // 64px
    section: { xs: '1.95rem', sm: '2.45rem', md: '2.75rem' }, // 44px
    subsection: { xs: '1.4rem', sm: '1.55rem', md: '1.625rem' }, // 26px
  }

  const trackingMap = {
    display: '-2.25px',
    hero: '-0.96px',
    section: '-0.66px',
    subsection: '-0.23px',
  }

  const lineHeightMap = {
    display: 1.12,
    hero: 1.22,
    section: 1.26,
    subsection: 1.18,
  }

  return (
    <Typography
      component={component}
      sx={{
        fontFamily: variant === 'subsection' ? AGRI_FONTS.sans : AGRI_FONTS.serif,
        fontWeight: variant === 'subsection' ? 450 : 400,
        fontSize: sizeMap[variant] || sizeMap.section,
        lineHeight: lineHeightMap[variant] || 1.26,
        letterSpacing: trackingMap[variant] || '-0.66px',
        color: AGRI_COLORS.ink,
        ...sx,
      }}
    >
      {children}
    </Typography>
  )
}

/**
 * Flat Neutral Card (#F2F5F3 Mist Surface, 24px radius, no shadow, no border) with scroll reveal.
 */
export function EditorialNeutralCard({ children, sx = {} }) {
  const [ref, revealed] = useStageReveal()
  return (
    <Box
      ref={ref}
      className="agri-stage-reveal"
      data-revealed={revealed}
      sx={{
        bgcolor: AGRI_COLORS.mistSurface,
        borderRadius: AGRI_RADII.cards,
        p: { xs: 3, sm: 4 },
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

/**
 * Rare Editorial Accent Card (#E3F3EA Blush-Mint surface, #034D32 Deep Emerald ink, 24px radius, no shadow).
 */
export function EditorialAccentCard({ children, sx = {} }) {
  const [ref, revealed] = useStageReveal()
  return (
    <Box
      ref={ref}
      className="agri-stage-reveal"
      data-revealed={revealed}
      sx={{
        bgcolor: AGRI_COLORS.blushMint,
        color: AGRI_COLORS.deepEmerald,
        borderRadius: AGRI_RADII.cards,
        p: { xs: 3.5, sm: 5 },
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

/**
 * Floating Product Artifact Card — White #FFFFFF surface, 20px radius, 10% subtle shadow,
 * and optional scroll-linked parallax factor (`parallaxFactor`).
 */
export function FloatingArtifactCard({
  title,
  statusLabel,
  parallaxFactor = 0,
  children,
  sx = {},
}) {
  const [ref, revealed] = useStageReveal()
  return (
    <Box
      ref={ref}
      className="agri-stage-reveal"
      data-revealed={revealed}
      sx={{
        bgcolor: AGRI_COLORS.paperWhite,
        borderRadius: AGRI_RADII.elevatedCards,
        boxShadow: AGRI_SHADOWS.artifact,
        p: { xs: '14px 16px', sm: '16px 20px 14px 16px' },
        ...(parallaxFactor !== 0
          ? {
              transform: {
                md: `translate3d(0, calc(var(--agri-scroll-y, 0px) * ${parallaxFactor}), 0)`,
              },
              transition: 'transform 0.15s ease-out, box-shadow 0.25s ease',
            }
          : {}),
        ...sx,
      }}
    >
      {(title || statusLabel) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1.25,
            mb: 1.5,
            borderBottom: `1px solid ${AGRI_COLORS.hairline}`,
          }}
        >
          <Typography
            sx={{
              fontFamily: AGRI_FONTS.sans,
              fontSize: '0.84rem',
              fontWeight: 480,
              color: AGRI_COLORS.ink,
            }}
          >
            {title}
          </Typography>
          {statusLabel && (
            <Typography
              sx={{
                fontFamily: AGRI_FONTS.sans,
                fontSize: '0.75rem',
                fontWeight: 450,
                color: AGRI_COLORS.emerald,
              }}
            >
              {statusLabel}
            </Typography>
          )}
        </Box>
      )}
      {children}
    </Box>
  )
}
