# Spesifikasi Produk

**Nama tim:** Tim Agri-Sort AI (SMKN 4 Payakumbuh)
**Nama produk:** Agri-Sort AI (versi challenge: aplikasi web client-side untuk QC dan pencatatan hasil panen)
**Alur inti yang dibangun:** Pengguna mengisi data hasil panen (cabai rawit hijau, terung, atau tomat), aplikasi menghitung rasio Grade A, B, C beserta nilai pendapatannya dalam Rupiah, lalu pengguna menyimpan dan melihat kembali datanya di tabel rekap.

> **Catatan hubungan dengan proposal.** Proposal Agri-Sort AI menggambarkan visi jangka panjang: klasifikasi mutu dengan computer vision (YOLO11), backend FastAPI, database Supabase, dan integrasi harga BAPANAS. Dokumen ini membatasi diri pada **prototipe yang dibangun dalam challenge**: grade dihitung dari data yang diinput pengguna dengan aturan bisnis yang jelas, berjalan sepenuhnya di browser. Bagian computer vision dan integrasi harga resmi adalah tahap pengembangan lanjutan (lihat Bagian 5).
>
> **Penyesuaian istilah dan komoditas.**
> - **Grade C** di dokumen ini sama dengan **Reject / Tolak / Afkir** di proposal dan mockup Figma: buah cacat yang tidak layak dijual sebagai produk segar.
> - Proposal menyebut cabai (cabai besar dan cabai rawit) serta tomat sebagai komoditas utama. Pada prototipe challenge ini, komoditas disesuaikan dengan hasil wawancara petani lokal Payakumbuh (narasumber N-01), yaitu **Cabai Rawit Hijau, Terung, dan Tomat**.

---

## 1. Masalah

Di Payakumbuh, hasil panen cabai rawit hijau, terung, dan tomat dinilai mutunya secara manual oleh pengepul dan pedagang: buah dipilah satu per satu dengan tangan, lalu hasilnya dicatat di buku tulis atau diingat saja. Akibatnya ada empat masalah nyata:

1. **Lambat.** Menurut proposal tim, memilah 100 kg hasil panen bisa memakan 2 sampai 4 jam, terutama saat panen raya.
2. **Subjektif.** Satu orang menilai "bagus" dan orang lain menilai "agak layu". Tidak ada pembagian grade yang tertulis, sehingga harga ditentukan lewat tawar-menawar dan petani sering merasa potongan harganya tidak jelas.
3. **Pencatatan tidak rapi.** Catatan di buku mudah hilang, tulisannya sulit dibaca, dan hitungan nilai panen sering salah karena dikalikan manual untuk tiap tingkat mutu.
4. **Sulit ditelusuri.** Ketika terjadi selisih antara petani dan pembeli, tidak ada riwayat yang bisa dibuka kembali untuk membuktikan berapa berat, berapa persen yang cacat, dan berapa nilainya.

Masalah ini dialami oleh petani, pedagang pengumpul (toke), dan pedagang pasar yang menangani komoditas hortikultura yang cepat rusak (menurut proposal, kerusakan fisik pasca panen berkisar 15% sampai 25%).

**Yang diselesaikan produk ini:** menyediakan cara yang cepat, seragam, dan terdokumentasi untuk menilai satu setoran panen. Pengguna cukup mengisi lima data, lalu aplikasi menghitung pembagian grade dan nilai uangnya secara konsisten, dan menyimpannya sebagai riwayat.

---

## 2. Pengguna

| Pengguna | Peran dalam rantai panen | Kebutuhan utama dari aplikasi |
|---|---|---|
| **Petani** | Menghasilkan panen dan menyetor ke pengepul atau menjual langsung | Mengetahui perkiraan nilai panennya sendiri sebelum tawar-menawar, dan menyimpan catatan panen per tanggal |
| **Pedagang pengumpul (toke)** | Menerima setoran dari banyak petani, menilai mutu, menentukan harga beli, lalu menjual ke pedagang pasar | Menilai mutu setoran dengan aturan yang seragam, menghitung nilai bayar dengan cepat, dan punya riwayat untuk menyelesaikan selisih |
| **Pedagang pasar** | Membeli dari pengumpul dan menjual eceran | Mengecek rasio mutu pasokan yang dibeli dan mencatat stok serta nilainya |

