from __future__ import annotations

import re
from dataclasses import dataclass

import sympy as sp

from backend.app.domain import ComponentKind, Port
from backend.app.parser.netlist import NetlistParseError, parse_value


@dataclass(frozen=True)
class PreviewComponent:
    line_number: int
    component_id: str
    kind: str
    node_a: str
    node_b: str
    raw_value: str
    parsed_value: sp.Expr | None


def build_netlist_preview(text: str) -> dict[str, object]:
    port1 = Port("P1", "1", "0", "V1", "I1")
    port2 = Port("P2", "2", "0", "V2", "I2")
    components: list[PreviewComponent] = []
    warnings: list[str] = []

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = _strip_comment(raw_line).strip()
        if not line:
            continue
        tokens = line.split()
        directive = tokens[0].lower()
        if directive == ".port":
            if len(tokens) < 4:
                warnings.append(f"Linea {line_number}: .port incompleto. Formato: .port P1 nodo+ nodo-.")
                continue
            port_id = tokens[1].upper()
            if port_id == "P1":
                port1 = Port("P1", tokens[2], tokens[3], "V1", "I1")
            elif port_id == "P2":
                port2 = Port("P2", tokens[2], tokens[3], "V2", "I2")
            else:
                warnings.append(f"Linea {line_number}: puerto desconocido {tokens[1]!r}.")
            continue
        if directive == ".ports":
            if len(tokens) < 5:
                warnings.append(f"Linea {line_number}: .ports incompleto. Formato: .ports p1+ p1- p2+ p2-.")
                continue
            port1 = Port("P1", tokens[1], tokens[2], "V1", "I1")
            port2 = Port("P2", tokens[3], tokens[4], "V2", "I2")
            continue
        if len(tokens) < 4:
            warnings.append(f"Linea {line_number}: componente incompleto. Formato: Nombre nodoA nodoB valor.")
            continue
        if len(tokens) > 4:
            warnings.append(f"Linea {line_number}: se ignoran tokens extra: {' '.join(tokens[4:])}.")
        component_id, node_a, node_b, raw_value = tokens[:4]
        kind = component_id[0].upper()
        if kind not in {item.value for item in ComponentKind}:
            warnings.append(f"Linea {line_number}: tipo {kind!r} no soportado. Use R, Z, L, C o Y.")
            continue
        parsed_value: sp.Expr | None
        try:
            parsed_value = parse_value(raw_value)
        except NetlistParseError as exc:
            parsed_value = None
            warnings.append(f"Linea {line_number}: {exc}")
        components.append(PreviewComponent(line_number, component_id, kind, node_a, node_b, raw_value, parsed_value))

    ports = (port1, port2)
    mermaid = _build_mermaid(components, ports)
    svg = _build_schematic_svg(components, ports)
    markdown = _build_markdown(components, ports, warnings, svg, mermaid)
    return {
        "markdown": markdown,
        "svg": svg,
        "mermaid": mermaid,
        "components": [_component_payload(component) for component in components],
        "ports": [_port_payload(port) for port in ports],
        "warnings": warnings,
    }


def _build_mermaid(components: list[PreviewComponent], ports: tuple[Port, Port]) -> str:
    lines = ["flowchart LR"]
    nodes = _collect_nodes(components, ports)
    for node in nodes:
        lines.append(f'  {_node_id(node)}(("{_label(node)}"))')
    for port in ports:
        port_id = _safe_id(port.id)
        lines.append(f'  {port_id}["{port.id}<br/>{port.voltage_label}, {port.current_label}"]')
        lines.append(f"  {port_id} -.-> {_node_id(port.positive_node)}")
        lines.append(f"  {port_id} -. ref .-> {_node_id(port.negative_node)}")
    for component in components:
        comp_id = f"cmp_{_safe_id(component.component_id)}"
        value = _display_value(component)
        lines.append(f'  {comp_id}["{_label(component.component_id)}<br/>{component.kind} = {_label(value)}"]')
        lines.append(f"  {_node_id(component.node_a)} --- {comp_id} --- {_node_id(component.node_b)}")
    if not components:
        lines.append('  empty["Sin componentes completos todavia"]')
    return "\n".join(lines)


