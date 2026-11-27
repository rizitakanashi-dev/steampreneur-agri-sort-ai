"""
Agri-Sort AI — Backend API Server
Framework: FastAPI (Python)
Tanggung Jawab: Fullstack Developer (Backend)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-01)
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

@asynccontextmanager
async def lifespan(_app: FastAPI):
    from server.services.auth_service import configure_auth_service

    configure_auth_service()
    yield


app = FastAPI(
    title="Agri-Sort AI Backend",
    description="Backend API Gateway & Quality Control Server untuk Agri-Sort AI (STEAMPreneur 2026)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Konfigurasi CORS: Mengizinkan Frontend Vite (localhost, LAN, maupun domain Vercel)
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
LAN_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.*\.vercel\.app)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=LAN_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Hubungkan router modular
from server.routers.qc import router as qc_router
from server.routers.pricing import router as pricing_router
from server.routers.history import router as history_router
from server.routers.auth import router as auth_router
from server.routers.organizations import router as organizations_router
from server.routers.account import router as account_router
from server.routers.prices import router as prices_router

app.include_router(qc_router)
app.include_router(pricing_router)
app.include_router(prices_router)
app.include_router(history_router)
app.include_router(auth_router)
app.include_router(organizations_router)
app.include_router(account_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Penanganan error global agar format error selalu terstandarisasi sesuai kontrak API
    dan tidak membocorkan stack trace internal server ke pengguna (Security Hardening).
    """
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Terjadi kesalahan pada internal server.",
                "details": {"path": str(request.url.path)},
            },
        },
    )


@app.get("/", tags=["General"])
async def root() -> Dict[str, Any]:
    """Halaman pengantar backend dan penunjuk dokumentasi OpenAPI/Swagger."""
    return {
        "status": "success",
        "message": "Agri-Sort AI API Server is running.",
        "version": "1.0.0",
        "documentation": "/docs",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/v1/health", tags=["Healthcheck"])
@app.get("/api/v1/health/", include_in_schema=False)
async def healthcheck() -> Dict[str, Any]:
    """
    Endpoint healthcheck untuk memverifikasi kesiapan server (Task FS-BE-01).
    Mendukung URL dengan dan tanpa trailing slash.
    """
    return {
        "status": "ok",
        "app": "Agri-Sort AI Backend",
        "version": "1.0.0",
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