Ketiganya memakai aplikasi yang sama dengan alur yang sama. Perangkat yang paling mungkin dipakai adalah **HP** (di gudang, kebun, atau pasar), sehingga tampilan harus nyaman di layar kecil.

---

## 3. Hasil wawancara calon pengguna

**Narasumber (peran saja):** Petani cabai rawit hijau dan terung (kode berkas N-01; nama samaran, tidak dicantumkan di dokumen ini).
**Cara wawancara dan tanggal:** 4 Oktober 2026, [langsung].
**Bukti:** `docs/bukti/Bukti_Wawancara_N-01.pdf` (catatan wawancara dan draf transkrip). Transkrip dirapikan dengan bantuan AI; jika ada perbedaan dengan rekaman audio, yang dipakai adalah rekaman.

### 3.1 Tanya-jawab wawancara

| Pertanyaan kami | Jawaban narasumber |
|---|---|
| Bagaimana aktivitas harian Bapak saat panen? | Terung dan cabai ada yang dipetik sendiri dan ada yang diupahkan ke orang lain. Memetik terung cukup setengah hari, sedangkan cabai rawit bisa 1 sampai 2 hari. |
| Bagaimana pengalaman Bapak saat memilah cabai dan terung? | Dari sisi pasar, pemilahan cabai rawit hijau sebenarnya tidak ada: asalkan tidak busuk dan tidak rusak, semua laku dengan harga sama. Terung juga begitu: asalkan tidak busuk dan tidak kena ulat, ukuran besar, sedang, atau kecil harganya tetap sama. |
| Seberapa sering Bapak panen? | Cabai rawit 1 kali seminggu, terung 1 kali setiap 4 sampai 5 hari. |
| Sekali panen, terung rata-rata dapat berapa kilo? | Tergantung jumlah tanam. Dari sekitar 400 batang, hasilnya di atas 100 kg, kadang 150 sampai 170 kg. |
| Dalam sekali panen, berapa persen buah yang busuk? | Tergantung cuaca; musim hujan lebih banyak busuk. Dari 150 sampai 170 kg, yang busuk (termasuk yang dimakan ulat) tidak sampai 1 kg. |
| Bagaimana cara mengatasi buah busuk? | Rutin menyemprot fungisida untuk jamur dan mengatur jarak tanam agar tidak terlalu rapat sehingga sinar matahari masuk. |
| Apa hambatan yang paling sering terjadi? | Biaya tanam (upah cangkul, bibit, obat-obatan), cuaca yang tidak menentu (hujan terus atau kemarau 2 sampai 3 minggu), dan penyakit seperti layu bakteri, layu fusarium, akar ganda, dan akar putih. |
| Berapa biaya produksinya? | Dihitung dari olah lahan sampai panen per batang. Terung Rp1.500 sampai Rp2.000 per batang (400 batang sekitar Rp1 juta). Cabai Rp4.000 sampai Rp5.000 per batang (1.000 batang sekitar Rp5 juta). |
| Bagaimana cara menentukan harga jual? | Belum ada contract farming; harga mengikuti pasokan dan permintaan pasar. Saat barang langka, cabai bisa Rp100 ribu per kg dan terung di atas Rp10 ribu per kg. Saat pasokan melimpah, cabai Rp15 ribu sampai Rp20 ribu per kg dan terung Rp2 ribu per kg atau tidak laku. |
| Buah yang kurang bagus diapakan? | Difermentasi dengan asam amino dan mikroorganisme (Trichoderma, Rhizobium) menjadi pupuk organik, lalu dikembalikan ke tanaman. |

### 3.2 Kaitan dengan lima pertanyaan wajib dari lembar challenge