def _build_markdown(
    components: list[PreviewComponent],
    ports: tuple[Port, Port],
    warnings: list[str],
    svg: str,
    mermaid: str,
) -> str:
    lines = [
        "# Vista previa del netlist",
        "",
        "## Diagrama esquematico",
        "",
        "```svg",
        svg,
        "```",
        "",
        "## Diagrama de conectividad",
        "",
        "```mermaid",
        mermaid,
        "```",
        "",
        "## Puertos",
        "",
        "| Puerto | Tension | Corriente | Bornes |",
        "| --- | --- | --- | --- |",
    ]
    for port in ports:
        lines.append(
            f"| {port.id} | {port.voltage_label} | {port.current_label} | {port.positive_node} - {port.negative_node} |"
        )
    lines.extend(
        [
            "",
            "## Componentes",
            "",
            "| Linea | Componente | Tipo | Conexion | Valor | Interpretacion |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
    )
    if components:
        for component in components:
            parsed = sp.sstr(component.parsed_value) if component.parsed_value is not None else "pendiente"
            lines.append(
                f"| {component.line_number} | {component.component_id} | {component.kind} | "
                f"{component.node_a} - {component.node_b} | {component.raw_value} | {parsed} |"
            )
    else:
        lines.append("| - | - | - | - | - | Sin componentes completos todavia |")
    lines.extend(["", "## Advertencias", ""])
    if warnings:
        for warning in warnings:
            lines.append(f"- {warning}")
    else:
        lines.append("- Sin advertencias.")
    return "\n".join(lines)


def _build_schematic_svg(components: list[PreviewComponent], ports: tuple[Port, Port]) -> str:
    port1, port2 = ports
    lattice_svg = _build_lattice_svg_if_applicable(components, ports)
    if lattice_svg is not None:
        return lattice_svg
    top_path = _find_top_path(components, port1.positive_node, port2.positive_node)
    path_complete = top_path is not None
    if top_path is None:
        top_path = _find_longest_chain_from_start(components, port1.positive_node)
    path_nodes = top_path[0] if top_path else [port1.positive_node, port2.positive_node]
    series_components = top_path[1] if top_path else []
    path_node_set = set(path_nodes)
    series_ids = {component.component_id for component in series_components}
    shunts = [
        component
        for component in components
        if component.component_id not in series_ids
        and (
            component.node_a in path_node_set
            and _is_reference_like(component.node_b, ports)
            or component.node_b in path_node_set
            and _is_reference_like(component.node_a, ports)
        )
    ]
    shunt_ids = {shunt.component_id for shunt in shunts}
    shunts_by_node: dict[str, list[PreviewComponent]] = {}
    for shunt in shunts:
        top_node = shunt.node_a if shunt.node_a in path_node_set else shunt.node_b
        shunts_by_node.setdefault(top_node, []).append(shunt)
    top_bridges = [
        component
        for component in components
        if component.component_id not in series_ids
        and component.component_id not in shunt_ids
        and component.node_a in path_node_set
        and component.node_b in path_node_set
    ]
    top_bridge_ids = {bridge.component_id for bridge in top_bridges}
    other_components = [
        component
        for component in components
        if component.component_id not in series_ids
        and component.component_id not in shunt_ids
        and component.component_id not in top_bridge_ids
    ]

    left_x = 96
    branch_gap = 104
    base_spacing = 154
    segment_widths = _segment_widths(path_nodes, shunts_by_node, base_spacing, branch_gap)
    node_positions = _node_positions(path_nodes, left_x, segment_widths)
    right_x = node_positions[path_nodes[-1]]
    width = max(720, int(right_x + 125))
    top_y = 125
    bottom_y = 300
    height = 390
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" style="min-width:{width}px" role="img" aria-label="Esquema de cuadripolo">',
        "<style>",
        ".wire{stroke:#111;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}",
        ".dash{stroke:#777;stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:8 7}",
        ".thin{stroke:#111;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}",
        ".box{fill:#fff;stroke:#111;stroke-width:2}",
        ".node{fill:#fff;stroke:#111;stroke-width:2}",
        ".label{font:14px Segoe UI,Arial,sans-serif;font-weight:700;fill:#111;text-anchor:middle;dominant-baseline:middle}",
        ".small{font:12px Segoe UI,Arial,sans-serif;fill:#333}",
        ".port{font:14px Segoe UI,Arial,sans-serif;font-weight:700;fill:#111}",
        ".warn{font:12px Segoe UI,Arial,sans-serif;fill:#8a3a00}",
        ".center{font:12px Segoe UI,Arial,sans-serif;fill:#333;text-anchor:middle}",
        "</style>",
        '<rect x="1" y="1" width="' + str(width - 2) + '" height="' + str(height - 2) + '" fill="#fff" stroke="#d7dde1"/>',
    ]

    left_terminal_x = 42
    right_terminal_x = width - 36
    parts.extend(
        [
            _line(left_terminal_x, top_y, left_x, top_y),
            _line(left_terminal_x, bottom_y, right_terminal_x, bottom_y),
            _line(right_x, top_y, right_terminal_x, top_y, "wire" if path_complete else "dash"),
            _terminal(left_terminal_x, top_y),
            _terminal(left_terminal_x, bottom_y),
            _terminal(right_terminal_x, top_y),
            _terminal(right_terminal_x, bottom_y),
            _text(22, top_y - 28, "1", "port"),
            _text(22, bottom_y + 26, "1'", "port"),
            _text(width - 24, top_y - 28, "2", "port"),
            _text(width - 26, bottom_y + 26, "2'", "port"),
            _arrow(left_terminal_x + 4, top_y - 28, left_terminal_x + 50, top_y - 28),
            _text(left_terminal_x + 14, top_y - 38, "I1", "small"),
            _arrow(right_terminal_x - 4, top_y - 28, right_terminal_x - 50, top_y - 28),
            _text(right_terminal_x - 42, top_y - 38, "I2", "small"),
            _voltage_arrow(left_terminal_x - 12, top_y + 6, bottom_y - 6, "V1"),
            _voltage_arrow(right_terminal_x + 12, top_y + 6, bottom_y - 6, "V2"),
        ]
    )

    for idx, component in enumerate(series_components):
        x1 = node_positions[path_nodes[idx]]
        x2 = node_positions[path_nodes[idx + 1]]
        _series_component(parts, component, x1, x2, top_y)

    if not series_components:
        parts.append(_line(left_x, top_y, right_x, top_y))

    for node in path_nodes:
        x = node_positions[node]
        parts.append(_circle(x, top_y, 4))
        parts.append(_text(x - 12, top_y + 26, node, "small"))

    for node, grouped_shunts in shunts_by_node.items():
        node_x = node_positions[node]
        node_index = path_nodes.index(node)
        branch_positions = _parallel_branch_positions(node_x, len(grouped_shunts), branch_gap, node_index, len(path_nodes))
        for branch_x, component in zip(branch_positions, grouped_shunts):
            _shunt_component(parts, component, node_x, branch_x, top_y, bottom_y)

    for bridge_index, component in enumerate(top_bridges):
        _top_bridge_component(
            parts,
            component,
            node_positions[component.node_a],
            node_positions[component.node_b],
            top_y,
            bridge_index,
        )

    parts.extend(
        [
            _text(left_terminal_x + 18, bottom_y + 24, port1.negative_node, "small"),
            _text(right_terminal_x - 40, bottom_y + 24, port2.negative_node, "small"),
        ]
    )

    if other_components:
        parts.append(_text(34, 360, "Otros componentes no ubicados en la escalera principal:", "warn"))
        labels = ", ".join(f"{component.component_id}({component.node_a}-{component.node_b})" for component in other_components)
        parts.append(_text(285, 360, labels, "warn"))
    if not components:
        parts.append(_text(width / 2 - 120, 205, "Sin componentes completos todavia", "small"))
    elif not path_complete:
        parts.append(_text(right_x + 18, top_y - 18, "camino a P2 incompleto", "warn"))
    parts.append("</svg>")
    return "\n".join(parts)


