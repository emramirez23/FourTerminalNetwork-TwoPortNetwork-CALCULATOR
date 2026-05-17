from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app


def test_health() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_solve_endpoint_returns_z_and_y() -> None:
    response = TestClient(app).post(
        "/solve",
        json={
            "netlist": "\n".join(
                [
                    "R1 1 n1 30",
                    "R2 n1 0 40",
                    "R3 n1 n2 50",
                    "R4 n2 0 20",
                    "R5 n2 2 10",
                ]
            ),
            "families": ["Z", "Y"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["results"]["Z"]["matrix"]["decimal"] == [["55.4545", "7.27273"], ["7.27273", "26.3636"]]
    assert payload["results"]["Y"]["matrix"]["decimal"][0][1] == "-0.00516129"
