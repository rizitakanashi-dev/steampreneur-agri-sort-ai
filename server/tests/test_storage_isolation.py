import hashlib
from pathlib import Path
import tempfile
import unittest

from server.services.storage_service import DEFAULT_STORAGE_PATH
from server.tests.storage_isolation import isolated_scan_storage


class TestStorageIsolation(unittest.TestCase):
    def test_scan_write_uses_temporary_storage_not_runtime_default(self):
        runtime_scans = DEFAULT_STORAGE_PATH
        before = hashlib.sha256(runtime_scans.read_bytes()).hexdigest() if runtime_scans.exists() else None

        with tempfile.TemporaryDirectory(prefix="agri-sort-test-") as temp_dir:
            storage = isolated_scan_storage(Path(temp_dir))
            storage.save_scan({"scan_id": "isolated-test-scan", "commodity": "Tomat"})

            self.assertNotEqual(storage.file_path.resolve(), runtime_scans.resolve())
            self.assertTrue(storage.file_path.is_relative_to(Path(temp_dir).resolve()))
            self.assertTrue(storage.file_path.exists())

        after = hashlib.sha256(runtime_scans.read_bytes()).hexdigest() if runtime_scans.exists() else None
        self.assertEqual(after, before)

    def test_qc_test_storage_helper_requires_explicit_temporary_directory(self):
        with self.assertRaises(ValueError):
            isolated_scan_storage(DEFAULT_STORAGE_PATH.parent)


if __name__ == "__main__":
    unittest.main()
