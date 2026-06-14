"""
train.py — Train fraud detection model on Kaggle Credit Card Fraud dataset.

Usage:
  1. Download creditcard.csv from https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud
  2. Place it in the data/ folder
  3. Run: python train.py

Outputs:
  models/fraud_model.pkl  — trained XGBoost classifier
  models/scaler.pkl       — fitted StandardScaler
  models/report.json      — evaluation metrics
"""

import os, json, sys, warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, f1_score, precision_score, recall_score, accuracy_score
)
from sklearn.ensemble import IsolationForest

try:
    from xgboost import XGBClassifier
    USE_XGB = True
except ImportError:
    from sklearn.ensemble import GradientBoostingClassifier
    USE_XGB = False
    print("XGBoost not found — falling back to GradientBoostingClassifier")

DATA_PATH   = os.path.join(os.path.dirname(__file__), "../data/creditcard.csv")
MODEL_DIR   = os.path.join(os.path.dirname(__file__), "../models")
MODEL_PATH  = os.path.join(MODEL_DIR, "fraud_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
REPORT_PATH = os.path.join(MODEL_DIR, "report.json")

os.makedirs(MODEL_DIR, exist_ok=True)

def load_data():
    if not os.path.exists(DATA_PATH):
        print(f"\n[ERROR] Dataset not found at {DATA_PATH}")
        print("Download creditcard.csv from:")
        print("  https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud")
        print("Place it in the data/ folder and re-run.")
        sys.exit(1)

    print("Loading dataset...")
    df = pd.read_csv(DATA_PATH)
    print(f"  Shape: {df.shape}")
    print(f"  Frauds: {df['Class'].sum()} ({df['Class'].mean()*100:.3f}%)")
    return df

def preprocess(df):
    X = df.drop("Class", axis=1)
    y = df["Class"]

    scaler = StandardScaler()
    X[["Time", "Amount"]] = scaler.fit_transform(X[["Time", "Amount"]])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    return X_train, X_test, y_train, y_test, scaler

def train(X_train, y_train):
    print("\nTraining model...")
    scale_pos = (y_train == 0).sum() / (y_train == 1).sum()

    if USE_XGB:
        clf = XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            scale_pos_weight=scale_pos,
            subsample=0.8,
            colsample_bytree=0.8,
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        )
    else:
        clf = GradientBoostingClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.05, random_state=42
        )

    clf.fit(X_train, y_train)
    print("  Training complete.")
    return clf

def evaluate(clf, X_test, y_test):
    y_pred  = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]

    cm = confusion_matrix(y_test, y_pred)
    report = {
        "accuracy":  round(accuracy_score(y_test, y_pred), 6),
        "precision": round(precision_score(y_test, y_pred), 4),
        "recall":    round(recall_score(y_test, y_pred), 4),
        "f1_score":  round(f1_score(y_test, y_pred), 4),
        "auc_roc":   round(roc_auc_score(y_test, y_proba), 4),
        "confusion_matrix": {
            "tp": int(cm[1, 1]), "fp": int(cm[0, 1]),
            "fn": int(cm[1, 0]), "tn": int(cm[0, 0])
        }
    }

    print("\n=== Evaluation Results ===")
    for k, v in report.items():
        if k != "confusion_matrix":
            print(f"  {k:12s}: {v}")
    print(f"  Confusion Matrix:")
    print(f"    TP={report['confusion_matrix']['tp']}  FP={report['confusion_matrix']['fp']}")
    print(f"    FN={report['confusion_matrix']['fn']}  TN={report['confusion_matrix']['tn']}")

    return report

def save_feature_importance(clf, feature_names):
    if hasattr(clf, "feature_importances_"):
        imp = clf.feature_importances_
        fi = sorted(zip(feature_names, imp), key=lambda x: x[1], reverse=True)
        print("\nTop 10 Features:")
        for name, score in fi[:10]:
            print(f"  {name:8s}: {score:.4f}")
        return [{"feature": n, "importance": round(float(s), 4)} for n, s in fi]
    return []

def main():
    df = load_data()
    X_train, X_test, y_train, y_test, scaler = preprocess(df)
    clf = train(X_train, y_train)
    report = evaluate(clf, X_test, y_test)
    fi = save_feature_importance(clf, X_train.columns.tolist())
    report["feature_importance"] = fi[:10]

    joblib.dump(clf, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nSaved:")
    print(f"  {MODEL_PATH}")
    print(f"  {SCALER_PATH}")
    print(f"  {REPORT_PATH}")
    print("\nDone! Run the API with: uvicorn backend.main:app --reload")

if __name__ == "__main__":
    main()
