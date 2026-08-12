#!/bin/bash
# start.sh — Launch FraudNet v3.0 (API + Frontend)

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         FraudNet v3.0 Startup            ║"
echo "║  Auth · WebSocket · SHAP · SQLite DB     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Install Python dependencies if needed ─────────────────────────────────────
if ! python -c "import sqlalchemy, jose, passlib, slowapi" 2>/dev/null; then
  echo "[*] Installing Python dependencies..."
  pip install -r requirements.txt -q
fi

# ── Install Node dependencies if needed ───────────────────────────────────────
if [ ! -d "frontend/node_modules" ]; then
  echo "[*] Installing frontend dependencies..."
  cd frontend && npm install -q && cd ..
fi

# ── Train model if missing ────────────────────────────────────────────────────
if [ ! -f "models/fraud_model.pkl" ]; then
  echo "[!] No trained model found."
  if [ -f "data/creditcard.csv" ]; then
    echo "    Training model now (this takes ~2 min)..."
    python -m backend.train
    [ $? -ne 0 ] && echo "[!] Training failed — API will run in demo mode."
  else
    echo "    data/creditcard.csv not found — API runs in demo mode."
    echo "    Download from: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud"
  fi
fi

echo ""
echo "[1] Starting FastAPI backend  →  http://localhost:8000"
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

# Wait until backend is ready
echo "    Waiting for backend..."
for i in $(seq 1 20); do
  sleep 1
  curl -sf http://localhost:8000/api/health > /dev/null 2>&1 && break
done

echo "[2] Starting React frontend   →  http://localhost:5173"
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "────────────────────────────────────────────"
echo "  Dashboard : http://localhost:5173"
echo "  API Docs  : http://localhost:8000/docs"
echo ""
echo "  Sign in as the administrator set in backend/.env"
echo "  (ADMIN_USERNAME / ADMIN_PASSWORD). On an empty database no"
echo "  account exists until both are set — see backend/.env.example."
echo "────────────────────────────────────────────"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

trap "echo ''; echo 'Stopping services...'; kill \$BACKEND_PID \$FRONTEND_PID 2>/dev/null; exit" INT
wait
