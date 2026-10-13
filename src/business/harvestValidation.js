const commodityOptions = ['Cabai Rawit Hijau', 'Terung', 'Tomat']
const sizeOptions = ['Besar', 'Sedang', 'Kecil']

function todayAsInputValue() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

export const defaultHarvestForm = {
  tanggal: todayAsInputValue(),
  komoditas: '',
  beratKg: '',
  kesegaranPersen: '',
  ukuran: '',
  cacatPersen: '',
  catatan: '',
}

function parseNumber(rawValue) {
  const normalized = String(rawValue ?? '').trim().replace(',', '.')
  if (!normalized || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  return Number(normalized)
}

function decimalPlaces(rawValue) {
  const normalized = String(rawValue ?? '').trim().replace(',', '.')
  return normalized.includes('.') ? normalized.split('.')[1].length : 0
}

function validateNumberField(errors, form, key, messages, { max, min = 0, label }) {
  const rawValue = String(form[key] ?? '').trim()
  if (!rawValue) {
    errors[key] = messages.empty
    return
  }

  const parsed = parseNumber(rawValue)
  if (parsed === null) {
    errors[key] = messages.notNumber
    return
  }
  if (parsed < min) {
    errors[key] = messages.negative ?? messages.range
    return
  }
  if (parsed > max) {
    errors[key] = messages.max ?? messages.range
    return
  }
  if (decimalPlaces(rawValue) > 2) {
    errors[key] = `${label} maksimal 2 angka di belakang koma.`
  }
}

export function validateHarvestForm(form, today = todayAsInputValue()) {
  const errors = {}
  const tanggal = String(form.tanggal ?? '').trim()

  if (!tanggal) errors.tanggal = 'Tanggal panen wajib diisi.'
  else if (tanggal > today) errors.tanggal = 'Tanggal panen tidak boleh melebihi hari ini.'

  if (!commodityOptions.includes(form.komoditas)) errors.komoditas = 'Pilih komoditas terlebih dahulu.'

  validateNumberField(errors, form, 'beratKg', {
    empty: 'Berat panen wajib diisi.',
    notNumber: 'Berat panen harus berupa angka.',
    negative: 'Berat panen tidak boleh negatif.',
    max: 'Berat panen maksimal 10.000 kg.',
  }, { max: 10000, label: 'Berat panen' })
  if (String(form.beratKg ?? '').trim() === '0') errors.beratKg = 'Berat panen harus lebih dari 0 kg.'

  validateNumberField(errors, form, 'kesegaranPersen', {
    empty: 'Kesegaran wajib diisi.',
    notNumber: 'Kesegaran harus berupa angka.',
    range: 'Kesegaran harus antara 0 sampai 100.',
  }, { max: 100, label: 'Kesegaran' })
  validateNumberField(errors, form, 'cacatPersen', {
    empty: 'Cacat wajib diisi.',
    notNumber: 'Cacat harus berupa angka.',
    range: 'Cacat harus antara 0 sampai 100.',
  }, { max: 100, label: 'Cacat' })

  if (!sizeOptions.includes(form.ukuran)) errors.ukuran = 'Pilih ukuran terlebih dahulu.'
  if (String(form.catatan ?? '').length > 100) errors.catatan = 'Catatan maksimal 100 karakter.'

  const values = {
    tanggal,
    komoditas: form.komoditas,
    beratKg: parseNumber(form.beratKg),
    kesegaranPersen: parseNumber(form.kesegaranPersen),
    ukuran: form.ukuran,
    cacatPersen: parseNumber(form.cacatPersen),
    catatan: String(form.catatan ?? '').trim(),
  }

  return { errors, isValid: Object.keys(errors).length === 0, values }
}

export function validateGradePercentages(gradeA, gradeB) {
  const errors = {}
  const parsedA = parseNumber(gradeA)
  const parsedB = parseNumber(gradeB)

  if (parsedA === null) errors.gradeA = 'Grade A harus berupa angka.'
  else if (parsedA < 0 || parsedA > 100) errors.gradeA = 'Grade A harus antara 0 sampai 100.'
  if (parsedB === null) errors.gradeB = 'Grade B harus berupa angka.'
  else if (parsedB < 0 || parsedB > 100) errors.gradeB = 'Grade B harus antara 0 sampai 100.'
  if (!errors.gradeA && !errors.gradeB && parsedA + parsedB > 100) {
    errors.gradeB = 'Total Grade A dan Grade B tidak boleh melebihi 100%.'
  }

  return { errors, isValid: Object.keys(errors).length === 0 }
}

export { commodityOptions, sizeOptions, todayAsInputValue }
