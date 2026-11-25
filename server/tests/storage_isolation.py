from pathlib import Path

from server.services.storage_service import DEFAULT_STORAGE_PATH, LocalScanStorage


def isolated_scan_storage(temp_dir: Path) -> LocalScanStorage:
    root = Path(temp_dir).resolve()
    runtime_root = DEFAULT_STORAGE_PATH.parent.resolve()
    if root == runtime_root or root in runtime_root.parents or runtime_root in root.parents:
        raise ValueError("Test scan storage must be isolated from the runtime data directory")
    return LocalScanStorage(file_path=root / "scans.json")
