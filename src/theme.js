import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: {
      main: '#2e7d32',
      light: '#60ad5e',
      dark: '#1b5e20',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f3f6f4',
      paper: '#ffffff',
    },
    error: {
      main: '#c62828',
    },
    warning: {
      main: '#ed6c02',
    },
  },
})
