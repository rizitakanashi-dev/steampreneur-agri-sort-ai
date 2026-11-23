import { createTheme } from '@mui/material/styles'

const surfaceShadow = '0 1px 3px rgba(28, 48, 42, 0.08), 0 8px 24px rgba(28, 48, 42, 0.04)'

export const theme = createTheme({
  palette: {
    primary: { main: '#036e45', light: '#4f9c7d', dark: '#034d32', contrastText: '#ffffff' },
    background: { default: '#f4f6f8', paper: '#ffffff' },
    text: { primary: '#1d2326', secondary: '#68747a' },
    error: { main: '#a94f46' },
    warning: { main: '#c68f2f' },
    success: { main: '#289d67' },
    divider: '#e3e8e7',
  },
  shape: { borderRadius: 12 },
  spacing: 8,
  typography: {
    fontFamily: 'Inter, Roboto, Arial, sans-serif',
    // Heading bergaya editorial (serif) selaras dengan landing page;
    // teks UI tetap sans (Inter). h6 dibiarkan sans karena dipakai
    // sebagai judul kartu/panel level komponen.
    h1: { fontFamily: '"Source Serif 4", Georgia, serif', letterSpacing: '-0.02em' },
    h2: { fontFamily: '"Source Serif 4", Georgia, serif', letterSpacing: '-0.02em' },
    h3: { fontFamily: '"Source Serif 4", Georgia, serif', letterSpacing: '-0.02em' },
    h4: { fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 },
    h5: { fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.015em' },
    h6: { fontSize: '1rem', fontWeight: 750, letterSpacing: '-0.01em' },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
    caption: { lineHeight: 1.4 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    // Kartu sudut 24px & tombol pill selaras dengan landing page
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { borderRadius: 24, border: '1px solid #e3e8e7', boxShadow: surfaceShadow } } },
    MuiCardContent: { styleOverrides: { root: { '&:last-child': { paddingBottom: 24 } } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 9999, textTransform: 'none', fontWeight: 700, minHeight: 40, paddingInline: 18 } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 14 } } },
    MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
    MuiChip: { styleOverrides: { root: { fontWeight: 700, borderRadius: 9999 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 14 } } },
  },
})
