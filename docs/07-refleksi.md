# Refleksi Tim

Diisi setelah pekerjaan utama selesai. Ditulis dengan bahasa sendiri dan jujur, termasuk bagian yang belum berjalan baik.

---

## 1. Apa yang berjalan baik dalam cara kami bekerja dengan AI?

Belum diisi — perlu dijawab tim.

---

## 2. Kapan AI paling membantu? Kapan AI justru menyulitkan?

Belum diisi — perlu dijawab tim.

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

### 3.2 Pelajaran dari kesalahan ini

- **"Sudah ditulis" tidak sama dengan "sudah tersimpan".** Berkas yang belum disimpan tidak akan ikut ter-commit, walaupun isinya sudah ada di editor.
- **Commit yang berhasil belum tentu berisi.** `git commit` bisa sukses walaupun berkasnya kosong. Perlu diperiksa isinya, bukan hanya pesan commit-nya.
- **Niat tidak terlihat di Git, hanya hasilnya yang terlihat.** Urutan kerja yang benar tidak ada gunanya kalau tidak terekam.

---

## 4. Apa yang akan kami lakukan berbeda jika mengulang challenge ini?

Belum diisi penuh — perlu dijawab tim. Namun dari kesalahan di Bagian 3, tim sudah menyepakati langkah perbaikan berikut:

1. **Simpan berkas sebelum commit.** Tekan simpan di editor, lalu pastikan penanda "belum tersimpan" sudah hilang sebelum menjalankan `git add`.
2. **Periksa isi commit, bukan hanya pesannya.** Setelah commit dokumen, jalankan `git show --stat <hash>` dan pastikan jumlah baris yang masuk sesuai harapan. Angka `0 insertions` pada commit dokumen adalah tanda bahaya.
3. **Periksa berkas dengan `git status` sebelum pindah tugas.** Berkas yang masih berstatus *modified* atau *untracked* berarti ada pekerjaan yang belum ikut ter-commit.
4. **Pisahkan commit dokumen dan commit kode, lalu pastikan urutannya benar.** Jalankan `git log --oneline -3` setelah commit dokumen untuk memastikan commit kode belum ada di atasnya.

---

## 5. Bagaimana kami mengatur waktu? Langkah mana yang jauh lebih lama dari estimasi, dan kenapa?

Belum diisi penuh — perlu dijawab tim. Catatan yang sudah kami miliki:

- Langkah 12 (analisis dampak change request) selesai dalam 35 menit dari estimasi 30 menit.
- Langkah 13 (pencarian & filter) selesai dalam 45 menit, sesuai estimasi.
- Langkah 20 (eksekusi fitur change request) selesai dalam 105 menit dari estimasi 120 menit.
- Waktu tambahan tidak terduga muncul untuk memperbaiki kesalahan urutan commit di Bagian 3, yaitu menelusuri riwayat, memverifikasi isi tiap commit, dan melengkapi dokumentasi yang terlewat.

---

## 6. Bagian mana dari kode yang masih belum kami pahami sepenuhnya?

Belum diisi — perlu dijawab tim dengan jujur.
