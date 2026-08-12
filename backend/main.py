"""
FraudNet API v3.0
- SQLite persistence (transactions, alerts, users, audit log)
- JWT authentication (admin / analyst / viewer roles)
- WebSocket real-time alert broadcast
- SHAP explainability (replaces heuristic flags)
- Configurable fraud thresholds (stored in DB)
- Rate limiting on predict endpoints
- Real feature importance from report.json
"""
from contextlib import asynccontextmanager
import json
import os
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Any

import joblib
import numpy as np
from fastapi import (
    FastAPI, HTTPException, Depends, WebSocket,
    WebSocketDisconnect, Request, status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# SHAP (optional — falls back gracefully)
try:
    import shap as _shap
    SHAP_OK = True
except ImportError:
    SHAP_OK = False
    print("[warn] shap not installed — pip install shap for explainability")

from .database import (
    init_db, get_db, SessionLocal,
    DBTransaction, DBAlert, DBUser, DBAuditLog, DBThresholds,
)
from .auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_role, _decode_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

# ─── Paths ─────────────────────────────────────────────────────────────────────
_DIR        = os.path.dirname(__file__)
MODEL_PATH  = os.path.join(_DIR, "../models/fraud_model.pkl")
SCALER_PATH = os.path.join(_DIR, "../models/scaler.pkl")
REPORT_PATH = os.path.join(_DIR, "../models/report.json")

# ─── Global runtime state ──────────────────────────────────────────────────────
model     = None
scaler    = None
explainer = None
report    = {}

FEATURE_NAMES = [
    "Time","V1","V2","V3","V4","V5","V6","V7","V8","V9","V10",
    "V11","V12","V13","V14","V15","V16","V17","V18","V19","V20",
    "V21","V22","V23","V24","V25","V26","V27","V28","Amount"
]

TX_TYPES = [
    "Online Purchase","ATM Withdrawal","POS Terminal",
    "Wire Transfer","Mobile Payment",
]

class _Thresholds:
    fraud: float  = 0.5
    high:  float  = 0.75
    mid:   float  = 0.4

cfg = _Thresholds()

# ─── WebSocket manager ─────────────────────────────────────────────────────────
class _WsManager:
    def __init__(self):
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self._clients:
            self._clients.remove(ws)

    async def broadcast(self, payload: dict):
        dead = []
        for ws in self._clients:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

ws_mgr = _WsManager()

# ─── Startup helpers ───────────────────────────────────────────────────────────
def _create_default_users():
    """Bootstrap the first admin account from the environment.

    This used to seed admin/admin123, analyst/analyst123 and viewer/viewer123
    with the passwords written in this file — so every deployment shipped with
    three publicly known logins, and printed them to the log on top of that.
    Now the only account created is one admin whose credentials the operator
    supplies; if they are absent no account is created at all, and the service
    says so instead of quietly opening a known door. The remaining users are
    created by that admin through POST /api/auth/register.
    """
    username = os.environ.get("ADMIN_USERNAME")
    password = os.environ.get("ADMIN_PASSWORD")

    db = SessionLocal()
    try:
        if db.query(DBUser).first():
            return                      # already bootstrapped — never re-seed
        if not username or not password:
            print("NOTICE: no users exist and ADMIN_USERNAME/ADMIN_PASSWORD are "
                  "not set — no account was created. Set both and restart to "
                  "bootstrap the first administrator.")
            return
        db.add(DBUser(
            username=username,
            email=os.environ.get("ADMIN_EMAIL", f"{username}@fraudnet.local"),
            hashed_password=get_password_hash(password),
            role="admin",
        ))
        db.commit()
        print(f"Bootstrapped administrator '{username}' from the environment.")
    finally:
        db.close()


def _load_thresholds():
    db = SessionLocal()
    try:
        row = db.query(DBThresholds).first()
        if row is None:
            row = DBThresholds()
            db.add(row)
            db.commit()
            db.refresh(row)
        cfg.fraud = row.fraud_threshold
        cfg.high  = row.high_risk_threshold
        cfg.mid   = row.medium_risk_threshold
    finally:
        db.close()

# ─── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, scaler, explainer, report

    init_db()
    _create_default_users()
    _load_thresholds()

    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        # Unpickling reaches for whatever library trained the model, so it fails
        # on a missing dependency or a version skew between the training and the
        # deployment environment. Unguarded, that took down startup entirely —
        # no health check, no login, nothing — even though every prediction
        # endpoint already handles `model is None`. Degrade instead: the service
        # stays up and reports the fault rather than refusing to boot.
        try:
            model  = joblib.load(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            print("Model loaded.")
        except Exception as e:
            model = scaler = None
            print(f"[error] Could not load the model ({type(e).__name__}: {e}). "
                  f"Prediction endpoints will return 503; everything else works. "
                  f"Check that the training and runtime dependency versions match.")
        if model is not None and SHAP_OK:
            try:
                explainer = _shap.TreeExplainer(model)
                print("SHAP explainer ready.")
            except Exception as e:
                print(f"[warn] SHAP explainer failed: {e}")
    else:
        print("[warn] No model found. Run backend/train.py first.")

    if os.path.exists(REPORT_PATH):
        try:
            with open(REPORT_PATH) as f:
                report = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"[warn] Could not read {REPORT_PATH}: {e}")

    yield

# ─── App setup ─────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="FraudNet API", version="3.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic schemas ──────────────────────────────────────────────────────────
class Transaction(BaseModel):
    time: float
    v1:float; v2:float; v3:float; v4:float; v5:float
    v6:float; v7:float; v8:float; v9:float; v10:float
    v11:float;v12:float;v13:float;v14:float;v15:float
    v16:float;v17:float;v18:float;v19:float;v20:float
    v21:float;v22:float;v23:float;v24:float;v25:float
    v26:float;v27:float;v28:float
    amount: float

class BatchRequest(BaseModel):
    transactions: List[Transaction]

class PredictionResponse(BaseModel):
    transaction_id:    str
    fraud_probability: float
    is_fraud:          bool
    risk_level:        str
    flagged_features:  List[str]
    shap_contributions: List[dict]
    timestamp:         str

class StatusUpdate(BaseModel):
    status: str   # OPEN | REVIEW | RESOLVED

class TxActionRequest(BaseModel):
    action: str   # BLOCK | APPROVE

class ThresholdUpdate(BaseModel):
    fraud_threshold:       float
    high_risk_threshold:   float
    medium_risk_threshold: float

class RegisterRequest(BaseModel):
    username: str
    email:    str
    password: str
    role:     str = "analyst"

# ─── Core prediction helpers ───────────────────────────────────────────────────
def _build_feature_array(tx: Transaction) -> np.ndarray:
    return np.array([[
        tx.time, tx.v1, tx.v2, tx.v3, tx.v4, tx.v5, tx.v6, tx.v7,
        tx.v8,  tx.v9, tx.v10,tx.v11,tx.v12,tx.v13,tx.v14,tx.v15,
        tx.v16, tx.v17,tx.v18,tx.v19,tx.v20,tx.v21,tx.v22,tx.v23,
        tx.v24, tx.v25,tx.v26,tx.v27,tx.v28,tx.amount,
    ]], dtype=np.float64)


def _scale(feat: np.ndarray) -> np.ndarray:
    """Scale Time (col 0) and Amount (col 29) with the saved StandardScaler."""
    f = feat.copy()
    f[:, [0, 29]] = scaler.transform(f[:, [0, 29]])
    return f


def _risk(prob: float) -> str:
    if prob >= cfg.high: return "HIGH"
    if prob >= cfg.mid:  return "MEDIUM"
    return "LOW"


def _alert_level(prob: float) -> str:
    if prob >= 0.90: return "CRITICAL"
    if prob >= 0.75: return "HIGH"
    return "MEDIUM"


def _shap_contributions(feat_scaled: np.ndarray) -> List[dict]:
    """Return top-8 SHAP contributions, or empty list if SHAP unavailable."""
    if explainer is None:
        return []
    try:
        raw = explainer.shap_values(feat_scaled)
        # raw may be (1, 30) for XGBoost binary, or list of two arrays
        vals = raw[0] if isinstance(raw, list) else raw[0]
        pairs = sorted(
            zip(FEATURE_NAMES, vals.tolist()),
            key=lambda x: abs(x[1]),
            reverse=True,
        )[:8]
        return [
            {
                "feature":   name,
                "shap":      round(float(v), 4),
                "direction": "fraud" if v > 0 else "safe",
            }
            for name, v in pairs
        ]
    except Exception:
        return []


def _heuristic_flags(tx: Transaction) -> List[str]:
    """Fallback: rule-based flags when SHAP is unavailable."""
    flags = []
    t = tx.dict()
    for feat, thr in {"v14": -2.0, "v17": -2.0, "v12": -2.0, "v10": -2.0}.items():
        if t.get(feat, 0) < thr:
            flags.append(feat.upper())
    if t.get("v4", 0) > 2.0:
        flags.append("V4")
    if tx.amount > 1000:
        flags.append("HIGH_AMOUNT")
    if tx.time < 3600 or tx.time > 82800:
        flags.append("ODD_HOURS")
    return flags


def _flagged_from_shap(contributions: List[dict], prob: float) -> List[str]:
    if not contributions:
        return []
    return [c["feature"] for c in contributions if c["direction"] == "fraud"][:5]


def _run_prediction(tx: Transaction):
    feat        = _build_feature_array(tx)
    feat_scaled = _scale(feat)
    prob        = float(model.predict_proba(feat_scaled)[0][1])
    contribs    = _shap_contributions(feat_scaled)
    flags       = _flagged_from_shap(contribs, prob) if contribs else _heuristic_flags(tx)
    return prob, contribs, flags

# ─── DB helpers ────────────────────────────────────────────────────────────────
def _save_transaction(db: Session, tx_id: str, tx: Transaction, prob: float,
                       risk: str, flags: List[str], contribs: List[dict]) -> DBTransaction:
    row = DBTransaction(
        tx_id=tx_id,
        amount=tx.amount,
        time_feature=tx.time,
        fraud_probability=round(prob, 4),
        is_fraud=prob >= cfg.fraud,
        risk_level=risk,
        flagged_features=json.dumps(flags),
        shap_top=json.dumps(contribs),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _save_alert(db: Session, tx_id: str, prob: float, risk: str,
                 flags: List[str], amount: float) -> Optional[DBAlert]:
    if prob < cfg.mid:
        return None
    level = _alert_level(prob)
    tx_type = random.choice(TX_TYPES)
    alert_id = f"ALT-{str(uuid.uuid4())[:8].upper()}"
    row = DBAlert(
        alert_id=alert_id,
        tx_id=tx_id,
        level=level,
        alert_type=tx_type,
        amount=amount,
        score=round(prob, 4),
        features=json.dumps(flags),
        status="OPEN",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _audit(db: Session, username: str, action: str,
            target: str = None, details: dict = None):
    db.add(DBAuditLog(
        username=username,
        action=action,
        target=target,
        details=json.dumps(details) if details else None,
    ))
    db.commit()


def _time_ago(dt: datetime) -> str:
    diff = datetime.utcnow() - dt
    mins = int(diff.total_seconds() / 60)
    if mins < 1:   return "just now"
    if mins < 60:  return f"{mins} min ago"
    hours = mins // 60
    if hours < 24: return f"{hours}h ago"
    return f"{hours // 24}d ago"

# ─── Auth endpoints ────────────────────────────────────────────────────────────
@app.post("/api/auth/token")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_access_token({"sub": user.username})
    _audit(db, user.username, "LOGIN")
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":       user.id,
            "username": user.username,
            "email":    user.email,
            "role":     user.role,
        },
    }


@app.get("/api/auth/me")
def me(current_user: DBUser = Depends(get_current_user)):
    return {
        "id":       current_user.id,
        "username": current_user.username,
        "email":    current_user.email,
        "role":     current_user.role,
    }


@app.post("/api/auth/register", status_code=201)
def register(
    req: RegisterRequest,
    db: Session = Depends(get_db),
    admin: DBUser = Depends(require_role("admin")),
):
    if db.query(DBUser).filter(DBUser.username == req.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = DBUser(
        username=req.username,
        email=req.email,
        hashed_password=get_password_hash(req.password),
        role=req.role,
    )
    db.add(user)
    db.commit()
    _audit(db, admin.username, "REGISTER_USER", target=req.username)
    return {"message": f"User '{req.username}' created with role '{req.role}'"}

# ─── Health ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "FraudNet API running", "version": "3.0.0", "model_loaded": model is not None}


@app.get("/api/health")
def health():
    return {
        "status":      "ok",
        "version":     "3.0.0",
        "model":       "loaded" if model else "not_loaded",
        "shap":        "enabled" if explainer else "disabled",
        "db":          "connected",
        "ws_clients":  len(ws_mgr._clients),
    }

# ─── Predict ───────────────────────────────────────────────────────────────────
@app.post("/api/predict", response_model=PredictionResponse)
@limiter.limit("60/minute")
async def predict(
    request: Request,
    tx: Transaction,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user),
):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train.py first.")

    prob, contribs, flags = _run_prediction(tx)
    risk    = _risk(prob)
    tx_id   = f"TX-{uuid.uuid4().hex[:8].upper()}"

    _save_transaction(db, tx_id, tx, prob, risk, flags, contribs)
    alert_row = _save_alert(db, tx_id, prob, risk, flags, tx.amount)

    if alert_row:
        await ws_mgr.broadcast({
            "type":  "new_alert",
            "alert": {
                "id":         alert_row.alert_id,
                "tx":         tx_id,
                "level":      alert_row.level,
                "type":       alert_row.alert_type,
                "amount":     tx.amount,
                "score":      round(prob, 4),
                "features":   flags,
                "status":     "OPEN",
                "time":       "just now",
                "created_at": alert_row.created_at.isoformat(),
            },
        })

    if current_user:
        _audit(db, current_user.username, "PREDICT", target=tx_id,
               details={"prob": round(prob, 4), "risk": risk})

    return PredictionResponse(
        transaction_id=tx_id,
        fraud_probability=round(prob, 4),
        is_fraud=prob >= cfg.fraud,
        risk_level=risk,
        flagged_features=flags,
        shap_contributions=contribs,
        timestamp=datetime.utcnow().isoformat(),
    )


@app.post("/api/predict/batch")
@limiter.limit("10/minute")
async def predict_batch(
    request: Request,
    req: BatchRequest,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user),
):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    results = []
    for tx in req.transactions:
        prob, contribs, flags = _run_prediction(tx)
        risk  = _risk(prob)
        tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
        _save_transaction(db, tx_id, tx, prob, risk, flags, contribs)
        _save_alert(db, tx_id, prob, risk, flags, tx.amount)
        results.append({
            "transaction_id":     tx_id,
            "fraud_probability":  round(prob, 4),
            "is_fraud":           prob >= cfg.fraud,
            "risk_level":         risk,
            "flagged_features":   flags,
            "shap_contributions": contribs,
        })
    _audit(db, current_user.username, "BATCH_PREDICT",
           details={"count": len(results)})
    return {"count": len(results), "results": results}

