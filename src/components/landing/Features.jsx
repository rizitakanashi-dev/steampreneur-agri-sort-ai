import {
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded'
import PieChartRoundedIcon from '@mui/icons-material/PieChartRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { FONTS, LANDING_COLORS } from './constants.js'

const FEATURES = [
  {
    icon: AssignmentRoundedIcon,
    tag: 'FITUR 01',
    title: 'Harvest Input',
    description: 'Catat jenis komoditas, berat hasil panen, dan parameter mutu dalam satu sistem.',
    perks: [
      'Multi-komoditas: Cabai, Terung, Tomat',
      'Validasi batas bobot & toleransi kalkulasi presisi',
      'Mendukung input manual & inspeksi foto keranjang',
    ],
  },
  {
    icon: PieChartRoundedIcon,
    tag: 'FITUR 02',
    title: 'Quality Grading',
    description: 'Kelompokkan hasil panen ke dalam kategori kualitas Grade A, B, dan C.',
    perks: [
      'Pembagian grade komersial yang transparan',
      'Visualisasi Donut Chart proporsi mutu panen',
      'Rekomendasi tindakan pasca panen & culling',
    ],
  },
  {
    icon: TrendingUpRoundedIcon,
    tag: 'FITUR 03',
    title: 'Smart Pricing',
    description: 'Dapatkan estimasi nilai panen berdasarkan distribusi grade dan harga acuan.',
    perks: [
      'Terhubung ke Panel Harga BAPANAS harian',
      'Formula pembobotan nilai per grade mutu',
      'Kalkulator proyeksi keuntungan & margin petani',
    ],
  },
  {
    icon: TableChartRoundedIcon,
    tag: 'FITUR 04',
    title: 'Harvest Recap',
    description: 'Pantau riwayat panen, statistik hasil, serta ekspor laporan untuk kebutuhan evaluasi.',
    perks: [
      'Penyimpanan riwayat batch lokal terorganisir',
      'Pencarian real-time & filter rentang tanggal',
      'Ekspor laporan resmi ke format CSV (Excel) & Cetak A4',
    ],
  },
]

export function Features() {
  return (
    <Box
      id="fitur"
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
            maxWidth: 720,
            mx: 'auto',
            mb: { xs: 6, sm: 8, md: 9 },
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
            KAPABILITAS UTAMA
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
            Semua Kebutuhan Panen dalam Satu Platform.
          </Typography>

          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: { xs: '0.98rem', sm: '1.08rem' },
              lineHeight: 1.65,
              color: LANDING_COLORS.mutedText,
            }}
          >
            Fitur sederhana dan informatif untuk membantu pengelolaan hasil panen hortikultura.
          </Typography>
        </Stack>

        {/* 4 FEATURE CARDS GRID */}
        <Grid container spacing={3.5}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <Grid key={feature.title} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Card
                  sx={{
                    height: '100%',
                    bgcolor: LANDING_COLORS.white,
                    borderRadius: '18px',
                    border: `1px solid ${LANDING_COLORS.border}`,
                    boxShadow: '0 4px 20px rgba(23, 63, 50, 0.04)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: '0 16px 36px rgba(23, 63, 50, 0.1)',
                      borderColor: LANDING_COLORS.leafGreen,
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      p: { xs: 3, sm: 3.5 },
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* ICON & TAG */}
                    <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between', mb: 2.5 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '12px',
                          bgcolor: 'rgba(117, 169, 106, 0.14)',
                          color: LANDING_COLORS.forestGreen,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        <Icon sx={{ fontSize: 24 }} />
                      </Box>
                      <Typography
                        sx={{
                          fontFamily: FONTS.body,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          color: LANDING_COLORS.leafGreen,
                          bgcolor: LANDING_COLORS.leafGreenLight,
                          px: 1.25,
                          py: 0.35,
                          borderRadius: '6px',
                        }}
                      >
                        {feature.tag}
                      </Typography>
                    </Stack>

                    {/* TITLE */}
                    <Typography
                      sx={{
                        fontFamily: FONTS.heading,
                        fontWeight: 800,
                        fontSize: '1.25rem',
                        color: LANDING_COLORS.forestGreen,
                        mb: 1.25,
                      }}
                    >
                      {feature.title}
                    </Typography>

                    {/* DESCRIPTION */}
                    <Typography
                      sx={{
                        fontFamily: FONTS.body,
                        fontSize: '0.9rem',
                        lineHeight: 1.6,
                        color: LANDING_COLORS.darkText,
                        opacity: 0.85,
                        mb: 2.5,
                      }}
                    >
                      {feature.description}
                    </Typography>

                    {/* PERKS LIST */}
                    <Stack spacing={1} sx={{ mt: 'auto', pt: 2, borderTop: `1px solid ${LANDING_COLORS.borderLight}` }}>
                      {feature.perks.map((perk, idx) => (
                        <Stack direction="row" alignItems="flex-start" spacing={1} key={idx}>
                          <CheckCircleRoundedIcon
                            sx={{
                              fontSize: 15,
                              color: LANDING_COLORS.leafGreen,
                              mt: 0.25,
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            sx={{
                              fontFamily: FONTS.body,
                              fontSize: '0.78rem',
                              lineHeight: 1.45,
                              color: LANDING_COLORS.mutedText,
                              fontWeight: 500,
                            }}
                          >
                            {perk}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      </Container>
    </Box>
  )
}