| Pertanyaan wajib | Status | Yang sudah diketahui / yang masih perlu ditanyakan |
|---|---|---|
| 1. Cara kerja sekarang dan yang paling merepotkan | Sebagian | Panen dipetik sendiri atau diupahkan, dan di pasar tidak ada pemilahan grade. Cara pencatatan dan hal yang paling merepotkan **belum ditanyakan**. |
| 2. Data yang perlu dicatat | Belum ditanyakan langsung | Yang disebut narasumber: berat panen per kali, frekuensi panen, biaya produksi per batang, dan jumlah buah busuk. |
| 3. Aturan atau perhitungan khusus | Sebagian | Harga mengikuti pasar dan tidak dibedakan menurut ukuran; buah busuk atau kena ulat tidak laku. Contoh angka perhitungan per grade **belum ada**. |
| 4. Frekuensi pemakaian dan perangkat | Belum ditanyakan | Hanya ada jadwal panen (rawit 1 kali seminggu, terung 4 sampai 5 hari sekali) sebagai petunjuk. Perangkat (HP atau komputer) belum diketahui. |
| 5. Kriteria berhasil | Belum ditanyakan | Perlu ditanyakan pada wawancara lanjutan. |

Narasumber adalah **petani**. Sudut pandang pedagang pengumpul (toke) dan pedagang pasar belum diwawancarai, padahal merekalah yang menentukan harga beli dan menilai mutu.

### 3.3 Temuan yang perlu ditinjau di Bagian 6

Beberapa jawaban narasumber berbeda dari asumsi awal tim. Tim perlu memutuskan apakah aturan di Bagian 6 dipertahankan, diubah, atau dijelaskan sebagai pendekatan tim:

1. **Ukuran tidak memengaruhi harga** menurut narasumber, sedangkan Bagian 6.2 memakai pengali ukuran (1,00; 0,90; 0,80).
2. **Tidak ada pemilahan grade di pasar** menurut narasumber, jadi pengali Grade B (0,70) belum punya dasar dari wawancara.
3. **Buah busuk tidak dijual**, melainkan dijadikan pupuk organik, sehingga pengali Grade C (0,30) perlu diputuskan: tetap 0,30 sebagai nilai olahan, atau 0.
4. **Tingkat busuk jauh lebih rendah dari proposal:** di bawah 1 kg dari 150 sampai 170 kg (kurang dari 1%), sedangkan proposal menyebut kerusakan 15% sampai 25%.
5. **Harga sangat berfluktuasi** (terung Rp2 ribu sampai di atas Rp10 ribu per kg), sehingga harga acuan tetap di kode mungkin cepat usang.

---

## 4. Fitur wajib (hanya untuk alur inti)

Alur inti terdiri dari tiga langkah yang berurutan: **Input dan Validasi → Hasil Kalkulasi → Rekap Data.**

### Langkah 1. Input hasil panen dan validasi

Form berisi isian berikut. Tanggal panen ditambahkan karena rekap membutuhkan urutan waktu.

| Isian | Jenis | Wajib? | Aturan validasi |
|---|---|---|---|
| Tanggal panen | Tanggal (default: hari ini) | Ya | Tidak boleh kosong, tidak boleh melebihi hari ini |
| Komoditas | Pilihan: Cabai Rawit Hijau, Terung, Tomat | Ya | Harus salah satu dari tiga pilihan |
| Berat total (kg) | Angka | Ya | Lebih dari 0 dan paling banyak 10.000; maksimal 2 angka di belakang koma |
| Kesegaran (%) | Angka | Ya | Dari 0 sampai 100 (0 dan 100 sah); maksimal 2 angka di belakang koma |
| Ukuran | Pilihan: Besar, Sedang, Kecil | Ya | Harus salah satu dari tiga pilihan |
| Cacat (%) | Angka | Ya | Dari 0 sampai 100 (0 dan 100 sah); maksimal 2 angka di belakang koma |
| Catatan | Teks pendek | Tidak | Maksimal 100 karakter; tidak boleh berisi data pribadi (nama lengkap, nomor HP, alamat) |

