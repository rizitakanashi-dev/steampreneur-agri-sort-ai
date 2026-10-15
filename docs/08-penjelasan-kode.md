# Penjelasan Kode

Tidak ada sesi presentasi, jadi dokumen ini adalah bukti utama bahwa tim memahami kode yang dihasilkan AI.

Aturan:
- Setiap anggota menjelaskan **minimal dua bagian kode yang berbeda**. Bagian yang dijelaskan tidak boleh sama dengan anggota lain.
- Tulis dengan bahasa sendiri. Boleh bertanya ke AI untuk memahami, tetapi jangan menyalin jawabannya.
- Sebut nama file dan fungsi yang nyata, serta contoh nilai yang nyata.
- Jika memungkinkan, setiap anggota meng-commit bagiannya sendiri dari akun GitHub masing-masing.

---

## Bagian A: Penjelasan per anggota

### Penjelasan 1
- **Ditulis oleh:** Ahmad Afif
- **File dan fungsi:** `src/utils/csvExporter.js` — fungsi `buildHarvestCsv(batches)`
- **Apa yang dilakukan:** Mengubah data kumpulan batch panen yang tersimpan di aplikasi menjadi format teks berstandar CSV, merapikan teks melalui `escapeCsvValue` agar aman dari koma atau tanda kutip, lalu memicu unduhan file secara otomatis ke perangkat pengguna.
- **Kenapa dibuat seperti itu:** Pengguna membutuhkan cara mudah untuk mencadangkan atau memindahkan laporan hasil sortir ke dalam bentuk dokumen universal yang bisa dibuka di aplikasi pengolah angka seperti Microsoft Excel atau Google Sheets.
- **Contoh:** jika inputnya daftar data batch panen yang valid, hasilnya adalah file unduhan berformat teks CSV bernama `rekap-panen-2026-10-15.csv` karena data berhasil disusun menjadi baris dan kolom terstruktur.
- **Jika input salah atau kosong:** Jika daftar batch yang dikirim bernilai kosong, fungsi ini tetap menghasilkan kerangka CSV dasar yang hanya berisi baris judul (*header*) saja tanpa mengalami error.

### Penjelasan 2
- **Ditulis oleh:** Ahmad Afif
- **File dan fungsi:** `src/business/harvestProjection.js` — fungsi `calculateRevenueProjection({...})`
- **Apa yang dilakukan:** Menghitung perkiraan total proyeksi pendapatan kotor berdasarkan jumlah berat bersih hasil panen dikalikan dengan harga acuan komoditas untuk keperluan analisis di halaman Pricing Dashboard.
- **Kenapa dibuat seperti itu:** Memisahkan logika matematika proyeksi ini ke dalam file bisnis murni agar fitur simulasi harga dapat diuji secara independen menggunakan unit test tanpa harus merender komponen tampilan visual di layar.
- **Contoh:** jika inputnya estimasi berat bersih komoditas kategori Grade A sebesar `10` kg dengan harga acuan tertentu, hasilnya adalah total nilai proyeksi pendapatan dalam bentuk Rupiah secara presisi karena dikalikan langsung dengan harga referensi.
- **Jika input salah atau kosong:** Jika parameter masukan bernilai nol atau tidak valid, fungsi ini akan mengembalikan nilai hasil proyeksi sebesar nol secara aman tanpa mengganggu jalannya aplikasi.

