import { Box, Stack, Typography } from '@mui/material'
import { formatNumber } from './formatters.js'

/**
 * Indikator mutu tunggal (persentase + butir/kg) dengan ikon berwarna.
 * Diekstrak dari QCResults — murni presentasional.
 */
export function QualityIndicator({ color, icon: Icon, label, percentage, count, weight }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: 'center',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        flex: 1,
        minWidth: { xs: '100%', sm: 160 },
        p: 1.75,
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          bgcolor: `${color}18`,
          borderRadius: 2,
          color,
          display: 'flex',
          height: 42,
          justifyContent: 'center',
          width: 42,
        }}
      >
        <Icon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography color="text.secondary" noWrap variant="body2">
          {label}
        </Typography>
        <Typography color={color} fontWeight={800} variant="h6">
          {formatNumber(percentage)}%
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {count !== undefined ? `${count} butir` : `${formatNumber(weight)} kg`}
        </Typography>
      </Box>
    </Stack>
  )
}

export default QualityIndicator