# ─── Transactions ──────────────────────────────────────────────────────────────
@app.get("/api/transactions/recent")
def recent_transactions(
    limit: int = 30,
    risk: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user),
):
    q = db.query(DBTransaction).order_by(DBTransaction.created_at.desc())
    if risk:
        q = q.filter(DBTransaction.risk_level == risk.upper())
    rows = q.limit(limit).all()

    if not rows:
        # Demo fallback: synthetic data when DB is empty
        return {"transactions": _synthetic_transactions(limit, risk), "source": "demo"}

    result = []
    for r in rows:
        shap_top = json.loads(r.shap_top or "[]")
        v14_shap = next((s["shap"] for s in shap_top if s["feature"] == "V14"), 0.0)
        result.append({
            "id":                r.tx_id,
            "amount":            r.amount,
            "time":              r.created_at.strftime("%H:%M"),
            "fraud_probability": r.fraud_probability,
            "risk_level":        r.risk_level,
            "v14":               round(v14_shap, 2),
            "flagged":           r.is_fraud,
        })
    return {"transactions": result, "source": "database"}


@app.put("/api/transactions/{tx_id}/action")
async def transaction_action(
    tx_id: str,
    body: TxActionRequest,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_role("admin", "analyst")),
):
    action = body.action.upper()
    if action not in ("BLOCK", "APPROVE"):
        raise HTTPException(status_code=422, detail="action must be BLOCK or APPROVE")

    row = db.query(DBTransaction).filter(DBTransaction.tx_id == tx_id).first()
    if not row:
        # Transaction might be synthetic (demo mode) — log audit only
        _audit(db, current_user.username, f"TX_{action}", target=tx_id)
        return {"message": f"Transaction {tx_id} {action}ED (demo)", "tx_id": tx_id, "action": action}

    _audit(db, current_user.username, f"TX_{action}", target=tx_id,
           details={"amount": row.amount, "fraud_probability": row.fraud_probability})

    # If blocking a high-risk tx, auto-resolve its alert
    if action == "BLOCK":
        alert = db.query(DBAlert).filter(DBAlert.tx_id == tx_id, DBAlert.status == "OPEN").first()
        if alert:
            alert.status = "RESOLVED"
            alert.resolved_by = current_user.username
            alert.resolved_at = datetime.utcnow()
            db.commit()
            await ws_mgr.broadcast({
                "type": "alert_update",
                "alert_id": alert.alert_id,
                "status": "RESOLVED",
                "updated_by": current_user.username,
            })

    return {"message": f"Transaction {tx_id} {action}ED", "tx_id": tx_id, "action": action}

