import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import AgricultureRoundedIcon from '@mui/icons-material/AgricultureRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { FONTS, LANDING_COLORS } from './constants.js'

const COMMODITIES = [
  {
    name: 'Cabai Rawit Hijau',
    latin: 'Capsicum frutescens',
    image: '/images/chilies.jpg',
    badge: 'Komoditas Unggulan',
    description: 'Komoditas hortikultura dengan risiko susut pasca panen cepat. Sistem memfasilitasi pencatatan bobot dan pemisahan cabai segar dari risiko antraknosa.',
    grades: [
      { name: 'Grade A', spec: 'Tangkai segar hijau, kulit mengkilap, bebas bercak/busuk' },
      { name: 'Grade B', spec: 'Ukuran variatif, sedikit layu, tidak ada busuk basah' },
      { name: 'Reject', spec: 'Busuk basah, berjamur, atau terserang patek (antraknosa)' },
    ],
  },
  {
    name: 'Terung Ungu',
    latin: 'Solanum melongena',
    image: '/images/eggplants.jpg',
    badge: 'Model Klasifikasi 4-Kelas',
    description: 'Didukung model deteksi 4 kelas komersial (Extra Class, Class I, Class II, Reject) untuk memilah kelurusan buah, kilau kulit, dan cacat fisik.',
    grades: [
      { name: 'Extra Class', spec: 'Bentuk sempurna, warna ungu tua pekat mengkilap, kelopak hijau' },
      { name: 'Class I & II', spec: 'Bentuk sedikit melengkung, warna baik, cacat kulit superfisial' },
      { name: 'Reject', spec: 'Luka tusuk hama, busuk lunak, kelopak kering menghitam' },
    ],
  },
  {
    name: 'Tomat Segar',
    latin: 'Solanum lycopersicum',
    image: '/images/tomatoes.jpg',
    badge: 'Volume Panen Tinggi',
    description: 'Fokus pada kecepatan sortasi massal untuk memisahkan tomat matang prima dari buah pecah atau berpenyakit sebelum dikemas ke keranjang.',
    grades: [
      { name: 'Grade A', spec: 'Kematangan seragam, padat, kulit mulus tanpa luka robek' },
      { name: 'Grade B', spec: 'Kematangan variatif (semburat hijau/kuning), layak konsumsi' },
      { name: 'Reject', spec: 'Retak parah, busuk ujung buah (BER), atau berjamur' },
    ],
  },
]

const TARGET_USERS = [
  {
    role: 'Petani Hortikultura',
    icon: AgricultureRoundedIcon,
    image: '/images/farmer-inspect.jpg',
    headline: 'Posisi Tawar Lebih Kuat di Kebun',
    benefit: 'Petani dapat mengetahui taksiran grade kualitas dan estimasi nilai jual panen sebelum menyerahkan hasil ke pengepul, sehingga negosiasi harga menjadi lebih transparan.',
    points: ['Mengetahui estimasi pendapatan sebelum jual', 'Deteksi cepat buah reject agar tidak merusak batch', 'Simulasi margin keuntungan budidaya'],
  },
  {
    role: 'Pedagang Pengumpul (Toke)',
    icon: LocalShippingRoundedIcon,
    image: '/images/harvest-crate.jpg',
    headline: 'Sortir Keranjang Cepat & Transaksi Rapi',
    benefit: 'Pengepul dapat memilah puluhan keranjang panen dalam waktu singkat, menetapkan harga beli berbasis grade objektif, dan mencatat rekap transaksi harian otomatis.',
    points: ['Mempercepat proses grading hingga >90%', 'Standar mutu tertulis tanpa subjektivitas mata', 'Riwayat nota dan rekap timbangan tersimpan'],
  },
  {
    role: 'Penjual di Pasar & Grosir',
    icon: StorefrontRoundedIcon,
    image: '/images/trader-market.jpg',
    headline: 'Jaminan Mutu & Minimalisasi Susut',
    benefit: 'Pedagang pasar induk memastikan pasokan sayur yang diterima bebas dari buah busuk terselubung, menekan risiko susut dagangan, dan menjaga loyalitas pelanggan.',
    points: ['Mencegah penularan busuk dalam peti kemas', 'Sertifikat mutu digital untuk kepastian pasokan', 'Kesesuaian grade dengan segmen harga pasar'],
  },
]