**Aturan umum validasi**
- Semua spasi di awal dan akhir isian dibuang sebelum diperiksa. Isian yang hanya berisi spasi dianggap kosong.
- Pemisah desimal boleh titik atau koma. Koma diubah menjadi titik sebelum diperiksa.
- Nilai yang bukan angka murni (misalnya `abc`, `12kg`, `1e3`, `--5`) dianggap bukan angka.
- Kesegaran dan cacat berdiri sendiri: tidak ada aturan yang menghubungkan keduanya (misalnya kesegaran 100 dengan cacat 100 tetap sah dan dihitung sesuai rumus).
- Jika ada lebih dari satu isian yang salah, **semua pesan kesalahan ditampilkan sekaligus**, masing-masing di bawah isiannya.
- Jika ada kesalahan, perhitungan tidak dijalankan dan tidak ada data yang tersimpan.

**Pesan kesalahan (teks persis yang harus tampil)**

| Kondisi | Pesan |
|---|---|
| Tanggal kosong | Tanggal panen wajib diisi. |
| Tanggal lebih dari hari ini | Tanggal panen tidak boleh melebihi hari ini. |
| Komoditas belum dipilih | Pilih komoditas terlebih dahulu. |
| Berat kosong | Berat panen wajib diisi. |
| Berat bukan angka | Berat panen harus berupa angka. |
| Berat negatif | Berat panen tidak boleh negatif. |
| Berat sama dengan 0 | Berat panen harus lebih dari 0 kg. |
| Berat lebih dari 10.000 | Berat panen maksimal 10.000 kg. |
| Berat lebih dari 2 angka desimal | Berat panen maksimal 2 angka di belakang koma. |
| Kesegaran kosong | Kesegaran wajib diisi. |
| Kesegaran bukan angka | Kesegaran harus berupa angka. |
| Kesegaran kurang dari 0 atau lebih dari 100 | Kesegaran harus antara 0 sampai 100. |
| Kesegaran lebih dari 2 angka desimal | Kesegaran maksimal 2 angka di belakang koma. |
| Ukuran belum dipilih | Pilih ukuran terlebih dahulu. |
| Cacat kosong | Cacat wajib diisi. |
| Cacat bukan angka | Cacat harus berupa angka. |
| Cacat kurang dari 0 atau lebih dari 100 | Cacat harus antara 0 sampai 100. |
| Cacat lebih dari 2 angka desimal | Cacat maksimal 2 angka di belakang koma. |
| Catatan lebih dari 100 karakter | Catatan maksimal 100 karakter. |

### Langkah 2. Kalkulasi distribusi grade dan harga

Setelah seluruh isian valid dan pengguna menekan tombol **Hitung**, aplikasi menampilkan:

1. **Rasio grade:** persentase Grade A, Grade B, dan Grade C dari satu setoran (jumlahnya selalu 100%).
2. **Berat per grade** dalam kg.
3. **Nilai per grade** dalam Rupiah dan **total nilai panen** dalam Rupiah.

Hasil ini baru berupa pratinjau. Data **belum disimpan** sampai pengguna menekan tombol **Simpan ke Rekap**. Pengguna juga bisa menekan **Ubah** untuk kembali ke form dengan isian yang masih terisi. Rumus lengkap ada di Bagian 6.

### Langkah 3. Lihat rekap data

Halaman rekap menampilkan semua data yang tersimpan dalam tabel:

| Kolom | Isi |
|---|---|
| No | Nomor urut tampilan |
| Tanggal | Tanggal panen |
| Komoditas | Cabai Rawit Hijau / Terung / Tomat |
| Berat (kg) | Berat total |
| Kesegaran (%) | Nilai input |
| Ukuran | Besar / Sedang / Kecil |
| Cacat (%) | Nilai input |
| Grade A / B / C (%) | Tiga persentase hasil hitung |
| Total nilai (Rp) | Nilai panen dalam Rupiah |
| Catatan | Teks catatan, atau tanda "-" jika kosong |