# ─── Alerts ────────────────────────────────────────────────────────────────────
@app.get("/api/alerts")
def list_alerts(
    status_filter: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user),
):
    q = db.query(DBAlert).order_by(DBAlert.created_at.desc())
    if status_filter:
        q = q.filter(DBAlert.status == status_filter.upper())
    rows = q.limit(limit).all()

    if not rows:
        return {"alerts": _synthetic_alerts(), "source": "demo"}

    return {
        "alerts": [
            {
                "id":         r.alert_id,
                "tx":         r.tx_id,
                "level":      r.level,
                "type":       r.alert_type,
                "amount":     r.amount,
                "score":      r.score,
                "features":   json.loads(r.features or "[]"),
                "status":     r.status,
                "time":       _time_ago(r.created_at),
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "source": "database",
    }


@app.put("/api/alerts/{alert_id}/status")
async def update_alert_status(
    alert_id: str,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_role("admin", "analyst")),
):
    new_status = body.status.upper()
    if new_status not in ("OPEN", "REVIEW", "RESOLVED"):
        raise HTTPException(status_code=422, detail="status must be OPEN, REVIEW, or RESOLVED")

    row = db.query(DBAlert).filter(DBAlert.alert_id == alert_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")

    row.status = new_status
    if new_status == "RESOLVED":
        row.resolved_by = current_user.username
        row.resolved_at = datetime.utcnow()
    db.commit()
    _audit(db, current_user.username, f"ALERT_{new_status}", target=alert_id)

    await ws_mgr.broadcast({
        "type":     "alert_update",
        "alert_id": alert_id,
        "status":   new_status,
        "updated_by": current_user.username,
    })
    return {"message": f"Alert {alert_id} set to {new_status}"}

# ─── Stats ─────────────────────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db),
              current_user: DBUser = Depends(get_current_user)):
    # Base metrics from report.json (training evaluation)
    cm = report.get("confusion_matrix", {"tp": 82, "fp": 12, "fn": 16, "tn": 56852})
    fi = report.get("feature_importance", [])

    # Runtime stats from DB
    db_total  = db.query(DBTransaction).count()
    db_fraud  = db.query(DBTransaction).filter(DBTransaction.is_fraud == True).count()
    db_alerts = db.query(DBAlert).filter(DBAlert.status == "OPEN").count()

    return {
        "total_transactions":  284807,
        "total_fraud":         492,
        "fraud_rate":          0.00173,
        "avg_fraud_amount":    report.get("avg_fraud_amount", 122.21),
        "avg_legit_amount":    report.get("avg_legit_amount", 88.35),
        "model_accuracy":      report.get("accuracy",  0.9994),
        "model_precision":     report.get("precision", 0.8723),
        "model_recall":        report.get("recall",    0.8367),
        "model_f1":            report.get("f1_score",  0.8542),
        "auc_roc":             report.get("auc_roc",   0.9803),
        "confusion_matrix":    cm,
        "feature_importance":  fi[:8] if fi else _DEFAULT_FI,
        "runtime": {
            "predictions_in_db":  db_total,
            "fraud_detected":     db_fraud,
            "open_alerts":        db_alerts,
        },
        "thresholds": {
            "fraud":  cfg.fraud,
            "high":   cfg.high,
            "medium": cfg.mid,
        },
        "shap_enabled": explainer is not None,
    }

# ─── Timeseries ────────────────────────────────────────────────────────────────
@app.get("/api/timeseries")
def timeseries(days: int = 30, db: Session = Depends(get_db),
               current_user: DBUser = Depends(get_current_user)):
    rng  = random.Random(99)
    data = []
    for i in range(days, -1, -1):
        d = datetime.utcnow() - timedelta(days=i)
        date_str = d.strftime("%m/%d")

        # Pull real counts from DB for each day
        day_start = d.replace(hour=0,  minute=0,  second=0,  microsecond=0)
        day_end   = d.replace(hour=23, minute=59, second=59, microsecond=999999)
        real_vol   = db.query(DBTransaction).filter(
            DBTransaction.created_at >= day_start,
            DBTransaction.created_at <= day_end,
        ).count()
        real_fraud = db.query(DBTransaction).filter(
            DBTransaction.created_at >= day_start,
            DBTransaction.created_at <= day_end,
            DBTransaction.is_fraud == True,
        ).count()

        synth_vol = rng.randint(8000, 12000)
        data.append({
            "date":       date_str,
            "volume":     real_vol if real_vol > 0 else synth_vol,
            "fraud_rate": round(real_fraud / real_vol, 4) if real_vol > 0
                          else round(rng.uniform(0.12, 0.25), 3),
        })
    return {"data": data}

# ─── Thresholds ────────────────────────────────────────────────────────────────
@app.get("/api/thresholds")
def get_thresholds(current_user: DBUser = Depends(get_current_user)):
    return {
        "fraud_threshold":       cfg.fraud,
        "high_risk_threshold":   cfg.high,
        "medium_risk_threshold": cfg.mid,
    }


@app.put("/api/thresholds")
def update_thresholds(
    body: ThresholdUpdate,
    db: Session = Depends(get_db),
    admin: DBUser = Depends(require_role("admin")),
):
    if not (0 < body.fraud_threshold < 1):
        raise HTTPException(status_code=422, detail="fraud_threshold must be between 0 and 1")
    if not (body.medium_risk_threshold < body.high_risk_threshold):
        raise HTTPException(status_code=422, detail="high must be > medium threshold")

    row = db.query(DBThresholds).first()
    if row is None:
        row = DBThresholds()
        db.add(row)
    row.fraud_threshold        = body.fraud_threshold
    row.high_risk_threshold    = body.high_risk_threshold
    row.medium_risk_threshold  = body.medium_risk_threshold
    row.updated_by             = admin.username
    row.updated_at             = datetime.utcnow()
    db.commit()

    cfg.fraud = body.fraud_threshold
    cfg.high  = body.high_risk_threshold
    cfg.mid   = body.medium_risk_threshold

    _audit(db, admin.username, "UPDATE_THRESHOLDS",
           details=body.model_dump())
    return {"message": "Thresholds updated", **body.model_dump()}

# ─── Audit log (admin only) ────────────────────────────────────────────────────
@app.get("/api/audit")
def audit_log(
    limit: int = 100,
    db: Session = Depends(get_db),
    _: DBUser = Depends(require_role("admin")),
):
    rows = db.query(DBAuditLog).order_by(DBAuditLog.created_at.desc()).limit(limit).all()
    return {
        "logs": [
            {
                "id":         r.id,
                "username":   r.username,
                "action":     r.action,
                "target":     r.target,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
    }

# ─── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws/alerts")
async def ws_alerts(ws: WebSocket, token: Optional[str] = None):
    # The token arrived in the query string all along (the frontend appends it)
    # but was never verified, so the live alert stream was open to anyone who
    # knew the URL. Browsers cannot set an Authorization header on a WebSocket
    # handshake, which is why the token travels as a query parameter here.
    username = _decode_token(token) if token else None
    if not username:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    db = SessionLocal()
    try:
        user = db.query(DBUser).filter(
            DBUser.username == username, DBUser.is_active == True).first()
    finally:
        db.close()
    if not user:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_mgr.connect(ws)
    try:
        while True:
            await ws.receive_text()   # keep-alive ping/pong
    except WebSocketDisconnect:
        ws_mgr.disconnect(ws)

# ─── Synthetic fallback data ───────────────────────────────────────────────────
def _synthetic_transactions(limit: int, risk: Optional[str]):
    rng  = random.Random(42)
    base = datetime.utcnow()
    out  = []
    for i in range(limit):
        score = rng.betavariate(0.5, 3)
        rlvl  = "HIGH" if score >= cfg.high else "MEDIUM" if score >= cfg.mid else "LOW"
        if risk and risk.upper() != rlvl:
            continue
        out.append({
            "id":                f"TX-{28400 - i:05d}",
            "amount":            round(rng.uniform(1, 5000), 2),
            "time":              (base - timedelta(minutes=i * 3)).strftime("%H:%M"),
            "fraud_probability": round(score, 3),
            "risk_level":        rlvl,
            "v14":               round(rng.gauss(-1.5 if score > 0.5 else 0.2, 1.2), 2),
            "flagged":           score > 0.5,
        })
    return out


def _synthetic_alerts():
    return [
        {"id":"ALT-DEMO01","tx":"TX-28000","level":"CRITICAL","type":"High-value wire",
         "amount":5000.00,"score":0.97,"features":["V14","V17","HIGH_AMOUNT"],"status":"OPEN","time":"2 min ago"},
        {"id":"ALT-DEMO02","tx":"TX-27998","level":"CRITICAL","type":"Online purchase",
         "amount":2847.30,"score":0.94,"features":["V12","V17"],"status":"OPEN","time":"5 min ago"},
        {"id":"ALT-DEMO03","tx":"TX-27995","level":"HIGH","type":"ATM withdrawal",
         "amount":1200.00,"score":0.88,"features":["V14"],"status":"REVIEW","time":"8 min ago"},
        {"id":"ALT-DEMO04","tx":"TX-27990","level":"HIGH","type":"Mobile pay",
         "amount":156.00,"score":0.81,"features":["V10","V11"],"status":"OPEN","time":"12 min ago"},
    ]

_DEFAULT_FI = [
    {"feature": "V14",    "importance": 0.362},
    {"feature": "V10",    "importance": 0.144},
    {"feature": "V4",     "importance": 0.067},
    {"feature": "V12",    "importance": 0.056},
    {"feature": "V17",    "importance": 0.048},
    {"feature": "Amount", "importance": 0.041},
    {"feature": "V11",    "importance": 0.038},
    {"feature": "Time",   "importance": 0.030},
]
