from __future__ import annotations

from typing import Iterable

from backend.app.conversion import ConversionError, convert_parameter_matrix
from backend.app.conversion.converter import conversion_error_payload, matrix_from_nested, normalize_family
from backend.app.explanation import result_payload
from backend.app.parameters import TwoPortParameterSolver
from backend.app.parser import parse_netlist
from backend.app.preview import build_netlist_preview


def solve_netlist(netlist: str, families: Iterable[str] = ("Z", "Y")) -> dict[str, object]:
    circuit = parse_netlist(netlist)
    solver = TwoPortParameterSolver(circuit)
    requested = [family.upper() for family in families]
    results: dict[str, object] = {}
    if "Z" in requested:
        results["Z"] = result_payload(solver.solve_z())
    if "Y" in requested:
        results["Y"] = result_payload(solver.solve_y())
    warnings = circuit.validate()
    return {
        "circuit": {
            "id": circuit.id,
            "nodes": list(circuit.nodes),
            "ports": [
                {
                    "id": port.id,
                    "positive_node": port.positive_node,
                    "negative_node": port.negative_node,
                    "voltage_label": port.voltage_label,
                    "current_label": port.current_label,
                }
                for port in circuit.ports
            ],
            "components": [
                {
                    "id": component.id,
                    "kind": component.kind.value,
                    "node_a": component.node_a,
                    "node_b": component.node_b,
                    "value": component.raw_value,
                }
                for component in circuit.components
            ],
        },
        "results": results,
        "warnings": warnings,
    }


def convert_matrix(source_family: str, matrix_values: list[list[object]], target_families: Iterable[str]) -> dict[str, object]:
    matrix = matrix_from_nested(matrix_values)
    source = normalize_family(source_family)
    requested = [normalize_family(family) for family in target_families]
    conversions: dict[str, object] = {}
    for target in requested:
        try:
            conversions[target] = convert_parameter_matrix(source, matrix, target).payload()
        except ConversionError as exc:
            conversions[target] = conversion_error_payload(source, target, str(exc))
    return {
        "source_family": source,
        "input_matrix": {
            "exact": [[str(matrix[row, col]) for col in range(matrix.cols)] for row in range(matrix.rows)],
        },
        "conversions": conversions,
    }


def preview_netlist(netlist: str) -> dict[str, object]:
    return build_netlist_preview(netlist)
