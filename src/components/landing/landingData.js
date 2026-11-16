import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded'
import PieChartRoundedIcon from '@mui/icons-material/PieChartRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import AgricultureRoundedIcon from '@mui/icons-material/AgricultureRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import { AGRI_COLORS, AGRI_STAGE_GRADIENTS } from './tokens.js'

export const NAV_LINKS = [
  { label: 'Beranda', href: '#beranda' },
  { label: 'Fitur', href: '#fitur' },
  { label: 'Cara Kerja', href: '#cara-kerja' },
  { label: 'Pratinjau', href: '#dashboard' },
  { label: 'Komoditas', href: '#komoditas' },
  { label: 'Tentang Kami', href: '#tentang-kami' },
]

export const TEAM_INFO = {
  school: 'SMK Negeri 4 Payakumbuh',
  location: 'Payakumbuh, Sumatera Barat',
  competition: 'STEAMPreneur SMK Tingkat Nasional 2026',
  members: [
    { name: 'Faris Al Farizi', role: 'Ketua & Machine Learning Engineer' },
    { name: 'Hieray Antovino', role: 'Fullstack Engineer & QA' },
    { name: 'Ahmad Afif', role: 'Analis Bisnis & Dokumentator' },
  ],
  mentor: 'Rogi Auvi, S.Pd',
  tagline: 'Smarter Harvest. Better Value.',
  supportingTagline: 'A Smarter Way to Understand Your Harvest.',
}

export const PROBLEM_VS_SOLUTION = [
  {
    problemTitle: 'Sortir Manual Lambat & Subjektif',
    problemDetail: 'Menilai puluhan keranjang dengan mata telanjang memicu bias mutu dan kelelahan.',
    solutionTitle: 'Deteksi YOLO11n dalam Hitungan Milidetik',
    solutionDetail: 'Model Computer Vision otomatis membagi setiap buah ke Grade A, Grade B, dan Reject.',
  },
  {
    problemTitle: 'Cacat Tersembunyi di Dasar Keranjang',
    problemDetail: 'Tumpukan buah menutupi buah busuk di lapisan bawah saat transaksi pengepul.',
    solutionTitle: 'Inspeksi Multi-Sudut Anti-Oklusi',
    solutionDetail: 'Gabungkan foto depan dan sesudah goyang nampan dengan aturan Zero-Defect Escape.',
  },
  {
    problemTitle: 'Harga Jual Tidak Transparan',
    problemDetail: 'Petani sering menerima potongan borongan tanpa rincian bobot per mutu.',
    solutionTitle: 'Smart Pricing BAPANAS & SP2KP Kemendag',
    solutionDetail: 'Nilai jual dihitung otomatis per grade (1.15x / 0.80x / 0x) sesuai acuan harga resmi.',
  },
]

export const FEATURE_STAGES = [
  {
    id: 'yolo-3class',
    gradient: AGRI_STAGE_GRADIENTS.harvestEmerald,
    headline: 'DETEKSI MUTU 3-CLASS INSTAN',
    body: 'Arahkan kamera ke keranjang panen. Mesin YOLO11n langsung menghitung jumlah Grade A, Grade B, dan Reject pada Tomat, Terung, serta Cabai tanpa mesin sortir mahal.',
    bullets: [
      'Seragam 3-Class komersial di seluruh komoditas',
      'Live bounding box & skor keyakinan per buah',
      'Validasi ketajaman gambar & pencahayaan otomatis',
    ],
    mockupType: 'scanner',
    mascot: 'tomato',
    reverse: false,
  },
  {
    id: 'multi-angle',
    gradient: AGRI_STAGE_GRADIENTS.canopyTeal,
    headline: 'INSPEKSI 2-SISI ANTI-OKLUSI',
    body: 'Ambil foto sisi pertama, goyang nampan, lalu foto sisi kedua. Algoritma otomatis mencegah foto duplikat dan mendeteksi disparitas busuk tersembunyi.',
    bullets: [
      'Verifikasi sidik foto mencegah unggahan kembar',
      'Prinsip Zero-Defect Escape untuk kelas Reject',
      'Peringatan otomatis bila selisih cacat >= 15%',
    ],
    mockupType: 'multiAngle',
    mascot: 'eggplant',
    reverse: true,
  },
  {
    id: 'smart-pricing',
    gradient: AGRI_STAGE_GRADIENTS.harvestGold,
    headline: 'SMART PRICING LIVE PASAR',
    body: 'Tidak ada lagi taksiran harga sepihak. Nilai batch langsung dihitung dari rasio berat tiap grade terhadap feed harga BAPANAS dan SP2KP Kemendag RI.',
    bullets: [
      'Grade A (1.15x), Grade B (0.80x), Reject (Rp 0)',
      'Triangulasi acuan harga BAPANAS & SP2KP harian',
      'Kalkulator ROI & Break-Even Point petani',
    ],
    mockupType: 'pricing',
    mascot: 'chili',
    reverse: false,
  },
  {
    id: 'recap-pwa',
    gradient: AGRI_STAGE_GRADIENTS.tomatoCrimson,
    headline: 'REKAP OFFLINE & SERTIFIKAT A4',
    body: 'Dirancang siap lapangan dengan dukungan PWA offline, ekspor CSV standar Excel, serta pencetakan Sertifikat Mutu QC A4 terverifikasi untuk transaksi pengepul.',
    bullets: [
      'Penyimpanan lokal aman di peramban petani',
      'Ekspor laporan CSV RFC 4180 siap buka di Excel',
      'Cetak Sertifikat Mutu A4 & rekomendasi patologi',
    ],
    mockupType: 'certificate',
    mascot: 'bot',
    reverse: true,
  },
]

