# ====== Code Summary ======
# Tests for the GET /api/v1/health/ping endpoint.


def test_ping_returns_200(client):
    """Health check endpoint must return HTTP 200."""
    response = client.get("/api/v1/health/ping")
    assert response.status_code == 200


def test_ping_response_schema(client):
    """Response body must match HealthResponse schema with status 'ok'."""
    response = client.get("/api/v1/health/ping")
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
