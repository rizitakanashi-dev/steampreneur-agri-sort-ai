/**
 * Konstanta & formatter modul scanner.
 * Dipisah dari BatchQCScanner agar data statis tidak membebani komponen utama.
 */

export function formatRupiah(val) {
  const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  })
  return typeof val === 'number' && Number.isFinite(val) ? rupiahFormatter.format(val) : '-'
}

export const COMMODITIES = [
  {
    id: 'Cabai',
    name: 'Cabai (Chili)',
    badge: 'YOLO11 3-Class',
    badgeColor: 'error',
    classes: ['Grade A', 'Grade B', 'Reject'],
    defaultConf: 0.35,
    emoji: '🌶️',
    supported: true,
  },
  {
    id: 'Terung',
    name: 'Terung (Eggplant)',
    badge: 'YOLO11 3-Class',
    badgeColor: 'primary',
    classes: ['Grade A', 'Grade B', 'Reject'],
    defaultConf: 0.35,
    emoji: '🍆',
    supported: true,
  },
  {
    id: 'Tomat',
    name: 'Tomat (Tomato)',
    badge: 'YOLO11 3-Class',
    badgeColor: 'success',
    classes: ['Grade A', 'Grade B', 'Reject'],
    defaultConf: 0.35,
    emoji: '🍅',
    supported: true,
  },
]