### Penjelasan 3
- **Ditulis oleh:** Faris Al Farizi
- **File dan fungsi:** `src/business/harvestValidation.js`, fungsi `validateHarvestForm` (baris 54–100), dibantu `validateNumberField` (baris 29), `parseNumber` (baris 18), dan `decimalPlaces` (baris 24)
- **Apa yang dilakukan:** Ngecek tujuh field input panen: tanggal, komoditas, berat, kesegaran, ukuran, cacat, catatan. Hasilnya `{ errors, isValid, values }`. Semua error dikembalikan barengan, bukan berhenti di kesalahan pertama, jadi pengguna langsung tahu semua yang perlu diperbaiki. Untuk angka, `parseNumber` ubah koma desimal Indonesia (`25,5`) jadi titik (`25.5`) sebelum dikonversi. `values` dipisah dari `form` karena `form` nyimpen teks mentah, sedangkan `values` sudah angka — kalau digabung, koma bisa bocor ke perhitungan dan jadi `NaN`.
- **Kenapa dibuat seperti ini:** Semua logika validasi ditaruh di `src/business/`, terpisah dari React, supaya bisa dites pakai `node --test` tanpa render komponen. Detail penting di baris 71–73: pengecekan berat nol pakai perbandingan numerik (`parseNumber(...) === 0`), bukan perbandingan string. Soalnya `'0'`, `'0.0'`, `'0,00'` tulisannya beda tapi nilainya sama-sama nol. Versi lama pakai perbandingan string dan cuma `'0'` yang tertangkap — bug ini tercatat di `docs/05-kesalahan-ai.md`.
- **Contoh:** kalau inputnya `{ tanggal: '2026-10-13', komoditas: 'Tomat', beratKg: '25,5', kesegaranPersen: '80', ukuran: 'Sedang', cacatPersen: '10', catatan: 'Setoran pagi' }`, hasilnya `isValid: true`, `values.beratKg = 25.5`. Kalau berat diisi `'0,00'` → `errors.beratKg = 'Berat panen harus lebih dari 0 kg.'`. Kasus berat nol (lima varian) dan berat desimal sah (`0,5`) diuji di `tes/harvestValidation.test.js`.
- **Jika input salah atau kosong:** tanggal kosong → `'Tanggal panen wajib diisi.'`; tanggal melebihi hari ini → `'Tanggal panen tidak boleh melebihi hari ini.'`. Komoditas kosong → `'Pilih komoditas terlebih dahulu.'`. Catatan lebih dari 100 karakter → `'Catatan maksimal 100 karakter.'`. Lebih dari 2 angka di belakang koma → pesan yang nyebut nama field, misal `'Berat panen maksimal 2 angka di belakang koma.'`

### Penjelasan 4
- **Ditulis oleh:** Faris Al Farizi
- **File dan fungsi:** `src/business/harvestCalculation.js`, fungsi `calculateHarvest` (baris 70–76). Memanggil `requiredNumber`, `assertNonNegativeNumber`, `calculateGradePercentages`, dan `calculateGradeWeights`.
- **Apa yang dilakukan:** Fungsi ini ngitung pembagian panen ke Grade A, Grade B, dan Reject, baik dalam persen maupun kilogram. Inputnya `{ beratKg, kesegaranPersen, cacatPersen }`, outputnya `{ persentase, beratKg }`. Fungsinya sendiri nggak ngitung rumus apa-apa. Dia cuma nge-gabungin empat fungsi lain: parse berat, cek nggak negatif dan nggak nol, hitung persentase grade, lalu konversi ke kilogram.
- **Kenapa dibuat seperti ini:** Berat dicek tiga kali karena tiap pengecekan nangkap kasus beda. `requiredNumber` nangkap input bukan angka kayak `'abc'` atau kosong. `assertNonNegativeNumber` nangkap angka minus. Pengecekan `<= 0` nangkap angka nol. Urutan ini sengaja: parse dulu (kalau gagal, nggak perlu lanjut), baru cek minus, baru cek nol. `calculateGradePercentages` dan `calculateGradeWeights` dipisah supaya `calculateGradeWeights` bisa dipakai ulang sama `harvestProjection.js` tanpa harus ngitung ulang persentasenya. Kalau pengguna ngisi gradeA/gradeB barengan sama kesegaran/cacat, fungsi nolak karena hasilnya ambiguous, nggak jelas mana yang dipakai.
- **Contoh:** kalau inputnya `{ beratKg: 100, kesegaranPersen: 80, cacatPersen: 10 }`, hasilnya `persentase: { gradeA: 72, gradeB: 18, reject: 10 }` dan `beratKg: { gradeA: 72, gradeB: 18, reject: 10 }`. Karena beratnya 100 kg, persen langsung sama dengan kilogram. Hitungannya: `gradeA = (100 - 10) × 80 / 100 = 72`, sisanya `gradeB = 18`, `reject = 10`. Diuji di `tes/harvestCalculation.test.js`.
- **Jika input salah atau kosong:** berat kosong atau bukan angka → `TypeError: 'Berat total harus berupa angka yang valid.'`. Berat minus → `TypeError: 'Berat total harus berupa angka nol atau lebih.'`. Berat nol → `RangeError: 'Berat total harus lebih dari 0 kg.'`. Kesegaran atau cacat di luar 0–100 → `RangeError` pesan rentang. Input campuran `{ beratKg: 100, gradeA: 70, gradeB: 20, cacatPersen: 5 }` → `RangeError: 'Input Grade A/B tidak boleh dicampur dengan kesegaran dan cacat.'`

