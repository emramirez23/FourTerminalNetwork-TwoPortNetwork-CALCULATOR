from __future__ import annotations

from typing import Any

import sympy as sp

from backend.app.parameters import ParameterResult


def result_payload(result: ParameterResult) -> dict[str, Any]:
    return {
        "family": result.family,
        "matrix": matrix_payload(result.matrix),
        "units": result.units,
        "steps": steps_payload(result.steps),
    }


def matrix_payload(matrix: sp.Matrix) -> dict[str, Any]:
    return {
        "exact": [[sp.sstr(sp.simplify(matrix[row, col])) for col in range(matrix.cols)] for row in range(matrix.rows)],
        "decimal": [
            [_decimal_string(matrix[row, col]) for col in range(matrix.cols)]
            for row in range(matrix.rows)
        ],
        "latex": sp.latex(matrix),
    }


def steps_payload(steps: list[dict[str, object]]) -> list[dict[str, Any]]:
    return [_serialize_value(step) for step in steps]


def _serialize_value(value: Any) -> Any:
    if isinstance(value, sp.MatrixBase):
        return matrix_payload(value)
    if isinstance(value, sp.Basic):
        return {"exact": sp.sstr(sp.simplify(value)), "decimal": _decimal_string(value), "latex": sp.latex(value)}
    if isinstance(value, dict):
        return {key: _serialize_value(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [_serialize_value(inner) for inner in value]
    if isinstance(value, tuple):
        return [_serialize_value(inner) for inner in value]
    return value


def _decimal_string(value: sp.Expr) -> str:
    simplified = sp.simplify(value)
    if simplified.free_symbols:
        return sp.sstr(simplified)
    return f"{float(sp.N(simplified, 12)):.6g}"