def _build_lattice_svg_if_applicable(
    components: list[PreviewComponent],
    ports: tuple[Port, Port],
) -> str | None:
    if len(components) < 4:
        return None
    port1, port2 = ports
    p1p, p1n = port1.positive_node, port1.negative_node
    p2p, p2n = port2.positive_node, port2.negative_node
    terminal_nodes = {p1p, p1n, p2p, p2n}
    if len(terminal_nodes) < 4:
        return None
    if any(component.node_a not in terminal_nodes or component.node_b not in terminal_nodes for component in components):
        return None
    top = _find_component_between(components, p1p, p2p)
    bottom = _find_component_between(components, p1n, p2n)
    diag_down = _find_component_between(components, p1p, p2n)
    diag_up = _find_component_between(components, p1n, p2p)
    if diag_down is None or diag_up is None:
        return None

    width = 760
    height = 390
    left_x = 110
    right_x = 650
    top_y = 115
    bottom_y = 300
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" style="min-width:{width}px" role="img" aria-label="Cuadripolo X o lattice">',
        "<style>",
        ".wire{stroke:#111;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}",
        ".thin{stroke:#111;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}",
        ".box{fill:#fff;stroke:#111;stroke-width:2}",
        ".node{fill:#fff;stroke:#111;stroke-width:2}",
        ".label{font:14px Segoe UI,Arial,sans-serif;font-weight:700;fill:#111;text-anchor:middle;dominant-baseline:middle}",
        ".small{font:12px Segoe UI,Arial,sans-serif;fill:#333}",
        ".port{font:14px Segoe UI,Arial,sans-serif;font-weight:700;fill:#111}",
        ".center{font:12px Segoe UI,Arial,sans-serif;fill:#333;text-anchor:middle}",
        "</style>",
        f'<rect x="1" y="1" width="{width - 2}" height="{height - 2}" fill="#fff" stroke="#d7dde1"/>',
        _terminal(left_x, top_y),
        _terminal(left_x, bottom_y),
        _terminal(right_x, top_y),
        _terminal(right_x, bottom_y),
        _text(left_x - 38, top_y - 26, "1", "port"),
        _text(left_x - 42, bottom_y + 34, "1'", "port"),
        _text(right_x + 28, top_y - 26, "2", "port"),
        _text(right_x + 24, bottom_y + 34, "2'", "port"),
        _arrow(left_x - 6, top_y - 30, left_x + 50, top_y - 30),
        _text(left_x + 10, top_y - 42, "I1", "small"),
        _arrow(right_x + 6, top_y - 30, right_x - 50, top_y - 30),
        _text(right_x - 40, top_y - 42, "I2", "small"),
        _voltage_arrow(left_x - 22, top_y + 8, bottom_y - 8, "V1"),
        _voltage_arrow(right_x + 22, top_y + 8, bottom_y - 8, "V2"),
    ]
    if top is not None:
        _horizontal_floating_component(parts, top, left_x, right_x, top_y, y_offset=0)
    else:
        parts.append(_line(left_x, top_y, right_x, top_y))
    if bottom is not None:
        _horizontal_floating_component(parts, bottom, left_x, right_x, bottom_y, y_offset=0, value_below=False)
    else:
        parts.append(_line(left_x, bottom_y, right_x, bottom_y))
    _diagonal_component(parts, diag_down, left_x, top_y, right_x, bottom_y, bend=-30)
    _diagonal_component(parts, diag_up, left_x, bottom_y, right_x, top_y, bend=30)
    parts.append("</svg>")
    return "\n".join(parts)