Aturan tampilan rekap:
- Data diurutkan dari yang **terbaru di atas** (tanggal panen terbaru dulu; jika tanggal sama, yang disimpan lebih akhir di atas).
- Di bawah tabel ada baris total: **jumlah berat (kg)** dan **jumlah nilai (Rp)** dari seluruh baris yang tampil.
- Jika belum ada data, tampil pesan **"Belum ada data panen tersimpan."** sebagai pengganti tabel.
- Data tetap tampil setelah halaman dimuat ulang.
- Tabel dapat digulir ke samping di layar HP tanpa merusak tata letak halaman.

---

## 5. Di luar cakupan (tidak dikerjakan dalam challenge ini)

Aplikasi berjalan sepenuhnya di sisi pengguna (client-side) di browser dan menyimpan data di `localStorage`. Karena itu hal-hal berikut **secara tegas TIDAK dikerjakan**:

- **Backend server.** Tidak ada server, API, FastAPI, ataupun layanan hosting inferensi (DigitalOcean) dalam versi ini.
- **Database eksternal.** Tidak memakai Supabase atau database cloud lain. Satu-satunya penyimpanan adalah `localStorage` di browser pengguna.
- **Login dan autentikasi.** Tidak ada akun, kata sandi, atau pembagian hak akses. Siapa pun yang membuka aplikasi di browser yang sama melihat data yang sama.
- **AI vision dan computer vision.** Tidak ada unggah foto keranjang panen, model YOLO11, ONNX, maupun deteksi gambar. Grade dihitung dari angka yang diisi pengguna, bukan dari analisis gambar.
- **Integrasi harga BAPANAS atau API harga lain.** Harga acuan adalah tabel tetap di dalam kode.
- **Sinkronisasi antar perangkat atau antar pengguna.** Data di HP tidak otomatis muncul di laptop.
- **Edit dan hapus per baris data.** Data yang sudah disimpan tidak diubah satu per satu pada versi pertama.
- **Hosting online.** Tidak diwajibkan oleh challenge.

**Catatan urutan kerja:** pencarian, filter, dan ekspor CSV pada halaman rekap **bukan bagian dari spesifikasi ini**. Fitur tersebut adalah Change Request (Tugas 3) yang baru dikerjakan setelah Checkpoint 2, dimulai dari dokumen `analisis-change-request.md`.

---

## 6. Aturan bisnis dan perhitungan

### 6.1 Definisi kriteria mutu

Satu setoran dinilai dari sampel yang dipilah pengguna. Dua persentase input menggambarkan sampel tersebut:

- **Cacat (%)** = persen buah dalam setoran yang cacat (busuk, memar berat, berjamur, pecah atau patah).
- **Kesegaran (%)** = persen buah **yang tidak cacat** yang masih segar (kulit kencang, warna cerah, belum layu atau keriput).

Setiap buah masuk ke tepat satu grade. Grade C identik dengan istilah Reject / Tolak / Afkir di proposal. Buah cacat diperiksa lebih dulu, sehingga cacat selalu mengalahkan kesegaran:

| Grade | Kriteria | Persentase dalam setoran |
|---|---|---|
| **A** | Tidak cacat dan segar | (100 − Cacat) × Kesegaran / 100 |
| **B** | Tidak cacat tetapi tidak segar (mulai layu, keriput, atau pudar), masih layak jual | (100 − Cacat) − Persen A |
| **C** | Cacat (hanya laku untuk olahan atau pakan) | Cacat |

Ketiganya selalu berjumlah 100%.

### 6.2 Pengali harga

**Harga acuan Grade A per kg** (**harga acuan tetap untuk simulasi pengujian manual**, bukan data resmi BAPANAS dan bukan harga yang tampil di mockup Figma proposal; ubah di satu tempat di kode jika ada perubahan, lalu perbarui kasus uji dan contoh di Bagian 6.4):

| Komoditas | Harga acuan (Rp/kg) |
|---|---|
| Cabai Rawit Hijau | 30.000 |
| Terung | 10.000 |
| Tomat | 12.000 |

