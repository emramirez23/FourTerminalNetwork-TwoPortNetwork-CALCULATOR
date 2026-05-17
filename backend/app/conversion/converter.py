from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import sympy as sp

from backend.app.explanation import matrix_payload, steps_payload


class ConversionError(ValueError):
    pass


@dataclass(frozen=True)
class MatrixConversion:
    source_family: str
    target_family: str
    input_matrix: sp.Matrix
    output_matrix: sp.Matrix
    conditions: tuple[str, ...]
    steps: list[dict[str, object]]

    def payload(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "source_family": self.source_family,
            "target_family": self.target_family,
            "input_matrix": matrix_payload(self.input_matrix),
            "matrix": matrix_payload(self.output_matrix),
            "conditions": list(self.conditions),
            "steps": steps_payload(self.steps),
        }


def convert_parameter_matrix(source_family: str, matrix: sp.Matrix, target_family: str) -> MatrixConversion:
    source = normalize_family(source_family)
    target = normalize_family(target_family)
    _validate_matrix(matrix)
    if source == target:
        return MatrixConversion(
            source,
            target,
            matrix,
            matrix,
            ("No conversion needed.",),
            [
                {
                    "title": "Matriz sin conversion",
                    "explanation": "La familia de origen coincide con la familia pedida.",
                    "equations": [sp.sstr(matrix)],
                }
            ],
        )

    if source == "Y" and target == "Gamma":
        return _y_to_gamma(matrix)

    z_matrix, to_z_conditions, to_z_steps = _to_z(source, matrix)
    target_matrix, from_z_conditions, from_z_steps = _from_z(z_matrix, target)
    return MatrixConversion(
        source,
        target,
        matrix,
        target_matrix,
        tuple(to_z_conditions + from_z_conditions),
        to_z_steps + from_z_steps,
    )


def normalize_family(family: str) -> str:
    normalized = family.strip().lower()
    aliases = {
        "z": "Z",
        "impedance": "Z",
        "impedancia": "Z",
        "y": "Y",
        "admittance": "Y",
        "admitancia": "Y",
        "h": "h",
        "hybrid": "h",
        "hibridos": "h",
        "g": "g",
        "gamma": "Gamma",
        "transmission": "Gamma",
        "transmision": "Gamma",
        "principal": "Gamma",
        "abcd": "Gamma",
    }
    try:
        return aliases[normalized]
    except KeyError as exc:
        raise ConversionError(f"Unsupported parameter family {family!r}.") from exc


def matrix_from_nested(values: list[list[object]]) -> sp.Matrix:
    if len(values) != 2 or any(len(row) != 2 for row in values):
        raise ConversionError("A parameter matrix must be 2x2.")
    parsed: list[list[sp.Expr]] = []
    for row in values:
        parsed.append([_parse_expr(value) for value in row])
    return sp.Matrix(parsed)


def conversion_error_payload(source_family: str, target_family: str, reason: str) -> dict[str, Any]:
    return {
        "status": "error",
        "source_family": source_family,
        "target_family": target_family,
        "reason": reason,
        "steps": [
            {
                "title": "Conversion no disponible",
                "explanation": reason,
                "equations": [],
            }
        ],
    }


