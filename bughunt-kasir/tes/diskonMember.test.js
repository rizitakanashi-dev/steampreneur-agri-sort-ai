/*
 * Test pembuktian Bug B4 - Aturan 4 README:
 * "Diskon tidak boleh digabung, hanya satu yang berlaku:
 *    - Pelanggan member mendapat diskon 10% dari subtotal.
 *    - Pelanggan bukan member dengan subtotal minimal Rp100.000 mendapat diskon 5%.
 *    - Selain itu, tidak ada diskon.
 *  Nilai diskon dibulatkan ke rupiah terdekat."
 *
 * Bug: hitungDiskon() memakai dua `if` terpisah, sehingga member dengan
 * subtotal di atas Rp100.000 mendapat diskon 5% + 10% = 15% sekaligus.
 *
 * Test ini SENGAJA hanya menguji pemilihan diskon (B4).
 * Ambang batas Rp100.000 untuk non-member (B5) TIDAK diuji di sini agar
 * tidak tercampur; karena itu subtotal non-member yang dipakai 150.000
 * (jauh di atas ambang) dan 50.000 (jauh di bawah ambang).
 *
 * Jalankan dari folder bughunt-kasir:  node --test
 */

const test = require("node:test");
const assert = require("node:assert");
const kasir = require("../kasir.js");

test("B4: member subtotal 150.000 mendapat diskon 15.000, bukan 22.500", () => {
  assert.strictEqual(kasir.hitungDiskon(150000, true), 15000);
  assert.notStrictEqual(kasir.hitungDiskon(150000, true), 22500);
});

test("B4: member subtotal 120.000 mendapat diskon 12.000, bukan 18.000", () => {
  assert.strictEqual(kasir.hitungDiskon(120000, true), 12000);
  assert.notStrictEqual(kasir.hitungDiskon(120000, true), 18000);
});

test("B4: non-member subtotal 150.000 mendapat diskon 7.500 (5% saja)", () => {
  assert.strictEqual(kasir.hitungDiskon(150000, false), 7500);
});

test("B4: non-member subtotal di bawah 100.000 tidak mendapat diskon", () => {
  assert.strictEqual(kasir.hitungDiskon(50000, false), 0);
});

test("B4: member di bawah 100.000 tetap mendapat 10% (tidak terpengaruh ambang)", () => {
  assert.strictEqual(kasir.hitungDiskon(50000, true), 5000);
});

test("B4: diskon pada hitungRingkasan juga tunggal, bukan gabungan", () => {
  const k = [];
  kasir.tambahItem(k, "K01", 10); // Nasi Goreng 10 x 15.000 = 150.000
  const r = kasir.hitungRingkasan(k, true);
  assert.strictEqual(r.subtotal, 150000);
  assert.strictEqual(r.diskon, 15000);
});