def _find_top_path(
    components: list[PreviewComponent],
    start: str,
    end: str,
) -> tuple[list[str], list[PreviewComponent]] | None:
    adjacency: dict[str, list[tuple[str, PreviewComponent]]] = {}
    for component in components:
        if _is_reference_name(component.node_a) or _is_reference_name(component.node_b):
            continue
        adjacency.setdefault(component.node_a, []).append((component.node_b, component))
        adjacency.setdefault(component.node_b, []).append((component.node_a, component))
    best: tuple[list[str], list[PreviewComponent]] | None = None
    stack: list[tuple[str, list[str], list[PreviewComponent], set[str]]] = [(start, [start], [], set())]
    while stack:
        node, nodes, edges, used_components = stack.pop()
        if node == end:
            if best is None or len(edges) > len(best[1]):
                best = (nodes, edges)
            continue
        for next_node, component in adjacency.get(node, []):
            if component.component_id in used_components or next_node in nodes:
                continue
            stack.append((next_node, nodes + [next_node], edges + [component], used_components | {component.component_id}))
    return best


def _find_longest_chain_from_start(
    components: list[PreviewComponent],
    start: str,
) -> tuple[list[str], list[PreviewComponent]] | None:
    adjacency: dict[str, list[tuple[str, PreviewComponent]]] = {}
    for component in components:
        if _is_reference_name(component.node_a) or _is_reference_name(component.node_b):
            continue
        adjacency.setdefault(component.node_a, []).append((component.node_b, component))
        adjacency.setdefault(component.node_b, []).append((component.node_a, component))
    best_nodes = [start]
    best_edges: list[PreviewComponent] = []
    stack: list[tuple[str, list[str], list[PreviewComponent], set[str]]] = [(start, [start], [], set())]
    while stack:
        node, nodes, edges, used_components = stack.pop()
        if len(edges) > len(best_edges):
            best_nodes = nodes
            best_edges = edges
        for next_node, component in adjacency.get(node, []):
            if component.component_id in used_components or next_node in nodes:
                continue
            stack.append((next_node, nodes + [next_node], edges + [component], used_components | {component.component_id}))
    if best_edges:
        return best_nodes, best_edges
    return None