**Pengali per grade:**

| Grade | Pengali |
|---|---|
| A | 1,00 (100% dari harga acuan) |
| B | 0,70 (70%) |
| C | 0,30 (30%) |

**Pengali ukuran:**

| Ukuran | Pengali |
|---|---|
| Besar | 1,00 |
| Sedang | 0,90 |
| Kecil | 0,80 |

### 6.3 Rumus

Notasi: `B` = berat total (kg), `K` = kesegaran (%), `C` = cacat (%), `H` = harga acuan komoditas (Rp/kg), `mG` = pengali grade, `mU` = pengali ukuran.

```
Persen A = (100 - C) x K / 100
Persen B = (100 - C) - Persen A
Persen C = C

Berat grade g (kg) = B x Persen g / 100            untuk g = A, B, C

Nilai grade g (Rp) = pembulatan( Berat grade g x H x mG x mU )

Total nilai panen (Rp) = Nilai A + Nilai B + Nilai C
```

**Aturan pembulatan:**
- Persentase dan berat **tidak dibulatkan** dalam perhitungan. Pembulatan hanya dilakukan pada **nilai Rupiah tiap grade**.
- Pembulatan ke Rupiah terdekat; pecahan 0,5 ke atas dibulatkan naik.
- Total nilai adalah **penjumlahan dari tiga nilai grade yang sudah dibulatkan**, sehingga angka di layar selalu cocok bila dijumlahkan.
- Tampilan persentase dan berat memakai maksimal 2 angka desimal dengan koma (format Indonesia). Nilai Rupiah ditampilkan dengan pemisah titik, misalnya `Rp946.080`.

### 6.4 Contoh perhitungan acuan (untuk diuji manual dengan kalkulator)

| No | Input | Persen A / B / C | Nilai A (Rp) | Nilai B (Rp) | Nilai C (Rp) | **Total (Rp)** |
|---|---|---|---|---|---|---|
| 1 | Tomat, 100 kg, K 80, Sedang, C 10 | 72 / 18 / 10 | 777.600 | 136.080 | 32.400 | **946.080** |
| 2 | Cabai Rawit Hijau, 25,5 kg, K 90, Besar, C 20 | 72 / 8 / 20 | 550.800 | 42.840 | 45.900 | **639.540** |
| 3 | Terung, 3,3 kg, K 50, Kecil, C 15 | 42,5 / 42,5 / 15 | 11.220 | 7.854 | 1.188 | **20.262** |
| 4 | Tomat, 1 kg, K 33, Sedang, C 7 (uji pembulatan) | 30,69 / 62,31 / 7 | 3.315 | 4.711 | 227 | **8.253** |
| 5 | Terung, 10 kg, K 0, Besar, C 100 (batas: semua cacat) | 0 / 0 / 100 | 0 | 0 | 30.000 | **30.000** |
| 6 | Tomat, 10 kg, K 100, Besar, C 0 (batas: semua Grade A) | 100 / 0 / 0 | 120.000 | 0 | 0 | **120.000** |
| 7 | Tomat, 10 kg, K 0, Besar, C 0 (batas: semua Grade B) | 0 / 100 / 0 | 0 | 84.000 | 0 | **84.000** |

**Uraian langkah contoh 1 (Tomat, 100 kg, K 80, Sedang, C 10):**
- Persen A = (100 − 10) × 80 / 100 = 72. Persen B = 90 − 72 = 18. Persen C = 10.
- Berat A = 72 kg, Berat B = 18 kg, Berat C = 10 kg.
- Nilai A = 72 × 12.000 × 1,00 × 0,90 = 777.600.
- Nilai B = 18 × 12.000 × 0,70 × 0,90 = 136.080.
- Nilai C = 10 × 12.000 × 0,30 × 0,90 = 32.400.
- Total = 777.600 + 136.080 + 32.400 = **946.080**.

