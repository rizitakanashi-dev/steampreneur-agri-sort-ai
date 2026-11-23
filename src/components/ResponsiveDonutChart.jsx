import { useEffect, useRef, useState } from 'react'
import { Box, Chip, Stack } from '@mui/material'
import { PieChart } from '@mui/x-charts/PieChart'

/**
 * Donut chart yang menyesuaikan lebar kontainer secara otomatis.
 *
 * Pengganti <PieChart width={angkaTetap}> agar tidak overflow di layar sempit.
 * Radius dalam/luar dihitung ulang dari lebar tersedia, dan legend
 * disembunyikan otomatis bila ruang terlalu sempit (info grade tetap
 * terbaca dari daftar chip/kartu di sampingnya).
 */
export function ResponsiveDonutChart({ data, height = 220, maxOuterRadius = 95, sx }) {
  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    const updateWidth = () => setWidth(el.clientWidth)
    updateWidth()

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(updateWidth)
      observer.observe(el)
      return () => observer.disconnect()
    }
    // Fallback browser lama tanpa ResizeObserver
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const safeWidth = Math.max(width, 120)
  const outerRadius = Math.min(maxOuterRadius, Math.floor(safeWidth / 2) - 6)
  const innerRadius = Math.round(outerRadius * 0.58)

  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0)

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        maxWidth: '100%',
        // Kunci ukuran: chart tidak boleh mendorong halaman meluber ke samping
        overflow: 'hidden',
        '& svg': { maxWidth: '100%' },
        ...sx,
      }}
    >
      {width > 0 && (
        <PieChart
          height={height}
          series={[
            {
              data,
              innerRadius,
              outerRadius,
              paddingAngle: 3,
              cornerRadius: 4,
            },
          ]}
          // Legend bawaan disembunyikan: diganti chip kustom di bawah agar
          // selalu terbaca (nama + persentase) dan tidak meluber di layar sempit
          slotProps={{ legend: { hidden: true } }}
          width={safeWidth}
        />
      )}
      {total > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.75} justifyContent="center" sx={{ mt: 1 }}>
          {data.map((d) => (
            <Chip
              key={d.id ?? d.label}
              label={`${d.label} ${Math.round(((Number(d.value) || 0) / total) * 100)}%`}
              size="small"
              sx={{
                bgcolor: `${d.color}18`,
                borderColor: d.color,
                color: d.color,
                fontWeight: 700,
              }}
              variant="outlined"
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}

export default ResponsiveDonutChart