def _segment_widths(
    path_nodes: list[str],
    shunts_by_node: dict[str, list[PreviewComponent]],
    base_spacing: int,
    branch_gap: int,
) -> list[float]:
    segment_count = max(1, len(path_nodes) - 1)
    widths = [float(base_spacing) for _ in range(segment_count)]
    for node_index, node in enumerate(path_nodes):
        shunt_count = len(shunts_by_node.get(node, []))
        if shunt_count <= 1:
            continue
        group_width = (shunt_count - 1) * branch_gap
        if node_index == 0:
            widths[0] = max(widths[0], 95 + group_width + 70)
        elif node_index == len(path_nodes) - 1:
            widths[node_index - 1] = max(widths[node_index - 1], 95 + group_width + 70)
        else:
            side_room = group_width / 2 + 95
            widths[node_index - 1] = max(widths[node_index - 1], side_room)
            widths[node_index] = max(widths[node_index], side_room)
    return widths


def _node_positions(path_nodes: list[str], left_x: float, segment_widths: list[float]) -> dict[str, float]:
    positions = {path_nodes[0]: left_x}
    current = left_x
    for index, node in enumerate(path_nodes[1:], start=1):
        current += segment_widths[index - 1]
        positions[node] = current
    return positions


def _parallel_branch_positions(
    node_x: float,
    count: int,
    branch_gap: float,
    node_index: int,
    node_count: int,
) -> list[float]:
    if count <= 1:
        return [node_x]
    if node_index == 0:
        return [node_x + 58 + index * branch_gap for index in range(count)]
    if node_index == node_count - 1:
        start = node_x - 58 - (count - 1) * branch_gap
        return [start + index * branch_gap for index in range(count)]
    center_offset = (count - 1) / 2
    return [node_x + (index - center_offset) * branch_gap for index in range(count)]


