"""Password change and admin reset.

Neither existed: a credential could not be rotated by anyone, through any
endpoint, without editing the database by hand.
"""


def test_user_can_change_own_password(client, viewer):
    new = "a-brand-new-password"
    r = client.post("/api/auth/change-password", headers=viewer["headers"],
                    json={"current_password": viewer["password"], "new_password": new})
    assert r.status_code == 200, r.text

    # the new one works
    assert client.post("/api/auth/token", data={
        "username": viewer["username"], "password": new}).status_code == 200
    # the old one does not
    assert client.post("/api/auth/token", data={
        "username": viewer["username"], "password": viewer["password"]}).status_code == 401


def test_change_requires_the_current_password(client, viewer):
    """A stolen token alone must not be enough to take the account over."""
    r = client.post("/api/auth/change-password", headers=viewer["headers"],
                    json={"current_password": "not-the-password",
                          "new_password": "another-new-password"})
    assert r.status_code == 400


def test_change_requires_authentication(client):
    r = client.post("/api/auth/change-password",
                    json={"current_password": "x", "new_password": "yyyyyyyy"})
    assert r.status_code == 401


def test_new_password_must_meet_the_minimum_length(client, viewer):
    r = client.post("/api/auth/change-password", headers=viewer["headers"],
                    json={"current_password": viewer["password"], "new_password": "short"})
    assert r.status_code == 422


def test_new_password_must_differ(client, viewer):
    r = client.post("/api/auth/change-password", headers=viewer["headers"],
                    json={"current_password": viewer["password"],
                          "new_password": viewer["password"]})
    assert r.status_code == 400


def test_admin_can_reset_a_locked_out_user(client, admin_headers, viewer):
    new = "reset-by-the-admin"
    r = client.post(f"/api/auth/users/{viewer['username']}/reset-password",
                    headers=admin_headers, json={"new_password": new})
    assert r.status_code == 200, r.text
    assert client.post("/api/auth/token", data={
        "username": viewer["username"], "password": new}).status_code == 200


def test_non_admin_cannot_reset_another_user(client, viewer, admin_headers):
    r = client.post("/api/auth/users/testadmin/reset-password",
                    headers=viewer["headers"], json={"new_password": "hijack-attempt-1"})
    assert r.status_code == 403


def test_reset_of_unknown_user_is_404(client, admin_headers):
    r = client.post("/api/auth/users/nobody-here/reset-password",
                    headers=admin_headers, json={"new_password": "does-not-matter"})
    assert r.status_code == 404


def test_password_changes_are_audited(client, admin_headers, viewer):
    client.post("/api/auth/change-password", headers=viewer["headers"],
                json={"current_password": viewer["password"],
                      "new_password": "audited-change-pw"})
    logs = client.get("/api/audit?limit=50", headers=admin_headers).json()["logs"]
    actions = {(l["action"], l.get("username")) for l in logs}
    assert ("CHANGE_PASSWORD", viewer["username"]) in actions
