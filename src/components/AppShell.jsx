import { useState } from 'react'
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AgricultureRoundedIcon from '@mui/icons-material/AgricultureRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import PriceCheckRoundedIcon from '@mui/icons-material/PriceCheckRounded'
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'

const drawerWidth = 248

const navigationItems = [
  { id: 'overview', label: 'Dashboard', icon: DashboardRoundedIcon },
  { id: 'scanner', label: 'Batch QC Scanner', icon: QrCodeScannerRoundedIcon },
  { id: 'results', label: 'Hasil Analisis QC', icon: AssessmentRoundedIcon },
  { id: 'pricing', label: 'Harga Pasar', icon: PriceCheckRoundedIcon },
]

export function AppShell({ activePage, onNavigate, children }) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleNavigate = (pageId) => {
    onNavigate(pageId)
    setMobileOpen(false)
  }

  const drawerContent = (
    <Stack sx={{ height: '100%', bgcolor: '#f2f4f6' }}>
      <Toolbar sx={{ minHeight: { xs: 72, md: 80 }, px: 2.5 }}>
        <Box
          sx={{
            alignItems: 'center',
            bgcolor: 'primary.main',
            borderRadius: 2,
            color: 'common.white',
            display: 'flex',
            height: 34,
            justifyContent: 'center',
            mr: 1.25,
            width: 34,
          }}
        >
          <AgricultureRoundedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography color="text.primary" fontWeight={800} sx={{ lineHeight: 1 }} variant="subtitle1">
            Agri-Sort AI
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.4 }} variant="caption">
            Precision Agriculture
          </Typography>
        </Box>
        {!isDesktop && (
          <IconButton aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} sx={{ ml: 'auto' }}>
            <CloseRoundedIcon />
          </IconButton>
        )}
      </Toolbar>

      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography color="text.secondary" sx={{ px: 1.5, pb: 1.25, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em' }}>
          WORKSPACE
        </Typography>
        <List disablePadding>
          {navigationItems.map(({ id, label, icon: Icon }) => (
            <ListItemButton
              key={id}
              aria-current={activePage === id ? 'page' : undefined}
              onClick={() => handleNavigate(id)}
              selected={activePage === id}
              sx={{
                '&.Mui-selected': { bgcolor: 'rgba(1, 110, 68, 0.12)', color: 'primary.dark' },
                '&.Mui-selected:hover': { bgcolor: 'rgba(1, 110, 68, 0.18)' },
                borderRadius: 1.75,
                mb: 0.5,
                minHeight: 44,
                px: 1.5,
              }}
            >
              <ListItemIcon sx={{ color: activePage === id ? 'primary.main' : 'text.secondary', minWidth: 36 }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={label} slotProps={{ primary: { sx: { fontSize: 13, fontWeight: activePage === id ? 700 : 500 } } }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Box sx={{ mt: 1, px: 1.5 }}>
        <Typography color="text.secondary" sx={{ px: 1.5, pb: 1.25, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em' }}>
          SYSTEM
        </Typography>
        <List disablePadding>
          <ListItemButton sx={{ borderRadius: 1.75, minHeight: 44, px: 1.5 }}>
            <ListItemIcon sx={{ color: 'text.secondary', minWidth: 36 }}><SettingsRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Pengaturan" slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 500 } } }} />
          </ListItemButton>
        </List>
      </Box>

      <Box sx={{ flexGrow: 1 }} />
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', borderTop: '1px solid', borderColor: 'divider', p: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.dark', fontSize: 13, height: 32, width: 32 }}>AS</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap fontWeight={700} variant="body2">Agri-Sort Workspace</Typography>
          <Typography color="text.secondary" noWrap variant="caption">Mode lokal · Aktif</Typography>
        </Box>
      </Stack>
    </Stack>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      {!isDesktop && (
        <AppBar color="inherit" elevation={0} position="fixed" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar sx={{ minHeight: 64 }}>
            <IconButton aria-label="Buka navigasi" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuRoundedIcon />
            </IconButton>
            <Typography color="text.primary" fontWeight={800} variant="subtitle1">Agri-Sort AI</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Avatar sx={{ bgcolor: 'primary.dark', fontSize: 12, height: 30, width: 30 }}>AS</Avatar>
          </Toolbar>
        </AppBar>
      )}

      <Drawer
        ModalProps={{ keepMounted: true }}
        onClose={() => setMobileOpen(false)}
        open={isDesktop || mobileOpen}
        variant={isDesktop ? 'permanent' : 'temporary'}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
        {!isDesktop && <Toolbar sx={{ minHeight: 64 }} />}
        {children}
      </Box>
    </Box>
  )
}
