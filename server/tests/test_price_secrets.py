"""
Test kebocoran kredensial provider (isu #42):
tidak boleh ada nama/nilai kredensial provider di frontend (src/) maupun di kode
yang diekspor ke bundle (path `src/` seluruhnya dipindai).
"""

import os
import unittest
from pathlib import Path

FRONTEND_SRC = Path(__file__).resolve().parents[2] / "src"
FORBIDDEN_MARKERS = (
    "VITE_SIPASHORTI",
    "VITE_SP2KP",
    "SIPASHORTI_API_KEY",
    "SP2KP_API_KEY",
    "SIPASHORTI_BASE_URL",
    "SP2KP_BASE_URL",
)
# Catatan: URL portal publik (sp2kp.kemendag.go.id, 11ap.pertanian.go.id) BOLEH muncul
# sebagai atribusi statis — yang dilarang adalah panggilan langsung/kredensial. Uji
# panggilan langsung dijakamin lewat scanService: tidak ada fetch ke domain provider.


class TestNoProviderSecretsInFrontend(unittest.TestCase):
    def test_src_contains_no_provider_secret_names_or_urls(self):
        offenders = []
        for path in FRONTEND_SRC.rglob("*"):
            if not path.is_file() or path.suffix not in {".js", ".jsx", ".ts", ".tsx", ".html", ".css"}:
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for marker in FORBIDDEN_MARKERS:
                if marker in text:
                    offenders.append(f"{path.relative_to(FRONTEND_SRC)}: {marker}")
        self.assertEqual(offenders, [])

    def test_no_direct_provider_calls_in_frontend(self):
        """Frontend tidak boleh memanggil domain provider langsung (fetch/axios/URL concat)."""
        import re

        offenders = []
        for path in FRONTEND_SRC.rglob("*.js*"):
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            for pattern in (r"fetch\(\s*['\"]https?://(11ap\.pertanian|sp2kp\.kemendag)", r"axios\.[a-z]+\(\s*['\"]https?://(11ap\.pertanian|sp2kp\.kemendag)"):
                if re.search(pattern, text):
                    offenders.append(str(path.relative_to(FRONTEND_SRC)))
        self.assertEqual(offenders, [])

    def test_server_uses_server_only_env_names(self):
        config_path = (
            Path(__file__).resolve().parents[1] / "config" / "price_config.py"
        )
        text = config_path.read_text(encoding="utf-8")
        for env_name in (
            "PRICE_SP2KP_ENABLED",
            "PRICE_SIPASHORTI_ENABLED",
            "PRICE_INGEST_ENABLED",
            "SP2KP_API_KEY",
            "SIPASHORTI_API_KEY",
        ):
            self.assertIn(env_name, text)


if __name__ == "__main__":
    unittest.main()
