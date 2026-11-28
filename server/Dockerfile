FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    YOLO_AUTOINSTALL=False

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app app

COPY server/requirements.txt ./server/requirements.txt
RUN grep -v '^ultralytics' server/requirements.txt > /tmp/requirements-runtime.txt \
    && python -m pip install --upgrade pip \
    && python -m pip install -r /tmp/requirements-runtime.txt \
    && rm /tmp/requirements-runtime.txt

COPY server ./server

RUN mkdir -p /app/server/data \
    && chown -R app:app /app/server

USER app
EXPOSE 8000

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
