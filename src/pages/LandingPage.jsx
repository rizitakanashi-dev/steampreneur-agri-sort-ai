import { Box } from '@mui/material'
import { Navbar } from '../components/landing/Navbar.jsx'
import { Hero } from '../components/landing/Hero.jsx'
import { ProblemSolution } from '../components/landing/ProblemSolution.jsx'
import { Features } from '../components/landing/Features.jsx'
import { HowItWorks } from '../components/landing/HowItWorks.jsx'
import { DashboardPreview } from '../components/landing/DashboardPreview.jsx'
import { Commodities } from '../components/landing/Commodities.jsx'
import { FinalCTA } from '../components/landing/FinalCTA.jsx'
import { Footer } from '../components/landing/Footer.jsx'
import { AGRI_COLORS } from '../components/landing/tokens.js'
import { useScrollParallaxVar } from '../components/landing/useScrollChoreography.js'

export function LandingPage({ onOpenApp }) {
  const scrollContainerRef = useScrollParallaxVar()

  return (
    <Box
      ref={scrollContainerRef}
      sx={{
        bgcolor: AGRI_COLORS.paperWhite,
        color: AGRI_COLORS.ink,
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
      }}
    >
      <Navbar onOpenApp={onOpenApp} />
      <Hero onOpenApp={onOpenApp} />
      <ProblemSolution onOpenApp={onOpenApp} />
      <Features onOpenApp={onOpenApp} />
      <HowItWorks onOpenApp={onOpenApp} />
      <DashboardPreview onOpenApp={onOpenApp} />
      <Commodities />
      <FinalCTA onOpenApp={onOpenApp} />
      <Footer onOpenApp={onOpenApp} />
    </Box>
  )
}

export default LandingPage
