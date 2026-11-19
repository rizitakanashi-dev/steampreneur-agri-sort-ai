# Integrasi Harga Publik SP2KP — Rancangan

## Tujuan
Mengganti harga baseline buatan aplikasi dengan data yang benar-benar diambil dari endpoint publik SP2KP Kemendag. Prioritas cakupan adalah agregat Sumatera Barat. Harga yang tidak tersedia dari SP2KP tidak boleh diganti diam-diam dengan angka simulasi.

## Sumber dan bukti akses
Portal `https://sp2kp.kemendag.go.id/` menggunakan API publik `https://api-sp2kp.kemendag.go.id/report/api`. Endpoint yang ditemukan dari aset JavaScript portal:

- `GET /latest-price-dates?tipe_komoditas_id=1` — tanggal data harga terbaru.
- `GET /average-price-komoditas-public` — rekaman harga publik dengan `tanggal`, kode/nama provinsi, komoditas/varian, level agregasi, dan harga.

Kedua endpoint berhasil diuji tanpa kredensial. Query `kode_provinsi=13`, `tanggal=<tanggal terbaru>`, dan `take=10000` mengembalikan data Sumatera Barat. Data memuat harga agregat provinsi (`level=1`) dan data kabupaten/kota. Komoditas yang ditemukan pada sampel tanggal terbaru mencakup Cabai dan Tomat; varian cabai juga tersedia di tingkat pasar/kota. Terung tidak ditemukan pada sampel tersebut dan harus dianggap tidak tersedia sampai benar-benar muncul dalam respons SP2KP.

## Desain

1. `Sp2kpPricingService` mengambil tanggal terbaru dari endpoint SP2KP, lalu meminta data untuk tanggal itu. Gunakan endpoint JSON resmi publik yang sama dengan portal; jangan scraping HTML dan jangan membuat request dari browser langsung.
2. Pilih data agregat Sumatera Barat (`kode_provinsi=13`, level provinsi) bila tersedia untuk komoditas. Jangan campur dengan harga kabupaten/kota atau menamai rata-rata hasil kalkulasi sendiri sebagai harga resmi.
3. Jika harga provinsi tidak tersedia untuk komoditas yang diminta, gunakan nilai agregat nasional dari field/data resmi SP2KP hanya jika tersedia dan tanggalnya sama. Jika tidak ada data nasional resmi yang dapat diidentifikasi, kembalikan status tidak tersedia—bukan baseline lokal.
4. Normalisasi respons ke kontrak aplikasi yang telah ada, dengan nama komoditas/varian SP2KP yang sebenarnya, nilai Rp/kg (hanya bila unit sumber bisa diverifikasi), wilayah/cakupan, tanggal data, waktu pengambilan, dan URL sumber. Jangan mengarang riwayat mingguan atau perubahan harga; keluarkan hanya jika sumber menyediakan data pembanding yang sepadan.
5. Cache respons sukses dengan tanggal sumber dan TTL yang wajar. Saat sumber gagal, gunakan hanya cache sukses sebelumnya dan tandai sebagai stale dengan tanggal aslinya. Tanpa cache sukses, endpoint mengembalikan error/tidak tersedia; tidak membuat harga baru dari kode.
6. Endpoint `GET /api/v1/pricing/sp2kp/live` dan tombol sinkronisasi tetap menjadi antarmuka aplikasi. Sync melakukan fetch sungguhan dan hanya menyimpan hasil valid. Hilangkan baseline SP2KP buatan dan jangan biarkan UI menghitung harga dari fallback statis ketika feed tidak tersedia. Harga/estimasi yang membutuhkan harga harus menunjukkan data tidak tersedia, bukan angka simulasi.
7. Endpoint triangulasi yang saat ini mencampur baseline BAPANAS/SP2KP harus menampilkan hanya data SP2KP untuk cakupan perubahan ini, atau dinonaktifkan/ditandai unavailable sampai mempunyai dua sumber nyata. Tidak boleh menyajikan perbandingan palsu.

## Error handling dan transparansi
- Timeout, respons HTTP gagal, JSON invalid, tanggal terbaru kosong, atau skema tak dikenal tidak boleh dianggap sebagai sinkronisasi sukses.
- Harga nol, negatif, unit tak terverifikasi, dan tanggal invalid tidak boleh dipublikasikan sebagai harga pasar.
- Metadata UI menyebut “SP2KP”, wilayah cakupan aktual, tanggal data dari SP2KP, serta status terbaru/cache/tidak tersedia. Kata “live” hanya untuk fetch sukses.
- Komoditas yang tidak tersedia pada SP2KP tidak ditampilkan dengan harga referensi lokal sebagai pengganti.

## Pengujian
Gunakan mock HTTP untuk menguji endpoint tanggal, pengambilan data, pemilihan agregat provinsi, fallback nasional hanya dari harga sumber yang nyata, normalisasi varian, cache stale, dan kegagalan. Tambahkan tes endpoint FastAPI serta tes yang memastikan UI tidak memilih `REFERENCE_PRICES_PER_KG`/riwayat statis saat feed gagal. Tes tidak bergantung pada jaringan publik.

## Batasan
API ditemukan dari bundle publik portal, namun dokumentasi kontrak/versi stabilnya belum ditemukan. Field dan query perlu divalidasi secara defensif. Data yang tersedia hari ini tidak menjamin semua komoditas atau varian hortikultura tersedia, dan sinkronisasi harian tergantung frekuensi pemutakhiran SP2KP. Data resmi tidak berarti selalu data saat itu juga; tanggal sumber harus selalu ditampilkan.

## Kriteria penerimaan
- Harga feed hanya dapat berasal dari respons SP2KP yang tervalidasi atau cache sukses dari respons tersebut.
- Tidak ada lagi baseline harga buatan yang muncul melalui endpoint live, sync, triangulasi, dashboard, kalkulator, atau hasil QC.
- Sumatera Barat diprioritaskan; data cakupan lain hanya ditampilkan dengan label cakupan sebenarnya dan bila nilainya benar-benar disediakan SP2KP.
- Kegagalan sumber dan komoditas tanpa data menghasilkan status eksplisit, bukan harga buatan.
- Tes offline mencakup sukses, data parsial, cache, dan kegagalan sumber.
