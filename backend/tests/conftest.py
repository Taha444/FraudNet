"""Shared fixtures.

Every test runs against a throwaway SQLite file selected through DATABASE_URL,
so a test run never touches a real database. The environment has to be set
before backend.database is imported, because the engine is built at import time.
"""
import os
import sys
import tempfile
import uuid

import pytest

ADMIN_USER = "testadmin"
ADMIN_PASS = "test-admin-pw-123"


@pytest.fixture(scope="session", autouse=True)
def _env():
    os.environ["SECRET_KEY"] = "test-only-signing-key"
    os.environ["ADMIN_USERNAME"] = ADMIN_USER
    os.environ["ADMIN_PASSWORD"] = ADMIN_PASS
    db = os.path.join(tempfile.mkdtemp(prefix="fraudnet-test-"), "test.db")
    os.environ["DATABASE_URL"] = f"sqlite:///{db.replace(os.sep, '/')}"
    # Put the repository root on the path so `backend.main` imports exactly the
    # way `uvicorn backend.main:app` does in the container.
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if root not in sys.path:
        sys.path.insert(0, root)
    yield


@pytest.fixture(scope="session")
def client(_env):
    from fastapi.testclient import TestClient
    from backend.main import app
    # The context manager runs the lifespan, which bootstraps the admin account
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client):
    r = client.post("/api/auth/token",
                    data={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def viewer(client, admin_headers):
    """A freshly created viewer-role account, for role-boundary tests."""
    name = f"viewer_{uuid.uuid4().hex[:8]}"
    password = "viewer-pw-12345"
    r = client.post("/api/auth/register", headers=admin_headers, json={
        "username": name, "email": f"{name}@example.com",
        "password": password, "role": "viewer",
    })
    assert r.status_code == 201, r.text
    tok = client.post("/api/auth/token",
                      data={"username": name, "password": password}).json()["access_token"]
    return {"username": name, "password": password, "token": tok,
            "headers": {"Authorization": f"Bearer {tok}"}}
