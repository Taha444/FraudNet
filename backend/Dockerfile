FROM python:3.11-slim

WORKDIR /app

# Install system deps for XGBoost / SHAP
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY models/  ./models/

# Writable location for the SQLite file. The database used to be written next
# to the source inside the image layer, so every container recreation started
# from an empty database — users, alerts and audit history all gone. Mount a
# volume here (see docker-compose.yml) or set DATABASE_URL to a real server.
RUN mkdir -p /app/data
ENV DATABASE_URL=sqlite:////app/data/fraudnet.db

# Run as an unprivileged user: a process that only reads its code and writes
# one directory has no reason to be root, and root in the container is root on
# the host if the runtime is ever misconfigured.
RUN useradd --create-home --uid 10001 fraudnet \
    && chown -R fraudnet:fraudnet /app/data
USER fraudnet

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
