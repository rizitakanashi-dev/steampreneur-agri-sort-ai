/*
 * Test pembuktian Bug B3 - Aturan 2 & 3 README:
 * "Jika produk yang sudah ada di keranjang ditambahkan lagi, jumlahnya dijumlahkan."
 * "Subtotal = jumlah dari (harga x jumlah) semua produk di keranjang."
 *
 * Bug: app.js mengirim jumlah dari <input> sebagai STRING (elQty.value),
 * sehingga "2" + "3" menghasilkan "23" (penggabungan teks), bukan 5.
 *
 * Test ini SENGAJA memakai jumlah string saja, dan tidak menyinggung
 * batas gabungan 99 milik B2 (B2 diuji terpisah di batasGabungan.test.js).
 *
 * Jalankan dari folder bughunt-kasir:  node --test
 */

const test = require("node:test");
const assert = require("node:assert");
const kasir = require("../kasir.js");

function keranjangBaru() {
  return [];
}

test("B3: contoh Aturan 2 dengan string, Es Teh \"2\" lalu \"3\" menjadi 5", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", "2");
  kasir.tambahItem(k, "K04", "3");
  assert.strictEqual(k.length, 1);
  assert.strictEqual(k[0].qty, 5, 'qty harus angka 5, bukan teks "23"');
});

test("B3: subtotal setelah gabungan string dihitung dari 5 x harga Es Teh", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", "2");
  kasir.tambahItem(k, "K04", "3");
  // 5 x 4.000 = 20.000 (bukan 23 x 4.000 = 92.000)
  assert.strictEqual(kasir.hitungSubtotal(k), 20000);
});

test("B3: gabungan string lain juga numerik, bukan kebetulan", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K05", "10");
  kasir.tambahItem(k, "K05", "7");
  assert.strictEqual(k[0].qty, 17, 'qty harus angka 17, bukan teks "107"');
  // 17 x 8.500 = 144.500 (bukan 107 x 8.500 = 909.500)
  assert.strictEqual(kasir.hitungSubtotal(k), 144500);
});

test("B3: qty tersimpan sebagai angka, bukan string, pada item baru", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", "6");
  assert.strictEqual(typeof k[0].qty, "number");
  assert.strictEqual(k[0].qty, 6);
});
