import { Box, Button, Divider, Stack, Typography } from '@mui/material'
import AgricultureRoundedIcon from '@mui/icons-material/AgricultureRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import PrintRoundedIcon from '@mui/icons-material/PrintRounded'
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'

import { buildCertificateData } from '../utils/qcCertificateHelper.js'

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

function formatRupiah(value) {
  return typeof value === 'number' && Number.isFinite(value) ? rupiahFormatter.format(value) : 'Rp 0'
}

export function QCPrintCertificate({ batch, showPrintButton = false, onPrint }) {
  const cert = buildCertificateData(batch)

  const handlePrint = () => {
    if (typeof onPrint === 'function') {
      onPrint()
    } else {
      window.print()
    }
  }

  return (
    <Box
      className="qc-printable-certificate"
      sx={{
        bgcolor: '#ffffff',
        color: '#111827',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        lineHeight: 1.45,
        maxWidth: 820,
        mx: 'auto',
        p: { xs: 2.5, sm: 4, md: 5 },
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Tombol Cetak jika dirender dalam dialog preview di layar */}
      {showPrintButton && (
        <Stack
          className="no-print"
          direction="row"
          justifyContent="flex-end"
          spacing={1.5}
          sx={{ mb: 3 }}
        >
          <Button
            onClick={handlePrint}
            startIcon={<PrintRoundedIcon />}
            sx={{ fontWeight: 700 }}
            variant="contained"
          >
            Cetak / Simpan PDF (A4)
          </Button>
        </Stack>
      )}

      {/* KOP SURAT RESMI */}
      <Box sx={{ borderBottom: '3px double #111827', pb: 2, mb: 3 }}>
        <Stack alignItems="center" direction="row" spacing={2.5}>
          <Box
            sx={{
              alignItems: 'center',
              border: '2px solid #036e45',
              borderRadius: 2,
              color: '#036e45',
              display: 'flex',
              height: 56,
              justifyContent: 'center',
              width: 56,
              flexShrink: 0,
            }}
          >
            <AgricultureRoundedIcon sx={{ fontSize: 36 }} />
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography
              sx={{
                fontSize: { xs: 11, sm: 12 },
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#4b5563',
              }}
            >
              Sayembara STEAMPreneur SMK Tingkat Nasional 2026
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 16, sm: 20 },
                fontWeight: 900,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                color: '#036e45',
                mt: 0.25,
              }}
            >
              {cert.institution.schoolName}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 11, sm: 13 },
                fontWeight: 600,
                color: '#1f2937',
                mt: 0.25,
              }}
            >
              {cert.institution.qcLaboratory}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 9, sm: 10.5 },
                color: '#6b7280',
                mt: 0.5,
              }}
            >
              {cert.institution.address} • Kontak: {cert.institution.contact}
            </Typography>
          </Box>
          <Box
            sx={{
              alignItems: 'center',
              border: '1px solid #d1d5db',
              borderRadius: 1.5,
              display: { xs: 'none', sm: 'flex' },
              flexDirection: 'column',
              justifyContent: 'center',
              p: 1,
              width: 60,
              height: 60,
              flexShrink: 0,
              bgcolor: '#f9fafb',
            }}
          >
            <QrCode2RoundedIcon sx={{ fontSize: 36, color: '#374151' }} />
            <Typography sx={{ fontSize: 7, fontWeight: 700, color: '#4b5563', mt: -0.2 }}>
              VERIFIED
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* JUDUL SERTIFIKAT */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography
          sx={{
            fontSize: { xs: 14, sm: 17 },
            fontWeight: 800,
            letterSpacing: '0.04em',
            textDecoration: 'underline',
            textTransform: 'uppercase',
          }}
        >
          Sertifikat Hasil Uji Mutu & Sortir Panen Digital
        </Typography>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: '#4b5563',
            mt: 0.5,
          }}
        >
          Nomor Registrasi: <strong>{cert.registrationId}</strong>
        </Typography>
      </Box>

      {/* INFORMASI BATCH PANEN (2 KOLOM) */}
      <Box
        sx={{
          bgcolor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 1.5,
          p: 2,
          mb: 3,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          divider={<Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', sm: 'block' } }} />}
          spacing={2}
        >
          <Box sx={{ flex: 1 }}>
            <Stack spacing={0.75}>
              <Box sx={{ display: 'flex', fontSize: 12 }}>
                <Typography sx={{ width: 140, color: '#4b5563', fontSize: 12 }}>
                  Komoditas
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>
                  : {cert.commodity}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: 12 }}>
                <Typography sx={{ width: 140, color: '#4b5563', fontSize: 12 }}>
                  Total Bobot Batch
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>
                  : {formatNumber(cert.totalWeightKg)} kg
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: 12 }}>
                <Typography sx={{ width: 140, color: '#4b5563', fontSize: 12 }}>
                  Tanggal Panen
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#111827' }}>
                  : {cert.harvestDate}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: 12 }}>
                <Typography sx={{ width: 140, color: '#4b5563', fontSize: 12 }}>
                  Petani / Kelompok
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#111827' }}>
                  : {cert.farmerName}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Stack spacing={0.75}>
              <Box sx={{ display: 'flex', fontSize: 12 }}>
                <Typography sx={{ width: 140, color: '#4b5563', fontSize: 12 }}>
                  Metode Verifikasi
                </Typography>
                <Typography sx={{ fontWeight: 600, fontSize: 12, color: '#036e45' }}>
                  : {cert.inspectionMethod}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: 12 }}>
                <Typography sx={{ width: 140, color: '#4b5563', fontSize: 12 }}>
                  Tanggal Sertifikasi
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#111827' }}>
                  : {cert.inspectionDate}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: 12 }}>
                <Typography sx={{ width: 140, color: '#4b5563', fontSize: 12 }}>
                  Acuan Pasar / Wilayah
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#111827' }}>
                  : {cert.marketRegion}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: 12 }}>
                <Typography sx={{ width: 140, color: '#4b5563', fontSize: 12 }}>
                  Status Validasi
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#036e45' }}>
                  : Terverifikasi Digital (Resmi)
                </Typography>
              </Box>
              {cert.isMultiAngle && (
                <Box sx={{ display: 'flex', fontSize: 12 }}>
                  <Typography sx={{ width: 140, color: '#4b5563', fontSize: 12 }}>
                    Inspeksi Multi-Sudut
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 12, color: cert.occlusion?.occlusion_bias_detected ? '#dc2626' : '#036e45' }}>
                    : {cert.occlusion?.occlusion_bias_detected ? '2-Sisi (Terdeteksi Bias Oklusi)' : '2-Sisi Terverifikasi (Occlusion-Free)'}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* KOTAK PERINGATAN / VALIDASI AUDIT ANTI-KECURANGAN (MULTI-ANGLE QC) */}
      {cert.occlusion?.occlusion_bias_detected ? (
        <Box
          sx={{
            mb: 2.5,
            p: 1.5,
            border: '2px solid #dc2626',
            bgcolor: '#fef2f2',
            borderRadius: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: 11.5,
              fontWeight: 800,
              color: '#991b1b',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            ⚠️ PERINGATAN AUDIT QC: TERDETEKSI INDIKASI OKLUSI / CACAT TERSEMBUNYI
          </Typography>
          <Typography sx={{ fontSize: 10.5, color: '#b91c1c', mt: 0.5, lineHeight: 1.4 }}>
            Inspeksi 2-sisi mendeteksi disparitas cacat signifikan sebesar{' '}
            <strong>+{cert.occlusion.defect_delta_percent}%</strong> pada sisi belakang sampel panen. Indeks
            Konsistensi Lot:{' '}
            <strong>{cert.occlusion.consistency_index_percent ?? 85}%</strong>. Lot ini wajib disortir manual
            ulang sebelum didistribusikan ke mitra industri atau pasar modern.
          </Typography>
        </Box>
      ) : cert.isMultiAngle ? (
        <Box
          sx={{
            mb: 2.5,
            p: 1.25,
            border: '1.5px solid #059669',
            bgcolor: '#ecfdf5',
            borderRadius: 2,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#065f46' }}>
            🛡️ AUDIT ANTI-KECURANGAN LOLOS: MUTU SERAGAM DUA SISI
          </Typography>
          <Typography sx={{ fontSize: 10, color: '#047857', mt: 0.25 }}>
            Pemeriksaan 2-sisi (Depan &amp; Goyang Nampan) membuktikan sebaran mutu seragam tanpa penyembunyian buah cacat. Indeks Konsistensi Lot: <strong>{cert.occlusion?.consistency_index_percent ?? 98}%</strong>.
          </Typography>
        </Box>
      ) : null}

      {/* TABEL RINCIAN HASIL UJI MUTU */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: '#1f2937' }}>
          A. Rincian Klasifikasi & Distribusi Mutu Panen
        </Typography>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11.5px',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderTop: '1px solid #9ca3af', borderBottom: '1px solid #9ca3af' }}>
              <th style={{ padding: '8px 10px', width: '35px', textAlign: 'center' }}>No</th>
              <th style={{ padding: '8px 10px' }}>Kategori Grade Mutu</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: '75px' }}>Rasio (%)</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: '85px' }}>Bobot (kg)</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: '95px' }}>Acuan (Rp/kg)</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Subtotal (Rp)</th>
              <th style={{ padding: '8px 10px', width: '150px' }}>Peruntukan Pasar</th>
            </tr>
          </thead>
          <tbody>
            {cert.grades.map((g, idx) => (
              <tr
                key={g.code}
                style={{
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: idx % 2 === 1 ? '#fafafa' : '#ffffff',
                }}
              >
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{g.label}</span>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{g.desc}</div>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                  {formatNumber(g.ratioPercent)}%
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                  {formatNumber(g.weightKg)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  {formatRupiah(g.pricePerKg)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                  {formatRupiah(g.subtotalRp)}
                </td>
                <td style={{ padding: '8px 10px', fontSize: '10.5px', color: '#374151' }}>
                  {g.status}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #374151', borderBottom: '2px solid #374151', backgroundColor: '#f9fafb', fontWeight: 800 }}>
              <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right' }}>
                TOTAL BOBOT & NILAI KOMERSIAL:
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                {formatNumber(cert.totalWeightKg)} kg
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>-</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#036e45' }}>
                {formatRupiah(cert.financials.totalRevenue)}
              </td>
              <td style={{ padding: '8px 10px' }}></td>
            </tr>
          </tfoot>
        </table>
      </Box>

      {/* REKAPITULASI STEAM MATH & REKOMENDASI TINDAKAN */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: '#1f2937' }}>
          B. Rekapitulasi Nilai Finansial & Rekomendasi Penanganan
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            border: '1px solid #e5e7eb',
            borderRadius: 1.5,
            p: 2,
            bgcolor: '#ffffff',
          }}
        >
          <Box sx={{ flex: 1, borderRight: { sm: '1px solid #e5e7eb' }, pr: { sm: 2 } }}>
            <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
              Estimasi Total Penerimaan Petani:
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#036e45', mt: 0.25 }}>
              {formatRupiah(cert.financials.totalRevenue)}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: '#6b7280', mt: 0.25 }}>
              *Berdasarkan harga acuan {formatRupiah(cert.referencePricePerKg)}/kg
            </Typography>
          </Box>

          <Box sx={{ flex: 1, borderRight: { sm: '1px solid #e5e7eb' }, pr: { sm: 2 } }}>
            <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
              Mitigasi Risiko Susut / Afkir:
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: cert.financials.potentialLoss > 0 ? '#b91c1c' : '#036e45', mt: 0.25 }}>
              {formatRupiah(cert.financials.potentialLoss)}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: '#6b7280', mt: 0.25 }}>
              Nilai komoditas yang dipisahkan dari batch utama
            </Typography>
          </Box>

          <Box sx={{ flex: 1.2 }}>
            <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
              Catatan Rekomendasi Sortasi:
            </Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#1f2937', mt: 0.5, lineHeight: 1.4 }}>
              {cert.recommendationNote}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* KOLOM TANDA TANGAN & PENGESAHAN */}
      <Box sx={{ mt: 4, pt: 2, borderTop: '1px dashed #d1d5db', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <Stack direction="row" justifyContent="space-between" sx={{ textAlign: 'center', px: 2 }}>
          {/* Tanda Tangan Petani */}
          <Box sx={{ width: 190 }}>
            <Typography sx={{ fontSize: 11, color: '#4b5563' }}>
              Petani Hortikultura / Pengirim,
            </Typography>
            <Box sx={{ height: 65 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #111827', pb: 0.25 }}>
              ( {cert.farmerName.length > 22 ? cert.farmerName.slice(0, 20) + '...' : cert.farmerName} )
            </Typography>
            <Typography sx={{ fontSize: 10, color: '#6b7280', mt: 0.25 }}>
              Mitra Tani Hortikultura
            </Typography>
          </Box>

          {/* Stempel & Validasi Mesin AI */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px dashed #036e45',
              borderRadius: 2,
              p: 1.25,
              width: 170,
              bgcolor: 'rgba(3, 110, 69, 0.03)',
            }}
          >
            <VerifiedRoundedIcon sx={{ color: '#036e45', fontSize: 32, mb: 0.5 }} />
            <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#036e45', textTransform: 'uppercase' }}>
              SMART QC VERIFIED
            </Typography>
            <Typography sx={{ fontSize: 8.5, color: '#4b5563', mt: 0.25 }}>
              Model AI {cert.modelEngineName || 'Ultralytics YOLO11'}
            </Typography>
            <Typography sx={{ fontSize: 8, color: '#6b7280' }}>
              ID: {cert.registrationId}
            </Typography>
          </Box>

          {/* Tanda Tangan Petugas QC / Lab SMKN 4 */}
          <Box sx={{ width: 190 }}>
            <Typography sx={{ fontSize: 11, color: '#4b5563' }}>
              Payakumbuh, {cert.inspectionDate}
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#4b5563' }}>
              Petugas QC / Penanggung Jawab,
            </Typography>
            <Box sx={{ height: 50 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #111827', pb: 0.25 }}>
              ( Tim Agri-Sort AI )
            </Typography>
            <Typography sx={{ fontSize: 10, color: '#6b7280', mt: 0.25 }}>
              SMK Negeri 4 Payakumbuh
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* FOOTER RESMI DOKUMEN */}
      <Box
        sx={{
          borderTop: '1px solid #e5e7eb',
          mt: 4,
          pt: 1.5,
          textAlign: 'center',
          color: '#6b7280',
          fontSize: 9,
          lineHeight: 1.4,
        }}
      >
        <Typography sx={{ fontSize: 9, color: '#6b7280' }}>
          Dokumen ini diterbitkan secara otomatis dan terotentikasi oleh Sistem Agri-Sort AI SMK Negeri 4 Payakumbuh dalam rangka{' '}
          <strong>Sayembara STEAMPreneur SMK Tingkat Nasional 2026</strong>.
        </Typography>
        <Typography sx={{ fontSize: 8.5, color: '#9ca3af', mt: 0.25 }}>
          Kode Dokumen: STEAM-SMKN4-AGRISORT-QC-2026 • Dicetak secara digital • Hak Cipta © 2026 Tim Agri-Sort AI
        </Typography>
      </Box>
    </Box>
  )
}

