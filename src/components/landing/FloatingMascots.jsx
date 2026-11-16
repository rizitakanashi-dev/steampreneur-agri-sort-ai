import { Box } from '@mui/material'

/**
 * Custom 3D-shaded inline SVG AgriBot mascot and agricultural harvest props.
 */
export function AgriBotMascot({ size = 140, sx = {} }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        pointerEvents: 'none',
        userSelect: 'none',
        ...sx,
      }}
    >
      <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <radialGradient id="agriBotBody" cx="35%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#6EE7A8" />
            <stop offset="55%" stopColor="#289D67" />
            <stop offset="100%" stopColor="#034D32" />
          </radialGradient>
          <linearGradient id="agriBotEar" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F8C26A" />
            <stop offset="100%" stopColor="#C68F2F" />
          </linearGradient>
          <linearGradient id="agriVisor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#123629" />
            <stop offset="100%" stopColor="#04110C" />
          </linearGradient>
        </defs>
        {/* Sprout Antenna */}
        <path d="M90 36V18" stroke="#34C77B" strokeWidth="6" strokeLinecap="round" />
        <path d="M90 22C90 10 108 6 116 14C108 24 98 26 90 22Z" fill="#34C77B" />
        <circle cx="90" cy="18" r="6" fill="#E9A64B" />
        {/* Side Sensors */}
        <rect x="20" y="72" width="22" height="44" rx="11" fill="url(#agriBotEar)" />
        <rect x="138" y="72" width="22" height="44" rx="11" fill="url(#agriBotEar)" />
        {/* Head */}
        <rect x="34" y="42" width="112" height="92" rx="34" fill="url(#agriBotBody)" />
        {/* Highlight */}
        <ellipse cx="64" cy="58" rx="18" ry="6" fill="#FFFFFF" fillOpacity="0.32" transform="rotate(-14 64 58)" />
        {/* Dark Visor */}
        <rect x="48" y="66" width="84" height="44" rx="18" fill="url(#agriVisor)" />
        {/* Scanner Optics */}
        <circle cx="72" cy="88" r="9" fill="#34C77B" />
        <circle cx="75" cy="85" r="3" fill="#FFFFFF" />
        <circle cx="108" cy="88" r="9" fill="#E9A64B" />
        <circle cx="111" cy="85" r="3" fill="#FFFFFF" />
        {/* Smile */}
        <path d="M77 120C84 125 96 125 103 120" stroke="#04110C" strokeWidth="5" strokeLinecap="round" />
        {/* Hands */}
        <circle cx="42" cy="144" r="14" fill="url(#agriBotBody)" />
        <circle cx="138" cy="144" r="14" fill="url(#agriBotBody)" />
      </svg>
    </Box>
  )
}

export function FloatingTomatoProp({ size = 110, sx = {} }) {
  return (
    <Box aria-hidden="true" sx={{ width: size, height: size, pointerEvents: 'none', ...sx }}>
      <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <radialGradient id="agriTomato3d" cx="34%" cy="30%" r="68%">
            <stop offset="0%" stopColor="#FF907A" />
            <stop offset="48%" stopColor="#D9534F" />
            <stop offset="100%" stopColor="#6D181A" />
          </radialGradient>
        </defs>
        <ellipse cx="70" cy="78" rx="46" ry="42" fill="url(#agriTomato3d)" />
        <ellipse cx="52" cy="60" rx="14" ry="8" fill="#FFFFFF" fillOpacity="0.32" transform="rotate(-24 52 60)" />
        <path d="M70 38C60 22 44 26 42 36C54 36 62 40 70 42C78 40 86 36 98 36C96 26 80 22 70 38Z" fill="#34C77B" />
        <path d="M70 38C66 20 74 14 78 26" stroke="#34C77B" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </Box>
  )
}

export function FloatingEggplantProp({ size = 115, sx = {} }) {
  return (
    <Box aria-hidden="true" sx={{ width: size, height: size, pointerEvents: 'none', ...sx }}>
      <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <radialGradient id="agriEggplant3d" cx="35%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#B87CF2" />
            <stop offset="48%" stopColor="#6B2FA0" />
            <stop offset="100%" stopColor="#2B1047" />
          </radialGradient>
        </defs>
        <path
          d="M84 32C102 36 112 58 106 84C98 112 72 126 50 118C30 110 26 88 38 68C48 52 62 28 84 32Z"
          fill="url(#agriEggplant3d)"
        />
        <ellipse cx="64" cy="62" rx="12" ry="6" fill="#FFFFFF" fillOpacity="0.28" transform="rotate(-35 64 62)" />
        <path d="M68 34C74 20 92 22 94 38C86 42 74 42 68 34Z" fill="#34C77B" />
        <path d="M84 26L92 16" stroke="#34C77B" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </Box>
  )
}

export function FloatingChiliProp({ size = 110, sx = {} }) {
  return (
    <Box aria-hidden="true" sx={{ width: size, height: size, pointerEvents: 'none', ...sx }}>
      <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <linearGradient id="agriChili3d" x1="25" y1="30" x2="110" y2="115" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E9A64B" />
            <stop offset="50%" stopColor="#D9534F" />
            <stop offset="100%" stopColor="#70171A" />
          </linearGradient>
        </defs>
        <path
          d="M92 38C108 50 104 86 78 106C58 122 32 122 24 114C42 106 60 88 66 64C70 48 76 30 92 38Z"
          fill="url(#agriChili3d)"
        />
        <ellipse cx="82" cy="60" rx="8" ry="18" fill="#FFFFFF" fillOpacity="0.25" transform="rotate(20 82 60)" />
        <path d="M86 38C92 24 102 22 106 30" stroke="#34C77B" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </Box>
  )
}

export function FloatingHarvestBadge({ size = 84, sx = {} }) {
  return (
    <Box aria-hidden="true" sx={{ width: size, height: size, pointerEvents: 'none', ...sx }}>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <linearGradient id="agriBadgeGrad" x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34C77B" />
            <stop offset="55%" stopColor="#036E45" />
            <stop offset="100%" stopColor="#E9A64B" />
          </linearGradient>
        </defs>
        <polygon points="50,8 88,36 74,88 26,88 12,36" fill="url(#agriBadgeGrad)" />
        <polygon points="50,8 70,36 50,88 30,36" fill="#FFFFFF" fillOpacity="0.18" />
      </svg>
    </Box>
  )
}
