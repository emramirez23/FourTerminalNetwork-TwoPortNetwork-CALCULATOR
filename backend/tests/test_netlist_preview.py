from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.preview import build_netlist_preview


def test_preview_builds_mermaid_and_component_table() -> None:
    preview = build_netlist_preview("R1 1 n1 30\nR2 n1 0 40\nR3 n1 2 50")

    assert "<svg" in preview["svg"]
    assert "Diagrama esquematico" in preview["markdown"]
    assert "```mermaid" in preview["markdown"]
    assert "Convencion de bornes" in preview["markdown"]
    assert "R1<br/>R = 30" in preview["mermaid"]
    assert "| 1 | R1 | R | 1 - n1 | 30 | 30 |" in preview["markdown"]
    assert preview["warnings"] == []


def test_preview_accepts_incomplete_lines_while_typing() -> None:
    preview = build_netlist_preview("R1 1 n1 30\nR2 n1")

    assert len(preview["components"]) == 1
    assert "componente incompleto" in preview["warnings"][0]
    assert "R1" in preview["svg"]
    assert "camino a P2 incompleto" in preview["svg"]


def test_preview_endpoint_returns_live_markdown_payload() -> None:
    response = TestClient(app).post(
        "/preview/netlist",
        json={"netlist": "R1 1 n1 30\nR2 n1 0 40"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["components"][0]["id"] == "R1"
    assert payload["ports"][0]["positive_node"] == "1"
    assert "<svg" in payload["svg"]
    assert "flowchart LR" in payload["mermaid"]


def test_preview_page_is_served() -> None:
    response = TestClient(app).get("/netlist-preview")

    assert response.status_code == 200
    assert "Vista previa de netlist" in response.text
    assert "params.get(\"netlist\")" in response.text


TYPICAL_PREVIEW_CASES = [
    ("user_parallel_input_shunts", "R1 1 0 15\nR2 1 0 20", 2),
    ("single_series_between_ports", "R1 1 2 50", 1),
    ("single_input_shunt", "R1 1 0 15", 1),
    ("single_output_shunt", "R1 2 0 20", 1),
    ("quadripole_t", "R1 1 n1 30\nR2 n1 2 50\nR3 n1 0 40", 3),
    ("quadripole_pi", "R1 1 0 100\nR2 1 2 50\nR3 2 0 200", 3),
    (
        "pdf_ladder_example",
        "R1 1 n1 30\nR2 n1 0 40\nR3 n1 n2 50\nR4 n2 0 20\nR5 n2 2 10",
        5,
    ),
    (
        "three_section_ladder",
        "R1 1 n1 10\nR2 n1 0 100\nR3 n1 n2 20\nR4 n2 0 200\nR5 n2 n3 30\nR6 n3 0 300\nR7 n3 2 40",
        7,
    ),
    ("two_middle_parallel_shunts", "R1 1 n1 10\nR2 n1 2 20\nR3 n1 0 30\nR4 n1 0 40", 4),
    ("three_middle_parallel_shunts", "R1 1 n1 10\nR2 n1 2 20\nR3 n1 0 30\nR4 n1 0 40\nR5 n1 0 50", 5),
    ("three_input_parallel_shunts", "R1 1 0 10\nR2 1 0 20\nR3 1 0 30", 3),
    ("three_output_parallel_shunts", "R1 2 0 10\nR2 2 0 20\nR3 2 0 30", 3),
    ("input_and_output_shunts", "R1 1 0 10\nR2 2 0 20", 2),
    ("custom_ports_t", ".ports in ref out ref\nR1 in n1 10\nR2 n1 ref 20\nR3 n1 out 30", 3),
    ("symbolic_t", "Z1 1 n1 j*5\nZ2 n1 2 -j*3\nZ3 n1 0 Zc", 3),
    ("reactive_ladder", "L1 1 n1 L\nC1 n1 0 C\nZ1 n1 2 1/(s*C2)", 3),
    ("series_chain", "R1 1 n1 10\nR2 n1 n2 20\nR3 n2 2 30", 3),
    ("double_shunts_each_internal_node", "R1 1 n1 10\nR2 n1 n2 20\nR3 n2 2 30\nR4 n1 0 40\nR5 n1 0 50\nR6 n2 0 60\nR7 n2 0 70", 7),
    ("five_parallel_input_shunts_wide", "R1 1 0 10\nR2 1 0 20\nR3 1 0 30\nR4 1 0 40\nR5 1 0 50", 5),
    ("gnd_reference", "R1 1 n1 10\nR2 n1 gnd 20\nR3 n1 2 30", 3),
    ("bridged_ladder_from_tables", "R1 1 n1 10\nR2 n1 2 20\nR3 n1 0 30\nR4 1 2 40", 4),
    ("symmetric_x_lattice", ".ports 1 1p 2 2p\nZ1 1 2 Za\nZ2 1p 2p Za\nZ3 1 2p Zb\nZ4 1p 2 Zb", 4),
    ("apostrophe_terminal_names", ".ports 1 1' 2 2'\nR1 1 2 80\nR2 1' 2' 80\nR3 1 2' 120\nR4 1' 2 120", 4),
]


@pytest.mark.parametrize("repeat_index", range(5))
@pytest.mark.parametrize(("name", "netlist", "expected_boxes"), TYPICAL_PREVIEW_CASES)
def test_typical_preview_cases_render_without_component_overlap_five_times(
    name: str,
    netlist: str,
    expected_boxes: int,
    repeat_index: int,
) -> None:
    preview = build_netlist_preview(netlist)
    boxes = _component_boxes(preview["svg"])

    label = f"{name} pass {repeat_index + 1}"
    assert len(boxes) == expected_boxes, label
    assert not _overlapping_pairs(boxes), label
    assert not re.search(r'(?<![A-Za-z])nan(?![A-Za-z])', preview["svg"], flags=re.IGNORECASE)
    assert "None" not in preview["svg"]


def test_preview_expands_viewbox_for_large_parallel_groups() -> None:
    narrow = build_netlist_preview("R1 1 0 10")
    wide = build_netlist_preview("R1 1 0 10\nR2 1 0 20\nR3 1 0 30\nR4 1 0 40\nR5 1 0 50")

    assert _viewbox_width(wide["svg"]) > _viewbox_width(narrow["svg"])


def test_component_names_are_rendered_inside_component_boxes() -> None:
    preview = build_netlist_preview("R1 1 n1 30\nR2 n1 0 40\nR3 n1 2 50")
    svg = preview["svg"]

    boxes = _component_boxes(svg)
    labels = _component_labels(svg)
    assert {label for label, _, _ in labels} >= {"R1", "R2", "R3"}
    for label, x, y in labels:
        if label in {"R1", "R2", "R3"}:
            assert any(_point_inside_box(x, y, box) for box in boxes), label


def _component_boxes(svg: str) -> list[tuple[float, float, float, float]]:
    matches = re.findall(
        r'<rect class="box" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"',
        svg,
    )
    return [(float(x), float(y), float(width), float(height)) for x, y, width, height in matches]


def _overlapping_pairs(boxes: list[tuple[float, float, float, float]]) -> list[tuple[int, int]]:
    overlaps: list[tuple[int, int]] = []
    for left_index, left in enumerate(boxes):
        for right_index, right in enumerate(boxes[left_index + 1 :], start=left_index + 1):
            if _overlaps(left, right):
                overlaps.append((left_index, right_index))
    return overlaps


def _overlaps(left: tuple[float, float, float, float], right: tuple[float, float, float, float]) -> bool:
    left_x, left_y, left_width, left_height = left
    right_x, right_y, right_width, right_height = right
    horizontal = left_x < right_x + right_width and left_x + left_width > right_x
    vertical = left_y < right_y + right_height and left_y + left_height > right_y
    return horizontal and vertical


def _viewbox_width(svg: str) -> float:
    match = re.search(r'viewBox="0 0 ([0-9.]+) [0-9.]+"', svg)
    assert match is not None
    return float(match.group(1))


def _component_labels(svg: str) -> list[tuple[str, float, float]]:
    matches = re.findall(
        r'<text class="label" text-anchor="middle" x="([^"]+)" y="([^"]+)">([^<]+)</text>',
        svg,
    )
    return [(text, float(x), float(y)) for x, y, text in matches]


def _point_inside_box(x: float, y: float, box: tuple[float, float, float, float]) -> bool:
    box_x, box_y, box_width, box_height = box
    return box_x <= x <= box_x + box_width and box_y <= y <= box_y + box_height
