penjelasan 1 — Hieray Antovino

Ditulis oleh: Hieray Antovino

File dan fungsi: src/business/harvestStorage.js, fungsi saveBatch(batch, storage) (baris 36–46) dan readBatches(storage) (baris 13–25), dibantu createUniqueId (baris 27–34) dan isBatchRecord (baris 9–11)

Apa yang dilakukan: readBatches membaca semua batch dari localStorage menggunakan kunci agrisort.panen.v1. Jika storage kosong, JSON rusak, atau data bukan berupa array, fungsi langsung mengembalikan [] tanpa crash. saveBatch menyimpan batch baru dengan membaca data yang ada, membuat ID unik melalui createUniqueId, lalu menambahkan batch baru ke akhir array dan menulisnya kembali ke storage.

Kenapa dibuat seperti ini: createUniqueId mengecek jika ID yang diminta sudah ada, lalu menambahkan suffix -2, -3, dan seterusnya. Jadi jika panen-1 sudah ada, batch berikutnya mendapatkan panen-1-2 untuk menghindari bentrokan ID yang bisa membuat data tertimpa. isBatchRecord menyaring objek yang tidak memiliki ID string valid saat dibaca, sehingga data rusak tidak ikut masuk. Semua logika storage ditaruh terpisah dari React agar dapat dites menggunakan mock storage (seperti Map sederhana), bukan localStorage beneran.

Contoh: Jika inputnya { id: 'panen-1', tanggal: '2026-10-14', komoditas: 'Tomat', beratKg: 10 } dikirim ke storage kosong, saveBatch mengembalikan { id: 'panen-1', ...data } dan readBatches mengembalikan array berisi batch tersebut. Jika saveBatch dipanggil lagi dengan ID yang sama, createUniqueId menghasilkan panen-1-2. Seluruhnya diuji di tes/harvestStorage.test.js.

Jika input salah atau kosong:

saveBatch tanpa argumen atau input bukan objek → TypeError: 'Batch harus berupa object.'

Storage tidak tersedia → Error: 'localStorage tidak tersedia.'

JSON rusak di storage → readBatches mengembalikan [], bukan crash.

Semua kasus ini diuji di tes/harvestStorage.test.js.

Penjelasan 2 — Hieray Antovino

Ditulis oleh: Hieray Antovino

File dan fungsi: src/business/harvestFilter.js, fungsi filterBatches(batches, filter) (baris 54–60) dan sortBatchesByNewest(batches) (baris 63–68), dibantu matchesSearch (baris 26–32), matchesCommodity (baris 34–38), dan matchesDateRange (baris 40–48)

Apa yang dilakukan: filterBatches menyaring batch berdasarkan tiga kriteria: pencarian teks (ID atau komoditas), filter komoditas, dan rentang tanggal. Semua kriteria digabung dengan logika AND — batch harus cocok dengan semua filter yang aktif. sortBatchesByNewest mengurutkan batch dari tanggal terbaru. Jika tanggalnya sama, pengurutan dilakukan berdasarkan dicatatPada (waktu penyimpanan).

Kenapa dibuat seperti ini: Pencarian bersifat case-insensitive ('tomat', 'TOMAT', 'TeRuNg' semua cocok) karena matchesSearch mengubah teks ke huruf kecil (lowercase) terlebih dahulu sebelum membandingkan. Rentang tanggal menggunakan batas inklusif — tanggalDari: '2026-10-11' tetap memasukkan batch tanggal 11 Oktober. Filter yang kosong diabaikan, sehingga filterBatches dengan filter kosong mengembalikan semua data. sortBatchesByNewest membuat salinan terlebih dahulu ([...batches]) sebelum diurutkan agar array aslinya tidak berubah. Semua logika dipisah dari React agar dapat dites tanpa render.

Contoh: Jika inputnya 3 batch dengan ID panen-1 (Tomat, 10 Okt), panen-2 (Terung, 11 Okt), panen-3 (Tomat, 12 Okt), dan filter { search: 'tomat', komoditas: 'Tomat', tanggalDari: '2026-10-12', tanggalSampai: '' }, hasilnya hanya ['panen-3']. Jika filter kosong, mengembalikan semua 3 batch. sortBatchesByNewest mengembalikan ['panen-3', 'panen-2', 'panen-1']. Seluruhnya diuji di tes/harvestRecapChangeRequest.test.js.

Jika input salah atau kosong:

filterBatches tanpa argumen mengembalikan [] (default batches = []).

sortBatchesByNewest tanpa argumen mengembalikan [].

Batch tanpa bidang yang dicari (misalnya komoditas kosong) tidak membuat crash — matchesCommodity mengembalikan false dan batch tidak masuk hasil.

Kombinasi filter tanpa hasil mengembalikan [].