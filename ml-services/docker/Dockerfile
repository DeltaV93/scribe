# syntax=docker/dockerfile:1.4

FROM python:3.11-slim as base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# -------------------
# Builder stage
# -------------------
FROM base as builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --upgrade pip && \
    pip install . --target=/app/deps

# -------------------
# Production stage
# -------------------
FROM base as production

# Copy dependencies from builder
COPY --from=builder /app/deps /app/deps
ENV PYTHONPATH=/app/deps:/app/src

# Copy application code
COPY src/ ./src/
COPY config/ ./config/
COPY alembic.ini ./

# Create non-root user
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

# -------------------
# Worker stage
# -------------------
FROM production as worker

CMD ["python", "-m", "celery", "-A", "src.common.celery_app", "worker", "--loglevel=info"]

# -------------------
# Beat stage (scheduler)
# -------------------
FROM production as beat

CMD ["python", "-m", "celery", "-A", "src.common.celery_app", "beat", "--loglevel=info"]
