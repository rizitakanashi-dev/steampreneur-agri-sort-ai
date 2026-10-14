import { validateGradePercentages } from './harvestValidation.js'
import { REFERENCE_PRICES_PER_KG } from './priceReference.js'

const GRADE_MULTIPLIERS = Object.freeze({ gradeA: 1, gradeB: 0.7, reject: 0.3 })
const SIZE_MULTIPLIERS = Object.freeze({ Besar: 1, Sedang: 0.9, Kecil: 0.8 })

export function parseNumeric(rawValue) {
  if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null
  if (rawValue === null || rawValue === undefined) return null
  const normalized = String(rawValue).trim()
  if (!normalized || !/^-?(?:\d+(?:[,.]\d+)?|[,.]\d+)$/.test(normalized)) return null
  if (normalized.includes(',') && normalized.includes('.')) return null
  if (/^-?\d+\.\d{3}$/.test(normalized)) return null
  const parsed = Number(normalized.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export function roundRupiah(value) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Nilai Rupiah harus berupa angka nol atau lebih.')
  const roundedDecimal = Number(value.toFixed(9))
  return Math.round(roundedDecimal)
}

function assertNonNegativeNumber(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${label} harus berupa angka nol atau lebih.`)
}

function requiredNumber(rawValue, label) {
  const parsed = parseNumeric(rawValue)
  if (parsed === null) throw new TypeError(`${label} harus berupa angka yang valid.`)
  return parsed
}

function calculateGradePercentages(input) {
  const hasDirectGrades = input.gradeA !== undefined || input.gradeB !== undefined
  const hasQualityInputs = input.kesegaranPersen !== undefined || input.cacatPersen !== undefined
  if (hasDirectGrades && hasQualityInputs) {
    throw new RangeError('Input Grade A/B tidak boleh dicampur dengan kesegaran dan cacat.')
  }
  if (hasDirectGrades) {
    const validation = validateGradePercentages(input.gradeA, input.gradeB)
    if (!validation.isValid) throw new RangeError(Object.values(validation.errors).join(' '))
    const gradeA = requiredNumber(input.gradeA, 'Grade A')
    const gradeB = requiredNumber(input.gradeB, 'Grade B')
    return { gradeA, gradeB, reject: 100 - gradeA - gradeB }
  }

  const freshness = requiredNumber(input.kesegaranPersen, 'Kesegaran')
  const defect = requiredNumber(input.cacatPersen, 'Cacat')
  if (!Number.isFinite(freshness) || freshness < 0 || freshness > 100) throw new RangeError('Kesegaran harus antara 0 sampai 100.')
  if (!Number.isFinite(defect) || defect < 0 || defect > 100) throw new RangeError('Cacat harus antara 0 sampai 100.')
  const gradeA = (100 - defect) * freshness / 100
  return { gradeA, gradeB: (100 - defect) - gradeA, reject: defect }
}

export function calculateGradeWeights(beratTotal, percentages) {
  const parsedWeight = requiredNumber(beratTotal, 'Berat total')
  assertNonNegativeNumber(parsedWeight, 'Berat total')
  const values = [percentages?.gradeA, percentages?.gradeB, percentages?.reject].map((value) => requiredNumber(value, 'Persentase grade'))
  if (values.some((value) => value < 0 || value > 100) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) > Number.EPSILON) {
    throw new RangeError('Persentase grade harus berjumlah 100% dan berada pada rentang 0 sampai 100.')
  }
  return {
    gradeA: parsedWeight * values[0] / 100,
    gradeB: parsedWeight * values[1] / 100,
    reject: parsedWeight * values[2] / 100,
  }
}

export function calculateHarvest(input) {
  const beratTotal = requiredNumber(input.beratKg, 'Berat total')
  assertNonNegativeNumber(beratTotal, 'Berat total')
  if (beratTotal <= 0) throw new RangeError('Berat total harus lebih dari 0 kg.')
  const persentase = calculateGradePercentages(input)
  return { persentase, beratKg: calculateGradeWeights(beratTotal, persentase) }
}

export function calculateHarvestValue(input) {
  const validation = validateCalculationInput(input, { requirePrice: true })
  if (!validation.isValid) throw new RangeError(Object.values(validation.errors).join(' '))
  const result = calculateHarvest(input)
  const hargaAcuanPerKg = requiredNumber(input.hargaAcuanPerKg, 'Harga acuan per kg')
  assertNonNegativeNumber(hargaAcuanPerKg, 'Harga acuan per kg')
  if (!Object.hasOwn(SIZE_MULTIPLIERS, input.ukuran)) throw new RangeError('Ukuran tidak dikenali.')
  const sizeMultiplier = SIZE_MULTIPLIERS[input.ukuran]
  const nilai = {
    gradeA: roundRupiah(result.beratKg.gradeA * hargaAcuanPerKg * GRADE_MULTIPLIERS.gradeA * sizeMultiplier),
    gradeB: roundRupiah(result.beratKg.gradeB * hargaAcuanPerKg * GRADE_MULTIPLIERS.gradeB * sizeMultiplier),
    reject: roundRupiah(result.beratKg.reject * hargaAcuanPerKg * GRADE_MULTIPLIERS.reject * sizeMultiplier),
  }
  return { ...result, nilai, totalNilai: nilai.gradeA + nilai.gradeB + nilai.reject }
}

export function validateCalculationInput(input, { requirePrice = false } = {}) {
  const errors = {}
  const berat = parseNumeric(input.beratKg)
  if (berat === null) errors.beratKg = 'Berat total harus berupa angka yang valid.'
  else if (berat <= 0) errors.beratKg = 'Berat total harus lebih dari 0 kg.'

  const hasDirectGrades = input.gradeA !== undefined || input.gradeB !== undefined
  const hasQualityInputs = input.kesegaranPersen !== undefined || input.cacatPersen !== undefined
  if (hasDirectGrades && hasQualityInputs) {
    errors.gradeB = 'Input Grade A/B tidak boleh dicampur dengan kesegaran dan cacat.'
  } else if (hasDirectGrades) {
    const gradeValidation = validateGradePercentages(input.gradeA, input.gradeB)
    Object.assign(errors, gradeValidation.errors)
  } else {
    const freshness = parseNumeric(input.kesegaranPersen)
    const defect = parseNumeric(input.cacatPersen)
    if (freshness === null) errors.kesegaranPersen = 'Kesegaran wajib diisi.'
    else if (freshness < 0 || freshness > 100) errors.kesegaranPersen = 'Kesegaran harus antara 0 sampai 100.'
    if (defect === null) errors.cacatPersen = 'Cacat wajib diisi.'
    else if (defect < 0 || defect > 100) errors.cacatPersen = 'Cacat harus antara 0 sampai 100.'
  }

  if (!Object.hasOwn(SIZE_MULTIPLIERS, input.ukuran)) errors.ukuran = 'Ukuran harus dipilih.'
  if (requirePrice || Object.hasOwn(input, 'hargaAcuanPerKg')) {
    const price = parseNumeric(input.hargaAcuanPerKg)
    if (price === null) errors.hargaAcuanPerKg = 'Harga acuan per kg wajib diisi.'
    else if (price < 0) errors.hargaAcuanPerKg = 'Harga acuan per kg tidak boleh negatif.'
  }
  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function calculateMinimumPrice({ bppPerKg, policy }) {
  if (!policy || !['margin', 'markup'].includes(policy.type)) {
    throw new Error('Kebijakan margin atau markup belum ditetapkan di spesifikasi.')
  }
  const bpp = requiredNumber(bppPerKg, 'BPP per kg')
  const rate = requiredNumber(policy.percent, 'Persentase margin/markup')
  assertNonNegativeNumber(bpp, 'BPP per kg')
  if (rate < 0 || (policy.type === 'margin' && rate >= 100)) throw new RangeError('Persentase margin/markup harus valid.')
  const price = policy.type === 'margin' ? bpp / (1 - rate / 100) : bpp * (1 + rate / 100)
  return roundRupiah(price)
}

export { GRADE_MULTIPLIERS, SIZE_MULTIPLIERS, REFERENCE_PRICES_PER_KG }
