from __future__ import annotations

import sympy as sp
from fastapi.testclient import TestClient

from backend.app.conversion import convert_parameter_matrix
from backend.app.main import app
from backend.app.services import convert_matrix


Z_SIMPLE = sp.Matrix([[2, 1], [1, 3]])
Y_SIMPLE = sp.Matrix([[sp.Rational(3, 5), sp.Rational(-1, 5)], [sp.Rational(-1, 5), sp.Rational(2, 5)]])
H_SIMPLE = sp.Matrix([[sp.Rational(5, 3), sp.Rational(1, 3)], [sp.Rational(-1, 3), sp.Rational(1, 3)]])
G_SIMPLE = sp.Matrix([[sp.Rational(1, 2), sp.Rational(-1, 2)], [sp.Rational(1, 2), sp.Rational(5, 2)]])
GAMMA_SIMPLE = sp.Matrix([[2, 5], [1, 3]])


def test_01_z_to_y_exact() -> None:
    result = convert_parameter_matrix("Z", Z_SIMPLE, "Y")

    assert result.output_matrix == Y_SIMPLE
    assert "DeltaZ = 5 != 0" in result.conditions


def test_02_z_to_h_exact() -> None:
    result = convert_parameter_matrix("Z", Z_SIMPLE, "h")

    assert result.output_matrix == H_SIMPLE


def test_03_z_to_g_exact() -> None:
    result = convert_parameter_matrix("Z", Z_SIMPLE, "g")

    assert result.output_matrix == G_SIMPLE


def test_04_z_to_gamma_exact() -> None:
    result = convert_parameter_matrix("Z", Z_SIMPLE, "Gamma")

    assert result.output_matrix == GAMMA_SIMPLE


def test_05_y_to_z_roundtrip() -> None:
    result = convert_parameter_matrix("Y", Y_SIMPLE, "Z")

    assert sp.simplify(result.output_matrix - Z_SIMPLE) == sp.zeros(2, 2)


def test_06_h_to_z_roundtrip() -> None:
    result = convert_parameter_matrix("h", H_SIMPLE, "Z")

    assert sp.simplify(result.output_matrix - Z_SIMPLE) == sp.zeros(2, 2)


def test_07_g_to_z_roundtrip() -> None:
    result = convert_parameter_matrix("g", G_SIMPLE, "Z")

    assert sp.simplify(result.output_matrix - Z_SIMPLE) == sp.zeros(2, 2)


def test_08_gamma_to_z_roundtrip() -> None:
    result = convert_parameter_matrix("Gamma", GAMMA_SIMPLE, "Z")

    assert sp.simplify(result.output_matrix - Z_SIMPLE) == sp.zeros(2, 2)


def test_09_singular_z_to_y_returns_explained_error() -> None:
    payload = convert_matrix("Z", [["1", "2"], ["2", "4"]], ["Y"])

    assert payload["conversions"]["Y"]["status"] == "error"
    assert "DeltaZ = 0" in payload["conversions"]["Y"]["reason"]


def test_10_api_convert_endpoint_handles_pdf_examples() -> None:
    response = TestClient(app).post(
        "/convert",
        json={
            "source_family": "Z",
            "matrix": [["742/11", "168/11"], ["168/11", "422/11"]],
            "target_families": ["Gamma", "Y"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["conversions"]["Gamma"]["status"] == "ok"
    assert payload["conversions"]["Gamma"]["matrix"]["decimal"] == [["4.41667", "154.167"], ["0.0654762", "2.5119"]]
    assert payload["conversions"]["Y"]["status"] == "ok"


def test_11_api_convert_metric_suffixes_are_case_sensitive() -> None:
    response = TestClient(app).post(
        "/convert",
        json={
            "source_family": "Z",
            "matrix": [["10m", "10u"], ["10M", "10G"]],
            "target_families": ["Z"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["input_matrix"]["exact"] == [["1/100", "1/100000"], ["10000000", "10000000000"]]
    assert payload["conversions"]["Z"]["status"] == "ok"


def test_12_api_convert_accepts_omega_symbol_aliases() -> None:
    response = TestClient(app).post(
        "/convert",
        json={
            "source_family": "Z",
            "matrix": [["1", "0"], ["0", "j*ω"]],
            "target_families": ["h"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["conversions"]["h"]["status"] == "ok"
    assert payload["conversions"]["h"]["matrix"]["exact"][0][0] == "1"
