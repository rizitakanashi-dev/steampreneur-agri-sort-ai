"""
Tests normalisasi harga (isu #42) — pemetaan EKSAK, tanpa fuzzy matching.

Zero-dependency (unittest bawaan), mengikuti konvensi server/tests.
"""

import unittest

from server.services.price_normalization import (
    CANONICAL_COMMODITIES,
    is_known_non_mass_unit,
    normalize_unit,
    resolve_commodity,
    resolve_commodity_query,
    resolve_region,
)


class TestExactCommodityMapping(unittest.TestCase):
    def test_sp2kp_label_c_rawit_hijau_maps_exactly(self):
        commodity_id, price_type, supported = resolve_commodity("C Rawit Hijau", "sp2kp")
        self.assertTrue(supported)
        self.assertEqual(commodity_id, "cabai_rawit_hijau")
        self.assertEqual(price_type, "consumer")

    def test_rawit_merah_and_rawit_hijau_never_merge(self):
        # Label 'Cabai Rawit Merah' TERVERIFIKASI di kolom Nama Varian dataset SP2KP
        # resmi — dipetakan EKSAK ke rawit merah, TIDAK PERNAH digabung ke hijau.
        commodity_id, price_type, supported = resolve_commodity("Cabai Rawit Merah", "sp2kp")
        self.assertTrue(supported)
        self.assertEqual(commodity_id, "cabai_rawit_merah")
        self.assertEqual(price_type, "consumer")
        self.assertNotEqual(
            resolve_commodity("Cabai Rawit Merah", "sp2kp")[0],
            resolve_commodity("Cabai Rawit Hijau", "sp2kp")[0],
        )

    def test_terung_not_published_by_sp2kp(self):
        # Terung tidak ada di daftar nasional SP2KP (#39) => None, bukan pengganti komoditas.
        commodity_id, price_type, supported = resolve_commodity("Terung", "sp2kp")
        self.assertFalse(supported)
        self.assertIsNone(commodity_id)

    def test_unknown_label_is_rejected(self):
        for label in ("Durian", "Tomat Merah", "rawit", "cabai keriting"):
            commodity_id, _, supported = resolve_commodity(label, "sp2kp")
            self.assertFalse(supported, label)
            self.assertIsNone(commodity_id, label)

    def test_sipashorti_map_empty_until_confirmed(self):
        commodity_id, _, supported = resolve_commodity("Cabai Rawit Hijau", "sipashorti")
        self.assertFalse(supported)
        self.assertIsNone(commodity_id)

    def test_catalog_contains_terung_as_first_class(self):
        self.assertIn("terung", CANONICAL_COMMODITIES)


class TestQueryResolver(unittest.TestCase):
    def test_accepts_canonical_id_and_name(self):
        self.assertEqual(resolve_commodity_query("cabai_rawit_hijau"), "cabai_rawit_hijau")
        self.assertEqual(resolve_commodity_query("Cabai Rawit Hijau"), "cabai_rawit_hijau")
        self.assertEqual(resolve_commodity_query("  tomat "), "tomat")
        self.assertEqual(resolve_commodity_query("Tomat (Tomato)"[:5]), "tomat")

    def test_no_fuzzy_matching(self):
        self.assertIsNone(resolve_commodity_query("tomat merah"))
        self.assertIsNone(resolve_commodity_query("tom"))
        self.assertIsNone(resolve_commodity_query("durian"))
        self.assertIsNone(resolve_commodity_query(None))
        self.assertIsNone(resolve_commodity_query(""))


class TestUnitNormalization(unittest.TestCase):
    def test_kg_is_normalizable(self):
        result = normalize_unit("kg", 44800)
        self.assertIsNotNone(result)
        factor, info = result
        self.assertEqual(factor, 1.0)
        self.assertEqual(info["method"], "unit_factor")
        self.assertEqual(info["source_unit"], "kg")

    def test_non_mass_unit_stays_null(self):
        # Dilarang mengarang berat jenis untuk liter/boks/ikat.
        self.assertIsNone(normalize_unit("liter", 12000))
        self.assertIsNone(normalize_unit("boks", 250000))
        self.assertIsNone(normalize_unit("ikat", 15000))

    def test_unknown_unit_stays_null(self):
        self.assertIsNone(normalize_unit("peti", 300000))

    def test_missing_value_is_not_normalizable(self):
        self.assertIsNone(normalize_unit("kg", None))
        self.assertIsNone(normalize_unit(None, 44800))

    def test_known_non_mass_unit_flag(self):
        self.assertTrue(is_known_non_mass_unit("liter"))
        self.assertFalse(is_known_non_mass_unit("peti"))


class TestRegionResolution(unittest.TestCase):
    def test_kabupaten_with_parent_province(self):
        region = resolve_region("kabupaten", "1376", "Pasar Ibuh")
        self.assertEqual(region["level"], "kabupaten")
        self.assertEqual(region["code"], "1376")
        self.assertEqual(region["parent"]["code"], "13")

    def test_nasional_has_no_code(self):
        region = resolve_region("nasional", None)
        self.assertEqual(region["code"], None)
        self.assertEqual(region["name"], "Nasional")

    def test_invalid_region_code_rejected(self):
        self.assertIsNone(resolve_region("kabupaten", "abc"))
        self.assertIsNone(resolve_region("kabupaten", ""))
        self.assertIsNone(resolve_region("provinsi", "12a45"))


if __name__ == "__main__":
    unittest.main()
