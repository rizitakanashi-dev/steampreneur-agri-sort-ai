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

## Bug 2 — Total jumlah gabungan satu produk bisa melebihi 99
- **Gejala** (apa yang terlihat salah): Jika produk yang sama ditambahkan dua kali dan totalnya melebihi 99, aplikasi tetap menerimanya. Contoh: Es Teh 60 lalu tambah Es Teh 60 lagi menghasilkan satu baris keranjang dengan jumlah `120`, padahal jumlah per produk dibatasi 99.
- **Langkah untuk memunculkan bug:**
  1. Buka `index.html` di browser.
  2. Pada form "Tambah Pesanan", pilih **Es Teh**, isi Jumlah `60`, klik **Tambah**.
  3. Pilih **Es Teh** lagi, isi Jumlah `60`, klik **Tambah**.
  4. Baris keranjang menampilkan Es Teh dengan jumlah `120` tanpa pesan kesalahan.
  - Cara cepat tanpa browser (dari folder `bughunt-kasir`):
    ```
    node -e "const k=require('./kasir.js'); const c=[]; k.tambahItem(c,'K04',60); k.tambahItem(c,'K04',60); console.log(c);"
    ```
    Keluaran lama: `[ { kode: 'K04', nama: 'Es Teh', harga: 4000, qty: 120 } ]` — seharusnya penambahan kedua ditolak.
- **Aturan bisnis yang dilanggar** (nomor aturan di README): **Aturan 2** — "Jika produk yang sudah ada di keranjang ditambahkan lagi, jumlahnya dijumlahkan. Contoh: Es Teh 2, lalu tambah Es Teh 3, maka di keranjang tertulis Es Teh 5. **Total jumlah per produk tetap tidak boleh lebih dari 99.**"
- **Penyebab** (file, fungsi, dan penjelasan):
  - **File:** `kasir.js`, fungsi `tambahItem(keranjang, kode, qty)`.
  - **penjelasan:** Fungsi `tambahItem` sudah punya pemeriksaan Aturan 1 yang membatasi **jumlah yang baru dimasukkan** agar berada di rentang 1–99. Tetapi pemeriksaan itu hanya melihat `qty` yang baru, bukan hasil gabungannya. Jadi ketika produk sudah ada di keranjang, baris `itemLama.qty += qty` langsung menjumlahkan tanpa memeriksa apakah total barunya melewati 99. Akibatnya masing-masing penambahan sah (60 sah, 60 sah), tetapi gabungannya menjadi 120 — melewati batas. Batas 99 harus diperiksa pada **total setelah dijumlahkan**, bukan hanya pada angka yang baru dimasukkan.
  - **[x] Pengguna sudah menulis ulang penyebab dengan bahasa sendiri** (diisi setelah sesi penjelasan).
- **Perbaikan** (apa yang diubah): Menambahkan pemeriksaan di dalam cabang `if (itemLama)` pada `tambahItem`, tepat sebelum penjumlahan: jika `Number(itemLama.qty) + jumlah` melebihi 99, lempar pesan kesalahan dan batalkan penambahan sehingga isi keranjang tidak berubah. Tidak ada perubahan pada cara penyimpanan jumlah dan tidak ada perubahan pada cabang produk baru, sehingga cakupan perbaikan tetap hanya Aturan 2.
- **Test yang membuktikan** (nama test): `tes/batasGabungan.test.js` — 6 test:
  - `B2: contoh README, Es Teh 2 lalu 3 menjadi 5`
  - `B2: Es Teh 60 lalu 60 ditolak karena total 120 melebihi 99`
  - `B2: Es Teh 50 lalu 49 diterima karena total tepat 99`
  - `B2: Es Teh 50 lalu 50 ditolak karena total 100 melebihi 99`
  - `B2: Es Teh 99 lalu 1 ditolak karena total 100 melebihi 99`
  - `B2: batas 99 berlaku per produk, bukan per keranjang`
  - **Bukti RED:** pada kode sebelum perbaikan B2 (commit `b783066`, kondisi setelah B1) → `tests 14, pass 11, fail 3` (3 test penolakan gabungan gagal dengan "Missing expected exception").
  - **Bukti GREEN:** setelah perbaikan → `tests 14, pass 14, fail 0`. Regression suite induk `agri-sort-ai`: `tests 57, pass 57, fail 0`.
  - **Catatan cakupan:** seluruh test memakai angka murni, bukan string, supaya bug B3 (`"2"` + `"3"` → `"23"`) tidak ikut tercampur. Setelah perbaikan B2, B3 masih terverifikasi belum diperbaiki.
- **Commit perbaikan** (pesan commit): `perbaikan: batasi total jumlah per produk maksimal 99`
- **Ditemukan oleh:** AI (diverifikasi lewat eksekusi nyata oleh tim)
