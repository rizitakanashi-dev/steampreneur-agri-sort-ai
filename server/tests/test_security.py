"""
Unit Tests untuk Validasi Keamanan Upload Citra (Task FS-BE-02)
Zero-dependency test runner menggunakan Python unittest bawaan.
"""

import unittest
from server.utils.security import (
    ImageValidationError,
    detect_magic_bytes,
    sanitize_filename,
    validate_upload_image,
)


class TestImageSecurityValidation(unittest.TestCase):
    def setUp(self):
        # Buat minimal valid PNG (1x1 pixel)
        # Header PNG 8 bytes + IHDR chunk (13 bytes) + IEND
        # Dimensi 1x1: width=0x00000001, height=0x00000001
        self.valid_png = (
            b"\x89PNG\r\n\x1a\n"  # PNG magic bytes (8 bytes)
            b"\x00\x00\x00\rIHDR"  # IHDR length + name (8 bytes)
            b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"  # 1x1 8bit RGBA (13 bytes)
            b"\x1f\x15\xc4\x89"  # IHDR CRC (4 bytes)
            b"\x00\x00\x00\x00IEND\xaeB`\x82"  # IEND chunk (12 bytes)
        )

        # Minimal valid JPEG header (32+ bytes) dengan marker SOF0
        self.valid_jpeg = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
            b"\xff\xc0\x00\x11\x08\x00\x0a\x00\x0a\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01"
            b"\xff\xd9"
        )

    def test_detect_magic_bytes_png(self):
        mime = detect_magic_bytes(self.valid_png)
        self.assertEqual(mime, "image/png")

    def test_detect_magic_bytes_jpeg(self):
        mime = detect_magic_bytes(self.valid_jpeg)
        self.assertEqual(mime, "image/jpeg")

    def test_detect_magic_bytes_invalid(self):
        fake_file = b"<!DOCTYPE html><html><body>Hacked</body></html>"
        mime = detect_magic_bytes(fake_file)
        self.assertIsNone(mime)

    def test_reject_empty_or_tiny_file(self):
        with self.assertRaises(ImageValidationError) as ctx:
            validate_upload_image(b"too_short", "test.jpg")
        self.assertEqual(ctx.exception.code, "FILE_EMPTY_OR_CORRUPT")

    def test_reject_oversized_file(self):
        # 10 MB + 1 byte
        huge_file = b"\x00" * (10 * 1024 * 1024 + 1)
        with self.assertRaises(ImageValidationError) as ctx:
            validate_upload_image(huge_file, "huge.jpg")
        self.assertEqual(ctx.exception.code, "FILE_TOO_LARGE")

    def test_reject_spoofed_extension(self):
        # Script PHP tapi dinamai .jpg
        malicious = b"<?php echo 'system vulnerable'; ?>" + (b"0" * 50)
        with self.assertRaises(ImageValidationError) as ctx:
            validate_upload_image(malicious, "malicious.jpg")
        self.assertEqual(ctx.exception.code, "INVALID_IMAGE_FORMAT")

    def test_accept_valid_png(self):
        result = validate_upload_image(self.valid_png, "tomat.png")
        self.assertTrue(result["is_valid"])
        self.assertEqual(result["mime_type"], "image/png")
        self.assertEqual(result["dimensions"]["width"], 1)
        self.assertEqual(result["dimensions"]["height"], 1)

    def test_sanitize_filename_prevents_path_traversal(self):
        dangerous_names = [
            "../../../etc/passwd",
            "..\\..\\windows\\system32\\calc.exe",
            "normal photo.jpg",
        ]
        for name in dangerous_names:
            safe = sanitize_filename(name)
            self.assertFalse(safe.startswith(".."))
            self.assertFalse("/" in safe)
            self.assertFalse("\\" in safe)

    def test_reject_decompression_bomb_dimensions(self):
        # PNG dengan header dimensi 5000 x 5000 px (> 4096 px)
        huge_dim_png = (
            b"\x89PNG\r\n\x1a\n"
            b"\x00\x00\x00\rIHDR"
            b"\x00\x00\x13\x88\x00\x00\x13\x88\x08\x06\x00\x00\x00"  # 5000 x 5000 (0x1388)
            b"\x00\x00\x00\x00"
            b"\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        with self.assertRaises(ImageValidationError) as ctx:
            validate_upload_image(huge_dim_png, "bomb.png")
        self.assertEqual(ctx.exception.code, "IMAGE_DIMENSIONS_TOO_LARGE")


if __name__ == "__main__":
    unittest.main()

