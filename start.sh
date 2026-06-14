#!/bin/bash
# start.sh — Launch FraudNet API + Frontend together

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        FraudNet v2.3 Startup         ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check for trained model
if [ ! -f "models/fraud_model.pkl" ]; then
  echo "[!] No trained model found."
  echo "    Training model now (requires data/creditcard.csv)..."
  echo ""
  python -m backend.train
  if [ $? -ne 0 ]; then
    echo ""
    echo "[!] Training failed. Starting API in demo mode."
  fi
fi

echo ""
echo "[1] Starting FastAPI backend on http://localhost:8000 ..."
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "[2] Starting React frontend on http://localhost:5173 ..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "──────────────────────────────────────"
echo "  Dashboard: http://localhost:5173"
echo "  API Docs:  http://localhost:8000/docs"
echo "──────────────────────────────────────"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
