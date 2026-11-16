import { keyframes } from '@mui/system'

export const scanBeamSweep = keyframes`
  0% {
    top: 6%;
    opacity: 0.25;
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    top: 90%;
    opacity: 0.25;
  }
`

export const bboxPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.94;
  }
  50% {
    transform: scale(1.03);
    opacity: 1;
  }
`

export const floatVertical = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-6px);
  }
`

export const barGrow = keyframes`
  0%, 100% {
    transform: scaleX(0.92);
  }
  50% {
    transform: scaleX(1);
  }
`

export const pulseNode = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.18);
    opacity: 1;
  }
`

export const flowDash = keyframes`
  0% {
    stroke-dashoffset: 32;
  }
  100% {
    stroke-dashoffset: 0;
  }
`

export const reducedMotionSx = {
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none !important',
    transition: 'none !important',
  },
}
