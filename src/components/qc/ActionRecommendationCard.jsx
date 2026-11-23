import { Alert, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import RecyclingRoundedIcon from '@mui/icons-material/RecyclingRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { formatNumber } from './formatters.js'

/**
 * Kartu rekomendasi tindakan sortir berdasarkan hasil reject.
 * Diekstrak dari QCResults — murni presentasional.
 */
export function ActionRecommendationCard({ recommendationNote, rejectCount, rejectPercentage }) {
  if (recommendationNote) {
    const isWarning = (rejectCount && rejectCount > 0) || (rejectPercentage && rejectPercentage > 0)
    return (
      <Alert
        icon={isWarning ? <WarningAmberRoundedIcon /> : <CheckCircleRoundedIcon />}
        severity={isWarning ? 'warning' : 'success'}
        sx={{ borderRadius: 2 }}
      >
        <Typography fontWeight={700} variant="body2">
          Rekomendasi Tindakan Sortir:
        </Typography>
        <Typography variant="body2">{recommendationNote}</Typography>
      </Alert>
    )
  }

  if (typeof rejectPercentage === 'number' && rejectPercentage > 0) {
    return (
      <Alert icon={<RecyclingRoundedIcon />} severity="warning" sx={{ borderRadius: 2 }}>
        <Typography fontWeight={700} variant="body2">
          Pisahkan produk Reject sebelum pengiriman.
        </Typography>
        <Typography variant="body2">
          Sebanyak {formatNumber(rejectPercentage)}% terindikasi cacat/reject. Pisahkan segera untuk mencegah penularan pembusukan.
        </Typography>
      </Alert>
    )
  }

  return (
    <Alert icon={<LocalShippingRoundedIcon />} severity="info" sx={{ borderRadius: 2 }}>
      <Typography fontWeight={700} variant="body2">
        Batch siap dipasarkan.
      </Typography>
      <Typography variant="body2">
        Seluruh sampel berada dalam kondisi prima untuk dipasarkan ke mitra pengepul.
      </Typography>
    </Alert>
  )
}

export default ActionRecommendationCard
