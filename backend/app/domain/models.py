from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

import sympy as sp


class ComponentKind(StrEnum):
    RESISTOR = "R"
    IMPEDANCE = "Z"
    INDUCTOR = "L"
    CAPACITOR = "C"
    ADMITTANCE = "Y"


@dataclass(frozen=True)
class Component:
    id: str
    kind: ComponentKind
    node_a: str
    node_b: str
    value: sp.Expr
    raw_value: str

    @property
    def impedance(self) -> sp.Expr:
        s = sp.Symbol("s")
        if self.kind == ComponentKind.RESISTOR:
            return self.value
        if self.kind == ComponentKind.IMPEDANCE:
            return self.value
        if self.kind == ComponentKind.INDUCTOR:
            return s * self.value
        if self.kind == ComponentKind.CAPACITOR:
            return 1 / (s * self.value)
        if self.kind == ComponentKind.ADMITTANCE:
            return 1 / self.value
        raise ValueError(f"Unsupported component kind: {self.kind}")

    @property
    def admittance(self) -> sp.Expr:
        if self.kind == ComponentKind.ADMITTANCE:
            return self.value
        z = sp.simplify(self.impedance)
        if z == 0:
            raise ValueError(f"Component {self.id} has zero impedance; use a wire/short model later.")
        return sp.simplify(1 / z)


@dataclass(frozen=True)
class Port:
    id: str
    positive_node: str
    negative_node: str
    voltage_label: str
    current_label: str


@dataclass(frozen=True)
class TwoPortCircuit:
    id: str
    components: tuple[Component, ...]
    port1: Port = field(default_factory=lambda: Port("P1", "1", "0", "V1", "I1"))
    port2: Port = field(default_factory=lambda: Port("P2", "2", "0", "V2", "I2"))

    @property
    def ports(self) -> tuple[Port, Port]:
        return (self.port1, self.port2)

    @property
    def nodes(self) -> tuple[str, ...]:
        values: set[str] = set()
        for component in self.components:
            values.add(component.node_a)
            values.add(component.node_b)
        for port in self.ports:
            values.add(port.positive_node)
            values.add(port.negative_node)
        return tuple(sorted(values, key=_node_sort_key))

    @property
    def non_reference_nodes(self) -> tuple[str, ...]:
        return tuple(node for node in self.nodes if not is_reference_node(node))

    def validate(self) -> list[str]:
        warnings: list[str] = []
        for port in self.ports:
            if port.positive_node == port.negative_node:
                warnings.append(f"{port.id} has the same positive and negative node.")
        if not self.components:
            warnings.append("The circuit has no components.")
        component_nodes = {node for c in self.components for node in (c.node_a, c.node_b)}
        for port in self.ports:
            if port.positive_node not in component_nodes and not is_reference_node(port.positive_node):
                warnings.append(f"{port.id} positive node {port.positive_node!r} is not connected to any component.")
        return warnings


def is_reference_node(node: str) -> bool:
    return node.strip().lower() in {"0", "gnd", "ground"}


def _node_sort_key(node: str) -> tuple[int, str]:
    return (0 if is_reference_node(node) else 1, node)
