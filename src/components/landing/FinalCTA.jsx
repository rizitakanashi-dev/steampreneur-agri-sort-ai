import { Box, Container, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded'
import { AGRI_COLORS, AGRI_FONTS } from './tokens.js'
import {
  AgriPrimaryButton,
  DisplayHeadline,
  FeatureStageCard,
  LightSecondaryButton,
} from './AgriPrimitives.jsx'
import { AgriBotMascot, FloatingHarvestBadge, FloatingTomatoProp } from './FloatingMascots.jsx'

export function FinalCTA({ onOpenApp }) {
  return (
    <Box
      component="section"
      sx={{
        py: { xs: 10, md: 13 },
        bgcolor: AGRI_COLORS.mintSoft,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <FeatureStageCard
          gradient="linear-gradient(135deg, #045E3B 0%, #0D8254 60%, #15946B 100%)"
          sx={{ textAlign: 'center', py: { xs: 6, md: 9 }, px: { xs: 3, md: 6 } }}
        >
          <AgriBotMascot
            size={{ xs: 92, md: 126 }}
            sx={{ position: 'absolute', top: -36, left: { xs: 16, md: 36 }, zIndex: 3 }}
          />
          <FloatingTomatoProp
            size={{ xs: 82, md: 104 }}
            sx={{ position: 'absolute', bottom: -30, right: { xs: 16, md: 40 }, zIndex: 3 }}
          />
          <FloatingHarvestBadge
            size={64}
            sx={{ position: 'absolute', top: -24, right: { xs: 20, md: 72 }, zIndex: 3, display: { xs: 'none', sm: 'block' } }}
          />

          <Stack spacing={3} alignItems="center" sx={{ maxWidth: 680, mx: 'auto', position: 'relative', zIndex: 2 }}>
            <DisplayHeadline onDark variant="hero">
              SAATNYA SORTIR PANEN LEBIH PRESISI
            </DisplayHeadline>

            <Typography
              sx={{
                fontFamily: AGRI_FONTS.body,
                fontSize: { xs: '1rem', sm: '1.125rem' },
                lineHeight: 1.55,
                letterSpacing: '0.01em',
                color: AGRI_COLORS.sageMist,
              }}
            >
              Gunakan kamera ponsel atau laptop untuk deteksi mutu Tomat, Terung, dan Cabai 3-Class secara instan, aman offline di browser, dan siap cetak Sertifikat QC A4.
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
              sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
            >
              <LightSecondaryButton
                onClick={() => onOpenApp('overview')}
                endIcon={<ArrowForwardRoundedIcon />}
              >
                Masuk Dashboard
              </LightSecondaryButton>
              <AgriPrimaryButton
                onClick={() => onOpenApp('scanner')}
                startIcon={<QrCodeScannerRoundedIcon />}
                sx={{ border: '1px solid rgba(255,255,255,0.28)' }}
              >
                Mulai Scan Sekarang
              </AgriPrimaryButton>
            </Stack>
          </Stack>
        </FeatureStageCard>
      </Container>
    </Box>
  )
}
