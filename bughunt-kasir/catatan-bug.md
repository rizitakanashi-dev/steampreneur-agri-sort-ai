# Catatan Bug Hunt: Kasir Kantin STEAM

**Nama tim: Agri-Sort AI**

Buat satu entri untuk setiap bug yang ditemukan. Simpan file ini di folder `bughunt-kasir/`.

## Bug 1 — Jumlah pesanan tidak divalidasi (bisa 0, negatif, pecahan, kosong, atau > 99)
- **Gejala** (apa yang terlihat salah): Pengguna bisa menambahkan produk dengan jumlah kosong, 0, negatif, pecahan, teks bebas, atau lebih dari 99, dan aplikasi tetap menerimanya. Baris keranjang lalu menampilkan jumlah tidak masuk akal seperti `0`, `-5`, `2.5`, `abc`, atau `120`.
- **Langkah untuk memunculkan bug:**
  1. Buka `index.html` di browser.
  2. Pada form "Tambah Pesanan", isi kolom Jumlah dengan `0` (atau `-5`, `2.5`, `abc`, atau `100`).
  3. Klik **Tambah**.
  4. Produk tetap masuk ke keranjang tanpa pesan kesalahan.
  - Cara cepat tanpa browser (dari folder `bughunt-kasir`):
    ```
    node -e "const k=require('./kasir.js'); const c=[]; k.tambahItem(c,'K04',-5); console.log(c);"
    ```
    Keluaran lama: `[ { kode: 'K04', nama: 'Es Teh', harga: 4000, qty: -5 } ]` — seharusnya ditolak.
- **Aturan bisnis yang dilanggar** (nomor aturan di README): **Aturan 1** — "Jumlah pesanan per produk harus bilangan bulat dari 1 sampai 99. Jumlah kosong, nol, negatif, atau pecahan harus ditolak dengan pesan kesalahan."
- **Penyebab** (file, fungsi, dan penjelasan):
  - **File:** `kasir.js`, fungsi `tambahItem(keranjang, kode, qty)`.
  - **penjelasan:**  Sebelumnya, fungsi tersebut hanya memeriksa apakah ada produk yang dimasukkan ke dalam daftar menu. namun, fungsi tersebut belum memeriksa apakah jumlah pesanan merupakan bilangan bulat dari angka 1 hingga 99. akibatnya, jumlah yang tidak sesuai dengan aturan, seperti nol, angka negatif, pecahan, atau teks yang bukan angka, bisa diterima dan dimasukkan kedalam kerangjang tanpa validasi yang tepat.
  - **[x] Pengguna sudah menulis ulang penyebab dengan bahasa sendiri** (diisi setelah sesi penjelasan).
- **Perbaikan** (apa yang diubah): Menambahkan pemeriksaan di awal `tambahItem` setelah produk ditemukan: nilai `qty` dikonversi ke angka (`Number(qty)`), lalu ditolak dengan pesan kesalahan bila bukan bilangan bulat atau berada di luar rentang 1–99. Tidak ada perubahan pada cara penyimpanan jumlah, sehingga cakupan perbaikan tetap hanya Aturan 1.
- **Test yang membuktikan** (nama test): `tes/validasiJumlah.test.js` — 7 test:
  - `B1: jumlah kosong ditolak`
  - `B1: jumlah nol ditolak`
  - `B1: jumlah negatif ditolak`
  - `B1: jumlah pecahan ditolak`
  - `B1: jumlah non-numerik ditolak`
  - `B1: jumlah di atas 99 ditolak`
  - `B1: batas sah 1 dan 99 diterima`
  - **Bukti RED:** pada kode asli commit `7eb5c47` → `tests 7, pass 1, fail 6` (6 test penolakan gagal dengan "Missing expected exception").
  - **Bukti GREEN:** setelah perbaikan → `tests 8, pass 8, fail 0` (termasuk test contoh lama). Regression suite induk `agri-sort-ai`: `tests 57, pass 57, fail 0`.
- **Commit perbaikan** (pesan commit): `perbaikan: tolak jumlah pesanan yang bukan bilangan bulat 1-99`
- **Ditemukan oleh:** AI (diverifikasi lewat eksekusi nyata oleh tim)

## Bug 2
- **Gejala:**
- **Langkah untuk memunculkan bug:**
- **Aturan bisnis yang dilanggar:**
- **Penyebab:**
- **Perbaikan:**
- **Test yang membuktikan:**
- **Commit perbaikan:**
- **Ditemukan oleh:**