### Penjelasan 5
- **Ditulis oleh:** Faris Al Farizi
- **File dan fungsi:** `src/business/harvestCalculation.js`, fungsi `calculateHarvestValue` (baris 78–92). Memanggil `validateCalculationInput`, `calculateHarvest`, `requiredNumber`, `assertNonNegativeNumber`, dan `roundRupiah`. Memakai konstanta `GRADE_MULTIPLIERS` dan `SIZE_MULTIPLIERS`.
- **Apa yang dilakukan:** Ngitung nilai Rupiah per grade dari input `{ beratKg, kesegaranPersen, cacatPersen, hargaAcuanPerKg, ukuran }`. Outputnya `persentase`, `beratKg`, `nilai` per grade, dan `totalNilai`. Rumus tiap grade: `beratKg × hargaAcuanPerKg × GRADE_MULTIPLIERS × SIZE_MULTIPLIERS`, lalu dibuletin pakai `roundRupiah`. Multiplier grade: A = 1.0, B = 0.7, Reject = 0.3. Multiplier ukuran: Besar = 1.0, Sedang = 0.9, Kecil = 0.8.
- **Kenapa dibuat seperti ini:** `roundRupiah` dipanggil per grade, bukan di total. Soalnya tiap grade punya rantai perkalian sendiri yang bisa ngasilin sisa floating-point yang beda-beda. Kalau dibuletin cuma di total, sisa presisi dari ketiga grade bisa numpuk dan ngasilin angka yang salah. `roundRupiah` jalanin `toFixed(9)` sebelum `Math.round` karena JavaScript kadang nyimpen `1127506.5` sebagai `1127506.4999999998`. Tanpa pembuletan awal, `Math.round` bakal ngambil ke bawah jadi `1127506` (salah). Ini bukan ngelarin semua masalah floating-point, cuma kasus sisa presisi yang muncul di rantai hitung aplikasi ini, dan ada regression test yang ngunci kasusnya. Validasi pakai `validateCalculationInput` yang ngumpulin semua error sekaligus, terus dilempar sebagai satu `RangeError`.
- **Contoh:** kalau inputnya `{ beratKg: 100, kesegaranPersen: 80, cacatPersen: 10, hargaAcuanPerKg: 12000, ukuran: 'Sedang' }`, hasilnya `nilai: { gradeA: 777600, gradeB: 136080, reject: 32400 }`, `totalNilai: 946080`. Karena berat 100 kg, persen sama dengan kilogram: A 72 kg, B 18 kg, Reject 10 kg. Nilai A = `72 × 12000 × 1.0 × 0.9 = 777.600`. Nilai B = `18 × 12000 × 0.7 × 0.9 = 136.080`. Nilai Reject = `10 × 12000 × 0.3 × 0.9 = 32.400`. Total = 946.080. Cocok sama Contoh 1 spesifikasi Bagian 6.4 dan diuji di `tes/harvestCalculation.test.js`.

  Kasus pembuletan: input `{ beratKg: 352.5, kesegaranPersen: 0, cacatPersen: 88.85, hargaAcuanPerKg: 12000, ukuran: 'Besar' }`. Hasil math-nya `1.127.506,5`. Tapi JavaScript nyimpen `0.3` sebagai `0.2999...`, jadi perkaliannya jadi `1127506.4999999998`. Tanpa `toFixed(9)`, `Math.round` ngambil ke bawah → `1127506` (salah). Pakai `toFixed(9)`, dipotong jadi `1127506.5`, dibuletin ke atas → `1127507` (benar). Kasus ini juga diuji di test yang sama.
