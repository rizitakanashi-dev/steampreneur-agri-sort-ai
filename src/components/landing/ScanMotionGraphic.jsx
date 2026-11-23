import { Box, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import TableViewRoundedIcon from '@mui/icons-material/TableViewRounded'
import { AGRI_COLORS, AGRI_FONTS, AGRI_RADII } from './tokens.js'
import {
  bboxPulse,
  floatVertical,
  pulseNode,
  reducedMotionSx,
  scanBeamSweep,
} from './motionKeyframes.js'

const DETECTED_BOXES = [
  { id: 'A1', label: 'Grade A 95%', x: '8%', y: '18%', w: '25%', h: '34%', color: AGRI_COLORS.emerald, fruit: 'tomato', delay: '0s' },
  { id: 'A2', label: 'Grade A 92%', x: '38%', y: '14%', w: '24%', h: '33%', color: AGRI_COLORS.emerald, fruit: 'tomato', delay: '0.35s' },
  { id: 'B1', label: 'Grade B 87%', x: '67%', y: '24%', w: '24%', h: '33%', color: AGRI_COLORS.gold, fruit: 'tomatoB', delay: '0.7s' },
  { id: 'A3', label: 'Grade A 94%', x: '20%', y: '56%', w: '25%', h: '32%', color: AGRI_COLORS.emerald, fruit: 'tomato', delay: '0.5s' },
  { id: 'R1', label: 'Reject 91%', x: '55%', y: '58%', w: '26%', h: '32%', color: AGRI_COLORS.crimson, fruit: 'reject', delay: '0.9s' },
]

function StylizedFruit({ variant }) {
  const fill =
    variant === 'reject'
      ? '#9A3D36'
      : variant === 'tomatoB'
      ? '#D99330'
      : '#DE4B3E'
  return (
    <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
      <circle cx="24" cy="26" r="14" fill={fill} />
      <ellipse cx="19" cy="20" rx="4.5" ry="2.2" fill="#FFFFFF" fillOpacity="0.32" transform="rotate(-20 19 20)" />
      <path d="M24 12 C21 8, 17 10, 16 13 C20 13, 22 14, 24 15 C26 14, 28 13, 32 13 C31 10, 27 8, 24 12Z" fill="#289D67" />
      {variant === 'reject' && (
        <circle cx="29" cy="29" r="4" fill="#4A1D19" fillOpacity="0.7" />
      )}
    </svg>
  )
}

/**
 * Editorial Light-Paper Motion Graphic demonstrating live YOLO11n 3-Class detection.
 */
export function LiveYoloScanMotion({ height = 200, badgeText = 'YOLO11n · 3-Class Live' }) {
  return (
    <Box
      style={{ '--scan-h': `${height}px` }}
      sx={{
        position: 'relative',
        height,
        borderRadius: AGRI_RADII.images,
        bgcolor: AGRI_COLORS.fogSurface,
        border: `1px solid ${AGRI_COLORS.hairline}`,
        overflow: 'hidden',
        backgroundImage:
          'linear-gradient(rgba(3, 110, 69, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(3, 110, 69, 0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <Typography
        sx={{
          position: 'absolute',
          top: 10,
          left: 12,
          zIndex: 5,
          px: 1.25,
          py: 0.35,
          borderRadius: AGRI_RADII.buttons,
          bgcolor: AGRI_COLORS.paperWhite,
          border: `1px solid ${AGRI_COLORS.hairline}`,
          color: AGRI_COLORS.deepEmerald,
          fontFamily: AGRI_FONTS.sans,
          fontSize: '0.7rem',
          fontWeight: 500,
        }}
      >
        {badgeText}
      </Typography>

      {DETECTED_BOXES.map((box) => (
        <Box
          key={box.id}
          sx={{
            position: 'absolute',
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            border: `1.5px solid ${box.color}`,
            borderRadius: '10px',
            bgcolor: 'rgba(255, 255, 255, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: `${bboxPulse} 2.8s ease-in-out infinite`,
            animationDelay: box.delay,
            ...reducedMotionSx,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -15,
              left: -1,
              px: 0.75,
              py: 0.1,
              borderRadius: '6px',
              bgcolor: box.color,
              color: AGRI_COLORS.paperWhite,
              fontFamily: AGRI_FONTS.sans,
              fontSize: '0.62rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {box.label}
          </Box>
          <StylizedFruit variant={box.fruit} />
        </Box>
      ))}

      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, #036E45 25%, #289D67 50%, #036E45 75%, transparent 100%)',
          boxShadow: '0 0 12px 2px rgba(3, 110, 69, 0.35)',
          zIndex: 4,
          animation: `${scanBeamSweep} 3.2s ease-in-out infinite alternate`,
          ...reducedMotionSx,
        }}
      />
    </Box>
  )
}

/**
 * Light-Paper Motion Graphic showing offline PWA archive rows and A4 QC print flow.
 */
export function CsvArchiveMotion() {
  const rows = [
    { batch: '#BATCH-TMT-042', split: 'Grade A 68% · Grade B 24%', total: 'Rp 223.200' },
    { batch: '#BATCH-TRG-019', split: 'Grade A 74% · Grade B 20%', total: 'Rp 198.400' },
  ]
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: AGRI_RADII.images,
        bgcolor: AGRI_COLORS.fogSurface,
        border: `1px solid ${AGRI_COLORS.hairline}`,
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TableViewRoundedIcon sx={{ color: AGRI_COLORS.emerald, fontSize: 18 }} />
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
              Ekspor CSV RFC 4180 &amp; Cetak A4
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: AGRI_RADII.buttons,
              bgcolor: AGRI_COLORS.blushMint,
              animation: `${pulseNode} 2.4s ease-in-out infinite`,
              ...reducedMotionSx,
            }}
          >
            <DescriptionRoundedIcon sx={{ fontSize: 13, color: AGRI_COLORS.deepEmerald }} />
            <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.68rem', fontWeight: 500, color: AGRI_COLORS.deepEmerald }}>
              Siap Cetak
            </Typography>
          </Box>
        </Stack>

        {rows.map((r, idx) => (
          <Box
            key={r.batch}
            sx={{
              px: 1.5,
              py: 1.1,
              borderRadius: '10px',
              bgcolor: AGRI_COLORS.paperWhite,
              border: `1px solid ${AGRI_COLORS.hairline}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              animation: `${floatVertical} 3.4s ease-in-out infinite`,
              animationDelay: `${idx * 0.45}s`,
              ...reducedMotionSx,
            }}
          >
            <Box>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.78rem', fontWeight: 500, color: AGRI_COLORS.ink }}>
                {r.batch}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.7rem', color: AGRI_COLORS.slateMuted }}>
                {r.split}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Typography sx={{ fontFamily: AGRI_FONTS.sans, fontSize: '0.8rem', fontWeight: 600, color: AGRI_COLORS.emerald }}>
                {r.total}
              </Typography>
              <CheckCircleRoundedIcon sx={{ fontSize: 15, color: AGRI_COLORS.leaf }} />
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
