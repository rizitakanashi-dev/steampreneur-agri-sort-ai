"""
Vercel Serverless Function Entrypoint — Agri-Sort AI Backend (FastAPI)
Mengekspor instance ASGI `app` dari `server.main` agar Vercel Python Runtime
dapat melayani seluruh endpoint `/api/*` dalam satu project bersama frontend Vite.
"""

from server.main import app

__all__ = ["app"]
