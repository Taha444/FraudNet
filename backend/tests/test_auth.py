"""Authentication and authorisation.

Each test here pins a defect that was live in the delivered code, so a
regression shows up as a named failure rather than as a quiet reopening.
"""
import pytest

from .conftest import ADMIN_USER, ADMIN_PASS

# Endpoints that expose data and must never answer without a token. All of
# these were readable by anyone who could reach the server.
PROTECTED_READS = [
    "/api/alerts",
    "/api/transactions/recent",
    "/api/stats",
    "/api/timeseries",
    "/api/thresholds",
]

PUBLIC = ["/", "/api/health"]


@pytest.mark.parametrize("path", PROTECTED_READS)
def test_read_endpoints_require_a_token(client, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("path", PUBLIC)
def test_public_endpoints_stay_public(client, path):
    assert client.get(path).status_code == 200


@pytest.mark.parametrize("path", PROTECTED_READS)
def test_read_endpoints_succeed_with_a_token(client, admin_headers, path):
    assert client.get(path, headers=admin_headers).status_code == 200


def test_predict_requires_a_token(client):
    # Was optional-auth: anyone could score transactions anonymously
    assert client.post("/api/predict", json={"time": 0, "amount": 1,
                                             **{f"v{i}": 0.0 for i in range(1, 29)}}
                       ).status_code == 401


def test_forged_token_is_rejected(client):
    bad = {"Authorization": "Bearer not.a.real.token"}
    assert client.get("/api/alerts", headers=bad).status_code == 401


def test_websocket_rejects_missing_and_forged_tokens(client):
    # The handler accepted a `token` query parameter and never verified it,
    # leaving the live alert stream open to anyone who knew the URL.
    for url in ("/ws/alerts", "/ws/alerts?token=forged.junk.value"):
        with pytest.raises(Exception):
            with client.websocket_connect(url):
                pass


def test_websocket_accepts_a_valid_token(client, admin_token):
    with client.websocket_connect(f"/ws/alerts?token={admin_token}"):
        pass


def test_no_default_accounts_exist(client):
    """The build used to seed admin/admin123, analyst/analyst123 and
    viewer/viewer123 on every empty database."""
    for user, pw in (("admin", "admin123"), ("analyst", "analyst123"),
                     ("viewer", "viewer123")):
        r = client.post("/api/auth/token", data={"username": user, "password": pw})
        assert r.status_code == 401, f"default account {user} still exists"


def test_bootstrap_admin_can_log_in(client):
    r = client.post("/api/auth/token",
                    data={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "admin"


def test_wrong_password_is_rejected(client):
    r = client.post("/api/auth/token",
                    data={"username": ADMIN_USER, "password": "wrong-password"})
    assert r.status_code == 401


# ── Role boundaries ───────────────────────────────────────────────────────────

def test_viewer_cannot_reach_admin_endpoints(client, viewer):
    h = viewer["headers"]
    assert client.get("/api/audit", headers=h).status_code == 403
    assert client.put("/api/thresholds", headers=h, json={
        "fraud_threshold": 0.5, "high_risk_threshold": 0.8,
        "medium_risk_threshold": 0.4}).status_code == 403
    assert client.post("/api/auth/register", headers=h, json={
        "username": "sneaky", "email": "s@example.com",
        "password": "password123", "role": "admin"}).status_code == 403


def test_viewer_can_read_data(client, viewer):
    assert client.get("/api/alerts", headers=viewer["headers"]).status_code == 200


# ── API schema exposure ───────────────────────────────────────────────────────

def test_docs_are_closed_by_default(client):
    """/docs, /redoc and the OpenAPI schema published the entire API surface to
    anyone who visited them. They are off unless ENABLE_DOCS is set."""
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404, f"{path} is still reachable"


def test_docs_can_be_enabled_for_development(monkeypatch):
    """Turning them back on is a deliberate, single-variable decision."""
    monkeypatch.setenv("ENABLE_DOCS", "1")
    import importlib

    from backend import main as m
    reloaded = importlib.reload(m)
    try:
        from fastapi.testclient import TestClient
        with TestClient(reloaded.app) as c:
            assert c.get("/docs").status_code == 200
    finally:
        # Restore the module for the rest of the session
        monkeypatch.delenv("ENABLE_DOCS", raising=False)
        importlib.reload(m)
