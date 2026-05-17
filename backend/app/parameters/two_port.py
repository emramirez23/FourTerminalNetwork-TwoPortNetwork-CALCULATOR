from __future__ import annotations

from dataclasses import dataclass

import sympy as sp

from backend.app.analysis import LinearCircuitSolver, PortCondition, PortConditionKind
from backend.app.domain import TwoPortCircuit


@dataclass(frozen=True)
class ParameterResult:
    family: str
    matrix: sp.Matrix
    units: tuple[tuple[str, str], tuple[str, str]]
    steps: list[dict[str, object]]


class TwoPortParameterSolver:
    def __init__(self, circuit: TwoPortCircuit):
        self.circuit = circuit
        self.solver = LinearCircuitSolver(circuit)

    def solve_z(self) -> ParameterResult:
        first = self._run_trial(
            title="Calculo de z11 y z21",
            reason="Se abre la salida: I2 = 0. Se inyecta una corriente de prueba I1 = 1 A.",
            conditions=[
                PortCondition("P1", PortConditionKind.CURRENT, sp.Integer(1)),
                PortCondition("P2", PortConditionKind.CURRENT, sp.Integer(0)),
            ],
        )
        second = self._run_trial(
            title="Calculo de z12 y z22",
            reason="Se abre la entrada: I1 = 0. Se inyecta una corriente de prueba I2 = 1 A.",
            conditions=[
                PortCondition("P1", PortConditionKind.CURRENT, sp.Integer(0)),
                PortCondition("P2", PortConditionKind.CURRENT, sp.Integer(1)),
            ],
        )
        z11 = sp.simplify(first["V1"] / first["I1"])
        z21 = sp.simplify(first["V2"] / first["I1"])
        z12 = sp.simplify(second["V1"] / second["I2"])
        z22 = sp.simplify(second["V2"] / second["I2"])
        matrix = sp.Matrix([[z11, z12], [z21, z22]])
        steps = [
            _intro_step(
                "Parametros Z",
                [
                    "V1 = z11 I1 + z12 I2",
                    "V2 = z21 I1 + z22 I2",
                ],
                "Los parametros Z se definen con el puerto opuesto abierto, por eso se impone I = 0.",
            ),
            first,
            second,
            _matrix_step("Matriz Z", matrix, "ohm"),
            _reciprocity_step(matrix, "Z"),
        ]
        return ParameterResult("Z", matrix, (("ohm", "ohm"), ("ohm", "ohm")), steps)

    def solve_y(self) -> ParameterResult:
        first = self._run_trial(
            title="Calculo de y11 y y21",
            reason="Se cortocircuita la salida: V2 = 0. Se aplica una tension de prueba V1 = 1 V.",
            conditions=[
                PortCondition("P1", PortConditionKind.VOLTAGE, sp.Integer(1)),
                PortCondition("P2", PortConditionKind.VOLTAGE, sp.Integer(0)),
            ],
        )
        second = self._run_trial(
            title="Calculo de y12 y y22",
            reason="Se cortocircuita la entrada: V1 = 0. Se aplica una tension de prueba V2 = 1 V.",
            conditions=[
                PortCondition("P1", PortConditionKind.VOLTAGE, sp.Integer(0)),
                PortCondition("P2", PortConditionKind.VOLTAGE, sp.Integer(1)),
            ],
        )
        y11 = sp.simplify(first["I1"] / first["V1"])
        y21 = sp.simplify(first["I2"] / first["V1"])
        y12 = sp.simplify(second["I1"] / second["V2"])
        y22 = sp.simplify(second["I2"] / second["V2"])
        matrix = sp.Matrix([[y11, y12], [y21, y22]])
        steps = [
            _intro_step(
                "Parametros Y",
                [
                    "I1 = y11 V1 + y12 V2",
                    "I2 = y21 V1 + y22 V2",
                ],
                "Los parametros Y se definen con el puerto opuesto en cortocircuito, por eso se impone V = 0.",
            ),
            first,
            second,
            _matrix_step("Matriz Y", matrix, "siemens"),
            _reciprocity_step(matrix, "Y"),
        ]
        return ParameterResult("Y", matrix, (("S", "S"), ("S", "S")), steps)

    def _run_trial(self, title: str, reason: str, conditions: list[PortCondition]) -> dict[str, object]:
        solution = self.solver.solve(conditions)
        values = {
            "V1": self.solver.port_voltage(solution, "P1"),
            "V2": self.solver.port_voltage(solution, "P2"),
            "I1": self.solver.port_current(solution, conditions, "P1"),
            "I2": self.solver.port_current(solution, conditions, "P2"),
        }
        equations = [
            f"{condition.port_id}: {condition.kind.value} = {sp.sstr(condition.value)}"
            for condition in conditions
        ]
        equations.extend(
            [
                f"V1 = {sp.sstr(values['V1'])}",
                f"V2 = {sp.sstr(values['V2'])}",
                f"I1 = {sp.sstr(values['I1'])}",
                f"I2 = {sp.sstr(values['I2'])}",
            ]
        )
        return {
            "title": title,
            "explanation": reason,
            "equations": equations,
            **values,
        }


def _intro_step(title: str, equations: list[str], explanation: str) -> dict[str, object]:
    return {"title": title, "explanation": explanation, "equations": equations}


def _matrix_step(title: str, matrix: sp.Matrix, unit: str) -> dict[str, object]:
    return {
        "title": title,
        "explanation": f"Se agrupan los cuatro parametros calculados. Unidad: {unit}.",
        "equations": [sp.sstr(matrix)],
        "matrix": matrix,
    }


def _reciprocity_step(matrix: sp.Matrix, family: str) -> dict[str, object]:
    reciprocal = sp.simplify(matrix[0, 1] - matrix[1, 0]) == 0
    if family == "Z":
        equation = "z12 = z21"
    else:
        equation = "y12 = y21"
    return {
        "title": "Verificacion de reciprocidad",
        "explanation": "Un cuadripolo pasivo reciproco cumple la igualdad de parametros de transferencia.",
        "equations": [equation, f"Resultado: {'cumple' if reciprocal else 'no cumple'}"],
        "reciprocal": reciprocal,
    }
