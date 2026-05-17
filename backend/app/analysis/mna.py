from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

import sympy as sp

from backend.app.domain import Port, TwoPortCircuit
from backend.app.domain.models import is_reference_node


class AnalysisError(RuntimeError):
    pass


class PortConditionKind(StrEnum):
    CURRENT = "current"
    VOLTAGE = "voltage"


@dataclass(frozen=True)
class PortCondition:
    port_id: str
    kind: PortConditionKind
    value: sp.Expr


@dataclass(frozen=True)
class CircuitSolution:
    unknowns: tuple[sp.Symbol, ...]
    values: dict[sp.Symbol, sp.Expr]
    matrix: sp.Matrix
    rhs: sp.Matrix
    voltage_source_currents: dict[str, sp.Expr]

    def unknown_value(self, symbol: sp.Symbol) -> sp.Expr:
        return self.values.get(symbol, sp.Integer(0))


class LinearCircuitSolver:
    def __init__(self, circuit: TwoPortCircuit):
        self.circuit = circuit
        self.nodes = circuit.non_reference_nodes
        self.node_symbols = {node: sp.Symbol(f"V_{_safe_symbol(node)}") for node in self.nodes}

    def solve(self, conditions: list[PortCondition]) -> CircuitSolution:
        condition_map = self._condition_map(conditions)
        voltage_conditions = [condition for condition in conditions if condition.kind == PortConditionKind.VOLTAGE]
        node_count = len(self.nodes)
        source_count = len(voltage_conditions)
        size = node_count + source_count
        if size == 0:
            raise AnalysisError("No unknowns to solve.")

        matrix = sp.zeros(size, size)
        rhs = sp.zeros(size, 1)
        node_index = {node: idx for idx, node in enumerate(self.nodes)}
        source_symbols: list[sp.Symbol] = []

        for component in self.circuit.components:
            try:
                admittance = component.admittance
            except ValueError as exc:
                raise AnalysisError(str(exc)) from exc
            self._stamp_admittance(matrix, node_index, component.node_a, component.node_b, admittance)

        for condition in conditions:
            port = self._port_by_id(condition.port_id)
            if condition.kind == PortConditionKind.CURRENT:
                self._stamp_current(rhs, node_index, port, condition.value)

        for source_offset, condition in enumerate(voltage_conditions):
            port = self._port_by_id(condition.port_id)
            source_index = node_count + source_offset
            source_symbol = sp.Symbol(f"I_Vtest_{port.id}")
            source_symbols.append(source_symbol)
            self._stamp_voltage_source(matrix, rhs, node_index, source_index, port, condition.value)

        unknowns = tuple(self.node_symbols[node] for node in self.nodes) + tuple(source_symbols)
        try:
            solved = matrix.LUsolve(rhs)
        except Exception as exc:
            raise AnalysisError("The MNA system is singular or cannot be solved with the imposed conditions.") from exc

        values = {unknown: sp.simplify(solved[idx, 0]) for idx, unknown in enumerate(unknowns)}
        source_currents = {
            voltage_conditions[idx].port_id: sp.simplify(values[source_symbols[idx]])
            for idx in range(source_count)
        }
        return CircuitSolution(unknowns, values, matrix, rhs, source_currents)

    def port_voltage(self, solution: CircuitSolution, port_id: str) -> sp.Expr:
        port = self._port_by_id(port_id)
        return sp.simplify(self._node_voltage(solution, port.positive_node) - self._node_voltage(solution, port.negative_node))

    def port_current(self, solution: CircuitSolution, conditions: list[PortCondition], port_id: str) -> sp.Expr:
        condition = self._condition_map(conditions)[port_id]
        if condition.kind == PortConditionKind.CURRENT:
            return sp.simplify(condition.value)
        # MNA source current is defined from port positive node to negative node.
        # Port current in the notes enters the positive terminal from the external source.
        return sp.simplify(-solution.voltage_source_currents[port_id])

    def _node_voltage(self, solution: CircuitSolution, node: str) -> sp.Expr:
        if is_reference_node(node):
            return sp.Integer(0)
        return solution.unknown_value(self.node_symbols[node])

    def _port_by_id(self, port_id: str) -> Port:
        normalized = port_id.upper()
        for port in self.circuit.ports:
            if port.id.upper() == normalized:
                return port
        raise AnalysisError(f"Unknown port {port_id!r}.")

    def _condition_map(self, conditions: list[PortCondition]) -> dict[str, PortCondition]:
        mapped: dict[str, PortCondition] = {}
        for condition in conditions:
            port_id = condition.port_id.upper()
            if port_id in mapped:
                raise AnalysisError(f"Repeated condition for {port_id}.")
            mapped[port_id] = condition
        expected = {port.id for port in self.circuit.ports}
        missing = expected.difference(mapped)
        if missing:
            raise AnalysisError(f"Missing port conditions for: {', '.join(sorted(missing))}.")
        return mapped

    @staticmethod
    def _stamp_admittance(
        matrix: sp.Matrix,
        node_index: dict[str, int],
        node_a: str,
        node_b: str,
        admittance: sp.Expr,
    ) -> None:
        a = node_index.get(node_a)
        b = node_index.get(node_b)
        if a is not None:
            matrix[a, a] += admittance
        if b is not None:
            matrix[b, b] += admittance
        if a is not None and b is not None:
            matrix[a, b] -= admittance
            matrix[b, a] -= admittance

    @staticmethod
    def _stamp_current(rhs: sp.Matrix, node_index: dict[str, int], port: Port, current: sp.Expr) -> None:
        positive = node_index.get(port.positive_node)
        negative = node_index.get(port.negative_node)
        if positive is not None:
            rhs[positive, 0] += current
        if negative is not None:
            rhs[negative, 0] -= current

    @staticmethod
    def _stamp_voltage_source(
        matrix: sp.Matrix,
        rhs: sp.Matrix,
        node_index: dict[str, int],
        source_index: int,
        port: Port,
        voltage: sp.Expr,
    ) -> None:
        positive = node_index.get(port.positive_node)
        negative = node_index.get(port.negative_node)
        if positive is not None:
            matrix[positive, source_index] += 1
            matrix[source_index, positive] += 1
        if negative is not None:
            matrix[negative, source_index] -= 1
            matrix[source_index, negative] -= 1
        rhs[source_index, 0] = voltage


def _safe_symbol(value: str) -> str:
    cleaned = "".join(char if char.isalnum() else "_" for char in value)
    return cleaned or "node"
