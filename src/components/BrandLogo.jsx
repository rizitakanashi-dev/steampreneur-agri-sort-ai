import { useId } from 'react'

/**
 * Logo brand Agri-Sort AI — SATU sumber kebenaran visual.
 *
 * Konten SVG identik dengan `/public/icons/icon.svg` (favicon + PWA manifest).
 * Inline (bukan <img>) agar tampil tanpa jaringan di awal dan bisa diset
 * ukurannya bebas. Gradient ID diberi namespace per-instance (useId) supaya
 * beberapa logo dalam satu halaman tidak saling menimpa definisi gradient.
 */
export function BrandLogo({ size = 30, sx }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const bgId = `agriBg-${uid}`
  const leafId = `agriLeaf-${uid}`
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label="Logo Agri-Sort AI"
      sx={sx}
      style={{ display: 'block', flexShrink: 0, ...sx }}
    >
      <defs>
        <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id={leafId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Background Rounded Rect */}
      <rect width="512" height="512" rx="128" fill={`url(#${bgId})`} />

      {/* Scanning Reticle Corners */}
      <path d="M 96 176 L 96 112 A 16 16 0 0 1 112 96 L 176 96" fill="none" stroke="#a7f3d0" strokeWidth="24" strokeLinecap="round" />
      <path d="M 336 96 L 400 96 A 16 16 0 0 1 416 112 L 416 176" fill="none" stroke="#a7f3d0" strokeWidth="24" strokeLinecap="round" />
      <path d="M 416 336 L 416 400 A 16 16 0 0 1 400 416 L 336 416" fill="none" stroke="#a7f3d0" strokeWidth="24" strokeLinecap="round" />
      <path d="M 176 416 L 112 416 A 16 16 0 0 1 96 400 L 96 336" fill="none" stroke="#a7f3d0" strokeWidth="24" strokeLinecap="round" />

      {/* Horizontal Scanning Beam Line */}
      <line x1="96" y1="256" x2="416" y2="256" stroke="#fbbf24" strokeWidth="8" strokeDasharray="16 12" strokeLinecap="round" opacity="0.85" />

      {/* Sprout / Horti Plant Icon */}
      <path d="M 256 384 C 256 312 256 248 256 200" fill="none" stroke="#f0fdf4" strokeWidth="22" strokeLinecap="round" />
      {/* Left Leaf */}
      <path d="M 256 280 C 200 280 152 248 160 192 C 216 184 256 232 256 280 Z" fill={`url(#${leafId})`} />
      {/* Right Leaf */}
      <path d="M 256 230 C 312 230 360 198 352 142 C 296 134 256 182 256 230 Z" fill="#6ee7b7" />

      {/* AI Sparkle Badge */}
      <path d="M 376 344 L 388 368 L 412 380 L 388 392 L 376 416 L 364 392 L 340 380 L 364 368 Z" fill="#f59e0b" />
    </svg>
  )
}

export default BrandLogo
