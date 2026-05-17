from __future__ import annotations

import json
import subprocess
from pathlib import Path

from backend.app.conversion import convert_parameter_matrix
from backend.app.parameters import TwoPortParameterSolver
from backend.app.parser import parse_netlist


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_web_engine_matches_backend_for_reference_case() -> None:
    completed = subprocess.run(
        ["node", "tools/web_parity_check.mjs"],
        cwd=PROJECT_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(completed.stdout)

    circuit = parse_netlist(
        "\n".join(
            [
                "R1 1 n1 30",
                "R2 n1 0 40",
                "R3 n1 n2 50",
                "R4 n2 0 20",
                "R5 n2 2 10",
            ]
        )
    )
    solver = TwoPortParameterSolver(circuit)
    z_matrix = solver.solve_z().matrix
    y_matrix = solver.solve_y().matrix
    gamma_matrix = convert_parameter_matrix("Z", z_matrix, "Gamma").output_matrix

    _assert_matrix_close(payload["z"], z_matrix)
    _assert_matrix_close(payload["y"], y_matrix)
    _assert_matrix_close(payload["gamma"], gamma_matrix)


def _assert_matrix_close(actual: list[list[float]], expected_matrix, tolerance: float = 1e-9) -> None:
    expected = [
        [float(expected_matrix[0, 0]), float(expected_matrix[0, 1])],
        [float(expected_matrix[1, 0]), float(expected_matrix[1, 1])],
    ]
    for row_index in range(2):
        for col_index in range(2):
            assert abs(actual[row_index][col_index] - expected[row_index][col_index]) < tolerance
