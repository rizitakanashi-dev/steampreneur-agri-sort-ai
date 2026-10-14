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
