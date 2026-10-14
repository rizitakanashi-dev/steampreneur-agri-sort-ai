import { Divider, Stack, Typography } from '@mui/material'

export function PageHeader({ eyebrow, title, description }) {
  return (
    <Stack spacing={1.25} sx={{ mb: { xs: 2, sm: 3 } }}>
      {eyebrow && (
        <Typography color="primary" variant="overline">
          {eyebrow}
        </Typography>
      )}
      <Typography component="h1" variant="h5">
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" variant="body2">
          {description}
        </Typography>
      )}
      <Divider sx={{ pt: 1 }} />
    </Stack>
  )
}
