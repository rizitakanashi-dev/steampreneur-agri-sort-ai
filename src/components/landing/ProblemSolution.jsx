import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded'
import PriceChangeRoundedIcon from '@mui/icons-material/PriceChangeRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded'
import BalanceRoundedIcon from '@mui/icons-material/BalanceRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import { FONTS, LANDING_COLORS } from './constants.js'

const PROBLEMS = [
  {
    icon: TimerRoundedIcon,
    number: '01',
    title: 'Penilaian Kualitas',
    summary: 'Proses penilaian mutu hasil panen secara manual dapat membutuhkan waktu dan ketelitian.',
    detail: 'Memilah buah satu demi satu pada volume puluhan hingga ratusan kilogram menimbulkan kelelahan visual dan inkonsistensi standar.',
  },
  {
    icon: FormatListNumberedRoundedIcon,
    number: '02',
    title: 'Pengelompokan Hasil',
    summary: 'Pembagian hasil panen berdasarkan grade membutuhkan pencatatan dan perhitungan yang terorganisir.',
    detail: 'Tanpa sistematisasi, pembagian Grade A, Grade B, dan buah tolak rentan tercecer sehingga sulit menghitung persentase riil panen.',
  },
  {
    icon: PriceChangeRoundedIcon,
    number: '03',
    title: 'Estimasi Nilai Panen',
    summary: 'Petani membutuhkan gambaran nilai hasil panen berdasarkan kualitas dan harga acuan.',
    detail: 'Ketimpangan informasi acuan harga pasar menyulitkan estimasi pendapatan riil dan sering melemahkan posisi tawar saat transaksi.',
  },
]

const SOLUTIONS = [
  {
    icon: SpeedRoundedIcon,
    title: 'Efisiensi Waktu Lapangan',
    description: 'Pencatatan dan analisis mutu panen dilakukan cepat dalam hitungan detik melalui antarmuka web yang intuitif.',
  },
  {
    icon: BalanceRoundedIcon,
    title: 'Standardisasi Grade yang Jelas',
    description: 'Sistem mengelompokkan hasil ke Grade A, Grade B, dan C/Reject secara objektif dengan parameter yang transparan.',
  },
  {
    icon: InsightsRoundedIcon,
    title: 'Kalkulasi Nilai Berbasis Acuan Pasar',
    description: 'Estimasi nilai ekonomi dihitung otomatis menggunakan formula tertimbang dan referensi harga pasar (BAPANAS).',
  },
]

