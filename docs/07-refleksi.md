# Refleksi Tim

Diisi setelah pekerjaan utama selesai. Ditulis dengan bahasa sendiri dan jujur, termasuk bagian yang belum berjalan baik.

---

## 1. Apa yang berjalan baik dalam cara kami bekerja dengan AI?

**Pemisahan logika bisnis dari komponen React sejak awal.** Sejak langkah scaffolding (log #1), AI menyarankan menaruh semua fungsi kalkulasi dan validasi di `src/business/` terpisah dari komponen UI. Keputusan ini terbukti sangat membantu: kita bisa mengetes setiap rumus dengan `node --test` tanpa render React, dan ketika bug ditemukan (misalnya berat `0,00` lolos validasi), perbaikan hanya menyentuh satu file bisnis tanpa mengubah UI.

**Audit read-only sebelum mengubah kode.** Pada log #14 dan #16, kami meminta AI melakukan audit tanpa menyentuh kode sama sekali. Hasilnya: 13 temuan audit (T01–T13) dan 6 temuan code review (R01–R06), lengkap dengan tingkat risiko, file, dan bukti. Kami meninjau setiap temuan lalu memutuskan sendiri mana yang diterima, ditunda, atau ditolak. Pola "audit dulu, keputusan tim, baru eksekusi" mencegah AI mengubah kode yang sebenarnya tidak perlu diubah.

**TDD untuk perbaikan bug.** Saat memperbaiki bug berat nol (kesalahan #1) dan baris total rekap (R01), kami selalu mulai dengan test yang gagal (RED), baru lakukan perbaikan minimal (GREEN). Bug hunt Kasir Kantin juga mengikuti siklus yang sama: satu bug per siklus, test pembuktian dulu, baru perbaikan. Hasilnya, setiap perbaikan punya bukti yang dapat dijalankan ulang.

**Penolakan saran AI dengan alasan teknis.** Kami menolak saran R06 (tambah `page` dan `rowsPerPage` ke dependency array `useMemo`) karena dependency array tersebut hanya untuk `sortedBatches`, yang hanya bergantung pada `batches` dan `filter`. Menambahkan justru salah secara teknis. Penolakan dengan alasan yang jelas tercatat di `docs/06-catatan-review.md` dan `docs/08-penjelasan-kode.md` Bagian B pertanyaan 4.

**Dokumentasi kesalahan AI yang terbuka.** Setiap kali AI memberikan hasil yang salah, kami mencatatnya di `docs/05-kesalahan-ai.md` — bukan untuk menyalahkan AI, tetapi sebagai bukti bahwa tim memeriksa hasilnya. Tujuh kesalahan tercatat di sana, masing-masing dengan cara penemuan dan perbaikan yang kami lakukan.

---

## 2. Kapan AI paling membantu? Kapan AI justru menyulitkan?

### Paling membantu

- **Scaffolding dan setup proyek (log #1–#2).** AI membuat fondasi React + Vite + MUI, tema hijau pertanian, AppShell responsif, dan konfigurasi `node --test` dalam waktu singkat. Yang seharusnya makan ber jam menjadi menit.
- **Implementasi logika bisnis yang sudah dispesifikasikan (log #5–#6).** Ketika rumus grade, multiplier harga, dan aturan pembulatan sudah tertulis di `docs/01-spesifikasi.md` §6.4, AI menerjemahkannya ke kode dengan akurat. Ketujuh contoh perhitungan di spesifikasi cocok dengan output fungsi.
- **Audit dan code review sistematis (log #14, #16–#17).** AI bagus dalam memeriksa kode secara menyeluruh dan menemukan hal-hal yang terlewat oleh tim — seperti baris total rekap yang tidak ada (R01) dan `setError` di dalam `useMemo` (R05). Tim mungkin tidak akan menyadarinya sampai presentasi.
- **Bug hunt dengan siklus RED → GREEN (log #24–#31).** AI membantu membuat test pembuktian yang tepat menunjuk bug, lalu perbaikan minimal yang tidak merusak bagian lain. Regression test dijalankan setiap siklus.

### Justru menyulitkan

- **Mengklaim fitur yang belum ada.** AI pernah mengklaim metrik "akurasi model AI" di dashboard padahal proyek tidak punya model AI sama sekali (kesalahan #2). Klaim seperti ini berbahaya untuk challenge yang menilai kejujuran teknis.
- **Bug halus yang lolos test.** Validasi berat nol memakai perbandingan string (`form.beratKg === '0'`) sehingga `'0.0'`, `'0,00'`, `'0,0'` lolos (kesalahan #1). Test awal tidak menangkap karena hanya menguji `'0'`. Bug ini baru ketahuan saat audit read-only.
- **Menandai "Diterima" padahal kode belum berubah (kesalahan #6).** Catatan review awal menandai R01, R03, R05 sebagai "Diterima" padahal `grep` membuktikan kode belum diubah. AI membuat kesimpulan tentang implementasi tanpa memverifikasi kode aktual.
- **Deskripsi teknis yang tidak presisi (kesalahan #7).** AI menyebut React StrictMode mengeksekusi `useMemo` "tepat dua kali". Setelah kami verifikasi, perilaku StrictMode tidak menjamin eksekusi tepat dua kali — hanya "dapat dijalankan lebih dari sekali". Klaim yang terdengar presisi tapi salah bisa menyesatkan.

---

## 3. Kesalahan terbesar yang hampir lolos, dan bagaimana kami menemukannya?

### 3.1 Kesalahan: berkas analisis change request ter-commit dalam keadaan kosong

**Apa yang terjadi.** Sebelum mengerjakan Change Request (Tugas 3), tim sudah menulis isi analisis di `docs/analisis-change-request.md` lebih dulu, sesuai aturan urutan kerja. Namun berkas itu **belum disimpan** saat commit dokumen dibuat. Akibatnya yang ter-commit adalah berkas kosong, bukan isi analisis yang sudah ditulis.

Setelah commit kosong itu, tim langsung lanjut mengerjakan fitur pencarian, filter, dan ekspor CSV. Isi analisis baru benar-benar tersimpan dan di-commit **setelah** commit kode fitur. Jadi urutan commit di Git menjadi terbalik dari urutan kerja yang sebenarnya kami lakukan.

**Bukti dari riwayat commit.**

| Waktu | Commit | Isi |
|---|---|---|
| 16:13:58 | `b8b043a dokumen: analisis change request` | `docs/analisis-change-request.md` — **0 baris, 0 insertions** |
| 16:51:54 | `c1b1389 fitur: tambah pencarian real-time, filter komoditas, dan ekspor csv` | Kode fitur Change Request |
| 16:53:28 | `83016a4 dokumen: analisis change request` | `docs/analisis-change-request.md` — **36 insertions** |

Terlihat jelas: commit analisis pertama kosong, lalu commit kode, lalu isi analisis menyusul 1,5 menit setelah kode.

**Bagaimana kami menemukannya.** Kesalahan ini tidak terlihat dari tampilan aplikasi maupun dari hasil `npm test` — semuanya lulus. Kesalahan baru ketahuan saat kami meminta AI memeriksa berkas `docs/analisis-change-request.md` dan membandingkannya dengan riwayat Git. Perintah `git show --stat b8b043a` menunjukkan `0 insertions`, dan di situ ketahuan bahwa commit dokumen itu tidak berisi apa pun.

**Kenapa ini berbahaya.** Aturan challenge menyatakan analisis change request harus di-commit **sebelum** perubahan kode, dan juri memeriksa urutan commit-nya. Yang dinilai juri adalah isi repositori dan riwayat commit, bukan niat atau urutan kerja yang kami rasakan. Dari sisi riwayat, pekerjaan kami terbaca seolah-olah kami mengerjakan kode dulu lalu menulis analisis belakangan — kebalikan dari yang sebenarnya terjadi. Kalau tidak ketahuan, tim bisa kehilangan nilai pada aspek kepatuhan workflow tanpa sadar.

**Yang tidak kami lakukan.** Kami **tidak** menulis ulang riwayat commit (tidak `rebase`, tidak `amend`, tidak `force push`), karena aturan challenge melarang menghapus atau menulis ulang riwayat commit. Kami memilih mencatat kejadian ini secara terbuka di dokumen refleksi dan di `docs/analisis-change-request.md` bagian hasil aktual, karena kejujuran menangani kesalahan ikut dinilai.

### 3.2 Bug berat nol desimal lolos validasi (kesalahan #1)

**Apa yang terjadi.** Validasi berat nol memakai perbandingan string: `form.beratKg === '0'`. Akibatnya, input `'0.0'`, `'0,00'`, `'0,0'` lolos validasi dan bisa dikonfirmasi sebagai panen dengan berat nol — jelas tidak masuk akal.

**Kenapa ini hampir lolos.** Test awal hanya menguji `'0'` (string persis), bukan varian desimal nol. `npm test` lulus. Tampilan aplikasi tidak memberi sinyal kesalahan. Bug ini hanya ketahuan saat audit read-only (log #14, temuan T01) memeriksa apakah `'0.0'` dan `'0,00'` ditolak.

**Bagaimana kami memperbaikinya.** Mengubah perbandingan string menjadi `parseNumber(...) === 0` (perbandingan numerik), dengan TDD: test RED menunjukkan `'0.0'`/`'0,00'`/`'0,0'` tidak ditolak, lalu perbaikan GREEN membuktikan kelimanya ditolak tanpa ikut menolak berat desimal sah seperti `'0,5'`.

### 3.3 Pelajaran dari kesalahan ini

- **"Sudah ditulis" tidak sama dengan "sudah tersimpan".** Berkas yang belum disimpan tidak akan ikut ter-commit, walaupun isinya sudah ada di editor.
- **Commit yang berhasil belum tentu berisi.** `git commit` bisa sukses walaupun berkasnya kosong. Perlu diperiksa isinya, bukan hanya pesan commit-nya.
- **Niat tidak terlihat di Git, hanya hasilnya yang terlihat.** Urutan kerja yang benar tidak ada gunanya kalau tidak terekam.
- **Test lulus bukan bukti tidak ada bug.** Test hanya membuktikan apa yang diuji. Kasus yang tidak diuji (`'0.0'`, `'0,00'`) tetap lolos tanpa sinyal.
- **"Diterima" di catatan review harus diverifikasi dengan kode.** Klaim "sudah diperbaiki" harus dicek dengan `grep` atau `git diff`, bukan hanya dibaca dari pesan AI.

---

## 4. Apa yang akan kami lakukan berbeda jika mengulang challenge ini?

1. **Simpan berkas sebelum commit.** Tekan simpan di editor, lalu pastikan penanda "belum tersimpan" sudah hilang sebelum menjalankan `git add`.
2. **Periksa isi commit, bukan hanya pesannya.** Setelah commit dokumen, jalankan `git show --stat <hash>` dan pastikan jumlah baris yang masuk sesuai harapan. Angka `0 insertions` pada commit dokumen adalah tanda bahaya.
3. **Periksa berkas dengan `git status` sebelum pindah tugas.** Berkas yang masih berstatus *modified* atau *untracked* berarti ada pekerjaan yang belum ikut ter-commit.
4. **Pisahkan commit dokumen dan commit kode, lalu pastikan urutannya benar.** Jalankan `git log --oneline -3` setelah commit dokumen untuk memastikan commit kode belum ada di atasnya.
5. **Tulis test kasus batas sejak awal, bukan menunggu audit.** Bug berat nol desimal (`'0.0'`, `'0,00'`) tidak akan lolos kalau test awal sudah memuat varian penulisan nol yang berbeda. Prinsipnya: untuk setiap aturan "tidak boleh nol", uji semua cara menulis nol.
6. **Pisahkan "saran diterima" dari "perbaikan diterapkan" di catatan review.** Saat mencatat hasil code review, gunakan dua status berbeda: "Diterima" berarti tim setuju saran tersebut, "Diterapkan" berarti kode sudah berubah. Verifikasi "Diterapkan" dengan `grep` atau `git diff` sebelum menandainya.
7. **Jangan biarkan AI menulis klaim fitur yang belum ada.** Setiap kali AI menulis deskripsi fitur atau metrik dashboard, tanyakan: "Apakah ini benar-benar ada di kode?" Metrik "akurasi model AI" yang tidak ada model-nya (kesalahan #2) tidak akan terjadi kalau setiap klaim dicek ke sumber.
8. **Jalankan `npm test` dan `npm run build` sebelum setiap commit, bukan hanya di akhir.** Ini standar, tapi kami kadang lupa di tengah proses ketika fokus pada satu tugas.

---

## 5. Bagaimana kami mengatur waktu? Langkah mana yang jauh lebih lama dari estimasi, dan kenapa?

Estimasi vs aktual berdasarkan `docs/02-rencana.md`:

| Langkah | Estimasi | Aktual | Selisih | Catatan |
|---|---|---|---|---|
| 1 — Wawancara & rumusan masalah | 60 mnt | 60 mnt | 0 | Sesuai |
| 2 — Kasus uji & edge cases | 45 mnt | 40 mnt | −5 mnt | Lebih cepat |
| 3 — Rencana kerja | 30 mnt | 30 mnt | 0 | Sesuai |
| 5 — Setup scaffolding | 45 mnt | ≈30 mnt | −15 mnt | AI mempercepat scaffolding |
| 6 — Form input & validasi | 50 mnt | ≈125 mnt | **+75 mnt** | Jauh lebih lama — lihat di bawah |
| 7 — Logika kalkulasi grade & pricing | 60 mnt | ≈60 mnt | 0 | Sesuai |
| 8 — Penyimpanan & rekap | 50 mnt | ≈30 mnt | −20 mnt | Lebih cepat |
| 9 — BAPANAS & fallback | 50 mnt | ≈60 mnt | +10 mnt | Disesuaikan: tidak ada API BAPANAS, diganti tabel simulasi |
| 10 — Tabel rekap & responsif | 45 mnt | ≈45 mnt | 0 | Sesuai |
| 12 — Analisis change request | 30 mnt | 35 mnt | +5 mnt | Sedikit lebih lama |
| 13 — Pencarian & filter | 45 mnt | 45 mnt | 0 | Sesuai |
| 14 — Ekspor CSV & cetak PDF | 45 mnt | 40 mnt | −5 mnt | PDF tidak dikerjakan |
| 15 — Pengujian manual K01–K20 | 45 mnt | 30 mnt | −15 mnt | Lebih cepat |
| 16 — Unit test & kesalahan AI | 45 mnt | 45 mnt | 0 | Sesuai |
| 17 — Code review & refactor | 30 mnt | 40 mnt | +10 mnt | Lebih lama karena verifikasi ulang |
| 20 — Eksekusi fitur change request | 120 mnt | 105 mnt | −15 mnt | Lebih cepat |
| Bug Hunt (di luar rencana awal) | — | ≈60 mnt+ | — | Tidak diperkirakan di rencana awal |

**Langkah yang paling lama dari estimasi: Langkah 6 (Form input & validasi) — 125 menit dari estimasi 50 menit (+75 menit).**

Alasan: spesifikasi awal menyebut validasi *Laplacian Variance* dan filter objek luar (K02/K03), yang ternyata di luar cakupan §5 (tidak ada kamera/model AI di proyek). Tim perlu waktu untuk memahami bahwa fitur validasi citra tidak akan dikerjakan, lalu menyesuaikan form input menjadi validasi field biasa (berat, kesegaran, cacat, ukuran, catatan). Perubahan cakupan ini tidak terduga dari estimasi awal.

**Waktu tambahan yang tidak terduga: Bug Hunt Tugas 2 (≈60+ menit).** Bug Hunt Kasir Kantin tidak ada di rencana kerja awal (`docs/02-rencana.md` langkah 19 baru ditambahkan belakangan). Tim menghabiskan waktu untuk persiapan, konfigurasi test, dan empat siklus bug (B1–B4), dengan B4 dikerjakan di luar jendela waktu 60 menit. Belum lagi waktu untuk menelusuri kesalahan urutan commit (Bagian 3.1) dan verifikasi ulang catatan review (kesalahan #6).

**Pelajaran waktu:** estimasi untuk langkah yang melibatkan perubahan cakupan (seperti §5 yang menghapus fitur AI) harus diberi buffer ekstra. Begitu juga langkah yang melibatkan verifikasi dokumentasi — verifikasi ulang catatan review di log #17 memakan waktu yang tidak diantisipasi.

---

## 6. Bagian mana dari kode yang masih belum kami pahami sepenuhnya? (Jawab dengan jujur.)

### Fungsi `roundRupiah` dan penanganan floating-point

Fungsi `roundRupiah` di `src/business/harvestCalculation.js` memakai `toFixed(9)` sebelum `Math.round()`. Kami mengerti **apa** yang dilakukan: memotong sisa presisi floating-point (misalnya `1127506.4999999998` dipotong jadi `1127506.5` lalu dibulatkan ke `1127507`). Kami juga mengerti **kenapa** kasus ini muncul: JavaScript menyimpan `0.3` sebagai `0.2999...`, jadi rantai perkalian bisa menghasilkan angka yang sedikit berbeda dari nilai matematis.

Yang kami **belum pahami sepenuhnya**: apakah `toFixed(9)` cukup untuk semua kasus floating-point yang mungkin muncul, atau hanya untuk kasus yang kebetulan kami temukan dan uji. Apakah ada kombinasi input lain yang bisa menghasilkan sisa presisi di digit ke-10 atau lebih, yang `toFixed(9)` tidak tangkap? Kami tidak punya jawaban pasti untuk ini. Regression test mengunci kasus yang sudah ditemukan, tapi tidak membuktikan tidak ada kasus lain.

### Refaktor `useMemo` di PricingDashboard (R05)

Perbaikan R05 mengubah `useMemo` yang memanggil `setError` (side effect) menjadi `useMemo` yang mengembalikan objek `{ projection, validationError }` sebagai derived value murni. Kami mengerti **prinsipnya**: `useMemo` harus murni, tidak boleh memanggil `setState` selama render fase, dan `React.StrictMode` dapat menjalankan callback `useMemo` lebih dari sekali untuk mendeteksi side effect.

Yang kami **belum pahami sepenuhnya**: kapan tepatnya React menjalankan ulang callback `useMemo` di StrictMode, dan apakah ada skenario lain di komponen ini (atau komponen lain) yang memiliki pola serupa tanpa kami sadari. Verifikasi R05 dilakukan dengan `grep setError` dan menjalankan test, bukan dengan memahami secara mendalam seluruh lifecycle render React di mode development.

### Validasi data pribadi di catatan (R03, belum diterapkan)

Spesifikasi §4 baris 106 mewajibkan catatan tidak boleh berisi data pribadi (nama lengkap, nomor HP, alamat). Implementasi saat ini hanya memeriksa panjang 100 karakter. R03 ditunda karena tim **belum memahami sepenuhnya** bagaimana mendeteksi "nama lengkap" tanpa false positive yang tinggi (tidak ada database nama), dan apakah validasi harus menolak menyimpan atau cukup memberi peringatan. Ini bukan sekadar "belum dikerjakan" — kami belum yakin apa pendekatan yang benar.
