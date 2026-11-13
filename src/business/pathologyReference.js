/**
 * Modul Referensi Patologi Pascapanen & Edukasi Agronomis (Pilar STEAM: Science)
 * Tanggung Jawab: Fullstack Developer (STEAM Science Integration)
 * Dokumen Acuan: Proposal STEAMPreneur SMK 2026 (Pilar Science & Bab 3.2) & AUDIT-AGRI-SORT-AI
 *
 * Menyediakan basis pengetahuan ilmiah terstruktur tentang agen mikrobiologis,
 * patogen jamur/bakteri, gangguan fisiologis pascapanen, dan tindakan mitigasi presisi
 * untuk komoditas hortikultura strategis (Cabai, Tomat, Terung).
 */

export const POST_HARVEST_PATHOLOGY_DATA = Object.freeze({
  anthracnose: Object.freeze({
    id: 'anthracnose',
    name: 'Antraknosa / Patek',
    scientificName: 'Colletotrichum capsici & C. gloeosporioides',
    agentType: 'Jamur (Fungi - Ascomycota)',
    affectedCommodities: ['Cabai Merah Keriting', 'Cabai Rawit Merah', 'Cabai Rawit Hijau', 'Terung', 'Tomat'],
    macroscopicSymptoms:
      'Bercak cekung melingkar konsentris (sunken lesions), jaringan buah membusuk lunak dengan massa spora berwarna oranye hingga merah salmon saat udara lembap.',
    postHarvestMechanism:
      'Spora menyebar sangat cepat melalui kelembapan tinggi (>85% RH) dan tetesan air di dalam keranjang panen. Infeksi laten pada buah mentah meledak saat buah mulai memerah.',
    mitigationAction:
      'Segera lakukan pemilahan (culling) buah yang berbercak; jangan mencuci buah dengan air dingin tanpa klorinasi; pastikan keranjang berventilasi baik dan gunakan alas penyerap air.',
    severityGrade: 'Reject',
    preventionTips:
      'Petik buah saat cuaca cerah kering setelah embun pagi menguap. Hindari pemetikan saat hujan karena air memicu perkecambahan konidia jamur.',
    steamPillar: 'Science (Mikologi & Fisiologi Tumbuhan)',
  }),
  bacterial_soft_rot: Object.freeze({
    id: 'bacterial_soft_rot',
    name: 'Busuk Lunak Bakteri',
    scientificName: 'Pectobacterium carotovorum (Erwinia carotovora)',
    agentType: 'Bakteri (Gram-negatif fakultatif)',
    affectedCommodities: ['Terung', 'Tomat', 'Cabai Merah Keriting', 'Cabai Rawit Merah'],
    macroscopicSymptoms:
      'Jaringan buah tampak berair (water-soaked), melunak secara cepat menjadi bubur berlendir, disertai bau busuk menyengat khas fermentasi asam.',
    postHarvestMechanism:
      'Bakteri memproduksi enzim pektolitik (pectate lyase) yang mencerna dinding sel buah. Menular langsung melalui kontak fisik buah sehat dengan cairan lendir di keranjang dalam 6–12 jam.',
    mitigationAction:
      'Pisahkan buah busuk seketika dan bersihkan cairan pada buah di sekelilingnya; cuci dan jemur wadah keranjang panen di bawah sinar matahari (disinfeksi UV alami).',
    severityGrade: 'Reject',
    preventionTips:
      'Hindari luka mekanis saat panen dan transportasi. Gunakan gunting pangkas bersih saat memotong tangkai buah, jangan dipelintir atau ditarik paksa.',
    steamPillar: 'Science (Bakteriologi & Enzimologi)',
  }),
  gray_mold: Object.freeze({
    id: 'gray_mold',
    name: 'Busuk Kapang Kelabu (Botrytis Calyx Rot)',
    scientificName: 'Botrytis cinerea',
    agentType: 'Jamur (Fungi - Deuteromycota)',
    affectedCommodities: ['Tomat', 'Terung', 'Cabai Rawit Hijau'],
    macroscopicSymptoms:
      'Pertumbuhan massa miselium dan konidia seperti beludru berwarna kelabu pekat, terutama menyerang area pangkal kelopak buah (calyx) dan bekas tangkai.',
    postHarvestMechanism:
      'Patogen oportunistik yang memasuki buah melalui jaringan penuaan kelopak bunga atau tangkai yang lembap selama penyimpanan dingin tanpa sirkulasi.',
    mitigationAction:
      'Turunkan kelembapan ruang penyimpanan dan hindari kondensasi air pada permukaan buah (sweating). Potong sisa tangkai yang busuk jika infeksi belum mencapai mesokarp.',
    severityGrade: 'Class 2 / Reject',
    preventionTips:
      'Jaga kebersihan kelopak saat panen dan lakukan pendinginan awal (precooling) dengan sirkulasi udara stabil pada suhu 10–13°C.',
    steamPillar: 'Science (Mikologi Pascapanen)',
  }),
  physiological_shrivel: Object.freeze({
    id: 'physiological_shrivel',
    name: 'Susut Bobot Fisiologis & Kerut Kulit',
    scientificName: 'Postharvest Transpiration & Respiration Defect',
    agentType: 'Gangguan Fisiologis (Bukan Penyakit Menular)',
    affectedCommodities: ['Terung', 'Cabai Merah Keriting', 'Cabai Rawit Merah', 'Cabai Rawit Hijau', 'Tomat'],
    macroscopicSymptoms:
      'Kulit buah berkerut, kehilangan kilau alami (turgor menurun), buah terasa lembek kenyal, dan bobot berkurang drastis 5–12% per 24 jam.',
    postHarvestMechanism:
      'Laju transpirasi (penguapan uap air jaringan) dan respirasi seluler buah pascapanen meningkat akibat suhu lingkungan yang terlalu panas (>28°C) dan angin kencang.',
    mitigationAction:
      'Simpan panen di tempat teduh dan sejuk terlindung dari terik matahari; tutupi bagian atas keranjang dengan terpal berpori atau kain goni lembap.',
    severityGrade: 'Class 2',
    preventionTips:
      'Lakukan pengangkutan ke pengepul di pagi hari atau sore hari untuk meminimalkan beban panas termal (field heat).',
    steamPillar: 'Science (Fisiologi Pascapanen & Termodinamika)',
  }),
  blossom_end_rot: Object.freeze({
    id: 'blossom_end_rot',
    name: 'Busuk Ujung Pantat Buah (Blossom-End Rot)',
    scientificName: 'Distal Calcium Deficiency Disorder',
    agentType: 'Gangguan Nutrisi Fisiologis',
    affectedCommodities: ['Tomat', 'Terung', 'Cabai Merah Keriting'],
    macroscopicSymptoms:
      'Area datar cekung berwarna cokelat tua hingga hitam arang pada ujung distal (ujung buah berseberangan dengan tangkai), tekstur kering seperti kulit keras.',
    postHarvestMechanism:
      'Terjadi akibat defisiensi pasokan ion kalsium (Ca2+) ke sel ujung buah saat fase pertumbuhan cepat. Bersifat non-patogenik dan tidak menular ke buah lain di keranjang.',
    mitigationAction:
      'Kelompokkan ke grade olahan (saus atau pasta) jika bagian yang rusak kurang dari 20% dan telah dibuang; jangan dibuang jika masih memiliki nilai ekonomis lokal.',
    severityGrade: 'Class 2 / Reject',
    preventionTips:
      'Perbaiki manajemen irigasi lahan agar kelembapan tanah stabil dan berikan pupuk kalsium nitrat (Ca(NO3)2) teratur selama fase pembungaan.',
    steamPillar: 'Science (Nutrisi Tanaman & Kimia Tanah)',
  }),
})