export const HOW_IT_WORKS_STEPS = [
  {
    step: 'LANGKAH 1',
    title: 'PILIH KOMODITAS & SCAN',
    description: 'Pilih Tomat, Terung, atau Cabai lalu ambil foto keranjang dari kamera langsung atau unggah berkas.',
    accent: AGRI_COLORS.teal,
  },
  {
    step: 'LANGKAH 2',
    title: 'AI PETAKAN 3 GRADE',
    description: 'YOLO11n mengelompokkan buah ke Grade A, Grade B, dan Reject beserta persentase bobot aktual.',
    accent: AGRI_COLORS.leafGlow,
  },
  {
    step: 'LANGKAH 3',
    title: 'PRICING & SERTIFIKAT A4',
    description: 'Dapatkan estimasi harga resmi BAPANAS/SP2KP dan cetak Sertifikat QC A4 atau ekspor ke Excel.',
    accent: AGRI_COLORS.gold,
  },
]

export const PREVIEW_TABS = [
  {
    id: 'dashboard',
    label: 'Dashboard Utama',
    icon: DashboardRoundedIcon,
    appTarget: 'overview',
    title: 'Ringkasan Eksekutif & Acuan Pasar',
    description: 'Pantau metrik batch tersimpan, status harga BAPANAS & SP2KP Kemendag RI, serta akses cepat ke batch terakhir.',
    highlights: [
      'Indikator kesiapan sistem & status PWA offline',
      'Acuan harga BAPANAS & SP2KP Kemendag terverifikasi',
      'Kartu batch terbaru lengkap dengan estimasi nilai jual',
    ],
  },
  {
    id: 'scanner',
    label: 'Batch QC Scanner',
    icon: QrCodeScannerRoundedIcon,
    appTarget: 'scanner',
    title: 'Inspeksi Mutu Keranjang Panen',
    description: 'Mendukung kamera langsung dan unggah foto 1-sisi maupun 2-sisi untuk komoditas Tomat, Terung, dan Cabai.',
    highlights: [
      'Model aktif: Tomat, Terung, & Cabai (YOLO11n 3-Class)',
      'Mode Multi-Angle 2-Sisi anti-oklusi bawaan',
      'Ambang batas keyakinan & cek kualitas foto otomatis',
    ],
  },
  {
    id: 'results',
    label: 'Hasil Analisis',
    icon: AssessmentRoundedIcon,
    appTarget: 'results',
    title: 'Visualisasi Sebaran Grade & Smart Pricing',
    description: 'Diagram Donut interaktif untuk sebaran Grade A, Grade B, Reject beserta estimasi nilai panen dan Sertifikat QC.',
    highlights: [
      'Donut Chart proporsi Grade A, Grade B, dan Reject',
      'Formula harga tertimbang 1.15x / 0.80x / 0x',
      'Penerbitan Sertifikat Mutu QC standar cetak A4',
    ],
  },
  {
    id: 'recap',
    label: 'Rekap Panen',
    icon: TableChartRoundedIcon,
    appTarget: 'results-list',
    title: 'Manajemen Inventaris & Ekspor CSV',
    description: 'Kelola riwayat seluruh batch panen dengan pencarian instan, hapus satuan aman, dan ekspor laporan Excel.',
    highlights: [
      'Pencarian real-time berdasarkan ID batch & komoditas',
      'Penghapusan satuan aman dengan dialog konfirmasi',
      'Ekspor CSV RFC 4180 langsung dari hasil scan AI',
    ],
  },
]

