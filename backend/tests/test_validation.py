"""Input bounds and request-model validation.

Unbounded numbers reached the database and the loops directly; the register
model accepted any role string at all.
"""
import pytest


def test_timeseries_days_is_capped(client, admin_headers):
    """The handler runs two COUNT queries per day, so an uncapped `days`
    turned one request into millions of queries."""
    assert client.get("/api/timeseries?days=500000", headers=admin_headers).status_code == 422
    assert client.get("/api/timeseries?days=0", headers=admin_headers).status_code == 422
    assert client.get("/api/timeseries?days=365", headers=admin_headers).status_code == 200


@pytest.mark.parametrize("path,cap", [
    ("/api/transactions/recent", 500),
    ("/api/alerts", 500),
    ("/api/audit", 1000),
])
def test_limit_is_capped(client, admin_headers, path, cap):
    assert client.get(f"{path}?limit={cap + 1}", headers=admin_headers).status_code == 422
    assert client.get(f"{path}?limit=0", headers=admin_headers).status_code == 422
    assert client.get(f"{path}?limit={cap}", headers=admin_headers).status_code == 200


def _tx(**over):
    base = {"time": 0.0, "amount": 10.0, **{f"v{i}": 0.0 for i in range(1, 29)}}
    base.update(over)
    return base


def test_batch_size_is_capped(client, admin_headers):
    """An unbounded list meant one request could exhaust memory."""
    r = client.post("/api/predict/batch", headers=admin_headers,
                    json={"transactions": [_tx() for _ in range(1001)]})
    assert r.status_code == 422
    r = client.post("/api/predict/batch", headers=admin_headers,
                    json={"transactions": []})
    assert r.status_code == 422


# ── Register model ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("payload,why", [
    ({"username": "u1", "email": "u1@example.com", "password": "password123",
      "role": "Admin"}, "role is case-sensitive and must be a known value"),
    ({"username": "u2", "email": "u2@example.com", "password": "password123",
      "role": "superuser"}, "unknown role"),
    ({"username": "u3", "email": "u3@example.com", "password": "short",
      "role": "viewer"}, "password below the minimum length"),
    ({"username": "u4", "email": "not-an-email", "password": "password123",
      "role": "viewer"}, "malformed email"),
    ({"username": "x", "email": "u5@example.com", "password": "password123",
      "role": "viewer"}, "username below the minimum length"),
])
def test_register_rejects_invalid_input(client, admin_headers, payload, why):
    r = client.post("/api/auth/register", headers=admin_headers, json=payload)
    assert r.status_code == 422, f"accepted despite: {why}"


def test_register_accepts_valid_input(client, admin_headers):
    r = client.post("/api/auth/register", headers=admin_headers, json={
        "username": "goodanalyst", "email": "good@example.com",
        "password": "a-good-password", "role": "analyst"})
    assert r.status_code == 201, r.text


def test_duplicate_username_is_rejected(client, admin_headers):
    body = {"username": "dupe", "email": "dupe@example.com",
            "password": "a-good-password", "role": "viewer"}
    assert client.post("/api/auth/register", headers=admin_headers, json=body).status_code == 201
    body["email"] = "dupe2@example.com"
    assert client.post("/api/auth/register", headers=admin_headers, json=body).status_code == 409


# ── Thresholds ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("body", [
    {"fraud_threshold": 0.5, "high_risk_threshold": 50, "medium_risk_threshold": 10},
    {"fraud_threshold": 0.5, "high_risk_threshold": 0.8, "medium_risk_threshold": -1},
    {"fraud_threshold": 5.0, "high_risk_threshold": 0.8, "medium_risk_threshold": 0.4},
])
def test_thresholds_must_be_probabilities(client, admin_headers, body):
    """Only fraud_threshold was range-checked, so high=50 was accepted and
    silently broke risk classification."""
    assert client.put("/api/thresholds", headers=admin_headers, json=body).status_code == 422


def test_thresholds_ordering_is_enforced(client, admin_headers):
    r = client.put("/api/thresholds", headers=admin_headers, json={
        "fraud_threshold": 0.5, "high_risk_threshold": 0.3,
        "medium_risk_threshold": 0.6})
    assert r.status_code == 422


def test_valid_thresholds_are_accepted(client, admin_headers):
    r = client.put("/api/thresholds", headers=admin_headers, json={
        "fraud_threshold": 0.5, "high_risk_threshold": 0.8,
        "medium_risk_threshold": 0.4})
    assert r.status_code == 200, r.text