- **Jika input salah atau kosong:** semua error dikumpulin `validateCalculationInput` terus dilempar sebagai satu `RangeError`. Berat kosong, bukan angka, atau nol → pesan berat. Kesegaran atau cacat kosong atau di luar 0–100 → pesan masing-masing. Ukuran nggak dikenali (`'Jumbo'`, kosong) → `'Ukuran harus dipilih.'`. Harga kosong → `'Harga acuan per kg wajib diisi.'`. Harga minus → `'Harga acuan per kg tidak boleh negatif.'`. Kalau beberapa field salah barengan, semua pesan digabung jadi satu string.

### Penjelasan 6
- **Ditulis oleh:** Hieray Antovino
- **File dan fungsi:** `src/business/harvestStorage.js`, fungsi `saveBatch(batch, storage)` (baris 36–46) dan `readBatches(storage)` (baris 13–25), dibantu `createUniqueId` (baris 27–34) dan `isBatchRecord` (baris 9–11)
- **Apa yang dilakukan:** `readBatches` membaca semua batch dari `localStorage` menggunakan kunci `agrisort.panen.v1`. Jika *storage* kosong, JSON rusak, atau data bukan berupa *array*, fungsi langsung mengembalikan `[]` tanpa *crash*. `saveBatch` menyimpan batch baru dengan membaca data yang ada, membuat ID unik melalui `createUniqueId`, lalu menambahkan batch baru ke akhir *array* dan menulisnya kembali ke *storage*.
- **Kenapa dibuat seperti ini:** `createUniqueId` mengecek jika ID yang diminta sudah ada, lalu menambahkan *suffix* `-2`, `-3`, dan seterusnya. Jadi jika `panen-1` sudah ada, batch berikutnya mendapatkan `panen-1-2` untuk menghindari bentrokan ID yang bisa membuat data tertimpa. `isBatchRecord` menyaring objek yang tidak memiliki ID *string* valid saat dibaca, sehingga data rusak tidak ikut masuk. Semua logika *storage* ditaruh terpisah dari React agar dapat dites menggunakan *mock storage* (seperti `Map` sederhana), bukan `localStorage` beneran.
- **Contoh:** Jika inputnya `{ id: 'panen-1', tanggal: '2026-10-14', komoditas: 'Tomat', beratKg: 10 }` dikirim ke *storage* kosong, `saveBatch` mengembalikan `{ id: 'panen-1', ...data }` dan `readBatches` mengembalikan *array* berisi batch tersebut. Jika `saveBatch` dipanggil lagi dengan ID yang sama, `createUniqueId` menghasilkan `panen-1-2`. Seluruhnya diuji di `tes/harvestStorage.test.js`.
- **Jika input salah atau kosong:**
  - `saveBatch` tanpa argumen atau input bukan objek → `TypeError: 'Batch harus berupa object.'`
  - *Storage* tidak tersedia → `Error: 'localStorage tidak tersedia.'`
  - JSON rusak di *storage* → `readBatches` mengembalikan `[]`, bukan *crash*.
  - Semua kasus ini diuji di `tes/harvestStorage.test.js`.