export const COMMODITY_MODELS = [
  {
    id: 'tomat',
    name: 'Tomat',
    latin: 'Solanum lycopersicum',
    badge: 'YOLO11n 3-Class',
    accent: AGRI_COLORS.crimson,
    refPrice: 'Rp 12.000/kg',
    description: 'Model 3-Class terbaru untuk pemilahan kematangan, keseragaman kulit, dan pemisahan buah busuk atau pecah secara instan.',
    grades: [
      { name: 'Grade A', spec: 'Segar, kematangan seragam, kulit mulus bebas memar' },
      { name: 'Grade B', spec: 'Kematangan bervariasi atau goresan ringan layak olahan' },
      { name: 'Reject', spec: 'Busuk basah, bercak jamur/antraknosa, atau pecah parah' },
    ],
  },
  {
    id: 'terung',
    name: 'Terung',
    latin: 'Solanum melongena',
    badge: 'YOLO11n 3-Class',
    accent: AGRI_COLORS.teal,
    refPrice: 'Rp 10.000/kg',
    description: 'Deteksi mutu buah terung per butir untuk memilah kelurusan bentuk, kilau ungu kulit, dan serangan hama pengerek.',
    grades: [
      { name: 'Grade A', spec: 'Bentuk proporsional lurus, ungu mengkilap tanpa cacat' },
      { name: 'Grade B', spec: 'Kelengkungan wajar <15% dengan goresan superfisial' },
      { name: 'Reject', spec: 'Busuk lunak, lubang ulat/hama, atau busuk tangkai' },
    ],
  },
  {
    id: 'cabai',
    name: 'Cabai',
    latin: 'Capsicum annuum / frutescens',
    badge: 'YOLO11n 3-Class',
    accent: AGRI_COLORS.gold,
    refPrice: 'Rp 42.000/kg',
    description: 'Model 3-Class presisi tinggi untuk mengidentifikasi kesegaran buah cabai dan mencegah kontaminasi antraknosa (patek).',
    grades: [
      { name: 'Grade A', spec: 'Segar, warna cerah merata, bebas bercak & busuk tangkai' },
      { name: 'Grade B', spec: 'Bercak permukaan ringan, ukuran variatif, daging padat' },
      { name: 'Reject', spec: 'Terserang patek/antraknosa, busuk basah, atau berulat' },
    ],
  },
]

export const TARGET_USERS = [
  {
    role: 'Petani Hortikultura',
    icon: AgricultureRoundedIcon,
    accent: AGRI_COLORS.leafGlow,
    headline: 'Posisi Tawar Kuat di Kebun',
    benefit: 'Ketahui persentase mutu dan nilai wajar panen sebelum negosiasi dengan pengepul.',
    points: ['Estimasi pendapatan sebelum transaksi', 'Pisahkan buah reject sebelum menular', 'Simulasi margin & BEP budidaya'],
  },
  {
    role: 'Pedagang Pengumpul',
    icon: LocalShippingRoundedIcon,
    accent: AGRI_COLORS.teal,
    headline: 'Sortir Keranjang Lebih Cepat',
    benefit: 'Periksa puluhan keranjang secara objektif dengan standar harga beli yang transparan.',
    points: ['Standar grading 3-Class tanpa bias mata', 'Deteksi 2-sisi cegah busuk dasar keranjang', 'Rekap transaksi tersimpan otomatis'],
  },
  {
    role: 'Pedagang Pasar & Grosir',
    icon: StorefrontRoundedIcon,
    accent: AGRI_COLORS.gold,
    headline: 'Tekan Risiko Susut Pasokan',
    benefit: 'Terima pasokan tersertifikasi dengan komposisi grade jelas sesuai segmen pembeli.',
    points: ['Sertifikat QC A4 pendamping pengiriman', 'Rekomendasi patologi pasca panen', 'Keselarasan grade dengan harga BAPANAS'],
  },
]

export const FEATURE_QUICK_ICONS = [
  AssignmentRoundedIcon,
  PieChartRoundedIcon,
  TrendingUpRoundedIcon,
  TableChartRoundedIcon,
]
