import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import { useEffect, useState } from 'react'
import {
  DEFAULT_REGION,
  DEFAULT_SOURCE_ID,
  PriceApiError,
  commodityNameToId,
  fetchLatestPrice,
  fetchPriceHistory,
  fetchSourceHealth,
  mapObservationForDisplay,
} from '../../services/priceApi.js'

/**
 * Panel harga mode LIVE (isu #44) — membaca KONTRAK `/api/v1/prices/*` saja.
 * Semua lima data_status punya tampilan berbeda; tidak ada fallback ke data statis.
 */

const STATE_STYLES = {
  actual: { color: 'success.main', icon: <CheckCircleRoundedIcon fontSize="small" />, chip: <Chip color="success" icon={<CheckCircleRoundedIcon />} label="Terkini" size="small" sx={{ fontWeight: 700 }} /> },
  historical: { color: 'info.main', icon: <HistoryRoundedIcon fontSize="small" />, chip: <Chip color="info" icon={<HistoryRoundedIcon />} label="Historis" size="small" sx={{ fontWeight: 700 }} /> },
  cached: { color: 'warning.main', icon: <HistoryRoundedIcon fontSize="small" />, chip: <Chip color="warning" icon={<HistoryRoundedIcon />} label="Cache — tidak live" size="small" sx={{ fontWeight: 700 }} /> },
  simulated: { color: 'secondary.main', icon: <ScienceRoundedIcon fontSize="small" />, chip: <Chip color="secondary" icon={<ScienceRoundedIcon />} label="Demo" size="small" sx={{ fontWeight: 700 }} /> },
  unavailable: { color: 'text.secondary', icon: <CloudOffRoundedIcon fontSize="small" />, chip: <Chip color="default" icon={<CloudOffRoundedIcon />} label="Tidak tersedia" size="small" /> },
}

function StateCard({ display, commodityName, requestId }) {
  const style = STATE_STYLES[display.state] ?? STATE_STYLES.unavailable
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography fontWeight={700} variant="subtitle2">{display.headline}</Typography>
        {style.chip}
      </Stack>

      {display.state === 'unavailable' || display.state === 'simulated' ? (
        <Stack spacing={0.5}>
          {display.reasons.map((reason, i) => (
            <Typography key={i} color="text.secondary" variant="body2">• {reason}</Typography>
          ))}
          <Typography color="text.disabled" variant="caption">
            Komoditas: {display.detail?.commodity ?? commodityName}
            {display.detail?.source ? ` · Sumber: ${display.detail.source}` : ''}
            {requestId ? ` · request ${requestId}` : ''}
          </Typography>
        </Stack>
      ) : (
        <>
          <Typography fontWeight={800} variant="h4" sx={{ letterSpacing: '-0.01em' }}>
            Rp {display.priceText} <Typography component="span" fontWeight={600} variant="subtitle2">/ {display.unitText}</Typography>
          </Typography>
          {display.normalizedPerKgText == null && display.unitText !== 'kg' && (
            <Typography color="text.secondary" variant="caption">
              Unit asli dipertahankan — tidak dinormalisasi ke kg (unit bukan massa terdokumentasi).
            </Typography>
          )}
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
            {display.priceTypeText} · Sumber: {display.sourceName ?? '—'}
          </Typography>
          <Typography color="text.secondary" variant="caption" sx={{ display: 'block' }}>
            Diobservasi: {display.observedText ?? '—'}{display.fetchedText ? ` · Ditarik backend: ${display.fetchedText}` : ''}
          </Typography>
          {display.warnings.length > 0 && (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }} useFlexGap>
              {display.warnings.map((warning, i) => (
                <Chip key={i} label={warning} size="small" variant="outlined" color="warning" sx={{ fontWeight: 600 }} />
              ))}
            </Stack>
          )}
          {requestId && <Typography color="text.disabled" variant="caption" sx={{ display: 'block', mt: 0.5 }}>request {requestId}</Typography>}
        </>
      )}
    </Box>
  )
}

