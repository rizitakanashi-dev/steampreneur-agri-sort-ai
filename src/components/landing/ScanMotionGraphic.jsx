import { Box, Chip, Stack, Typography } from '@mui/material'
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
  { id: 'A1', label: 'Grade A 95%', x: '10%', y: '18%', w: '24%', h: '34%', color: AGRI_COLORS.leafGlow, fruit: 'tomato', delay: '0s' },
  { id: 'A2', label: 'Grade A 92%', x: '39%', y: '14%', w: '23%', h: '32%', color: AGRI_COLORS.leafGlow, fruit: 'tomato', delay: '0.35s' },
  { id: 'B1', label: 'Grade B 87%', x: '68%', y: '24%', w: '22%', h: '32%', color: AGRI_COLORS.gold, fruit: 'tomatoB', delay: '0.7s' },
  { id: 'A3', label: 'Grade A 94%', x: '22%', y: '56%', w: '24%', h: '32%', color: AGRI_COLORS.leafGlow, fruit: 'tomato', delay: '0.5s' },
  { id: 'R1', label: 'Reject 91%', x: '56%', y: '58%', w: '25%', h: '32%', color: AGRI_COLORS.crimson, fruit: 'reject', delay: '0.9s' },
]

function StylizedFruit({ variant }) {
  const fill =
    variant === 'reject'
      ? '#8B2626'
      : variant === 'tomatoB'
      ? '#D9822B'
      : '#E0433E'
  return (
    <svg viewBox="0 0 48 48" width="38" height="38" aria-hidden="true">
      <circle cx="24" cy="26" r="15" fill={fill} />
      <ellipse cx="19" cy="20" rx="5" ry="2.5" fill="#FFFFFF" fillOpacity="0.28" transform="rotate(-20 19 20)" />
      <path d="M24 12 C21 8, 17 10, 16 13 C20 13, 22 14, 24 15 C26 14, 28 13, 32 13 C31 10, 27 8, 24 12Z" fill="#34C77B" />
      {variant === 'reject' && (
        <circle cx="29" cy="29" r="4.5" fill="#2A0E0E" fillOpacity="0.72" />
      )}
    </svg>
  )
}

/**
 * Animated Motion Graphic showing YOLO11n real-time 3-Class detection over a harvest tray.
 */
export function LiveYoloScanMotion({ height = 200, badgeText = 'LIVE YOLO11N 3-CLASS' }) {
  return (
    <Box
      sx={{
        position: 'relative',
        height,
        borderRadius: AGRI_RADII.cards,
        bgcolor: '#081D15',
        border: '1px solid rgba(52, 199, 123, 0.28)',
        overflow: 'hidden',
        backgroundImage:
          'linear-gradient(rgba(52, 199, 123, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(52, 199, 123, 0.06) 1px, transparent 1px)',
        backgroundSize: '26px 26px',
      }}
    >
      {/* Top Status Chip */}
      <Chip
        label={badgeText}
        size="small"
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 5,
          bgcolor: 'rgba(7, 26, 19, 0.9)',
          color: AGRI_COLORS.leafGlow,
          border: `1px solid ${AGRI_COLORS.leafGlow}`,
          fontFamily: AGRI_FONTS.ui,
          fontSize: '0.68rem',
          fontWeight: 700,
        }}
      />

      {/* Animated Bounding Boxes + Vector Fruits */}
      {DETECTED_BOXES.map((box) => (
        <Box
          key={box.id}
          sx={{
            position: 'absolute',
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            border: `2px solid ${box.color}`,
            borderRadius: '8px',
            bgcolor: 'rgba(255, 255, 255, 0.03)',
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
              top: -16,
              left: -2,
              px: 0.75,
              py: 0.1,
              borderRadius: '4px',
              bgcolor: box.color,
              color: '#04110C',
              fontFamily: AGRI_FONTS.ui,
              fontSize: '0.62rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            {box.label}
          </Box>
          <StylizedFruit variant={box.fruit} />
        </Box>
      ))}

      {/* Sweeping Laser Scan Line */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, transparent 0%, #34C77B 20%, #FFFFFF 50%, #34C77B 80%, transparent 100%)',
          boxShadow: '0 0 16px 3px rgba(52, 199, 123, 0.55)',
          zIndex: 4,
          animation: `${scanBeamSweep} 3.2s ease-in-out infinite alternate`,
          ...reducedMotionSx,
        }}
      />
    </Box>
  )
}

/**
 * Animated Motion Graphic showing offline PWA archive, CSV export rows, and A4 QC Certificate stamp.
 */
export function CsvArchiveMotion() {
  const rows = [
    { batch: '#BATCH-TMT-042', split: 'Grade A 68% · B 24%', total: 'Rp 223.200' },
    { batch: '#BATCH-TRG-019', split: 'Grade A 74% · B 20%', total: 'Rp 198.400' },
  ]
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: AGRI_RADII.buttons,
        bgcolor: '#081D15',
        border: '1px solid rgba(52, 199, 123, 0.25)',
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <TableViewRoundedIcon sx={{ color: AGRI_COLORS.leafGlow, fontSize: 18 }} />
            <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.75rem', fontWeight: 700, color: AGRI_COLORS.snow }}>
              EKSPOR CSV RFC 4180 &amp; CETAK A4
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: '12px',
              bgcolor: 'rgba(52, 199, 123, 0.16)',
              animation: `${pulseNode} 2.4s ease-in-out infinite`,
              ...reducedMotionSx,
            }}
          >
            <DescriptionRoundedIcon sx={{ fontSize: 13, color: AGRI_COLORS.leafGlow }} />
            <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.66rem', fontWeight: 700, color: AGRI_COLORS.leafGlow }}>
              SIAP CETAK
            </Typography>
          </Box>
        </Stack>

        {rows.map((r, idx) => (
          <Box
            key={r.batch}
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: '8px',
              bgcolor: AGRI_COLORS.appChrome,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              animation: `${floatVertical} 3.4s ease-in-out infinite`,
              animationDelay: `${idx * 0.45}s`,
              ...reducedMotionSx,
            }}
          >
            <Box>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.76rem', fontWeight: 700, color: AGRI_COLORS.snow }}>
                {r.batch}
              </Typography>
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.68rem', color: AGRI_COLORS.sageMist }}>
                {r.split}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography sx={{ fontFamily: AGRI_FONTS.ui, fontSize: '0.78rem', fontWeight: 700, color: AGRI_COLORS.gold }}>
                {r.total}
              </Typography>
              <CheckCircleRoundedIcon sx={{ fontSize: 15, color: AGRI_COLORS.leafGlow }} />
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
