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

(Tambahkan sampai setiap anggota punya minimal dua penjelasan.)

---

## Bagian B: Pertanyaan yang dijawab bersama

1. Jika aturan bisnis utama di spesifikasi berubah (tuliskan contoh perubahannya), file dan fungsi mana yang harus diubah? Jelaskan alasannya.

2. Bagaimana data mengalir dari saat pengguna mengisi form sampai hasilnya tampil di layar? Sebutkan file dan fungsi yang dilewati secara berurutan.

3. Pilih satu unit test. Apa yang diuji, dan dalam kondisi apa test itu akan gagal?

4. Pilih satu saran AI yang kalian tolak. Apa sarannya dan kenapa kalian menolaknya?

5. Bagian kode mana yang paling sulit dipahami, dan bagaimana kalian akhirnya memahaminya?