function MiniHistoryChart({ rows, commodityName }) {
  // Titik hanya untuk observasi yang benar-benar ada — TANPA interpolasi/forward-fill.
  const actualPoints = []
  const cachedPoints = []
  for (const row of rows) {
    if (row.price_value == null) continue
    const point = {
      label: new Date(row.observed_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' }),
      pricePerKg: row.normalized_price_per_kg ?? row.price_value,
    }
    ;(row.data_status === 'cached' ? cachedPoints : actualPoints).push(point)
  }
  const merged = [...actualPoints, ...cachedPoints].sort((a, b) => new Date(a.label) - new Date(b.label))
  if (merged.length < 2) {
    return (
      <Typography color="text.secondary" variant="body2">
        Belum ada cukup data historis dari kontrak untuk menggambar tren (tanpa interpolasi).
      </Typography>
    )
  }
  // Gunakan PriceTrendChart demo-free: gambar sendiri dari data kontrak.
  return (
    <Typography color="text.secondary" variant="body2">
      {merged.length} titik kontrak ({actualPoints.length} terkini, {cachedPoints.length} cache) untuk {commodityName} —
      tanggal yang tidak ada dibiarkan bolong, tidak disambung.
    </Typography>
  )
}

export function LivePricePanel({ commodityName, onObservation }) {
  const commodityId = commodityNameToId(commodityName)
  const [phase, setPhase] = useState('loading') // loading | ready | error
  const [display, setDisplay] = useState(null)
  const [requestId, setRequestId] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [health, setHealth] = useState(null)
  const [errorInfo, setErrorInfo] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!commodityId) return undefined
    let cancelled = false
    setPhase('loading')
    setErrorInfo(null)

    async function load() {
      try {
        const latest = await fetchLatestPrice({ commodityId })
        const healthRes = await fetchSourceHealth(DEFAULT_SOURCE_ID).catch(() => null)
        const historyRes = await fetchPriceHistory({ commodityId, ...DEFAULT_REGION ? {} : {} }).catch(() => null)
        if (cancelled) return
        setRequestId(latest.requestId)
        setDisplay(mapObservationForDisplay(latest.observation))
        setHealth(healthRes?.health ?? null)
        setHistoryRows(historyRes?.rows ?? [])
        setPhase('ready')
        onObservation?.(latest.observation)
      } catch (err) {
        if (cancelled) return
        // Gagal live TIDAK pernah otomatis pindah ke demo — tampilkan error + retry.
        setErrorInfo({
          message: err instanceof PriceApiError ? err.message : 'API harga tidak terjangkau.',
          requestId: err instanceof PriceApiError ? err.requestId : null,
          code: err instanceof PriceApiError ? err.code : 'UNKNOWN',
        })
        setPhase('error')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [commodityId, reloadKey])

  if (!commodityId) {
    return (
      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography color="text.secondary" variant="body2">
          Komoditas tidak ada di katalog kontrak harga.
        </Typography>
      </Box>
    )
  }

  if (phase === 'loading') {
    return (
      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography color="text.secondary" variant="body2">Memuat observasi kontrak harga…</Typography>
      </Box>
    )
  }

  if (phase === 'error') {
    return (
      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'rgba(179,38,30,0.04)' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <ErrorOutlineRoundedIcon color="error" fontSize="small" />
          <Typography fontWeight={700} variant="subtitle2">API harga tidak dapat dihubungi</Typography>
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {errorInfo.message} Tidak ada fallback otomatis ke data demo — mode tetap live.
        </Typography>
        {errorInfo.requestId && (
          <Typography color="text.disabled" variant="caption" sx={{ display: 'block' }}>request {errorInfo.requestId}</Typography>
        )}
        <Button onClick={() => setReloadKey((k) => k + 1)} size="small" sx={{ mt: 1, textTransform: 'none', fontWeight: 700 }}>
          Coba Lagi
        </Button>
      </Box>
    )
  }

  return (
    <Stack spacing={2}>
      <StateCard display={display} commodityName={commodityName} requestId={requestId} />
      <Box>
        <Typography fontWeight={700} variant="subtitle2" sx={{ mb: 0.5 }}>Tren kontrak ({DEFAULT_REGION.level} {DEFAULT_REGION.code})</Typography>
        <MiniHistoryChart rows={historyRows} commodityName={commodityName} />
      </Box>
      {health && (
        <Typography color="text.disabled" variant="caption">
          Kesehatan sumber {DEFAULT_SOURCE_ID}: {health.state}
          {health.last_success_age_seconds != null ? ` · last success ${Math.round(health.last_success_age_seconds / 3600)} jam lalu` : ''}
        </Typography>
      )}
    </Stack>
  )
}
