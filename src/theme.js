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
    h4: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.15 },
    h5: { fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em' },
    h6: { fontSize: '1rem', fontWeight: 750, letterSpacing: '-0.01em' },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
    caption: { lineHeight: 1.4 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: '1px solid #e3e8e7', boxShadow: surfaceShadow } } },
    MuiCardContent: { styleOverrides: { root: { '&:last-child': { paddingBottom: 24 } } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 9, textTransform: 'none', fontWeight: 700, minHeight: 40 } } },
    MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
    MuiChip: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
  },
})
