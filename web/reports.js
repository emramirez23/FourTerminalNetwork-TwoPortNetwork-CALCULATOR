import { formatMatrix } from "./matrix.js?v=20260517-acentos-ui";
import { formatNumber } from "./math-utils.js?v=20260517-acentos-ui";

export function generateReport({ netlist, preview, solution, conversion, association }) {
  const lines = [
    "# Simulador de cuadripolos",
    "",
    "## Netlist",
    "",
    "```text",
    netlist.trim() || "(sin netlist)",
    "```",
    "",
  ];

  if (preview) {
    lines.push("## Componentes detectados", "");
    lines.push("| Componente | Conexión | Valor |");
    lines.push("| --- | --- | --- |");
    if (preview.components.length === 0) {
      lines.push("| - | - | Sin componentes |");
    } else {
      for (const component of preview.components) {
        lines.push(`| ${component.id} | ${component.nodeA} - ${component.nodeB} | ${component.rawValue} |`);
      }
    }
    lines.push("");
  }

  if (solution) {
    lines.push("## Resolución MVP1", "");
    lines.push(`Matriz Z: ${formatMatrix(solution.z, "ohm")}`);
    lines.push("");
    lines.push(`Matriz Y: ${formatMatrix(solution.y, "S")}`);
    lines.push("");
    if (solution.derivedFamilies?.length) {
      lines.push("Matrices derivadas automáticamente:", "");
      for (const family of solution.derivedFamilies) {
        if (family.status === "ok") {
          lines.push(`- Matriz ${family.label}: ${formatMatrix(family.matrix, family.unit)}`);
        } else {
          lines.push(`- Matriz ${family.label}: ${family.message}`);
        }
      }
      lines.push("");
    }
    lines.push(`Reciprocidad por Z: ${solution.reciprocalZ ? "sí" : "no"}. Simetría por Z: ${solution.symmetricZ ? "sí" : "no"}.`);
    lines.push("");
  }

  if (conversion) {
    lines.push("## Conversión MVP2", "");
    lines.push(`${conversion.source} -> ${conversion.target}: ${formatMatrix(conversion.result)}`);
    lines.push("");
    lines.push(...conversion.conditions.map((condition) => `- ${condition}`));
    lines.push("");
  }

  if (association) {
    lines.push("## Asociación MVP3", "");
    lines.push(`${association.label} usando ${association.family}: ${formatMatrix(association.result)}`);
    lines.push("");
    lines.push(...association.steps.map((step) => `- ${step}`));
    lines.push("");
  }

  return lines.join("\n");
}

export function generateLatexReport({ netlist, solution, conversion, association }) {
  const lines = [
    "\\section*{Simulador de cuadripolos}",
    "\\subsection*{Netlist}",
    "\\begin{verbatim}",
    netlist.trim() || "(sin netlist)",
    "\\end{verbatim}",
  ];
  if (solution) {
    lines.push("\\subsection*{Parámetros calculados}");
    lines.push(`\\[ Z = ${matrixToLatex(solution.z)}\\ \\Omega \\]`);
    lines.push(`\\[ Y = ${matrixToLatex(solution.y)}\\ S \\]`);
    for (const family of solution.derivedFamilies || []) {
      if (family.status === "ok") {
        lines.push(`\\[ ${latexFamilyLabel(family.label)} = ${matrixToLatex(family.matrix)} \\]`);
      } else {
        lines.push(`% ${family.label}: ${family.message}`);
      }
    }
  }
  if (conversion) {
    lines.push("\\subsection*{Conversión}");
    lines.push(`\\[ ${conversion.source} \\rightarrow ${conversion.target}: ${matrixToLatex(conversion.result)} \\]`);
  }
  if (association) {
    lines.push("\\subsection*{Asociación}");
    lines.push(`\\[ ${association.family}_{eq} = ${matrixToLatex(association.result)} \\]`);
  }
  return lines.join("\n");
}

function matrixToLatex(matrix) {
  return `\\begin{bmatrix}${formatNumber(matrix[0][0])} & ${formatNumber(matrix[0][1])}\\\\${formatNumber(matrix[1][0])} & ${formatNumber(matrix[1][1])}\\end{bmatrix}`;
}

function latexFamilyLabel(label) {
  return String(label).replace("Gamma / ABCD", "\\Gamma");
}
