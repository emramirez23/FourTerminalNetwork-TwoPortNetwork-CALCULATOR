from __future__ import annotations

import re
from dataclasses import replace

import sympy as sp

from backend.app.domain import Component, ComponentKind, Port, TwoPortCircuit


class NetlistParseError(ValueError):
    pass


_METRIC_SUFFIXES = {
    "p": sp.Rational(1, 10**12),
    "n": sp.Rational(1, 10**9),
    "u": sp.Rational(1, 10**6),
    "m": sp.Rational(1, 1000),
    "k": sp.Integer(1000),
    "meg": sp.Integer(1_000_000),
    "g": sp.Integer(1_000_000_000),
}


def parse_netlist(text: str, circuit_id: str = "netlist") -> TwoPortCircuit:
    components: list[Component] = []
    port1 = Port("P1", "1", "0", "V1", "I1")
    port2 = Port("P2", "2", "0", "V2", "I2")

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = _strip_comment(raw_line).strip()
        if not line:
            continue
        tokens = line.split()
        directive = tokens[0].lower()
        if directive == ".port":
            if len(tokens) != 4:
                raise NetlistParseError(f"Line {line_number}: .port expects '.port P1 node+ node-'.")
            port_id = tokens[1].upper()
            if port_id == "P1":
                port1 = replace(port1, positive_node=tokens[2], negative_node=tokens[3])
            elif port_id == "P2":
                port2 = replace(port2, positive_node=tokens[2], negative_node=tokens[3])
            else:
                raise NetlistParseError(f"Line {line_number}: unknown port {tokens[1]!r}.")
            continue
        if directive == ".ports":
            if len(tokens) != 5:
                raise NetlistParseError(f"Line {line_number}: .ports expects '.ports p1+ p1- p2+ p2-'.")
            port1 = replace(port1, positive_node=tokens[1], negative_node=tokens[2])
            port2 = replace(port2, positive_node=tokens[3], negative_node=tokens[4])
            continue
        components.append(_parse_component(tokens, line_number))

    circuit = TwoPortCircuit(circuit_id, tuple(components), port1, port2)
    warnings = circuit.validate()
    fatal_warnings = [warning for warning in warnings if "same positive and negative" in warning]
    if fatal_warnings:
        raise NetlistParseError("; ".join(fatal_warnings))
    return circuit


def parse_value(raw: str) -> sp.Expr:
    normalized = raw.strip().replace(",", ".").replace("^", "**")
    normalized = normalized.replace("ω", "w")
    suffix_value = _parse_metric_suffix(normalized)
    if suffix_value is not None:
        return suffix_value
    locals_map = {
        "j": sp.I,
        "J": sp.I,
        "I": sp.I,
        "s": sp.Symbol("s"),
        "w": sp.Symbol("w"),
        "omega": sp.Symbol("w"),
        "pi": sp.pi,
    }
    try:
        return sp.sympify(normalized, locals=locals_map)
    except (sp.SympifyError, SyntaxError) as exc:
        raise NetlistParseError(f"Cannot parse value {raw!r}.") from exc


def _parse_component(tokens: list[str], line_number: int) -> Component:
    if len(tokens) != 4:
        raise NetlistParseError(f"Line {line_number}: components expect 'Name nodeA nodeB value'.")
    component_id, node_a, node_b, raw_value = tokens
    kind_key = component_id[0].upper()
    try:
        kind = ComponentKind(kind_key)
    except ValueError as exc:
        raise NetlistParseError(
            f"Line {line_number}: unsupported component kind {kind_key!r}; use R, Z, L, C or Y."
        ) from exc
    return Component(
        id=component_id,
        kind=kind,
        node_a=node_a,
        node_b=node_b,
        value=parse_value(raw_value),
        raw_value=raw_value,
    )


def _strip_comment(line: str) -> str:
    stripped = line.strip()
    if stripped.startswith("*"):
        return ""
    return re.split(r"(?<!\\)[#;]", line, maxsplit=1)[0]


def _parse_metric_suffix(value: str) -> sp.Expr | None:
    match = re.fullmatch(r"([+-]?(?:\d+(?:\.\d*)?|\.\d+))([a-zA-Z]+)", value)
    if not match:
        return None
    number, suffix = match.groups()
    factor = _METRIC_SUFFIXES.get(suffix.lower())
    if factor is None:
        return None
    return sp.Rational(number) * factor
