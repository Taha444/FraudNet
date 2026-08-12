"""
database.py — SQLAlchemy models and session setup (SQLite)
"""
import os
import json
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, Float, String,
    Boolean, DateTime, Text, event
)
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR    = os.path.dirname(__file__)
DB_PATH     = os.path.join(BASE_DIR, "fraudnet.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

# Enable WAL mode for better concurrency
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DBTransaction(Base):
    __tablename__ = "transactions"

    id                 = Column(Integer, primary_key=True, index=True)
    tx_id              = Column(String, unique=True, index=True, nullable=False)
    amount             = Column(Float, nullable=False)
    time_feature       = Column(Float, nullable=False)
    fraud_probability  = Column(Float, nullable=False)
    is_fraud           = Column(Boolean, nullable=False)
    risk_level         = Column(String, nullable=False)
    flagged_features   = Column(Text, default="[]")   # JSON list
    shap_top           = Column(Text, default="[]")   # JSON list [{feature, shap, direction}]
    created_at         = Column(DateTime, default=datetime.utcnow)


class DBAlert(Base):
    __tablename__ = "alerts"

    id          = Column(Integer, primary_key=True, index=True)
    alert_id    = Column(String, unique=True, index=True, nullable=False)
    tx_id       = Column(String, nullable=False)
    level       = Column(String, nullable=False)   # CRITICAL | HIGH | MEDIUM
    alert_type  = Column(String, nullable=False)
    amount      = Column(Float, nullable=True)
    score       = Column(Float, nullable=True)
    features    = Column(Text, default="[]")        # JSON list
    status      = Column(String, default="OPEN")   # OPEN | REVIEW | RESOLVED
    resolved_by = Column(String, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class DBUser(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True, nullable=False)
    email           = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(String, default="analyst")  # admin | analyst | viewer
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class DBAuditLog(Base):
    __tablename__ = "audit_log"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String, nullable=False)
    action     = Column(String, nullable=False)
    target     = Column(String, nullable=True)
    details    = Column(Text, nullable=True)   # JSON
    created_at = Column(DateTime, default=datetime.utcnow)


class DBThresholds(Base):
    __tablename__ = "thresholds"

    id                   = Column(Integer, primary_key=True, default=1)
    fraud_threshold      = Column(Float, default=0.5)
    high_risk_threshold  = Column(Float, default=0.75)
    medium_risk_threshold = Column(Float, default=0.4)
    updated_by           = Column(String, nullable=True)
    updated_at           = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
