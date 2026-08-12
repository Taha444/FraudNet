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

# Create empty DB dir
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
