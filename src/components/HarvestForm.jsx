import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  FormLabel,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import { defaultHarvestForm, validateHarvestForm, validateGradePercentages, commodityOptions, sizeOptions, todayAsInputValue } from '../business/harvestValidation.js'

function FieldError({ children }) {
  return children ? <FormHelperText error>{children}</FormHelperText> : null
}

export function HarvestForm({ onSave }) {
  const [form, setForm] = useState(defaultHarvestForm)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [preview, setPreview] = useState(null)

  const validateCurrentForm = () => {
    const result = validateHarvestForm(form)
    setErrors(result.errors)
    return result
  }

  const handleChange = (field) => (event) => {
    const nextForm = { ...form, [field]: event.target.value }
    setForm(nextForm)
    setGlobalError('')
    if (touched[field]) {
      const result = validateHarvestForm(nextForm)
      setErrors(result.errors)
    }
  }

  const handleBlur = (field) => () => {
    setTouched((current) => ({ ...current, [field]: true }))
    validateCurrentForm()
  }

  const resetForm = () => {
    setForm({ ...defaultHarvestForm, tanggal: todayAsInputValue() })
    setErrors({})
    setTouched({})
    setGlobalError('')
    setPreview(null)
  }

  const handleCalculate = (event) => {
    event.preventDefault()
    setTouched(Object.keys(defaultHarvestForm).reduce((all, field) => ({ ...all, [field]: true }), {}))
    const result = validateCurrentForm()
    if (!result.isValid) {
      setGlobalError('Periksa kembali isian yang ditandai sebelum melanjutkan.')
      setPreview(null)
      return
    }
    setPreview({ ...result.values, id: `panen-${Date.now()}` })
  }

  const confirmSave = () => {
    if (preview && onSave) onSave(preview)
    setPreview(null)
  }

  return (
    <>
      <Card component="form" onSubmit={handleCalculate}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6">Input hasil panen</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
                Isi parameter mutu dari satu setoran panen. Data belum disimpan sebelum kamu memeriksa ringkasannya.
              </Typography>
            </Box>

            {globalError && <Alert severity="error">{globalError}</Alert>}

            <Stack spacing={2.25}>
              <Typography color="primary.dark" fontWeight={700} variant="subtitle2">Informasi panen</Typography>
              <TextField
                fullWidth
                required
                error={Boolean(touched.tanggal && errors.tanggal)}
                helperText={(touched.tanggal && errors.tanggal) || 'Tanggal tidak boleh melebihi hari ini.'}
                onBlur={handleBlur('tanggal')}
                inputProps={{ max: todayAsInputValue() }}
                label="Tanggal panen"
                onChange={handleChange('tanggal')}
                type="date"
                value={form.tanggal}
              />
              <FormControl fullWidth required error={Boolean(touched.komoditas && errors.komoditas)}>
                <FormLabel id="harvest-commodity-label">Komoditas</FormLabel>
                <Select aria-labelledby="harvest-commodity-label" displayEmpty onBlur={handleBlur('komoditas')} onChange={handleChange('komoditas')} value={form.komoditas} sx={{ mt: 0.75 }}>
                  <MenuItem disabled value="">Pilih komoditas</MenuItem>
                  {commodityOptions.map((commodity) => <MenuItem key={commodity} value={commodity}>{commodity}</MenuItem>)}
                </Select>
                <FieldError>{touched.komoditas && errors.komoditas ? errors.komoditas : ''}</FieldError>
              </FormControl>
              <TextField
                fullWidth
                required
                error={Boolean(touched.beratKg && errors.beratKg)}
                helperText={(touched.beratKg && errors.beratKg) || 'Maksimal 10.000 kg; boleh menggunakan koma desimal.'}
                onBlur={handleBlur('beratKg')}
                InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
                inputMode="decimal"
                label="Berat total"
                onChange={handleChange('beratKg')}
                placeholder="Contoh: 25,5"
                type="text"
                value={form.beratKg}
              />
            </Stack>

            <Stack spacing={2.25}>
              <Typography color="primary.dark" fontWeight={700} variant="subtitle2">Parameter mutu</Typography>
              <TextField
                fullWidth
                required
                error={Boolean(touched.kesegaranPersen && errors.kesegaranPersen)}
                helperText={(touched.kesegaranPersen && errors.kesegaranPersen) || 'Nilai 0 sampai 100.'}
                onBlur={handleBlur('kesegaranPersen')}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                inputMode="decimal"
                label="Kesegaran"
                onChange={handleChange('kesegaranPersen')}
                placeholder="Contoh: 80"
                type="text"
                value={form.kesegaranPersen}
              />
              <FormControl fullWidth required error={Boolean(touched.ukuran && errors.ukuran)}>
                <FormLabel id="harvest-size-label">Ukuran</FormLabel>
                <Select aria-labelledby="harvest-size-label" displayEmpty onBlur={handleBlur('ukuran')} onChange={handleChange('ukuran')} value={form.ukuran} sx={{ mt: 0.75 }}>
                  <MenuItem disabled value="">Pilih ukuran</MenuItem>
                  {sizeOptions.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
                </Select>
                <FieldError>{touched.ukuran && errors.ukuran ? errors.ukuran : ''}</FieldError>
              </FormControl>
              <TextField
                fullWidth
                required
                error={Boolean(touched.cacatPersen && errors.cacatPersen)}
                helperText={(touched.cacatPersen && errors.cacatPersen) || 'Nilai 0 sampai 100.'}
                onBlur={handleBlur('cacatPersen')}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                inputMode="decimal"
                label="Cacat"
                onChange={handleChange('cacatPersen')}
                placeholder="Contoh: 10"
                type="text"
                value={form.cacatPersen}
              />
            </Stack>

            <TextField
              fullWidth
              error={Boolean(touched.catatan && errors.catatan)}
              helperText={(touched.catatan && errors.catatan) || `${form.catatan.length}/100 karakter`}
              label="Catatan (opsional)"
              onBlur={handleBlur('catatan')}
              multiline
              onChange={handleChange('catatan')}
              placeholder="Contoh: Setoran pagi"
              rows={2}
              value={form.catatan}
            />

            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="flex-end" spacing={1.25}>
              <Button fullWidth variant="outlined" onClick={resetForm} startIcon={<RestartAltRoundedIcon />} sx={{ maxWidth: { sm: 140 } }}>Reset</Button>
              <Button fullWidth type="submit" variant="contained" startIcon={<CalculateRoundedIcon />} sx={{ maxWidth: { sm: 190 } }}>Hitung &amp; periksa</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Dialog fullWidth maxWidth="sm" onClose={() => setPreview(null)} open={Boolean(preview)}>
        <DialogTitle>Periksa ringkasan input</DialogTitle>
        <DialogContent dividers>
          {preview && (
            <Stack spacing={1.25}>
              <Alert icon={<CheckCircleOutlineRoundedIcon />} severity="success">Semua input valid. Belum ada data yang disimpan.</Alert>
              <Typography variant="body2"><strong>ID batch:</strong> {preview.id}</Typography>
              <Typography variant="body2"><strong>Tanggal:</strong> {preview.tanggal}</Typography>
              <Typography variant="body2"><strong>Komoditas:</strong> {preview.komoditas}</Typography>
              <Typography variant="body2"><strong>Berat total:</strong> {preview.beratKg} kg</Typography>
              <Typography variant="body2"><strong>Kesegaran:</strong> {preview.kesegaranPersen}%</Typography>
              <Typography variant="body2"><strong>Ukuran:</strong> {preview.ukuran}</Typography>
              <Typography variant="body2"><strong>Cacat:</strong> {preview.cacatPersen}%</Typography>
              <Typography variant="body2"><strong>Catatan:</strong> {preview.catatan || '-'}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPreview(null)} variant="outlined">Ubah</Button>
          <Button color="primary" onClick={confirmSave} variant="contained">Simpan ke rekap</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
