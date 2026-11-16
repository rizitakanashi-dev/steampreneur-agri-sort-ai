import React from 'react'
import { Box, Button, Card, CardContent, Stack, Typography, Alert } from '@mui/material'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary tertangkap:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 720, mx: 'auto', my: 4 }}>
          <Card elevation={3} sx={{ borderRadius: 3, border: '1px solid #fecaca' }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Stack spacing={2.5} alignItems="center" textAlign="center">
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ErrorOutlineRoundedIcon sx={{ fontSize: 36 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800} gutterBottom>
                    Terjadi Kendala Tampilan
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Halaman ini mengalami kendala rendering tak terduga. Sistem telah mengisolasi error agar aplikasi tetap aman.
                  </Typography>
                </Box>

                {this.state.error && (
                  <Alert severity="error" sx={{ width: '100%', textAlign: 'left', borderRadius: 2 }}>
                    <strong>Pesan:</strong> {this.state.error.message || String(this.state.error)}
                  </Alert>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshRoundedIcon />}
                    onClick={this.handleReset}
                  >
                    Coba Lagi
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<HomeRoundedIcon />}
                    onClick={() => {
                      this.handleReset()
                      window.location.hash = ''
                      window.location.reload()
                    }}
                  >
                    Muat Ulang Halaman
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )
    }

    return this.props.children
  }
}