export function Commodities() {
  return (
    <Box
      id="komoditas"
      component="section"
      sx={{
        py: { xs: 8, sm: 10, md: 14 },
        bgcolor: LANDING_COLORS.creamLight,
        position: 'relative',
        borderTop: `1px solid ${LANDING_COLORS.border}`,
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
            mb: { xs: 6, sm: 8 },
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
            KOMODITAS &amp; EKOSISTEM
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
            Dirancang untuk Mendukung Ekosistem Hortikultura.
          </Typography>

          <Typography
            sx={{
              fontFamily: FONTS.body,
              fontSize: { xs: '0.98rem', sm: '1.08rem' },
              lineHeight: 1.65,
              color: LANDING_COLORS.mutedText,
            }}
          >
            Agri-Sort AI berfokus pada pengelolaan kualitas beberapa komoditas hortikultura strategis bernilai tinggi.
          </Typography>
        </Stack>

        {/* 3 COMMODITY CARDS */}
        <Grid container spacing={3.5} sx={{ mb: { xs: 8, md: 12 } }}>
          {COMMODITIES.map((item) => (
            <Grid key={item.name} size={{ xs: 12, md: 4 }}>
              <Card
                sx={{
                  height: '100%',
                  bgcolor: LANDING_COLORS.white,
                  borderRadius: '20px',
                  border: `1px solid ${LANDING_COLORS.border}`,
                  overflow: 'hidden',
                  boxShadow: '0 6px 24px rgba(23, 63, 50, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 16px 36px rgba(23, 63, 50, 0.1)',
                    borderColor: LANDING_COLORS.leafGreen,
                  },
                }}
              >
                {/* COMMODITY PHOTOGRAPH */}
                <Box
                  sx={{
                    position: 'relative',
                    height: 220,
                    width: '100%',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="img"
                    src={item.image}
                    alt={item.name}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.4s ease',
                      '&:hover': { transform: 'scale(1.05)' },
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      bgcolor: 'rgba(23, 63, 50, 0.88)',
                      backdropFilter: 'blur(8px)',
                      color: LANDING_COLORS.white,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: '8px',
                      fontFamily: FONTS.body,
                      fontWeight: 700,
                      fontSize: '0.72rem',
                    }}
                  >
                    {item.badge}
                  </Box>
                </Box>

                <CardContent sx={{ p: { xs: 3, sm: 3.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography
                      sx={{
                        fontFamily: FONTS.heading,
                        fontWeight: 800,
                        fontSize: '1.35rem',
                        color: LANDING_COLORS.forestGreen,
                      }}
                    >
                      {item.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: FONTS.body,
                        fontStyle: 'italic',
                        fontSize: '0.8rem',
                        color: LANDING_COLORS.leafGreen,
                      }}
                    >
                      {item.latin}
                    </Typography>
                  </Box>

                  <Typography
                    sx={{
                      fontFamily: FONTS.body,
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      color: LANDING_COLORS.darkText,
                      opacity: 0.85,
                      mb: 2.5,
                    }}
                  >
                    {item.description}
                  </Typography>

                  {/* GRADE SPECIFICATIONS */}
                  <Box sx={{ mt: 'auto', pt: 2, borderTop: `1px solid ${LANDING_COLORS.borderLight}` }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: LANDING_COLORS.forestGreen, mb: 1.25 }}>
                      Panduan Standar Grade:
                    </Typography>
                    <Stack spacing={0.85}>
                      {item.grades.map((g) => (
                        <Box key={g.name} sx={{ p: 1, bgcolor: LANDING_COLORS.warmCream, borderRadius: '8px' }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: LANDING_COLORS.darkText }}>
                            {g.name}:{' '}
                            <Box component="span" sx={{ fontWeight: 400, color: LANDING_COLORS.mutedText }}>
                              {g.spec}
                            </Box>
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* TARGET USERS SECTION */}
        <Box sx={{ pt: 2 }}>
          <Stack
            alignItems="center"
            spacing={1.5}
            sx={{
              textAlign: 'center',
              maxWidth: 700,
              mx: 'auto',
              mb: { xs: 5, sm: 6 },
            }}
          >
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
              PENERIMA MANFAAT
            </Typography>

            <Typography
              component="h3"
              sx={{
                fontFamily: FONTS.heading,
                fontSize: { xs: '1.6rem', sm: '2.1rem' },
                fontWeight: 800,
                color: LANDING_COLORS.forestGreen,
              }}
            >
              Solusi Tepat untuk Setiap Pelaku Rantai Pasok
            </Typography>
          </Stack>

          <Grid container spacing={3.5}>
            {TARGET_USERS.map((user) => {
              const Icon = user.icon
              return (
                <Grid key={user.role} size={{ xs: 12, md: 4 }}>
                  <Card
                    sx={{
                      height: '100%',
                      bgcolor: LANDING_COLORS.white,
                      borderRadius: '20px',
                      border: `1px solid ${LANDING_COLORS.border}`,
                      overflow: 'hidden',
                      boxShadow: '0 4px 20px rgba(23, 63, 50, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Box sx={{ height: 160, width: '100%', overflow: 'hidden', position: 'relative' }}>
                      <Box
                        component="img"
                        src={user.image}
                        alt={user.role}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 12,
                          left: 12,
                          bgcolor: LANDING_COLORS.forestGreen,
                          color: LANDING_COLORS.white,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                        }}
                      >
                        <Icon sx={{ fontSize: 16, color: LANDING_COLORS.leafGreen }} />
                        <Typography sx={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: '0.75rem' }}>
                          {user.role}
                        </Typography>
                      </Box>
                    </Box>

                    <CardContent sx={{ p: { xs: 3, sm: 3.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Typography
                        sx={{
                          fontFamily: FONTS.heading,
                          fontWeight: 800,
                          fontSize: '1.15rem',
                          color: LANDING_COLORS.darkText,
                          mb: 1.25,
                        }}
                      >
                        {user.headline}
                      </Typography>

                      <Typography
                        sx={{
                          fontFamily: FONTS.body,
                          fontSize: '0.88rem',
                          lineHeight: 1.6,
                          color: LANDING_COLORS.mutedText,
                          mb: 2,
                        }}
                      >
                        {user.benefit}
                      </Typography>

                      <Stack spacing={0.8} sx={{ mt: 'auto', pt: 1.5, borderTop: `1px solid ${LANDING_COLORS.borderLight}` }}>
                        {user.points.map((pt, i) => (
                          <Stack direction="row" alignItems="center" spacing={1} key={i}>
                            <CheckCircleRoundedIcon sx={{ fontSize: 15, color: LANDING_COLORS.leafGreen }} />
                            <Typography sx={{ fontFamily: FONTS.body, fontSize: '0.78rem', color: LANDING_COLORS.darkText, fontWeight: 600 }}>
                              {pt}
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
        </Box>
      </Container>
    </Box>
  )
}
