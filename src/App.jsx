import { Box, Button, Container, Typography } from '@mui/material'

function App() {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Typography color="primary" component="p" gutterBottom variant="overline">
          Fondasi proyek
        </Typography>
        <Typography component="h1" gutterBottom variant="h3">
          Agri-Sort AI
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 640, mb: 3 }} variant="body1">
          Quality Control dan Smart Pricing untuk hasil panen hortikultura.
          Alur input, kalkulasi, dan rekap akan dibangun bertahap sesuai spesifikasi.
        </Typography>
        <Button disabled variant="contained">
          Mulai alur inti pada langkah berikutnya
        </Button>
      </Box>
    </Container>
  )
}

export default App
