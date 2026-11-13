export const HARVEST_STORAGE_KEY = 'agrisort.panen.v1'

function getStorage(storage) {
  if (storage) return storage
  if (typeof localStorage !== 'undefined') return localStorage
  return null
}

function isBatchRecord(value) {
  return value && typeof value === 'object' && typeof value.id === 'string' && value.id.length > 0
}

export function readBatches(storage) {
  const target = getStorage(storage)
  if (!target) return []

  try {
    const raw = target.getItem(HARVEST_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isBatchRecord) : []
  } catch {
    return []
  }
}

function createUniqueId(existingIds, requestedId) {
  const baseId = requestedId || `panen-${Date.now()}`
  if (!existingIds.has(baseId)) return baseId

  let suffix = 2
  while (existingIds.has(`${baseId}-${suffix}`)) suffix += 1
  return `${baseId}-${suffix}`
}

export function saveBatch(batch, storage) {
  const target = getStorage(storage)
  if (!target) throw new Error('localStorage tidak tersedia.')
  if (!batch || typeof batch !== 'object') throw new TypeError('Batch harus berupa object.')

  const batches = readBatches(target)
  const id = createUniqueId(new Set(batches.map((item) => item.id)), batch.id)
  const savedBatch = { ...batch, id }
  target.setItem(HARVEST_STORAGE_KEY, JSON.stringify([...batches, savedBatch]))
  return savedBatch
}

export function clearBatches(storage) {
  const target = getStorage(storage)
  if (target) target.removeItem(HARVEST_STORAGE_KEY)
}

export function deleteBatch(batchId, storage) {
  const target = getStorage(storage)
  if (!target) return []
  if (!batchId) return readBatches(target)

  const batches = readBatches(target)
  const remaining = batches.filter((b) => b.id !== batchId)
  target.setItem(HARVEST_STORAGE_KEY, JSON.stringify(remaining))
  return remaining
}

export function exportBatchesAsJson(storage) {
  const batches = readBatches(storage)
  const payload = {
    app: 'Agri-Sort AI',
    version: '1.0.0',
    institution: 'SMKN 4 Payakumbuh',
    exportedAt: new Date().toISOString(),
    totalRecords: batches.length,
    batches,
  }
  return JSON.stringify(payload, null, 2)
}

export function importBatchesFromJson(rawInput, storage) {
  const target = getStorage(storage)
  if (!target) throw new Error('localStorage tidak tersedia.')

  let parsed = null
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput)
    } catch {
      return { success: false, error: 'Format berkas cadangan JSON tidak valid atau rusak.', importedCount: 0 }
    }
  } else if (rawInput && typeof rawInput === 'object') {
    parsed = rawInput
  } else {
    return { success: false, error: 'Data cadangan tidak valid.', importedCount: 0 }
  }

  const candidateBatches = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.batches)
      ? parsed.batches
      : []

  const validNewRecords = candidateBatches.filter(isBatchRecord)
  if (validNewRecords.length === 0) {
    return {
      success: false,
      error: 'Tidak ditemukan rekaman batch panen yang valid di dalam berkas cadangan.',
      importedCount: 0,
    }
  }

  const existingBatches = readBatches(target)
  const existingIds = new Set(existingBatches.map((b) => b.id))

  const merged = [...existingBatches]
  let importedCount = 0

  for (const record of validNewRecords) {
    const uniqueId = createUniqueId(existingIds, record.id)
    existingIds.add(uniqueId)
    merged.push({ ...record, id: uniqueId })
    importedCount += 1
  }

  target.setItem(HARVEST_STORAGE_KEY, JSON.stringify(merged))

  return {
    success: true,
    importedCount,
    totalCount: merged.length,
    batches: merged,
  }
}