def _series_component(parts: list[str], component: PreviewComponent, x1: float, x2: float, y: float) -> None:
    cx = (x1 + x2) / 2
    box_w = min(64, max(46, (x2 - x1) * 0.45, 12 + 8 * len(component.component_id)))
    box_h = 22
    parts.append(_line(x1, y, cx - box_w / 2, y))
    parts.append(_line(cx + box_w / 2, y, x2, y))
    parts.append(_rect(cx - box_w / 2, y - box_h / 2, box_w, box_h))
    parts.append(_text_center(cx, y + 1, component.component_id, "label"))
    parts.append(_text_center(cx, y + 40, f"{component.kind} = {_display_value(component)}", "center"))


def _top_bridge_component(
    parts: list[str],
    component: PreviewComponent,
    x1: float,
    x2: float,
    top_y: float,
    bridge_index: int,
) -> None:
    left, right = sorted((x1, x2))
    bridge_y = top_y - 70 - bridge_index * 48
    cx = (left + right) / 2
    box_w = max(46, 12 + 8 * len(component.component_id))
    box_h = 22
    parts.append(_line(left, top_y, left, bridge_y))
    parts.append(_line(right, top_y, right, bridge_y))
    parts.append(_line(left, bridge_y, cx - box_w / 2, bridge_y))
    parts.append(_line(cx + box_w / 2, bridge_y, right, bridge_y))
    parts.append(_rect(cx - box_w / 2, bridge_y - box_h / 2, box_w, box_h))
    parts.append(_text_center(cx, bridge_y + 1, component.component_id, "label"))
    parts.append(_text_center(cx, bridge_y - 18, f"{component.kind} = {_display_value(component)}", "center"))


def _shunt_component(
    parts: list[str],
    component: PreviewComponent,
    node_x: float,
    branch_x: float,
    top_y: float,
    bottom_y: float,
) -> None:
    box_w = max(30, 12 + 8 * len(component.component_id))
    box_h = 58
    cy = (top_y + bottom_y) / 2
    if branch_x != node_x:
        parts.append(_line(node_x, top_y, branch_x, top_y))
        parts.append(_circle(branch_x, top_y, 4))
    parts.append(_line(branch_x, top_y, branch_x, cy - box_h / 2))
    parts.append(_line(branch_x, cy + box_h / 2, branch_x, bottom_y))
    parts.append(_rect(branch_x - box_w / 2, cy - box_h / 2, box_w, box_h))
    parts.append(_text_center(branch_x, cy + 1, component.component_id, "label"))
    parts.append(_text_center(branch_x, cy + 48, f"{component.kind} = {_display_value(component)}", "center"))


def _horizontal_floating_component(
    parts: list[str],
    component: PreviewComponent,
    x1: float,
    x2: float,
    y: float,
    y_offset: float = 0,
    value_below: bool = True,
) -> None:
    y += y_offset
    cx = (x1 + x2) / 2
    box_w = max(46, 12 + 8 * len(component.component_id))
    box_h = 22
    parts.append(_line(x1, y, cx - box_w / 2, y))
    parts.append(_line(cx + box_w / 2, y, x2, y))
    parts.append(_rect(cx - box_w / 2, y - box_h / 2, box_w, box_h))
    parts.append(_text_center(cx, y + 1, component.component_id, "label"))
    value_y = y + 38 if value_below else y - 22
    parts.append(_text_center(cx, value_y, f"{component.kind} = {_display_value(component)}", "center"))


def _diagonal_component(
    parts: list[str],
    component: PreviewComponent,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    bend: float,
) -> None:
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2 + bend
    box_w = max(46, 12 + 8 * len(component.component_id))
    box_h = 24
    parts.append(_line(x1, y1, cx - box_w / 2, cy))
    parts.append(_line(cx + box_w / 2, cy, x2, y2))
    parts.append(_rect(cx - box_w / 2, cy - box_h / 2, box_w, box_h))
    parts.append(_text_center(cx, cy + 1, component.component_id, "label"))
    parts.append(_text_center(cx, cy + (38 if bend < 0 else -22), f"{component.kind} = {_display_value(component)}", "center"))


def _find_component_between(components: list[PreviewComponent], node_a: str, node_b: str) -> PreviewComponent | None:
    for component in components:
        if {component.node_a, component.node_b} == {node_a, node_b}:
            return component
    return None


