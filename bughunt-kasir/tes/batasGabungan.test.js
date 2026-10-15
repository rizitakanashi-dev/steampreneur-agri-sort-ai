/*
 * Test pembuktian Bug B2 - Aturan 2 README:
 * "Jika produk yang sudah ada di keranjang ditambahkan lagi, jumlahnya dijumlahkan.
 *  Total jumlah per produk tetap tidak boleh lebih dari 99."
 *
 * Test ini SENGAJA hanya menguji penjumlahan dan batas 99 (B2).
 * Penggabungan string seperti "2" + "3" -> "23" (B3) diuji terpisah pada siklus lain.
 * Karena itu seluruh test di bawah memakai angka murni, bukan string.
 *
 * Jalankan dari folder bughunt-kasir:  node --test
 */

const test = require("node:test");
const assert = require("node:assert");
const kasir = require("../kasir.js");

function keranjangBaru() {
  return [];
}

test("B2: contoh README, Es Teh 2 lalu 3 menjadi 5", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", 2);
  kasir.tambahItem(k, "K04", 3);
  assert.strictEqual(k.length, 1);
  assert.strictEqual(Number(k[0].qty), 5);
});

test("B2: Es Teh 60 lalu 60 ditolak karena total 120 melebihi 99", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", 60);
  assert.throws(() => kasir.tambahItem(k, "K04", 60), /99|melebihi/i);
  assert.strictEqual(Number(k[0].qty), 60, "keranjang tidak boleh berubah setelah penolakan");
});

test("B2: Es Teh 50 lalu 49 diterima karena total tepat 99", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", 50);
  kasir.tambahItem(k, "K04", 49);
  assert.strictEqual(Number(k[0].qty), 99);
});

test("B2: Es Teh 50 lalu 50 ditolak karena total 100 melebihi 99", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", 50);
  assert.throws(() => kasir.tambahItem(k, "K04", 50), /99|melebihi/i);
  assert.strictEqual(Number(k[0].qty), 50, "keranjang tidak boleh berubah setelah penolakan");
});

test("B2: Es Teh 99 lalu 1 ditolak karena total 100 melebihi 99", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", 99);
  assert.throws(() => kasir.tambahItem(k, "K04", 1), /99|melebihi/i);
  assert.strictEqual(Number(k[0].qty), 99, "keranjang tidak boleh berubah setelah penolakan");
});

test("B2: batas 99 berlaku per produk, bukan per keranjang", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", 99);
  kasir.tambahItem(k, "K05", 99);
  assert.strictEqual(k.length, 2);
  assert.strictEqual(Number(k[0].qty), 99);
  assert.strictEqual(Number(k[1].qty), 99);
});
