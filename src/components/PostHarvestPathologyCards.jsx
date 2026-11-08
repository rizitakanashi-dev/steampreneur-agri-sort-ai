import { useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import BiotechRoundedIcon from '@mui/icons-material/BiotechRounded'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import {
  ALL_PATHOLOGY_ITEMS,
  getPathologiesForCommodity,
  getPrimaryScienceRecommendation,
} from '../business/pathologyReference.js'

export function PostHarvestPathologyCards({ commodity, rejectCount = 0, rejectPercent = 0 }) {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [selectedCommodityFilter, setSelectedCommodityFilter] = useState(commodity || 'Semua')

  const relevantPathologies = getPathologiesForCommodity(commodity)
  const primaryRec = getPrimaryScienceRecommendation({
    commodity,
    rejectCount,
    rejectPercent,
  })

  const catalogItems =
    selectedCommodityFilter === 'Semua'
      ? ALL_PATHOLOGY_ITEMS
      : getPathologiesForCommodity(selectedCommodityFilter)

  const hasReject = rejectCount > 0 || rejectPercent > 0
  const [showPreventiveGuide, setShowPreventiveGuide] = useState(false)

  return (
    <Card
      sx={{
        border: '1px solid',
        borderColor: hasReject ? '#ff980040' : '#4caf5040',
        borderRadius: 2.5,
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Header Modul Sains STEAM */}
        <Stack
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <Stack alignItems="center" direction="row" spacing={1.5}>
            <Box
              sx={{
                alignItems: 'center',
                bgcolor: hasReject ? '#fff3e0' : '#e8f5e9',
                borderRadius: 2,
                color: hasReject ? '#e65100' : '#2e7d32',
                display: 'flex',
                height: 40,
                justifyContent: 'center',
                width: 40,
              }}
            >
              <ScienceRoundedIcon fontSize="small" />
            </Box>
            <Box>
              <Stack alignItems="center" direction="row" spacing={1}>
                <Typography fontWeight={700} variant="subtitle1">
                  Sains Patologi Pascapanen & Mitigasi Mutu
                </Typography>
                <Chip
                  color={hasReject ? 'warning' : 'success'}
                  label={hasReject ? 'Deteksi Cacat Aktif' : 'Batch Sehat & Prima'}
                  size="small"
                  sx={{ fontWeight: 600, height: 22, fontSize: '0.72rem' }}
                />
              </Stack>
              <Typography color="text.secondary" variant="caption">
                Diagnosis biologi pembusukan, fisiologi turgor, dan pedoman agronomis pascapanen (Pilar S — STEAM)
              </Typography>
            </Box>
          </Stack>

          <Button
            onClick={() => setIsCatalogOpen(true)}
            size="small"
            startIcon={<MenuBookRoundedIcon />}
            variant="outlined"
          >
            Katalog Sains Patologi
          </Button>
        </Stack>

        {/* Insight Diagnosis Utama */}
        <Box
          sx={{
            bgcolor: hasReject ? '#fff8e1' : '#f1f8e9',
            borderLeft: '4px solid',
            borderColor: hasReject ? '#ffa000' : '#66bb6a',
            borderRadius: '0 8px 8px 0',
            mb: 2.5,
            p: 1.75,
          }}
        >
          <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
            {hasReject ? (
              <WarningAmberRoundedIcon color="warning" fontSize="small" />
            ) : (
              <HealthAndSafetyRoundedIcon color="success" fontSize="small" />
            )}
            <Typography fontWeight={700} variant="body2">
              {hasReject
                ? `Terdeteksi ${rejectCount > 0 ? `${rejectCount} Butir Cacat/Reject` : `${rejectPercent}% Cacat`} — Potensi Infeksi Pascapanen`
                : 'Kondisi Batch: 100% Prima — Bebas Gejala Patologi & Pembusukan'}
            </Typography>
          </Stack>
          <Typography color="text.primary" sx={{ mb: 1 }} variant="body2">
            {hasReject ? (
              <>
                <strong>Tindakan Mitigasi Presisi:</strong> Segera lakukan pemilahan (<em>culling</em>) buah bergejala busuk/bercak dari keranjang utama. Jangan biarkan lendir atau spora mengontaminasi buah sehat di sekitarnya selama distribusi.
              </>
            ) : (
              <>
                <strong>Pemeliharaan Turgor & Rantai Dingin:</strong> Tidak terindikasi adanya pembusukan jamur atau bakteri. Simpan keranjang di tempat teduh (suhu 12–15°C) berventilasi baik dan hindari penumpukan panas lapang (<em>field heat</em>) agar kesegaran Grade A bertahan maksimal.
              </>
            )}
          </Typography>
          <Typography color="text.secondary" sx={{ fontStyle: 'italic' }} variant="caption">
            Rekomendasi diselaraskan dengan standar fisiologi pascapanen untuk komoditas {commodity || 'hortikultura'}.
          </Typography>
        </Box>

        {/* Jika ada reject: tampilkan kartu patologi langsung. Jika bebas reject: sediakan toggle panduan preventif */}
        {hasReject ? (
          <>
            <Typography color="text.secondary" fontWeight={600} sx={{ mb: 1.5 }} variant="caption">
              POTENSI PENYEBAB CACAT PADA BATCH {String(commodity || 'HORTIKULTURA').toUpperCase()} INI:
            </Typography>

            <Stack spacing={1.25}>
              {relevantPathologies.map((item) => (
                <Accordion
                  disableGutters
                  key={item.id}
                  sx={{
                    bgcolor: '#fafafa',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px !important',
                    '&:before': { display: 'none' },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Stack alignItems="center" direction="row" spacing={1.5} sx={{ width: '100%', pr: 1 }}>
                      {item.agentType.includes('Bakteri') ? (
                        <BiotechRoundedIcon color="error" fontSize="small" />
                      ) : item.agentType.includes('Jamur') ? (
                        <BugReportRoundedIcon color="warning" fontSize="small" />
                      ) : (
                        <ScienceRoundedIcon color="primary" fontSize="small" />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={600} variant="body2">
                          {item.name}
                        </Typography>
                        <Typography color="text.secondary" sx={{ fontStyle: 'italic' }} variant="caption">
                          {item.scientificName}
                        </Typography>
                      </Box>
                      <Chip
                        label={`Berdampak: ${item.severityGrade}`}
                        size="small"
                        sx={{
                          fontSize: '0.7rem',
                          height: 20,
                          bgcolor: item.severityGrade.includes('Reject') ? '#ffebee' : '#fff3e0',
                          color: item.severityGrade.includes('Reject') ? '#c62828' : '#e65100',
                          fontWeight: 600,
                        }}
                      />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography color="text.secondary" fontWeight={600} variant="caption">
                          Gejala Makroskopis Buah:
                        </Typography>
                        <Typography sx={{ mb: 1 }} variant="body2">
                          {item.macroscopicSymptoms}
                        </Typography>

                        <Typography color="text.secondary" fontWeight={600} variant="caption">
                          Mekanisme Penularan Pascapanen:
                        </Typography>
                        <Typography variant="body2">
                          {item.postHarvestMechanism}
                        </Typography>
                      </Grid>

                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography color="primary.main" fontWeight={600} variant="caption">
                          Tindakan Mitigasi Petani / Pengepul:
                        </Typography>
                        <Typography sx={{ mb: 1 }} variant="body2">
                          {item.mitigationAction}
                        </Typography>

                        <Typography color="success.main" fontWeight={600} variant="caption">
                          Tips Pencegahan Saat Panen:
                        </Typography>
                        <Typography sx={{ mb: 1 }} variant="body2">
                          {item.preventionTips}
                        </Typography>

                        <Chip
                          label={item.steamPillar}
                          size="small"
                          sx={{ fontSize: '0.68rem', height: 20, bgcolor: '#ede7f6', color: '#512da8' }}
                        />
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          </>
        ) : (
          <Box sx={{ mt: 1 }}>
            <Button
              color="inherit"
              onClick={() => setShowPreventiveGuide((prev) => !prev)}
              size="small"
              startIcon={<ExpandMoreRoundedIcon sx={{ transform: showPreventiveGuide ? 'rotate(180deg)' : 'none' }} />}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              {showPreventiveGuide
                ? 'Sembunyikan Panduan Edukasi Penyakit Potensial'
                : `Pelajari Potensi Penyakit & Gangguan Pascapanen ${commodity || 'Komoditas Ini'} (Panduan Preventif)`}
            </Button>

            {showPreventiveGuide && (
              <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                {relevantPathologies.map((item) => (
                  <Accordion
                    disableGutters
                    key={item.id}
                    sx={{
                      bgcolor: '#fafafa',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px !important',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                      <Stack alignItems="center" direction="row" spacing={1.5} sx={{ width: '100%', pr: 1 }}>
                        {item.agentType.includes('Bakteri') ? (
                          <BiotechRoundedIcon color="error" fontSize="small" />
                        ) : item.agentType.includes('Jamur') ? (
                          <BugReportRoundedIcon color="warning" fontSize="small" />
                        ) : (
                          <ScienceRoundedIcon color="primary" fontSize="small" />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={600} variant="body2">
                            {item.name}
                          </Typography>
                          <Typography color="text.secondary" sx={{ fontStyle: 'italic' }} variant="caption">
                            {item.scientificName}
                          </Typography>
                        </Box>
                        <Chip
                          label={`Potensi Dampak: ${item.severityGrade}`}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            height: 20,
                            bgcolor: '#f5f5f5',
                            color: 'text.secondary',
                            fontWeight: 600,
                          }}
                        />
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
                      <Divider sx={{ mb: 1.5 }} />
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography color="text.secondary" fontWeight={600} variant="caption">
                            Gejala Makroskopis Buah:
                          </Typography>
                          <Typography sx={{ mb: 1 }} variant="body2">
                            {item.macroscopicSymptoms}
                          </Typography>

                          <Typography color="text.secondary" fontWeight={600} variant="caption">
                            Mekanisme Penularan Pascapanen:
                          </Typography>
                          <Typography variant="body2">
                            {item.postHarvestMechanism}
                          </Typography>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography color="primary.main" fontWeight={600} variant="caption">
                            Tindakan Mitigasi Petani / Pengepul:
                          </Typography>
                          <Typography sx={{ mb: 1 }} variant="body2">
                            {item.mitigationAction}
                          </Typography>

                          <Typography color="success.main" fontWeight={600} variant="caption">
                            Tips Pencegahan Saat Panen:
                          </Typography>
                          <Typography sx={{ mb: 1 }} variant="body2">
                            {item.preventionTips}
                          </Typography>

                          <Chip
                            label={item.steamPillar}
                            size="small"
                            sx={{ fontSize: '0.68rem', height: 20, bgcolor: '#ede7f6', color: '#512da8' }}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            )}
          </Box>
        )}
      </CardContent>

      {/* Dialog Modal Eksplorasi Seluruh Katalog Sains Patologi */}
      <Dialog
        fullWidth
        maxWidth="md"
        onClose={() => setIsCatalogOpen(false)}
        open={isCatalogOpen}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack alignItems="center" direction="row" justifyContent="space-between">
            <Stack alignItems="center" direction="row" spacing={1.5}>
              <Box
                sx={{
                  alignItems: 'center',
                  bgcolor: '#ede7f6',
                  borderRadius: 2,
                  color: '#512da8',
                  display: 'flex',
                  height: 38,
                  justifyContent: 'center',
                  width: 38,
                }}
              >
                <ScienceRoundedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography fontWeight={700} variant="h6">
                  Katalog Sains Patologi Pascapanen Hortikultura
                </Typography>
                <Typography color="text.secondary" variant="caption">
                  Pilar Science (Sains) — Inovasi STEAMPreneur SMK Nasional 2026 (SMKN 4 Payakumbuh)
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={() => setIsCatalogOpen(false)} size="small">
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {/* Filter Komoditas di Katalog */}
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2.5 }}>
            {['Semua', 'Terung', 'Tomat', 'Cabai Merah Keriting', 'Cabai Rawit Merah'].map((comm) => (
              <Chip
                clickable
                color={selectedCommodityFilter === comm ? 'primary' : 'default'}
                key={comm}
                label={comm}
                onClick={() => setSelectedCommodityFilter(comm)}
                size="small"
                variant={selectedCommodityFilter === comm ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>

          <Grid container spacing={2}>
            {catalogItems.map((item) => (
              <Grid key={item.id} size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: '100%', border: '1px solid #e0e0e0', borderRadius: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack alignItems="center" direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography fontWeight={700} variant="subtitle2">
                        {item.name}
                      </Typography>
                      <Chip
                        label={item.agentType.split(' ')[0]}
                        size="small"
                        sx={{ fontSize: '0.68rem', height: 20 }}
                      />
                    </Stack>
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic', mb: 1.5 }} variant="caption">
                      {item.scientificName}
                    </Typography>

                    <Typography color="text.secondary" fontWeight={600} variant="caption">
                      Gejala Visual:
                    </Typography>
                    <Typography sx={{ mb: 1 }} variant="body2">
                      {item.macroscopicSymptoms}
                    </Typography>

                    <Typography color="primary.main" fontWeight={600} variant="caption">
                      Tindakan Mitigasi Agronomis:
                    </Typography>
                    <Typography sx={{ mb: 1 }} variant="body2">
                      {item.mitigationAction}
                    </Typography>

                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                      {item.affectedCommodities.map((c) => (
                        <Chip
                          key={c}
                          label={c}
                          size="small"
                          sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#f5f5f5' }}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsCatalogOpen(false)} variant="contained">
            Tutup Katalog
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