**Uraian langkah contoh 4 (uji pembulatan, Tomat, 1 kg, K 33, Sedang, C 7):**
- Persen A = 93 × 33 / 100 = 30,69. Persen B = 93 − 30,69 = 62,31. Persen C = 7.
- Nilai A = 0,3069 × 12.000 × 1,00 × 0,90 = 3.314,52, dibulatkan menjadi 3.315.
- Nilai B = 0,6231 × 12.000 × 0,70 × 0,90 = 4.710,636, dibulatkan menjadi 4.711.
- Nilai C = 0,07 × 12.000 × 0,30 × 0,90 = 226,8, dibulatkan menjadi 227.
- Total = 3.315 + 4.711 + 227 = **8.253**.

---

## 7. Data yang disimpan

Seluruh data disimpan di `localStorage` browser dengan satu kunci. Nilainya berupa **JSON Array**; setiap elemen mewakili satu setoran panen yang sudah disimpan.

| Data | Contoh isi | Disimpan di mana |
|---|---|---|
| Daftar transaksi panen | JSON Array berisi objek panen (struktur di bawah) | `localStorage`, kunci `agrisort.panen.v1` |

### 7.1 Struktur satu objek panen

| Properti | Tipe | Contoh | Keterangan |
|---|---|---|---|
| `id` | string | `"panen-1760000000000"` | Unik; dibuat dari waktu penyimpanan |
| `tanggal` | string | `"2026-10-10"` | Tanggal panen, format `YYYY-MM-DD` |
| `komoditas` | string | `"Tomat"` | Salah satu dari `"Cabai Rawit Hijau"`, `"Terung"`, `"Tomat"` |
| `beratKg` | number | `100` | Berat total, kg |
| `kesegaranPersen` | number | `80` | Input kesegaran |
| `ukuran` | string | `"Sedang"` | `"Besar"`, `"Sedang"`, atau `"Kecil"` |
| `cacatPersen` | number | `10` | Input cacat |
| `catatan` | string | `"Setoran pagi"` | Boleh string kosong `""` |
| `hasil` | object | lihat contoh | Hasil hitung yang disimpan sebagai arsip |
| `dicatatPada` | string | `"2026-10-10T07:15:00.000Z"` | Waktu penyimpanan (ISO 8601) |

Properti `hasil` berisi: `persenA`, `persenB`, `persenC`, `beratA`, `beratB`, `beratC`, `nilaiA`, `nilaiB`, `nilaiC`, dan `totalNilai`. Semuanya bertipe number, dan nilai Rupiah sudah dibulatkan.

### 7.2 Contoh isi `localStorage`

```json
[
  {
    "id": "panen-1760000000000",
    "tanggal": "2026-10-10",
    "komoditas": "Tomat",
    "beratKg": 100,
    "kesegaranPersen": 80,
    "ukuran": "Sedang",
    "cacatPersen": 10,
    "catatan": "Setoran pagi",
    "hasil": {
      "persenA": 72,
      "persenB": 18,
      "persenC": 10,
      "beratA": 72,
      "beratB": 18,
      "beratC": 10,
      "nilaiA": 777600,
      "nilaiB": 136080,
      "nilaiC": 32400,
      "totalNilai": 946080
    },
    "dicatatPada": "2026-10-10T07:15:00.000Z"
  }
]
```

### 7.3 Aturan penyimpanan

- Setiap kali pengguna menekan **Simpan ke Rekap**, satu objek baru ditambahkan ke Array, lalu seluruh Array ditulis ulang ke `localStorage`.
- Hasil hitung disimpan sebagai arsip, sehingga riwayat lama tidak berubah walaupun harga acuan di kode diubah kemudian.
- Angka disimpan sebagai number biasa (misalnya `946080`), tanpa simbol "Rp" dan tanpa pemisah ribuan. Format tampilan dibuat saat data ditampilkan.
- Saat aplikasi dibuka, data dibaca dengan `JSON.parse` di dalam `try/catch`. Jika kunci belum ada, isinya bukan JSON yang valid, atau bukan Array, aplikasi menganggap datanya kosong (`[]`) dan **tidak error**.
- Tidak ada data pribadi yang disimpan.

