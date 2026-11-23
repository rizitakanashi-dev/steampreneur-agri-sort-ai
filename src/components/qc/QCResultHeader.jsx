import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import PrintRoundedIcon from '@mui/icons-material/PrintRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { formatBatchDisplayId } from '../../utils/qcCertificateHelper.js'

/**
 * Header utama halaman Hasil QC: judul, chip status eksekusi, dan aksi sertifikat.
 * Diekstrak dari QCResults — murni presentasional (5 props).
 */
export function QCResultHeader({ batch, commodity, executionStatus, isMultiAngle, onOpenCertificate }) {
  return (
    <Card elevation={2} sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
         sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
          <Box sx={{ flexGrow: 1 }}>
            {/* Baris Judul + Chip AI lurus di samping kanannya persis */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ color: '#036e45', display: 'flex', alignItems: 'center' }}>
                {executionStatus === 'ai_detected' ? (
                  <AutoAwesomeRoundedIcon sx={{ fontSize: 30 }} />
                ) : (
                  <AssessmentRoundedIcon sx={{ fontSize: 30 }} />
                )}
              </Box>
              <Typography fontWeight={800} variant="h5" sx={{ color: '#1d2326', lineHeight: 1.2 }}>
                Hasil Pemeriksaan Mutu Panen
              </Typography>

              {/* Status Chips lurus sejajar dengan Judul */}
              {executionStatus === 'ai_detected' && (
                <Chip
                  color="success"
                  icon={<VerifiedRoundedIcon />}
                  label="AI Computer Vision (Optimal)"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
              {executionStatus === 'needs_review' && (
                <Chip
                  color="warning"
                  icon={<WarningAmberRoundedIcon />}
                  label="Perlu Verifikasi Manual"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
              {executionStatus === 'simulated' && (
                <Chip
                  color="info"
                  icon={<AssessmentRoundedIcon />}
                  label="Simulasi (Non-AI)"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
              {executionStatus === 'unsupported' && (
                <Chip
                  color="default"
                  icon={<HelpOutlineRoundedIcon />}
                  label="Model AI Belum Didukung"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
              {executionStatus === 'model_unavailable' && (
                <Chip
                  color="error"
                  icon={<ErrorOutlineRoundedIcon />}
                  label="Model AI Tidak Tersedia"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
              {isMultiAngle && executionStatus === 'ai_detected' && (
                <Chip
                  color="success"
                  icon={<VerifiedRoundedIcon />}
                  label="🛡️ Multi-Angle Verified"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
            </Stack>

            {/* Baris Subjudul: Huruf B pada Batch ID lurus tepat di bawah huruf H pada Hasil */}
            <Typography
              color="text.secondary"
              variant="body2"
              sx={{
                mt: 0.75,
                pl: { xs: 0, sm: '42px' },
                fontSize: '0.875rem',
                lineHeight: 1.5,
              }}
            >
              Batch ID: <strong style={{ color: '#036e45', fontWeight: 800 }}>{formatBatchDisplayId(batch.id)}</strong> &nbsp;•&nbsp; Tanggal: <strong style={{ color: '#1d2326' }}>{batch.tanggal || batch.tanggalPanen || '-'}</strong> &nbsp;•&nbsp; Komoditas: <strong style={{ color: '#1d2326' }}>{commodity}</strong>
            </Typography>
          </Box>

          {/* Tombol Aksi di sisi kanan: Posisi pas di kanan tengah, rapi dan tombol cetak bulat */}
          <Stack
            direction="row"
            spacing={1.5}
            sx={{alignItems: 'center', 
              alignSelf: { xs: 'flex-start', md: 'center' },
              mt: { xs: 1.5, md: 0 },
              flexShrink: 0,
            }}
          >
            <Button
              color="primary"
              onClick={onOpenCertificate}
              size="small"
              startIcon={<VerifiedRoundedIcon />}
              sx={{
                fontWeight: 700,
                px: 2.25,
                height: 38,
                borderRadius: 2,
                textTransform: 'none',
              }}
              variant="contained"
            >
              Sertifikat QC
            </Button>
            <Tooltip title="Cetak atau simpan bukti QC resmi sebagai PDF (A4)">
              <IconButton
                aria-label="Cetak bukti QC"
                onClick={() => window.print()}
                size="small"
                sx={{
                  width: 38,
                  height: 38,
                  minWidth: 38,
                  borderRadius: '50%',
                  border: '1px solid #d1d5db',
                  bgcolor: '#ffffff',
                  p: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  '&:hover': { bgcolor: '#f3f4f6' },
                }}
              >
                <PrintRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default QCResultHeader