export function ProblemSolution({ onOpenApp }) {
  return (
    <Box
      component="section"
      sx={{
        py: { xs: 8, sm: 10, md: 14 },
        bgcolor: LANDING_COLORS.creamLight,
        position: 'relative',
        borderTop: `1px solid ${LANDING_COLORS.border}`,
        borderBottom: `1px solid ${LANDING_COLORS.border}`,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3, md: 4 } }}>
        {/* SECTION HEADER */}
        <Stack
          alignItems="center"
          spacing={2}
          sx={{
            textAlign: 'center',
            maxWidth: 780,
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
            TANTANGAN &amp; SOLUSI DIGITAL
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
            Setiap Hasil Panen Memiliki Nilai. Kenali Potensinya.
          </Typography>

          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: { xs: '0.98rem', sm: '1.08rem' },
              lineHeight: 1.65,
              color: LANDING_COLORS.mutedText,
            }}
          >
            Pengelolaan hasil panen membutuhkan ketelitian. Agri-Sort AI hadir untuk membantu proses pencatatan, pengelompokan kualitas, dan estimasi nilai panen menjadi lebih praktis.
          </Typography>
        </Stack>

        {/* 3 PROBLEM CARDS */}
        <Box sx={{ mb: { xs: 7, md: 9 } }}>
          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: '0.85rem',
              fontWeight: 700,
              color: LANDING_COLORS.darkText,
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box component="span" sx={{ width: 18, height: 2, bgcolor: '#d9534f', display: 'inline-block' }} />
            Tantangan Pengelolaan Panen Saat Ini:
          </Typography>

          <Grid container spacing={3}>
            {PROBLEMS.map((problem) => {
              const Icon = problem.icon
              return (
                <Grid key={problem.number} size={{ xs: 12, md: 4 }}>
                  <Card
                    sx={{
                      height: '100%',
                      bgcolor: LANDING_COLORS.white,
                      borderRadius: '16px',
                      border: `1px solid ${LANDING_COLORS.border}`,
                      boxShadow: '0 4px 16px rgba(23, 63, 50, 0.04)',
                      transition: 'all 0.25s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 12px 32px rgba(23, 63, 50, 0.09)',
                        borderColor: LANDING_COLORS.leafGreen,
                      },
                    }}
                  >
                    <CardContent sx={{ p: { xs: 3, sm: 3.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between', mb: 2.5 }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '12px',
                            bgcolor: 'rgba(217, 83, 79, 0.08)',
                            color: '#c9302c',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon fontSize="small" />
                        </Box>
                        <Typography
                          sx={{
                            fontFamily: FONTS.stats,
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            color: 'rgba(23, 63, 50, 0.25)',
                          }}
                        >
                          {problem.number}
                        </Typography>
                      </Stack>

                      <Typography
                        sx={{
                          fontFamily: FONTS.heading,
                          fontWeight: 800,
                          fontSize: '1.2rem',
                          color: LANDING_COLORS.darkText,
                          mb: 1.25,
                        }}
                      >
                        {problem.title}
                      </Typography>

                      <Typography
                        sx={{
                          fontFamily: FONTS.body,
                          fontSize: '0.92rem',
                          color: LANDING_COLORS.darkText,
                          fontWeight: 600,
                          lineHeight: 1.5,
                          mb: 1.5,
                        }}
                      >
                        {problem.summary}
                      </Typography>

                      <Typography
                        sx={{
                          fontFamily: FONTS.body,
                          fontSize: '0.85rem',
                          color: LANDING_COLORS.mutedText,
                          lineHeight: 1.6,
                          mt: 'auto',
                        }}
                      >
                        {problem.detail}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        </Box>

        {/* SOLUTION BANNER CARD */}
        <Box
          sx={{
            bgcolor: LANDING_COLORS.forestGreen,
            borderRadius: '24px',
            p: { xs: 3.5, sm: 5, md: 6 },
            color: LANDING_COLORS.white,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(23, 63, 50, 0.25)',
          }}
        >
          {/* BACKGROUND GLOW */}
          <Box
            sx={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(117, 169, 106, 0.25) 0%, rgba(23, 63, 50, 0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, lg: 5 }}>
              <Stack spacing={2}>
                <Typography
                  sx={{
                    fontFamily: FONTS.body,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: LANDING_COLORS.leafGreen,
                  }}
                >
                  JAWABAN KAMI
                </Typography>

                <Typography
                  sx={{
                    fontFamily: FONTS.heading,
                    fontWeight: 800,
                    fontSize: { xs: '1.65rem', sm: '2rem' },
                    lineHeight: 1.2,
                    color: LANDING_COLORS.white,
                  }}
                >
                  Agri-Sort AI Menjawab Kebutuhan Sortasi Lapangan
                </Typography>

                <Typography
                  sx={{
                    fontFamily: FONTS.body,
                    fontSize: '0.92rem',
                    lineHeight: 1.65,
                    color: 'rgba(255, 255, 255, 0.82)',
                  }}
                >
                  Dirancang dari pengalaman riil pertanian di Sumatera Barat, Agri-Sort AI memadukan kepraktisan perangkat lunak dengan kecermatan kalkulasi untuk menunjang transaksi hasil panen yang transparan dan adil.
                </Typography>

                <Box sx={{ pt: 1 }}>
                  <Button
                    onClick={() => onOpenApp('overview')}
                    variant="contained"
                    endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      bgcolor: LANDING_COLORS.leafGreen,
                      color: LANDING_COLORS.white,
                      fontFamily: FONTS.body,
                      fontWeight: 700,
                      textTransform: 'none',
                      px: 3,
                      py: 1.25,
                      borderRadius: '10px',
                      '&:hover': {
                        bgcolor: '#629358',
                      },
                    }}
                  >
                    Buka Dashboard Solusi
                  </Button>
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, lg: 7 }}>
              <Stack spacing={2.5}>
                {SOLUTIONS.map((sol) => {
                  const Icon = sol.icon
                  return (
                    <Box
                      key={sol.title}
                      sx={{
                        p: 2.25,
                        bgcolor: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '14px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        backdropFilter: 'blur(8px)',
                        transition: 'background-color 0.2s ease',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.14)' },
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '10px',
                            bgcolor: 'rgba(117, 169, 106, 0.25)',
                            color: LANDING_COLORS.leafGreen,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            mt: 0.25,
                          }}
                        >
                          <Icon fontSize="small" />
                        </Box>
                        <Box>
                          <Typography
                            sx={{
                              fontFamily: FONTS.heading,
                              fontWeight: 700,
                              fontSize: '1rem',
                              color: LANDING_COLORS.white,
                              mb: 0.5,
                            }}
                          >
                            {sol.title}
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: FONTS.body,
                              fontSize: '0.85rem',
                              lineHeight: 1.55,
                              color: 'rgba(255, 255, 255, 0.78)',
                            }}
                          >
                            {sol.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  )
                })}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  )
}
