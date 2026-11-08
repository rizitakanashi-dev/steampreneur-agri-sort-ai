"""
Unit Test Suite untuk Pre-flight Quality Gate & CLAHE Preprocessing — Agri-Sort AI Backend
Tanggung Jawab: ML Engineer (Faris Al Farizi)
Dokumen Acuan: docs/rencana-kerja-ml-engineer.md (Bab 8B Poin 2)
"""

from io import BytesIO
import unittest
import numpy as np
from PIL import Image

from server.utils.image_quality import analyze_image_quality, apply_clahe_enhancement


class TestImageQualityAndCLAHE(unittest.TestCase):
    """Pengujian deteksi ketajaman, pencahayaan, dan peningkatan citra CLAHE."""

    def setUp(self):
        # 1. Citra tajam dengan kontras tinggi (checkerboard pattern)
        sharp_arr = np.zeros((200, 200, 3), dtype=np.uint8)
        sharp_arr[::20, :] = 255
        sharp_arr[:, ::20] = 255
        sharp_img = Image.fromarray(sharp_arr)
        buf = BytesIO()
        sharp_img.save(buf, format="JPEG")
        self.sharp_bytes = buf.getvalue()

        # 2. Citra seragam sangat gelap (Pasar Subuh remang-remang < 45)
        dark_arr = np.full((200, 200, 3), 25, dtype=np.uint8)
        dark_img = Image.fromarray(dark_arr)
        buf = BytesIO()
        dark_img.save(buf, format="JPEG")
        self.dark_bytes = buf.getvalue()

        # 3. Citra sangat silau (> 215)
        bright_arr = np.full((200, 200, 3), 245, dtype=np.uint8)
        bright_img = Image.fromarray(bright_arr)
        buf = BytesIO()
        bright_img.save(buf, format="JPEG")
        self.bright_bytes = buf.getvalue()

    def test_sharp_image_analysis(self):
        """Memverifikasi citra tajam memiliki Laplacian variance tinggi dan lolos uji."""
        res = analyze_image_quality(self.sharp_bytes)
        self.assertGreater(res["blur_score"], 50.0)
        self.assertFalse(res["is_blurry"])
        self.assertIn(res["lighting_condition"], ["optimal", "underexposed", "overexposed"])

    def test_dark_image_detection_and_clahe_recommendation(self):
        """Memverifikasi deteksi kondisi remang-remang subuh dan rekomendasi CLAHE."""
        res = analyze_image_quality(self.dark_bytes)
        self.assertLess(res["mean_luminance"], 45.0)
        self.assertEqual(res["lighting_condition"], "underexposed")
        self.assertTrue(res["clahe_recommended"])
        self.assertIn("WARNING", res["quality_verdict"])

    def test_overexposed_image_detection(self):
        """Memverifikasi deteksi citra silau berlebih."""
        res = analyze_image_quality(self.bright_bytes)
        self.assertGreater(res["mean_luminance"], 215.0)
        self.assertEqual(res["lighting_condition"], "overexposed")
        self.assertIn("WARNING_OVEREXPOSED", res["quality_verdict"])

    def test_clahe_enhancement_success(self):
        """Memverifikasi CLAHE memproses byte citra dan menghasilkan citra valid dengan dimensi identik."""
        enhanced_bytes = apply_clahe_enhancement(self.dark_bytes)
        self.assertIsInstance(enhanced_bytes, bytes)
        self.assertGreater(len(enhanced_bytes), 0)

        # Buka hasil dan verifikasi dimensi
        enhanced_img = Image.open(BytesIO(enhanced_bytes))
        self.assertEqual(enhanced_img.size, (200, 200))

    def test_corrupt_bytes_fallback(self):
        """Memverifikasi penanganan byte korup secara aman tanpa melempar unhandled exception."""
        corrupt = b"invalid_binary_corrupt_data"
        res = analyze_image_quality(corrupt)
        self.assertIn("quality_verdict", res)
        fallback_bytes = apply_clahe_enhancement(corrupt)
        self.assertEqual(fallback_bytes, corrupt)


if __name__ == "__main__":
    unittest.main()