def _to_z(source: str, matrix: sp.Matrix) -> tuple[sp.Matrix, list[str], list[dict[str, object]]]:
    if source == "Z":
        return matrix, [], [
            {
                "title": "Matriz Z de partida",
                "explanation": "La matriz de origen ya esta expresada como parametros de impedancia.",
                "equations": [sp.sstr(matrix)],
            }
        ]
    if source == "Y":
        y11, y12, y21, y22 = _entries(matrix)
        delta = sp.simplify(y11 * y22 - y12 * y21)
        _require_nonzero(delta, "DeltaY")
        z = sp.simplify((1 / delta) * sp.Matrix([[y22, -y12], [-y21, y11]]))
        return z, [f"DeltaY = {sp.sstr(delta)} != 0"], [
            _determinant_step("Conversion Y a Z", "DeltaY = y11*y22 - y12*y21", delta),
            {
                "title": "Formula aplicada",
                "explanation": "La matriz Z existe si la matriz Y es inversible.",
                "equations": ["Z = (1/DeltaY) * [[y22, -y12], [-y21, y11]]", f"Z = {sp.sstr(z)}"],
            },
        ]
    if source == "h":
        h11, h12, h21, h22 = _entries(matrix)
        delta = sp.simplify(h11 * h22 - h12 * h21)
        _require_nonzero(h22, "h22")
        z = sp.simplify(sp.Matrix([[delta / h22, h12 / h22], [-h21 / h22, 1 / h22]]))
        return z, [f"h22 = {sp.sstr(h22)} != 0"], [
            {
                "title": "Conversion h a Z",
                "explanation": "Se despeja V2 desde la segunda ecuacion h para volver a la forma V = Z I.",
                "equations": [
                    "Deltah = h11*h22 - h12*h21",
                    "Z = [[Deltah/h22, h12/h22], [-h21/h22, 1/h22]]",
                    f"Z = {sp.sstr(z)}",
                ],
            }
        ]
    if source == "g":
        g11, g12, g21, g22 = _entries(matrix)
        delta = sp.simplify(g11 * g22 - g12 * g21)
        _require_nonzero(g11, "g11")
        z = sp.simplify(sp.Matrix([[1 / g11, -g12 / g11], [g21 / g11, delta / g11]]))
        return z, [f"g11 = {sp.sstr(g11)} != 0"], [
            {
                "title": "Conversion g a Z",
                "explanation": "Se despeja V1 desde la primera ecuacion g para volver a la forma V = Z I.",
                "equations": [
                    "Deltag = g11*g22 - g12*g21",
                    "Z = [[1/g11, -g12/g11], [g21/g11, Deltag/g11]]",
                    f"Z = {sp.sstr(z)}",
                ],
            }
        ]
    if source == "Gamma":
        a, b, c, d = _entries(matrix)
        _require_nonzero(c, "C")
        z = sp.simplify(sp.Matrix([[a / c, (a * d - b * c) / c], [1 / c, d / c]]))
        return z, [f"C = {sp.sstr(c)} != 0"], [
            {
                "title": "Conversion Gamma a Z",
                "explanation": "Con la convencion V1 = A V2 - B I2 e I1 = C V2 - D I2, se despejan los parametros Z.",
                "equations": [
                    "Z = [[A/C, (A*D - B*C)/C], [1/C, D/C]]",
                    f"Z = {sp.sstr(z)}",
                ],
            }
        ]
    raise ConversionError(f"Cannot convert from {source} to Z.")


def _from_z(z: sp.Matrix, target: str) -> tuple[sp.Matrix, list[str], list[dict[str, object]]]:
    if target == "Z":
        return z, [], [
            {
                "title": "Matriz Z resultante",
                "explanation": "No se requiere un segundo pasaje.",
                "equations": [sp.sstr(z)],
            }
        ]
    z11, z12, z21, z22 = _entries(z)
    delta = sp.simplify(z11 * z22 - z12 * z21)
    if target == "Y":
        _require_nonzero(delta, "DeltaZ")
        y = sp.simplify((1 / delta) * sp.Matrix([[z22, -z12], [-z21, z11]]))
        return y, [f"DeltaZ = {sp.sstr(delta)} != 0"], [
            _determinant_step("Conversion Z a Y", "DeltaZ = z11*z22 - z12*z21", delta),
            {
                "title": "Formula aplicada",
                "explanation": "La matriz Y es la inversa de la matriz Z cuando el determinante no se anula.",
                "equations": ["Y = (1/DeltaZ) * [[z22, -z12], [-z21, z11]]", f"Y = {sp.sstr(y)}"],
            },
        ]
    if target == "h":
        _require_nonzero(z22, "z22")
        h = sp.simplify(sp.Matrix([[delta / z22, z12 / z22], [-z21 / z22, 1 / z22]]))
        return h, [f"z22 = {sp.sstr(z22)} != 0"], [
            _determinant_step("Conversion Z a h", "DeltaZ = z11*z22 - z12*z21", delta),
            {
                "title": "Formula aplicada",
                "explanation": "Se despeja I2 para escribir V1 e I2 en funcion de I1 y V2.",
                "equations": ["h = [[DeltaZ/z22, z12/z22], [-z21/z22, 1/z22]]", f"h = {sp.sstr(h)}"],
            },
        ]
    if target == "g":
        _require_nonzero(z11, "z11")
        g = sp.simplify(sp.Matrix([[1 / z11, -z12 / z11], [z21 / z11, delta / z11]]))
        return g, [f"z11 = {sp.sstr(z11)} != 0"], [
            _determinant_step("Conversion Z a g", "DeltaZ = z11*z22 - z12*z21", delta),
            {
                "title": "Formula aplicada",
                "explanation": "Se despeja I1 para escribir I1 y V2 en funcion de V1 e I2.",
                "equations": ["g = [[1/z11, -z12/z11], [z21/z11, DeltaZ/z11]]", f"g = {sp.sstr(g)}"],
            },
        ]
    if target == "Gamma":
        _require_nonzero(z21, "z21")
        gamma = sp.simplify(sp.Matrix([[z11 / z21, delta / z21], [1 / z21, z22 / z21]]))
        return gamma, [f"z21 = {sp.sstr(z21)} != 0"], [
            _determinant_step("Conversion Z a Gamma", "DeltaZ = z11*z22 - z12*z21", delta),
            {
                "title": "Formula aplicada",
                "explanation": "Se usa la convencion del apunte: V1 = A V2 - B I2 e I1 = C V2 - D I2.",
                "equations": ["Gamma = [[z11/z21, DeltaZ/z21], [1/z21, z22/z21]]", f"Gamma = {sp.sstr(gamma)}"],
            },
        ]
    raise ConversionError(f"Cannot convert Z to {target}.")


