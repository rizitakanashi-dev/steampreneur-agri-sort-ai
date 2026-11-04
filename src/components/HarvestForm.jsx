import { useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
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
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageError, setImageError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleImageFile = (file) => {
    if (!file) return
    setImageError('')

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setImageError('Format file tidak didukung. Gunakan JPG, PNG, atau WebP.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setImageError('Ukuran gambar melebihi 10 MB. Silakan gunakan foto yang lebih kecil.')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result)
    }
    reader.readAsDataURL(file)
  }

  const handleClearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer?.files?.[0]) {
      handleImageFile(e.dataTransfer.files[0])
    }
  }

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
    handleClearImage()
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
    setPreview({
      ...result.values,
      id: `panen-${Date.now()}`,
      fotoKeranjang: imagePreview,
      fotoNama: imageFile?.name || null,
      fotoUkuran: imageFile ? `${(imageFile.size / (1024 * 1024)).toFixed(2)} MB` : null,
    })
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
              <Typography variant="h6">Batch QC Scanner &amp; Input Panen</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
                Ambil foto keranjang hasil panen atau isi parameter mutu setoran untuk pemeriksaan kualitas dan rekomendasi harga.
              </Typography>
            </Box>

            {globalError && <Alert severity="error">{globalError}</Alert>}

            {/* Bagian 1: Pemindaian Citra Keranjang (Batch Camera / Image Upload) */}
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography color="primary.dark" fontWeight={700} variant="subtitle2">
                  Pemindaian Keranjang Panen (Batch Scanner)
                </Typography>
                <Chip
                  size="small"
                  icon={<CameraAltRoundedIcon />}
                  label={imagePreview ? 'Foto Terpilih' : 'Kamera & Upload'}
                  color={imagePreview ? 'success' : 'default'}
                  variant={imagePreview ? 'filled' : 'outlined'}
                  sx={{ fontSize: '0.75rem' }}
                />
              </Stack>

              {/* Hidden Inputs untuk File Picker dan Kamera Langsung */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleImageFile(e.target.files[0])
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleImageFile(e.target.files[0])
                }}
              />

              {imageError && (
                <Alert severity="warning" onClose={() => setImageError('')}>
                  {imageError}
                </Alert>
              )}

              {imagePreview ? (
                <Card variant="outlined" sx={{ overflow: 'hidden', bgcolor: '#fafcfb' }}>
                  <Box sx={{ position: 'relative', width: '100%', maxHeight: 280, bgcolor: '#000', display: 'flex', justifyContent: 'center' }}>
                    <Box
                      component="img"
                      src={imagePreview}
                      alt="Foto Keranjang Panen"
                      sx={{
                        maxHeight: 280,
                        maxWidth: '100%',
                        objectFit: 'contain',
                      }}
                    />
                    <IconButton
                      onClick={handleClearImage}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        '&:hover': { bgcolor: 'rgba(185,28,28,0.85)' },
                      }}
                      title="Hapus Foto"
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                      <Box>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: { xs: 260, sm: 320 } }}>
                          {imageFile?.name || 'Foto Keranjang Panen'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB • Siap dianalisis` : 'Foto terpilih'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PhotoCameraRoundedIcon />}
                          onClick={() => cameraInputRef.current?.click()}
                        >
                          Foto Ulang
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CloudUploadRoundedIcon />}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Ganti Berkas
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ) : (
                <Box
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  sx={{
                    border: '2px dashed',
                    borderColor: isDragging ? 'primary.main' : 'divider',
                    bgcolor: isDragging ? 'rgba(3, 110, 69, 0.04)' : '#fafcfb',
                    borderRadius: 2,
                    p: { xs: 2.5, sm: 3.5 },
                    textAlign: 'center',
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  <Stack spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        bgcolor: 'rgba(3, 110, 69, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'primary.main',
                      }}
                    >
                      <CameraAltRoundedIcon fontSize="medium" />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        Ambil Foto Keranjang Panen atau Unggah Berkas
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Tampak atas (top-down view) keranjang panen dengan pencahayaan memadai &bull; JPG, PNG, atau WebP (maks. 10 MB)
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ pt: 0.5, width: { xs: '100%', sm: 'auto' } }}>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PhotoCameraRoundedIcon />}
                        onClick={() => cameraInputRef.current?.click()}
                        fullWidth
                      >
                        Buka Kamera HP
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<CloudUploadRoundedIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        fullWidth
                      >
                        Pilih Berkas Galeri
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              )}
            </Stack>

            <Stack spacing={2.25}>
              <Typography color="primary.dark" fontWeight={700} variant="subtitle2">Informasi panen</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    error={Boolean(touched.tanggal && errors.tanggal)}
                    helperText={(touched.tanggal && errors.tanggal) || 'Tanggal tidak boleh melebihi hari ini.'}
                    onBlur={handleBlur('tanggal')}
                    slotProps={{ htmlInput: { max: todayAsInputValue() } }}
                    label="Tanggal panen"
                    onChange={handleChange('tanggal')}
                    type="date"
                    value={form.tanggal}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth required error={Boolean(touched.komoditas && errors.komoditas)}>
                    <FormLabel id="harvest-commodity-label">Komoditas</FormLabel>
                    <Select aria-labelledby="harvest-commodity-label" displayEmpty onBlur={handleBlur('komoditas')} onChange={handleChange('komoditas')} value={form.komoditas} sx={{ mt: 0.75 }}>
                      <MenuItem disabled value="">Pilih komoditas</MenuItem>
                      {commodityOptions.map((commodity) => <MenuItem key={commodity} value={commodity}>{commodity}</MenuItem>)}
                    </Select>
                    <FieldError>{touched.komoditas && errors.komoditas ? errors.komoditas : ''}</FieldError>
                  </FormControl>
                </Grid>
              </Grid>
              <TextField
                fullWidth
                required
                error={Boolean(touched.beratKg && errors.beratKg)}
                helperText={(touched.beratKg && errors.beratKg) || 'Maksimal 10.000 kg; boleh menggunakan koma desimal.'}
                onBlur={handleBlur('beratKg')}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }}
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
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    error={Boolean(touched.kesegaranPersen && errors.kesegaranPersen)}
                    helperText={(touched.kesegaranPersen && errors.kesegaranPersen) || 'Nilai 0 sampai 100.'}
                    onBlur={handleBlur('kesegaranPersen')}
                    slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                    inputMode="decimal"
                    label="Kesegaran"
                    onChange={handleChange('kesegaranPersen')}
                    placeholder="Contoh: 80"
                    type="text"
                    value={form.kesegaranPersen}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth required error={Boolean(touched.ukuran && errors.ukuran)}>
                    <FormLabel id="harvest-size-label">Ukuran</FormLabel>
                    <Select aria-labelledby="harvest-size-label" displayEmpty onBlur={handleBlur('ukuran')} onChange={handleChange('ukuran')} value={form.ukuran} sx={{ mt: 0.75 }}>
                      <MenuItem disabled value="">Pilih ukuran</MenuItem>
                      {sizeOptions.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
                    </Select>
                    <FieldError>{touched.ukuran && errors.ukuran ? errors.ukuran : ''}</FieldError>
                  </FormControl>
                </Grid>
              </Grid>
              <TextField
                fullWidth
                required
                error={Boolean(touched.cacatPersen && errors.cacatPersen)}
                helperText={(touched.cacatPersen && errors.cacatPersen) || 'Nilai 0 sampai 100.'}
                onBlur={handleBlur('cacatPersen')}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
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
              {preview.fotoKeranjang && (
                <Box sx={{ mt: 0.5, mb: 0.5, p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fafcfb' }}>
                  <Box
                    component="img"
                    src={preview.fotoKeranjang}
                    alt="Preview Panen"
                    sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1 }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">Lampiran Foto Keranjang:</Typography>
                    <Typography variant="body2" fontWeight={600} noWrap>{preview.fotoNama || 'Foto Keranjang Panen'}</Typography>
                    <Typography variant="caption" color="text.secondary">{preview.fotoUkuran || 'Siap dianalisis'}</Typography>
                  </Box>
                </Box>
              )}
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
