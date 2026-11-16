import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import PriceCheckRoundedIcon from '@mui/icons-material/PriceCheckRounded'
import { FONTS, LANDING_COLORS } from './constants.js'

const PREVIEW_TABS = [
  {
    id: 'dashboard',
    label: 'Dashboard Utama',
    icon: DashboardRoundedIcon,
    appTarget: 'overview',
    title: 'Ringkasan Eksekutif & Acuan Harga BAPANAS',
    description: 'Menampilkan metrik batch tersimpan, komoditas terdaftar, acuan harga pasar terkini, dan akses cepat ke batch panen terakhir.',
    image: '/images/screenshots/U20-tombol-dashboard.png',
    highlights: [
      'Indikator status sistem & kesiapan lapangan',
      'Harga acuan BAPANAS Payakumbuh & Sumbar terverifikasi',
      'Ringkasan batch terakhir dengan nilai ekonomi panen',
    ],
  },
  {
    id: 'scanner',
    label: 'Batch QC Scanner',
    icon: QrCodeScannerRoundedIcon,
    appTarget: 'scanner',
    title: 'Pemeriksaan Mutu Keranjang Panen',
    description: 'Mendukung live viewfinder kamera gawai/laptop serta unggah berkas foto keranjang untuk deteksi dan klasifikasi mutu instan.',
    image: '/images/screenshots/langkah-1.png',
    highlights: [
      'Live camera viewfinder untuk smartphone & laptop',
      'Mode Terung (4-Class), Tomat, dan Cabai Rawit Hijau',
      'Slider sensitivitas deteksi keyakinan mutu panen',
    ],
  },
  {
    id: 'results',
    label: 'Hasil Analisis Mutu',
    icon: AssessmentRoundedIcon,
    appTarget: 'results',
    title: 'Visualisasi Sebaran Grade & Estimasi Nilai',
    description: 'Menyajikan diagram Donut interaktif sebaran mutu Grade A, B, dan Reject, beserta rincian bobot dan estimasi pendapatan riil.',
    image: '/images/screenshots/langkah-2.png',
    highlights: [
      'Donut Chart (@mui/x-charts) persentase mutu panen',
      'Estimasi Smart Pricing berbasis formula tertimbang',
      'Penerbitan Sertifikat Mutu Digital standar cetak A4',
    ],
  },
  {
    id: 'recap',
    label: 'Rekap Data Panen',
    icon: TableChartRoundedIcon,
    appTarget: 'results-list',
    title: 'Manajemen Inventaris & Ekspor CSV',
    description: 'Kelola seluruh riwayat batch panen yang tersimpan di browser, lengkap dengan fitur pencarian instan dan ekspor Excel.',
    image: '/images/screenshots/01-pencarian-realtime-tomat.png',
    highlights: [
      'Penyimpanan persisten lokal ramah kerja tanpa sinyal',
      'Pencarian real-time berdasarkan ID batch dan komoditas',
      'Ekspor laporan terformat CSV standar RFC 4180 (Excel)',
    ],
  },
]

