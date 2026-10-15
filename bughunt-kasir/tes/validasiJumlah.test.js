/*
 * Test pembuktian Bug B1 - Aturan 1 README:
 * "Jumlah pesanan per produk harus bilangan bulat dari 1 sampai 99.
 *  Jumlah kosong, nol, negatif, atau pecahan harus ditolak dengan pesan kesalahan."
 *
 * Test ini SENGAJA hanya menguji validasi jumlah (B1).
 * Penggabungan produk sama (Aturan 2) diuji terpisah pada siklus bug lain.
 *
 * Jalankan dari folder bughunt-kasir:  node --test
 */

const test = require("node:test");
const assert = require("node:assert");
const kasir = require("../kasir.js");

function keranjangBaru() {
  return [];
}

test("B1: jumlah kosong ditolak", () => {
  assert.throws(() => kasir.tambahItem(keranjangBaru(), "K04", ""), /jumlah/i);
});

test("B1: jumlah nol ditolak", () => {
  assert.throws(() => kasir.tambahItem(keranjangBaru(), "K04", 0), /jumlah/i);
});

test("B1: jumlah negatif ditolak", () => {
  assert.throws(() => kasir.tambahItem(keranjangBaru(), "K04", -5), /jumlah/i);
});

test("B1: jumlah pecahan ditolak", () => {
  assert.throws(() => kasir.tambahItem(keranjangBaru(), "K04", 2.5), /jumlah/i);
});

test("B1: jumlah non-numerik ditolak", () => {
  assert.throws(() => kasir.tambahItem(keranjangBaru(), "K04", "abc"), /jumlah/i);
});

test("B1: jumlah di atas 99 ditolak", () => {
  assert.throws(() => kasir.tambahItem(keranjangBaru(), "K04", 100), /jumlah/i);
});

test("B1: batas sah 1 dan 99 diterima", () => {
  const k = keranjangBaru();
  kasir.tambahItem(k, "K04", 1);
  kasir.tambahItem(k, "K05", 99);
  assert.strictEqual(k.length, 2);
  assert.strictEqual(Number(k[0].qty), 1);
  assert.strictEqual(Number(k[1].qty), 99);
});
