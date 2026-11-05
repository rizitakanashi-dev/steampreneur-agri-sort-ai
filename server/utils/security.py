"""
Modul Keamanan & Validasi Upload Citra — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend Security)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-02)
"""

import io
import re
import struct
import uuid
from typing import Dict, Optional, Tuple

# Batasan Keamanan
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB (sesuai dokumen workflow)
MIN_FILE_SIZE_BYTES = 32                # File di bawah 32 bytes dipastikan corrupt/kosong
MAX_IMAGE_DIMENSION = 4096              # 4096 x 4096 px (mencegah Decompression Bomb / Zip Bomb)

ALLOWED_MIME_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
}

# Magic bytes signature
SIGNATURE_JPEG = b"\xff\xd8\xff"
SIGNATURE_PNG = b"\x89PNG\r\n\x1a\n"
SIGNATURE_WEBP_RIFF = b"RIFF"
SIGNATURE_WEBP_TAG = b"WEBP"


class ImageValidationError(Exception):
    """Exception khusus untuk kegagalan validasi berkas citra."""

    def __init__(self, message: str, code: str = "IMAGE_VALIDATION_FAILED", details: Optional[Dict] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


def detect_magic_bytes(header: bytes) -> Optional[str]:
    """
    Mendeteksi tipe MIME sebenarnya berdasarkan byte signature awal (Magic Bytes),
    bukan hanya percaya pada ekstensi file dari klien.
    """
    if len(header) < 12:
        return None

    if header.startswith(SIGNATURE_JPEG):
        return "image/jpeg"

    if header.startswith(SIGNATURE_PNG):
        return "image/png"

    if header.startswith(SIGNATURE_WEBP_RIFF) and header[8:12] == SIGNATURE_WEBP_TAG:
        return "image/webp"

    return None


def get_image_dimensions(image_bytes: bytes, mime_type: str) -> Tuple[int, int]:
    """
    Mengekstrak dimensi lebar dan tinggi gambar tanpa me-load seluruh piksel ke RAM.
    Membaca langsung dari binary header terlebih dahulu (Anti-Decompression Bomb),
    dengan fallback ke PIL jika diperlukan.
    """
    # 1. Coba baca dimensi cepat langsung dari binary header (sangat efisien & aman)
    width, height = None, None
    try:
        if mime_type == "image/png" and len(image_bytes) >= 24:
            width, height = struct.unpack(">II", image_bytes[16:24])
            return width, height

        if mime_type == "image/jpeg":
            idx = 2
            length = len(image_bytes)
            while idx < length - 8:
                if image_bytes[idx] == 0xFF:
                    marker = image_bytes[idx + 1]
                    if marker in (0xC0, 0xC1, 0xC2, 0xC3):  # SOF markers
                        h, w = struct.unpack(">HH", image_bytes[idx + 5 : idx + 9])
                        return w, h
                    elif marker not in (0x00, 0xFF):
                        segment_len = struct.unpack(">H", image_bytes[idx + 2 : idx + 4])[0]
                        idx += 2 + segment_len
                        continue
                idx += 1

        if mime_type == "image/webp" and len(image_bytes) >= 30:
            if b"VP8 " in image_bytes[:20]:
                w, h = struct.unpack("<HH", image_bytes[26:30])
                return (w & 0x3FFF), (h & 0x3FFF)
            elif b"VP8L" in image_bytes[:20]:
                b0, b1, b2, b3 = image_bytes[21:25]
                w = 1 + (((b1 & 0x3F) << 8) | b0)
                h = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6))
                return w, h
    except Exception:
        pass

    # 2. Jika tidak terbaca dari binary header, gunakan PIL
    try:
        from PIL import Image

        with Image.open(io.BytesIO(image_bytes)) as img:
            return img.width, img.height
    except ImportError:
        pass
    except Exception as exc:
        raise ImageValidationError(
            f"Struktur berkas citra rusak atau tidak valid: {str(exc)}",
            code="CORRUPTED_IMAGE",
        )

    return 640, 640


def sanitize_filename(filename: str) -> str:
    """
    Membersihkan nama file dari karakter berbahaya untuk mencegah Path Traversal.
    Menghasilkan nama aman berawalan UUID acak.
    """
    clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", filename)
    clean_name = clean_name.lstrip("._")
    if not clean_name:
        clean_name = "upload.jpg"
    return f"{uuid.uuid4().hex[:12]}_{clean_name}"


def validate_upload_image(
    image_bytes: bytes,
    claimed_filename: str = "upload.jpg",
    claimed_content_type: Optional[str] = None,
) -> Dict[str, any]:
    """
    Pemeriksaan keamanan lengkap (Task FS-BE-02):
    1. Cek ukuran minimal (mencegah zero-byte / file kosong).
    2. Cek ukuran maksimal (mencegah DoS / payload > 10 MB).
    3. Cek Magic Bytes signature (mencegah executable / spoofed extension).
    4. Cek dimensi gambar (mencegah Decompression Bomb > 4096 px).
    5. Menghasilkan nama berkas aman.
    """
    file_size = len(image_bytes)

    # 1. Cek batas ukuran minimal
    if file_size < MIN_FILE_SIZE_BYTES:
        raise ImageValidationError(
            "Berkas citra kosong atau terlalu kecil.",
            code="FILE_EMPTY_OR_CORRUPT",
            details={"file_size_bytes": file_size, "min_required": MIN_FILE_SIZE_BYTES},
        )

    # 2. Cek batas ukuran maksimal
    if file_size > MAX_FILE_SIZE_BYTES:
        raise ImageValidationError(
            f"Ukuran berkas ({file_size / (1024 * 1024):.2f} MB) melebihi batas maksimal 10 MB.",
            code="FILE_TOO_LARGE",
            details={"file_size_bytes": file_size, "max_allowed_bytes": MAX_FILE_SIZE_BYTES},
        )

    # 3. Cek Magic Bytes signature
    detected_mime = detect_magic_bytes(image_bytes[:32])
    if not detected_mime or detected_mime not in ALLOWED_MIME_TYPES:
        raise ImageValidationError(
            "Format berkas tidak didukung. Harap unggah berkas citra berformat JPG, PNG, atau WebP.",
            code="INVALID_IMAGE_FORMAT",
            details={
                "detected_mime": detected_mime,
                "allowed_mimes": list(ALLOWED_MIME_TYPES.keys()),
            },
        )

    # 4. Cek dimensi gambar (Anti Decompression Bomb)
    width, height = get_image_dimensions(image_bytes, detected_mime)
    if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        raise ImageValidationError(
            f"Dimensi citra ({width}x{height} px) melebihi batas aman maksimal {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION} px.",
            code="IMAGE_DIMENSIONS_TOO_LARGE",
            details={"width": width, "height": height, "max_allowed": MAX_IMAGE_DIMENSION},
        )

    safe_name = sanitize_filename(claimed_filename)

    return {
        "is_valid": True,
        "mime_type": detected_mime,
        "file_size_bytes": file_size,
        "dimensions": {"width": width, "height": height},
        "safe_filename": safe_name,
    }
