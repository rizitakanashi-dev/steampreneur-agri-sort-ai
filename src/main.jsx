import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import App from './App.jsx'
import { theme } from './theme.js'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

// Registrasi Service Worker untuk Kesiapan Lapangan Offline Petani (PWA)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env?.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Service worker terdaftar sukses
      })
      .catch((err) => {
        // Gagal registrasi service worker (abaikan tanpa mengganggu UI)
      })
  })
}