---

## 8. Kriteria "selesai"

Setiap baris hanya bisa dijawab **Ya** atau **Tidak**. Alur inti dianggap selesai jika semua baris dijawab **Ya**.

| ID | Kriteria | Ya / Tidak |
|---|---|---|
| K01 | Form menampilkan isian tanggal, komoditas (3 pilihan), berat, kesegaran, ukuran (3 pilihan), cacat, dan catatan | [ ] Ya  [ ] Tidak |
| K02 | Jika semua isian wajib dikosongkan lalu **Hitung** ditekan, semua pesan "wajib diisi" / "Pilih ... terlebih dahulu" tampil sekaligus dan tidak ada hasil yang ditampilkan | [ ] Ya  [ ] Tidak |
| K03 | Berat `-5` ditolak dengan pesan persis "Berat panen tidak boleh negatif." | [ ] Ya  [ ] Tidak |
| K04 | Berat `abc` ditolak dengan pesan persis "Berat panen harus berupa angka." | [ ] Ya  [ ] Tidak |
| K05 | Kesegaran `101` dan cacat `-1` ditolak, sedangkan nilai `0` dan `100` diterima | [ ] Ya  [ ] Tidak |
| K06 | Contoh 1 (Tomat, 100 kg, K 80, Sedang, C 10) menampilkan Grade 72% / 18% / 10% dan total **Rp946.080** | [ ] Ya  [ ] Tidak |
| K07 | Contoh 2 (Cabai Rawit Hijau, 25,5 kg, K 90, Besar, C 20) menampilkan total **Rp639.540**, dan input `25,5` dengan koma diterima | [ ] Ya  [ ] Tidak |
| K08 | Contoh 4 (uji pembulatan) menampilkan total **Rp8.253** | [ ] Ya  [ ] Tidak |
| K09 | Contoh 5, 6, dan 7 (kasus batas) masing-masing menampilkan total Rp30.000, Rp120.000, dan Rp84.000 | [ ] Ya  [ ] Tidak |
| K10 | Untuk ketujuh contoh di Bagian 6.4, Persen A + Persen B + Persen C sama dengan 100 | [ ] Ya  [ ] Tidak |
| K11 | Hasil hitung belum masuk ke rekap sebelum tombol **Simpan ke Rekap** ditekan | [ ] Ya  [ ] Tidak |
| K12 | Setelah **Simpan ke Rekap** ditekan, baris baru muncul di tabel rekap tanpa memuat ulang halaman | [ ] Ya  [ ] Tidak |
| K13 | Setelah halaman dimuat ulang (F5), seluruh baris rekap yang tadi disimpan masih tampil dengan nilai yang sama | [ ] Ya  [ ] Tidak |
| K14 | Isi `localStorage` pada kunci `agrisort.panen.v1` adalah JSON Array yang valid dan berstruktur sesuai Bagian 7 | [ ] Ya  [ ] Tidak |
| K15 | Rekap kosong menampilkan pesan persis "Belum ada data panen tersimpan." | [ ] Ya  [ ] Tidak |
| K16 | Angka di baris total rekap sama dengan jumlah kolom berat dan kolom total nilai yang tampil | [ ] Ya  [ ] Tidak |
| K17 | Jika isi kunci `agrisort.panen.v1` diganti teks sembarang (bukan JSON), aplikasi tetap terbuka dan menampilkan rekap kosong tanpa error | [ ] Ya  [ ] Tidak |
| K18 | Aplikasi bisa dijalankan dengan mengikuti README, tanpa login dan tanpa server tambahan | [ ] Ya  [ ] Tidak |
| K19 | Pada layar selebar 360 px, seluruh form dapat diisi dan tabel rekap dapat dilihat tanpa halaman bergeser ke samping | [ ] Ya  [ ] Tidak |
| K20 | Satu setoran selesai dicatat, dari membuka form sampai tombol **Simpan ke Rekap** ditekan, dalam 120 detik atau kurang (diukur dengan stopwatch) | [ ] Ya  [ ] Tidak |