### Penjelasan 7
- **Ditulis oleh:** Hieray Antovino
- **File dan fungsi:** `src/business/harvestFilter.js`, fungsi `filterBatches(batches, filter)` (baris 54–60) dan `sortBatchesByNewest(batches)` (baris 63–68), dibantu `matchesSearch` (baris 26–32), `matchesCommodity` (baris 34–38), dan `matchesDateRange` (baris 40–48)
- **Apa yang dilakukan:** `filterBatches` menyaring batch berdasarkan tiga kriteria: pencarian teks (ID atau komoditas), filter komoditas, dan rentang tanggal. Semua kriteria digabung dengan logika AND — batch harus cocok dengan semua filter yang aktif. `sortBatchesByNewest` mengurutkan batch dari tanggal terbaru. Jika tanggalnya sama, pengurutan dilakukan berdasarkan `dicatatPada` (waktu penyimpanan).
- **Kenapa dibuat seperti ini:** Pencarian bersifat *case-insensitive* (`'tomat'`, `'TOMAT'`, `'TeRuNg'` semua cocok) karena `matchesSearch` mengubah teks ke huruf kecil (*lowercase*) terlebih dahulu sebelum membandingkan. Rentang tanggal menggunakan batas inklusif — `tanggalDari: '2026-10-11'` tetap memasukkan batch tanggal 11 Oktober. Filter yang kosong diabaikan, sehingga `filterBatches` dengan filter kosong mengembalikan semua data. `sortBatchesByNewest` membuat salinan terlebih dahulu (`[...batches]`) sebelum diurutkan agar *array* aslinya tidak berubah. Semua logika dipisah dari React agar dapat dites tanpa *render*.
- **Contoh:** Jika inputnya 3 batch dengan ID `panen-1` (Tomat, 10 Okt), `panen-2` (Terung, 11 Okt), `panen-3` (Tomat, 12 Okt), dan filter `{ search: 'tomat', komoditas: 'Tomat', tanggalDari: '2026-10-12', tanggalSampai: '' }`, hasilnya hanya `['panen-3']`. Jika filter kosong, mengembalikan semua 3 batch. `sortBatchesByNewest` mengembalikan `['panen-3', 'panen-2', 'panen-1']`. Seluruhnya diuji di `tes/harvestRecapChangeRequest.test.js`.

## Bagian B: Pertanyaan yang dijawab bersama

### 1. Jika aturan bisnis utama di spesifikasi berubah, file dan fungsi mana yang harus diubah?

Saya pakai contoh: harga acuan Grade A untuk Tomat naik dari Rp12.000 jadi Rp15.000 per kg. Cuma ubah satu angka di `REFERENCE_PRICES_PER_KG` (`src/business/priceReference.js` baris 19–23). Rumus di `calculateHarvestValue` nggak perlu disentuh karena dia cuma nerima harga yang dikirim `App.jsx`.

Yang ikut berubah: `PRICE_HISTORY` (baris 31, data grafik tren) dan `PRICE_REFERENCE_SOURCE.updatedAt` (baris 15, tanggal di Dashboard). Test di `tes/harvestCalculation.test.js` pakai `hargaAcuanPerKg: 12000` dan expect `totalNilai: 946080` — begitu harga berubah, test gagal dan harus diupdate. UI nggak perlu disentuh karena `App.jsx`, `PricingDashboard`, dan `harvestProjection.js` semua baca dari modul yang sama.

Satu hal yang perlu diwaspadai: `commodityOptions` di `harvestValidation.js` baris 1 di-hardcode terpisah dari `COMMODITY_OPTIONS` di `priceReference.js` baris 25. Isinya kebetulan sama, tapi kalau ada komoditas baru, dua file harus diubah.

### 2. Bagaimana data mengalir dari form sampai hasil muncul di layar?

1. Pengguna ngisi tujuh field di `HarvestForm.jsx`. Tiap ketikan disimpen ke state `form` lewat `handleChange`.
2. `validateHarvestForm` dipanggil saat blur dan saat tekan tombol. Koma desimal diubah jadi angka di sini.
3. Kalau valid, `preview` diisi nilai plus `id` dari `panen-<timestamp>`. Dialog ringkasan muncul. Belum ada data tersimpan.
4. Pengguna tekan "Simpan ke rekap" → `confirmSave` manggil `onSave(preview)`.
5. `App.jsx` nerima di `handleHarvestConfirm`. `calculateHarvest` ngasilin persentase dan berat per grade, `calculateHarvestValue` nambah nilai Rupiah.
6. `saveBatch` nulis ke `localStorage` key `agrisort.panen.v1`.
7. React update state, pindah ke halaman QC Results. `QCResults.jsx` baca `batch.hasil` dan tampilin. Nggak ada hitung ulang.
8. Halaman rekap jalan terpisah: `HarvestRecap.jsx` nerima `batches`, `filterBatches` nyaring, `sortBatchesByNewest` ngurutin, `slice` ambil baris untuk pagination.