def _y_to_gamma(matrix: sp.Matrix) -> MatrixConversion:
    y11, y12, y21, y22 = _entries(matrix)
    delta = sp.simplify(y11 * y22 - y12 * y21)
    _require_nonzero(y21, "y21")
    gamma = sp.simplify(sp.Matrix([[-y22 / y21, -1 / y21], [-delta / y21, -y11 / y21]]))
    return MatrixConversion(
        "Y",
        "Gamma",
        matrix,
        gamma,
        (f"y21 = {sp.sstr(y21)} != 0",),
        [
            _determinant_step("Conversion Y a Gamma", "DeltaY = y11*y22 - y12*y21", delta),
            {
                "title": "Formula aplicada",
                "explanation": "Se despeja V1 e I1 desde las ecuaciones de admitancia usando la convencion principal del apunte.",
                "equations": ["Gamma = [[-y22/y21, -1/y21], [-DeltaY/y21, -y11/y21]]", f"Gamma = {sp.sstr(gamma)}"],
            },
        ],
    )


def _entries(matrix: sp.Matrix) -> tuple[sp.Expr, sp.Expr, sp.Expr, sp.Expr]:
    return (
        sp.simplify(matrix[0, 0]),
        sp.simplify(matrix[0, 1]),
        sp.simplify(matrix[1, 0]),
        sp.simplify(matrix[1, 1]),
    )


def _determinant_step(title: str, formula: str, determinant: sp.Expr) -> dict[str, object]:
    return {
        "title": title,
        "explanation": "Antes de convertir se verifica la condicion de existencia correspondiente.",
        "equations": [formula, f"Resultado = {sp.sstr(determinant)}"],
        "determinant": determinant,
    }


def _require_nonzero(value: sp.Expr, name: str) -> None:
    simplified = sp.simplify(value)
    if simplified == 0:
        raise ConversionError(f"The conversion is not possible because {name} = 0.")


def _validate_matrix(matrix: sp.Matrix) -> None:
    if matrix.shape != (2, 2):
        raise ConversionError("A parameter matrix must be 2x2.")


def _parse_expr(value: object) -> sp.Expr:
    if isinstance(value, int):
        return sp.Integer(value)
    if isinstance(value, float):
        return sp.Rational(str(value))
    normalized = (
        str(value)
        .strip()
        .replace(",", ".")
        .replace("^", "**")
        .replace("omega", "w")
        .replace("ω", "w")
        .replace("Ω", "w")
    )
    normalized = _expand_metric_suffixes(normalized)
    locals_map = {"j": sp.I, "J": sp.I, "I": sp.I, "s": sp.Symbol("s"), "w": sp.Symbol("w"), "pi": sp.pi}
    try:
        return sp.sympify(normalized, locals=locals_map)
    except (sp.SympifyError, SyntaxError) as exc:
        raise ConversionError(f"Cannot parse matrix value {value!r}.") from exc


def _expand_metric_suffixes(value: str) -> str:
    suffixes = {
        "p": sp.Rational(1, 10**12),
        "P": sp.Rational(1, 10**12),
        "n": sp.Rational(1, 10**9),
        "N": sp.Rational(1, 10**9),
        "u": sp.Rational(1, 10**6),
        "U": sp.Rational(1, 10**6),
        "m": sp.Rational(1, 1000),
        "k": sp.Integer(1000),
        "K": sp.Integer(1000),
        "M": sp.Integer(1_000_000),
        "meg": sp.Integer(1_000_000),
        "Meg": sp.Integer(1_000_000),
        "MEG": sp.Integer(1_000_000),
        "g": sp.Integer(1_000_000_000),
        "G": sp.Integer(1_000_000_000),
    }

    def replace(match: re.Match[str]) -> str:
        number, suffix = match.groups()
        factor = suffixes["meg"] if suffix.lower() == "meg" else suffixes.get(suffix)
        if factor is None:
            return match.group(0)
        return f"({number}*{sp.sstr(factor)})"

    return re.sub(r"(?<![A-Za-z_])([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)([a-zA-Z]+)\b", replace, value)
