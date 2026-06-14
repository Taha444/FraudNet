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

### 4. Start the API

```bash
uvicorn backend.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | API health check |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/timeseries` | 30-day volume/fraud rate |
| GET | `/api/transactions/recent` | Recent scored transactions |
| POST | `/api/predict` | Predict a single transaction |
| POST | `/api/predict/batch` | Predict multiple transactions |

### Example prediction request

```bash
curl -X POST http://localhost:8000/api/predict \
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
