from __future__ import annotations

import sympy as sp

from backend.app.parameters import TwoPortParameterSolver
from backend.app.parser import parse_netlist
from backend.app.parser.netlist import parse_value


EJEMPLO_1_NETLIST = """
R1 1 n1 30
R2 n1 0 40
R3 n1 n2 50
R4 n2 0 20
R5 n2 2 10
"""


def test_ejemplo_1_z_parameters_match_pdf_values() -> None:
    circuit = parse_netlist(EJEMPLO_1_NETLIST)
    result = TwoPortParameterSolver(circuit).solve_z()

    expected = sp.Matrix([[sp.Rational(610, 11), sp.Rational(80, 11)], [sp.Rational(80, 11), sp.Rational(290, 11)]])

    assert result.matrix == expected
    assert round(float(result.matrix[0, 0]), 2) == 55.45
    assert round(float(result.matrix[0, 1]), 2) == 7.27
    assert round(float(result.matrix[1, 0]), 2) == 7.27
    assert round(float(result.matrix[1, 1]), 2) == 26.36


def test_ejemplo_1_y_parameters_match_pdf_values() -> None:
    circuit = parse_netlist(EJEMPLO_1_NETLIST)
    result = TwoPortParameterSolver(circuit).solve_y()

    # The PDF prints these values with classroom rounding/truncation.
    assert abs(float(result.matrix[0, 0]) - 0.018) < 1e-3
    assert abs(float(result.matrix[0, 1]) - (-0.0051)) < 1e-4
    assert abs(float(result.matrix[1, 0]) - (-0.0051)) < 1e-4
    assert abs(float(result.matrix[1, 1]) - 0.039) < 1e-3


def test_z_to_y_matches_direct_y_solution() -> None:
    circuit = parse_netlist(EJEMPLO_1_NETLIST)
    solver = TwoPortParameterSolver(circuit)
    z_matrix = solver.solve_z().matrix
    y_matrix = solver.solve_y().matrix

    assert sp.simplify(z_matrix.inv() - y_matrix) == sp.zeros(2, 2)


def test_symbolic_omega_aliases_parse_as_frequency_symbol() -> None:
    w = sp.Symbol("w")

    assert parse_value("j*ω*10m") == sp.I * w / 100
    assert parse_value("j*Ω*10m") == sp.I * w / 100
