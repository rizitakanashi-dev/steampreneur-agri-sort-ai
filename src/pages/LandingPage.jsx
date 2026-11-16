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

export function LandingPage({ onOpenApp }) {
  return (
    <Box
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
      <Box className="agri-cv-section">
        <ProblemSolution onOpenApp={onOpenApp} />
      </Box>
      <Box className="agri-cv-section">
        <Features onOpenApp={onOpenApp} />
      </Box>
      <Box className="agri-cv-section">
        <HowItWorks onOpenApp={onOpenApp} />
      </Box>
      <Box className="agri-cv-section">
        <DashboardPreview onOpenApp={onOpenApp} />
      </Box>
      <Box className="agri-cv-section">
        <Commodities />
      </Box>
      <Box className="agri-cv-section">
        <FinalCTA onOpenApp={onOpenApp} />
      </Box>
      <Box className="agri-cv-section">
        <Footer onOpenApp={onOpenApp} />
      </Box>
    </Box>
  )
}

export default LandingPage