export const ALL_PATHOLOGY_ITEMS = Object.freeze(Object.values(POST_HARVEST_PATHOLOGY_DATA))

/**
 * Mengambil daftar patologi yang relevan berdasarkan nama komoditas.
 * Toleran terhadap variasi ejaan lokal (Terong/Terung, Cabe/Cabai, Tomato/Tomat)
 * dan memiliki fallback aman jika komoditas tidak dikenali.
 */
export function getPathologiesForCommodity(commodityName) {
  if (!commodityName) return ALL_PATHOLOGY_ITEMS
  const raw = String(commodityName).trim().toLowerCase()

  // Normalisasi ejaan sinonim komoditas lokal
  let normalizedKey = raw
  if (raw.includes('terong') || raw.includes('terung') || raw.includes('eggplant')) {
    normalizedKey = 'terung'
  } else if (raw.includes('cabe') || raw.includes('cabai') || raw.includes('chili')) {
    normalizedKey = 'cabai'
  } else if (raw.includes('tomat') || raw.includes('tomato')) {
    normalizedKey = 'tomat'
  }

  const matches = ALL_PATHOLOGY_ITEMS.filter((item) =>
    item.affectedCommodities.some((aff) => {
      const affLower = aff.toLowerCase()
      return (
        raw.includes(affLower) ||
        affLower.includes(raw) ||
        normalizedKey.includes(affLower) ||
        affLower.includes(normalizedKey)
      )
    })
  )

  // Fallback aman jika komoditas umum belum terpetakan, jangan kembalikan array kosong yang merusak UI
  return matches.length > 0 ? matches : ALL_PATHOLOGY_ITEMS
}

/**
 * Mengidentifikasi rekomendasi sains utama berdasarkan deteksi reject atau kelas mutu.
 * Tahan banting terhadap null/undefined komoditas dan menjamin tidak pernah melempar TypeError.
 */
export function getPrimaryScienceRecommendation({ commodity, rejectCount = 0, rejectPercent = 0 } = {}) {
  const commPathologies = getPathologiesForCommodity(commodity)
  const fallbackItem = commPathologies[0] || ALL_PATHOLOGY_ITEMS[0]
  const hasReject = Number(rejectCount) > 0 || Number(rejectPercent) > 0

  if (hasReject) {
    // Utamakan infeksi menular paling kritis: Antraknosa atau Busuk Lunak Bakteri
    const primary =
      commPathologies.find((p) => p.id === 'anthracnose') ||
      commPathologies.find((p) => p.id === 'bacterial_soft_rot') ||
      fallbackItem

    return {
      severity: 'warning',
      headline: `Waspada Patologi Menular Pascapanen: ${primary?.name || 'Infeksi Pascapanen'}`,
      pathology: primary,
      actionHighlight:
        primary?.mitigationAction ||
        'Segera lakukan pemilahan (culling) buah yang bergejala busuk dari keranjang utama.',
    }
  }

  // Jika kondisi prima
  const physiological =
    commPathologies.find((p) => p.id === 'physiological_shrivel') ||
    fallbackItem

  return {
    severity: 'success',
    headline: 'Mutu Panen Prima — Jaga Turgor & Manajemen Rantai Dingin',
    pathology: physiological,
    actionHighlight:
      physiological?.mitigationAction ||
      'Simpan panen di tempat teduh dan sejuk terlindung dari terik matahari.',
  }
}