def _is_reference_like(node: str, ports: tuple[Port, Port]) -> bool:
    return _is_reference_name(node) or node in {ports[0].negative_node, ports[1].negative_node}


def _is_reference_name(node: str) -> bool:
    return node.lower() in {"0", "gnd", "ground"}


def _line(x1: float, y1: float, x2: float, y2: float, class_name: str = "wire") -> str:
    return f'<path class="{class_name}" d="M {x1:g} {y1:g} L {x2:g} {y2:g}"/>'


def _rect(x: float, y: float, width: float, height: float) -> str:
    return f'<rect class="box" x="{x:g}" y="{y:g}" width="{width:g}" height="{height:g}" rx="1"/>'


def _circle(x: float, y: float, radius: float) -> str:
    return f'<circle class="node" cx="{x:g}" cy="{y:g}" r="{radius:g}"/>'


def _terminal(x: float, y: float) -> str:
    return f'<circle class="node" cx="{x:g}" cy="{y:g}" r="5"/>'


def _text(x: float, y: float, text: str, class_name: str) -> str:
    return f'<text class="{class_name}" x="{x:g}" y="{y:g}">{_escape_xml(str(text))}</text>'


def _text_center(x: float, y: float, text: str, class_name: str) -> str:
    return f'<text class="{class_name}" text-anchor="middle" x="{x:g}" y="{y:g}">{_escape_xml(str(text))}</text>'


def _arrow(x1: float, y1: float, x2: float, y2: float) -> str:
    direction = 1 if x2 >= x1 else -1
    head_x = x2
    return "\n".join(
        [
            _line(x1, y1, x2, y2, "thin"),
            f'<path class="thin" d="M {head_x:g} {y2:g} l {-8 * direction:g} -5 M {head_x:g} {y2:g} l {-8 * direction:g} 5"/>',
        ]
    )


def _voltage_arrow(x: float, y1: float, y2: float, label: str) -> str:
    return "\n".join(
        [
            _line(x, y2, x, y1, "thin"),
            f'<path class="thin" d="M {x:g} {y1:g} l -5 8 M {x:g} {y1:g} l 5 8"/>',
            _text(x + 7, (y1 + y2) / 2, label, "small"),
            _text(x + 5, y1 + 12, "+", "small"),
            _text(x + 5, y2 - 4, "-", "small"),
        ]
    )


def _escape_xml(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _component_payload(component: PreviewComponent) -> dict[str, object]:
    return {
        "line_number": component.line_number,
        "id": component.component_id,
        "kind": component.kind,
        "node_a": component.node_a,
        "node_b": component.node_b,
        "raw_value": component.raw_value,
        "parsed_value": sp.sstr(component.parsed_value) if component.parsed_value is not None else None,
    }


def _port_payload(port: Port) -> dict[str, str]:
    return {
        "id": port.id,
        "positive_node": port.positive_node,
        "negative_node": port.negative_node,
        "voltage_label": port.voltage_label,
        "current_label": port.current_label,
    }


def _collect_nodes(components: list[PreviewComponent], ports: tuple[Port, Port]) -> list[str]:
    values: set[str] = set()
    for component in components:
        values.add(component.node_a)
        values.add(component.node_b)
    for port in ports:
        values.add(port.positive_node)
        values.add(port.negative_node)
    return sorted(values, key=lambda node: (0 if node in {"0", "gnd", "GND"} else 1, node))


def _display_value(component: PreviewComponent) -> str:
    if component.parsed_value is None:
        return component.raw_value
    return sp.sstr(component.parsed_value)


def _strip_comment(line: str) -> str:
    stripped = line.strip()
    if stripped.startswith("*"):
        return ""
    return re.split(r"(?<!\\)[#;]", line, maxsplit=1)[0]


def _node_id(node: str) -> str:
    return f"node_{_safe_id(node)}"


def _safe_id(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", value)
    if not cleaned or cleaned[0].isdigit():
        cleaned = f"n_{cleaned}"
    return cleaned


def _label(value: str) -> str:
    return value.replace('"', "'").replace("|", "/")