Kalau validasi gagal, `globalError` muncul dan dialog nggak kebuka. Kalau pengguna tekan "Ubah", `preview` dikosongin. Saat aplikasi dibuka, `useEffect` di `App.jsx` baca ulang dari `localStorage`, jadi data tetap ada setelah refresh.

### 3. Pilih satu unit test. Apa yang diuji dan kapan gagal?

Test: `'calculateHarvestValue memakai harga acuan dan multiplier yang disetujui spesifikasi'` di `tes/harvestCalculation.test.js` (baris 28–39). Input `{ beratKg: 100, kesegaranPersen: 80, cacatPersen: 10, hargaAcuanPerKg: 12000, ukuran: 'Sedang' }`. Cek `nilai.gradeA = 777600`, `nilai.gradeB = 136080`, `nilai.reject = 32400`, `totalNilai = 946080`.

Manual: distribusi 72/18/10. Nilai A = `72 × 12000 × 1.0 × 0.9 = 777.600`. Nilai B = `18 × 12000 × 0.7 × 0.9 = 136.080`. Reject = `10 × 12000 × 0.3 × 0.9 = 32.400`. Total = 946.080.

Gagal kalau: pengali grade berubah (B jadi 0.75 → nilai B jadi 145.800), pengali ukuran Sedang berubah dari 0.9, harga acuan berubah, rumus distribusi berubah, atau `roundRupiah` mbuletin salah. Test sudah dijalankan — 57 lulus, 0 gagal.

### 4. Saran AI mana yang ditolak tim, dan mengapa?

R06 — perjelas dependency array `useMemo` di `HarvestRecap.jsx`. AI nyaranin tambah `page` dan `rowsPerPage` ke dependency array `sortedBatches` karena `visibleBatches` dihitung dari `sortedBatches.slice(...)`. Kami nolak karena dependency array `[batches, filter]` cuma untuk `sortedBatches`, yang cuma bergantung pada `batches` dan `filter`. `visibleBatches` dihitung di luar `useMemo` itu, jadi `page` dan `rowsPerPage` bukan input memo tersebut. Nambahin justru salah secara teknis. Nggak ada bug, nggak ada kode yang diubah. Tercatat di `docs/06-catatan-review.md`.

Contoh lain: `docs/05-kesalahan-ai.md` nyatat AI pernah ngklaim metrik akurasi model AI padahal proyek ini nggak punya model AI. Ditolak dan diganti sama fakta yang bisa diverifikasi.

### 5. Bagian kode mana yang paling sulit dipahami, dan bagaimana akhirnya dipahami?

Bagian yang cukup sulit kami pahami adalah fungsi `roundRupiah()` di `src/business/harvestCalculation.js`. Awalnya kami belum memahami mengapa nilai harus diproses dengan `toFixed(9)` sebelum dibulatkan menggunakan `Math.round()`.

Kami mencoba memahami fungsi tersebut dengan membaca implementasinya dan memeriksa unit test yang menguji pembulatan nilai `.5`. Dari situ kami memahami bahwa JavaScript dapat menghasilkan nilai desimal yang sedikit berbeda dari nilai matematis yang diharapkan karena representasi floating-point. Penanganan tambahan tersebut digunakan untuk mengatasi kasus pembulatan tertentu yang ditemukan pada proyek ini.

Kami memeriksa kembali pemahaman tersebut melalui regression test terkait. Dengan begitu, kami tidak hanya mengetahui apa yang dilakukan fungsi tersebut, tetapi juga alasan penanganannya dibuat seperti itu.
