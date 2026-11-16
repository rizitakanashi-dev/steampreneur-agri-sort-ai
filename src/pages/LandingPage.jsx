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
import { LANDING_COLORS } from '../components/landing/constants.js'

export function LandingPage({ onOpenApp }) {
  return (
    <Box
      sx={{
        bgcolor: LANDING_COLORS.warmCream,
        color: LANDING_COLORS.darkText,
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
      }}
    >
      {/* SECTION 01 — NAVIGATION BAR */}
      <Navbar onOpenApp={onOpenApp} />

      {/* SECTION 02 — HERO SECTION */}
      <Hero onOpenApp={onOpenApp} />

      {/* SECTION 03 — PROBLEM AND SOLUTION */}
      <ProblemSolution onOpenApp={onOpenApp} />

      {/* SECTION 04 — CORE FEATURES */}
      <Features />

      {/* SECTION 05 — HOW IT WORKS */}
      <HowItWorks />

      {/* SECTION 06 — REAL APPLICATION PREVIEW */}
      <DashboardPreview onOpenApp={onOpenApp} />

      {/* SECTION 07 — COMMODITIES AND TARGET USERS */}
      <Commodities />

      {/* SECTION 08 — FINAL CTA */}
      <FinalCTA onOpenApp={onOpenApp} />

      {/* FOOTER */}
      <Footer onOpenApp={onOpenApp} />
    </Box>
  )
}

export default LandingPage
