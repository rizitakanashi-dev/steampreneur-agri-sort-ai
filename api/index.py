"""
Vercel Serverless Function Entrypoint — Agri-Sort AI Backend (FastAPI)
Mengekspor instance ASGI `app` dari `server.main` agar Vercel Python Runtime
dapat melayani seluruh endpoint `/api/*` dalam satu project bersama frontend Vite.
"""

import sys
import traceback

from server.config.auth_config import AuthConfigurationError, load_auth_config
from server.services.auth_service import auth_service

# Validate on serverless cold start as well as during ASGI lifespan startup.
try:
    auth_service.configure(load_auth_config())
except AuthConfigurationError as exc:
    sys.stderr.write(
        f"[COLD-START FATAL] Kesalahan konfigurasi autentikasi saat inisialisasi serverless: {exc}\n"
    )
    traceback.print_exc(file=sys.stderr)
    sys.stderr.flush()
    raise
except Exception as exc:
    sys.stderr.write(
        f"[COLD-START FATAL] Kegagalan tidak terduga saat inisialisasi serverless: {exc}\n"
    )
    traceback.print_exc(file=sys.stderr)
    sys.stderr.flush()
    raise

from server.main import app

__all__ = ["app"]
