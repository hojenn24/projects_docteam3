
# ════════════════════════════════════════════════════════════
# Paw-Data Backend RECOMMEND - 마이크로서비스 v1
# 도메인: 거주지 추천 (MariaDB + MongoDB + CSV + SSH 터널)
#
# 베이스: backend/Dockerfile.lite-v3 (12가지 최적화 기법 적용)
# 차이점: service_name = paw-backend-recommend
# ════════════════════════════════════════════════════════════

# ──────────────────────────────────────────
# Stage 1 - Builder
# ──────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        python3-dev && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/*

COPY requirements.txt .

RUN pip install --user --no-cache-dir --upgrade pip && \
    pip install --user --no-cache-dir -r requirements.txt && \
    /root/.local/bin/opentelemetry-bootstrap -a install

RUN find /root/.local -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /root/.local -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete 2>/dev/null || true && \
    find /root/.local -type d \( -name "tests" -o -name "test" \) -exec rm -rf {} + 2>/dev/null || true && \
    find /root/.local -type d \( -name "docs" -o -name "examples" \) -exec rm -rf {} + 2>/dev/null || true && \
    rm -rf /root/.local/lib/python*/site-packages/pip* \
           /root/.local/lib/python*/site-packages/setuptools* \
           /root/.local/lib/python*/site-packages/wheel* \
           /root/.local/lib/python*/site-packages/_distutils_hack \
           /root/.local/bin/pip*


# ──────────────────────────────────────────
# Stage 2 - Runtime
# ──────────────────────────────────────────
FROM python:3.11-slim

LABEL maintainer="paw-data-team" \
      service="backend-recommend" \
      domain="거주지 추천" \
      version="1.0"

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        tini && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/* /var/tmp/* && \
    useradd -m -u 1000 -s /bin/bash app && \
    mkdir -p /app/data && \
    chown -R app:app /app

COPY --from=builder --chown=app:app /root/.local /home/app/.local
COPY --chown=app:app main.py ./

USER app

ENV PATH=/home/app/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DATA_DIR=/app/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["opentelemetry-instrument", \
     "--traces_exporter", "otlp", \
     "--metrics_exporter", "none", \
     "--logs_exporter", "none", \
     "--service_name", "paw-backend-recommend", \
     "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