export function DashboardPreview({ onOpenApp }) {
  const [activeTab, setActiveTab] = useState(0)
  const currentModule = PREVIEW_TABS[activeTab]

  return (
    <Box
      id="dashboard"
      component="section"
      sx={{
        py: { xs: 8, sm: 10, md: 14 },
        position: 'relative',
        bgcolor: LANDING_COLORS.warmCream,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3, md: 4 } }}>
        {/* SECTION HEADER */}
        <Stack
          alignItems="center"
          spacing={2}
          sx={{
            textAlign: 'center',
            maxWidth: 760,
            mx: 'auto',
            mb: { xs: 5, sm: 6, md: 7 },
          }}
        >
          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: LANDING_COLORS.leafGreen,
            }}
          >
            PRATINJAU APLIKASI ASLI
          </Typography>

          <Typography
            component="h2"
            sx={{
              fontFamily: FONTS.heading,
              fontSize: { xs: '1.9rem', sm: '2.5rem', md: '2.85rem' },
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.025em',
              color: LANDING_COLORS.forestGreen,
            }}
          >
            Kenali Dashboard Agri-Sort AI.
          </Typography>

          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: { xs: '0.98rem', sm: '1.08rem' },
              lineHeight: 1.65,
              color: LANDING_COLORS.mutedText,
            }}
          >
            Antarmuka yang dirancang untuk menyajikan informasi hasil panen secara terstruktur dan mudah dipahami.
          </Typography>
        </Stack>

        {/* INTERACTIVE MODULE TABS */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              bgcolor: 'rgba(23, 63, 50, 0.05)',
              p: 0.75,
              borderRadius: '16px',
              border: `1px solid ${LANDING_COLORS.border}`,
              '& .MuiTabs-indicator': {
                display: 'none',
              },
            }}
          >
            {PREVIEW_TABS.map((tab, idx) => {
              const Icon = tab.icon
              const isSelected = activeTab === idx
              return (
                <Tab
                  key={tab.id}
                  icon={<Icon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  label={tab.label}
                  sx={{
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    textTransform: 'none',
                    minHeight: 44,
                    px: { xs: 2, sm: 2.75 },
                    borderRadius: '12px',
                    color: isSelected ? `${LANDING_COLORS.white} !important` : LANDING_COLORS.darkText,
                    bgcolor: isSelected ? LANDING_COLORS.forestGreen : 'transparent',
                    boxShadow: isSelected ? '0 4px 12px rgba(23, 63, 50, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: isSelected ? LANDING_COLORS.forestGreen : 'rgba(23, 63, 50, 0.08)',
                    },
                  }}
                />
              )
            })}
          </Tabs>
        </Box>

        {/* BROWSER WINDOW MOCKUP */}
        <Box
          sx={{
            bgcolor: LANDING_COLORS.white,
            borderRadius: '24px',
            border: `1px solid ${LANDING_COLORS.border}`,
            boxShadow: '0 24px 60px rgba(23, 63, 50, 0.12)',
            overflow: 'hidden',
          }}
        >
          {/* BROWSER HEADER BAR */}
          <Box
            sx={{
              px: { xs: 2, sm: 3 },
              py: 1.75,
              bgcolor: '#f1f3f1',
              borderBottom: `1px solid ${LANDING_COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {/* 3 WINDOW CONTROL DOTS */}
            <Stack direction="row" spacing={0.85} alignItems="center">
              <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: '#ef4444' }} />
              <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: '#f59e0b' }} />
              <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: '#10b981' }} />
            </Stack>

            {/* MOCKUP URL BAR */}
            <Box
              sx={{
                flex: 1,
                maxWidth: 480,
                mx: 'auto',
                bgcolor: LANDING_COLORS.white,
                py: 0.6,
                px: 2,
                borderRadius: '8px',
                border: '1px solid #dce2db',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                sx={{
                  fontFamily: FONTS.body,
                  fontSize: '0.78rem',
                  color: LANDING_COLORS.mutedText,
                  fontWeight: 500,
                }}
              >
                https://agri-sort-ai.local/{currentModule.appTarget}
              </Typography>
            </Box>

            {/* STATUS CHIP */}
            <Chip
              label="Live App Preview"
              size="small"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                bgcolor: LANDING_COLORS.leafGreenLight,
                color: LANDING_COLORS.forestGreen,
                fontWeight: 700,
                fontSize: '0.72rem',
              }}
            />
          </Box>

          {/* SCREENSHOT & INFO SPLIT CONTAINER */}
          <Box sx={{ p: { xs: 2.5, sm: 3.5, md: 4 } }}>
            <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
              {/* LEFT: SCREENSHOT IMAGE */}
              <Grid size={{ xs: 12, lg: 7.5 }}>
                <Box
                  sx={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: `1px solid ${LANDING_COLORS.border}`,
                    bgcolor: '#fafafa',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                    maxHeight: { xs: 280, sm: 400, md: 460 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    component="img"
                    src={currentModule.image}
                    alt={currentModule.title}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                      transition: 'opacity 0.3s ease',
                    }}
                  />
                </Box>
              </Grid>

              {/* RIGHT: MODULE DETAILS */}
              <Grid size={{ xs: 12, lg: 4.5 }}>
                <Stack spacing={2.5}>
                  <Box>
                    <Typography
                      sx={{
                        fontFamily: FONTS.body,
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: LANDING_COLORS.leafGreen,
                        mb: 0.5,
                      }}
                    >
                      MODUL SISTEM AKTIF
                    </Typography>

                    <Typography
                      sx={{
                        fontFamily: FONTS.heading,
                        fontWeight: 800,
                        fontSize: { xs: '1.35rem', sm: '1.6rem' },
                        lineHeight: 1.25,
                        color: LANDING_COLORS.forestGreen,
                      }}
                    >
                      {currentModule.title}
                    </Typography>
                  </Box>

                  <Typography
                    sx={{
                      fontFamily: FONTS.body,
                      fontSize: '0.92rem',
                      lineHeight: 1.65,
                      color: LANDING_COLORS.darkText,
                      opacity: 0.88,
                    }}
                  >
                    {currentModule.description}
                  </Typography>

                  {/* HIGHLIGHT PERKS */}
                  <Stack spacing={1.25} sx={{ py: 1 }}>
                    {currentModule.highlights.map((h, i) => (
                      <Stack direction="row" alignItems="flex-start" spacing={1.25} key={i}>
                        <CheckCircleRoundedIcon
                          sx={{
                            fontSize: 18,
                            color: LANDING_COLORS.leafGreen,
                            mt: 0.25,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          sx={{
                            fontFamily: FONTS.body,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: LANDING_COLORS.darkText,
                            lineHeight: 1.5,
                          }}
                        >
                          {h}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>

                  {/* CTA TO OPEN THIS EXACT APP MODULE */}
                  <Box sx={{ pt: 1 }}>
                    <Button
                      onClick={() => onOpenApp(currentModule.appTarget)}
                      variant="contained"
                      endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}
                      sx={{
                        bgcolor: LANDING_COLORS.forestGreen,
                        color: LANDING_COLORS.white,
                        fontFamily: FONTS.body,
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        textTransform: 'none',
                        px: 3,
                        py: 1.3,
                        borderRadius: '10px',
                        boxShadow: '0 4px 14px rgba(23, 63, 50, 0.2)',
                        '&:hover': {
                          bgcolor: LANDING_COLORS.forestGreenLight,
                        },
                      }}
                    >
                      Jelajahi Aplikasi
                    </Button>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
