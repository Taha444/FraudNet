# FraudNet — AI Bank Fraud Detection System

A complete end-to-end fraud detection project with a real ML model, REST API, and React dashboard.

## Project Structure

```
fraud-detection/
├── backend/
│   ├── main.py          # FastAPI REST API
│   └── train.py         # Model training script
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main app with routing
│   │   ├── components.jsx   # Shared UI components
│   │   ├── api.js           # API client
│   │   └── pages/
│   │       ├── Dashboard.jsx    # Analytics dashboard
│   │       ├── Transactions.jsx # Live transaction feed
│   │       ├── Predict.jsx      # Manual TX scoring
│   │       └── Alerts.jsx       # Alert management
│   └── index.html
├── data/                # Put creditcard.csv here
├── models/              # Trained model saved here
├── requirements.txt
└── README.md
```

---

## Datasets

### Kaggle Credit Card Fraud (used)
- URL: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud
- 284,807 transactions, 492 frauds (0.173%)
- 28 PCA features (V1–V28) + Time + Amount

### IEEE-CIS Fraud Detection (optional)
- URL: https://www.kaggle.com/competitions/ieee-fraud-detection
- Larger dataset with more features for better performance

---

## Quick Start

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Download the dataset

1. Go to https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud
2. Download `creditcard.csv`
3. Place it in `data/creditcard.csv`

### 3. Train the model

```bash
python -m backend.train
```

Expected output:
```
Loading dataset...
  Shape: (284807, 31)
  Frauds: 492 (0.173%)
Training model...
  Training complete.
=== Evaluation Results ===
  accuracy    : 0.9994
  precision   : 0.868
  recall      : 0.881
  f1_score    : 0.874
  auc_roc     : 0.9786
```

### 4. Configure the environment

```bash
cp backend/.env.example backend/.env
```

Fill in at least these three — **the API creates no account and nobody can log
in until `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set.** There are no default
credentials.

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing key. Generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"`. Unset means a new random key each restart, which invalidates every issued token. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | The first administrator, created once while the user table is empty. That admin creates everyone else from **Settings → User Management**. |
| `DATABASE_URL` | Optional. Defaults to the SQLite file `backend/fraudnet.db`; point it at PostgreSQL for anything concurrent. |

`CORS_ORIGINS` must list the frontend origin when the two are not on the same host.

### 5. Start the API

```bash
uvicorn backend.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Running with Docker

```bash
docker compose up --build
```

The dashboard is served on http://localhost:8080 and the API on
http://localhost:8000. `backend/.env` must exist first — compose reads it. The
database lives on the `fraudnet-data` volume, so it survives container
recreation; both containers run as unprivileged users.

---

## Tests

```bash
pytest
```

47 tests covering authentication, role boundaries, input bounds and password
management. They run against a temporary SQLite database and never touch a real
one.

---

## Security notes

- Every data endpoint requires a bearer token; only `/`, `/api/health` and the
  login endpoint are public. The alert WebSocket verifies the token it is given.
- Roles are `admin`, `analyst` and `viewer`; thresholds, the audit log and user
  management are admin-only.
- Passwords are bcrypt-hashed. Any user can change their own from Settings; an
  admin can reset another user's via
  `POST /api/auth/users/{username}/reset-password`. Both are recorded in the
  audit log.
- `/docs` is publicly reachable. Put the API behind a gateway, or pass
  `docs_url=None` to `FastAPI(...)`, if the schema should not be exposed.

---

## API Endpoints

All endpoints require `Authorization: Bearer <token>` except `/`,
`/api/health` and `/api/auth/token`.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/token` | public | Log in, returns a JWT |
| GET | `/api/auth/me` | any user | Current account |
| POST | `/api/auth/register` | admin | Create a user |
| POST | `/api/auth/change-password` | any user | Change your own password |
| POST | `/api/auth/users/{username}/reset-password` | admin | Reset another user's password |
| GET | `/api/health` | public | API health check |
| GET | `/api/stats` | any user | Dashboard statistics |
| GET | `/api/timeseries?days=` | any user | Volume/fraud rate, `days` 1–365 |
| GET | `/api/transactions/recent?limit=` | any user | Recent scored transactions, `limit` 1–500 |
| PUT | `/api/transactions/{id}/action` | analyst, admin | Block or approve |
| GET | `/api/alerts?limit=` | any user | Alerts, `limit` 1–500 |
| PUT | `/api/alerts/{id}/status` | analyst, admin | Update alert status |
| GET | `/api/thresholds` | any user | Current thresholds |
| PUT | `/api/thresholds` | admin | Update thresholds (all values 0–1) |
| GET | `/api/audit?limit=` | admin | Audit log, `limit` 1–1000 |
| POST | `/api/predict` | any user | Predict a single transaction |
| POST | `/api/predict/batch` | any user | Predict up to 1000 transactions |
| WS | `/ws/alerts?token=` | any user | Live alert stream |

### Example prediction request

```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "time": 406, "amount": 239.93,
    "v1": -2.31, "v2": 1.95, "v3": -1.61, "v4": 3.99,
    "v5": -0.52, "v6": -1.43, "v7": -2.53, "v8": 1.39,
    "v9": -2.77, "v10": -2.77, "v11": 3.20, "v12": -2.90,
    "v13": -0.59, "v14": -4.28, "v15": 0.39, "v16": -1.14,
    "v17": -2.83, "v18": -0.02, "v19": 0.41, "v20": 0.43,
    "v21": 0.06, "v22": -0.08, "v23": -0.07, "v24": -0.13,
    "v25": 0.16, "v26": 0.06, "v27": 0.21, "v28": 0.12
  }'
```

Response:
```json
{
  "transaction_id": "TX-47291",
  "fraud_probability": 0.9731,
  "is_fraud": true,
  "risk_level": "HIGH",
  "flagged_features": ["V14", "V17", "HIGH_AMOUNT"],
  "timestamp": "2024-11-15T14:23:01.123456"
}
```

---

## ML Model Details

| Attribute | Value |
|-----------|-------|
| Algorithm | XGBoost (GBClassifier fallback) |
| Features | 30 (V1–V28 + Time + Amount) |
| Training split | 80/20 stratified |
| Class balancing | scale_pos_weight |
| Accuracy | 99.94% |
| Precision | 86.8% |
| Recall | 88.1% |
| F1 Score | 0.874 |
| AUC-ROC | 0.9786 |

Top fraud indicators (SHAP): V17, V14, V12, V10, Amount

---

## Dashboard Features

- **Dashboard** — 30-day volume trend, confusion matrix, feature importance, amount distribution
- **Transactions** — Live feed with risk scoring, filterable, click-to-inspect detail panel
- **Predict** — Manual transaction entry with Fraud/Legit presets and scoring history
- **Alerts** — Alert queue with resolve/dismiss actions and severity levels

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| ML Model | XGBoost, scikit-learn, pandas, numpy |
| API | FastAPI, Uvicorn, Pydantic |
| Frontend | React 18, Vite, Chart.js, Axios |
| Styling | CSS-in-JS (no framework) |
