import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

/**
 * Dialog "Simpan ke Rekap Data Panen" dari hasil scan.
 * Diekstrak dari BatchQCScanner — state berat & catatan tetap di parent.
 */
export function SaveToRecapDialog({
  open,
  onClose,
  onConfirm,
  selectedCommodity,
  saveWeight,
  onWeightChange,
  saveNotes,
  onNotesChange,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Simpan ke Rekap Data Panen</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info" icon={<InfoOutlinedIcon />}>
            Hasil deteksi AI ({selectedCommodity}) akan dicatat ke dalam database rekap lokal.
          </Alert>
          <TextField
            label="Estimasi Berat Timbangan (kg)"
            value={saveWeight}
            onChange={onWeightChange}
            placeholder="Contoh: 15"
            slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }}
            helperText="Opsional. Default 10 kg jika dikosongkan."
            fullWidth
          />
          <TextField
            label="Catatan Panen"
            value={saveNotes}
            onChange={onNotesChange}
            placeholder="Contoh: Panen pagi keranjang 3"
            multiline
            rows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          Batal
        </Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          Simpan Sekarang
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SaveToRecapDialog
