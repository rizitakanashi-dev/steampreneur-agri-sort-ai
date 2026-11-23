import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PrintRoundedIcon from '@mui/icons-material/PrintRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import { QCPrintCertificate } from '../QCPrintCertificate.jsx'
import { getTodayDateString } from '../../business/harvestValidation.js'

/**
 * Dialog pratinjau Sertifikat Mutu QC (A4) dari hasil scan.
 * Diekstrak dari BatchQCScanner — data batch disusun dari props hasil scan.
 */
export function CertificatePreviewDialog({
  open,
  onClose,
  scanResult,
  selectedCommodity,
  saveWeight,
  execStatus,
  statusDetails,
  inference,
  pricing,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <VerifiedRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={800}>
            Sertifikat Mutu QC Resmi (A4)
          </Typography>
        </Stack>
        <IconButton aria-label="Tutup pratinjau sertifikat" onClick={onClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
        {scanResult && (
          <QCPrintCertificate
            batch={{
              id: scanResult.scan_id || 'QC-SCAN',
              tanggal: getTodayDateString(),
              komoditas: selectedCommodity,
              beratKg: Number(saveWeight ? saveWeight.replace(',', '.') : 10) || 10,
              fotoKeranjang: scanResult.imagePreview,
              ai_scan_performed: execStatus === 'ai_detected',
              execution_status: execStatus,
              status_details: statusDetails,
              is_simulated: execStatus === 'simulated',
              inference: inference,
              pricing: pricing,
              scanResult: scanResult,
              business_grading: scanResult.business_grading,
            }}
            showPrintButton
            onPrint={() => window.print()}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          Tutup
        </Button>
        <Button
          onClick={() => window.print()}
          variant="contained"
          color="primary"
          startIcon={<PrintRoundedIcon />}
        >
          Cetak / Unduh PDF
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CertificatePreviewDialog
