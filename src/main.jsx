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
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (!import.meta.env?.PROD) {
    // Di lingkungan dev lokal, bersihkan semua Service Worker dan Cache agar perubahan kode langsung terlihat
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister()
      }
    })
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name)
        }
      })
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update()
        })
        .catch(() => {
          // Gagal registrasi service worker (abaikan tanpa mengganggu UI)
        })
    })
  }
}
