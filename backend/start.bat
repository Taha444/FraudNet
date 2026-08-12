@echo off
REM FraudNet v3.0 — Windows Startup Script
REM Place this in the root d:\11 directory and run from there,
REM OR run from root: backend\start.bat

echo.
echo ==========================================
echo   FraudNet v3.0  -  Windows Startup
echo   Auth  WebSocket  SHAP  SQLite DB
echo ==========================================
echo.

REM ── Activate venv ─────────────────────────────────────────────────────────
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo [*] Virtual environment activated.
) else (
    echo [!] No .venv found. Install deps manually:
    echo     pip install -r requirements.txt
)

REM ── Install deps if needed ─────────────────────────────────────────────────
python -c "import sqlalchemy, jose, passlib, slowapi" 2>nul
if errorlevel 1 (
    echo [*] Installing Python dependencies...
    pip install -r requirements.txt -q
)

REM ── Install frontend deps if needed ───────────────────────────────────────
if not exist "frontend\node_modules" (
    echo [*] Installing frontend dependencies...
    cd frontend
    npm install --silent
    cd ..
)

REM ── Train model if missing ─────────────────────────────────────────────────
if not exist "models\fraud_model.pkl" (
    echo [!] No trained model found.
    if exist "data\creditcard.csv" (
        echo     Training model now ^(this takes about 2 minutes^)...
        python -m backend.train
    ) else (
        echo     data\creditcard.csv not found.
        echo     Download from: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud
        echo     API will run in demo mode.
    )
)

echo.
echo [1] Starting FastAPI backend  -^>  http://localhost:8000
start "FraudNet Backend" /min cmd /c ".venv\Scripts\uvicorn backend.main:app --reload --port 8000"

echo [2] Starting React frontend   -^>  http://localhost:5173
timeout /t 3 /nobreak >nul
start "FraudNet Frontend" /min cmd /c "cd frontend && npm run dev"

echo.
echo ==========================================
echo   Dashboard : http://localhost:5173
echo   API Docs  : off by default - start with ENABLE_DOCS=1 for /docs
echo.
echo   Sign in as the administrator set in backend\.env
echo   (ADMIN_USERNAME / ADMIN_PASSWORD). On an empty database no
echo   account exists until both are set - see backend\.env.example.
echo ==========================================
echo.
echo Press any key to stop both services...
pause >nul

echo Stopping services...
taskkill /fi "WindowTitle eq FraudNet Backend*" /f >nul 2>&1
taskkill /fi "WindowTitle eq FraudNet Frontend*" /f >nul 2>&1
echo Done.
