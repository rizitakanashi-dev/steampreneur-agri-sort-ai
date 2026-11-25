"""
Vercel Serverless Function Entrypoint — Agri-Sort AI Backend (FastAPI)
Mengekspor instance ASGI `app` dari `server.main` agar Vercel Python Runtime
dapat melayani seluruh endpoint `/api/*` dalam satu project bersama frontend Vite.
"""

from server.config.auth_config import load_auth_config
from server.services.auth_service import auth_service

# Validate on serverless cold start as well as during ASGI lifespan startup.
auth_service.configure(load_auth_config())

from server.main import app

__all__ = ["app"]
