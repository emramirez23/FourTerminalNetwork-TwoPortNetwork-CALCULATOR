export const DEFAULT_NETLIST = [
  "R1 1 n1 30",
  "R2 n1 0 40",
  "R3 n1 n2 50",
  "R4 n2 0 20",
  "R5 n2 2 10",
].join("\n");

export const EXAMPLES = {
  escalera: {
    label: "Escalera resistiva del apunte",
    netlist: DEFAULT_NETLIST,
  },
  t: {
    label: "Cuadripolo T",
    netlist: ["R1 1 n1 25", "R2 n1 2 35", "R3 n1 0 50"].join("\n"),
  },
  pi: {
    label: "Cuadripolo pi",
    netlist: ["R1 1 0 100", "R2 1 2 40", "R3 2 0 80"].join("\n"),
  },
  serie: {
    label: "Impedancia serie Zs",
    netlist: "R1 1 2 60",
  },
  derivacion: {
    label: "Impedancia en derivacion Zp",
    netlist: "R1 1 0 45",
  },
  dobleParalelo: {
    label: "Dos derivaciones en paralelo",
    netlist: ["R1 1 0 15", "R2 1 0 20"].join("\n"),
  },
  x: {
    label: "Cuadripolo X / lattice",
    netlist: [".ports 1 1p 2 2p", "R1 1 2 120", "R2 1p 2p 120", "R3 1 2p 300", "R4 1p 2 300"].join("\n"),
  },
  inferior: {
    label: "Rama inferior con nodo b1",
    netlist: [".ports 1 0 2 b2", "R1 1 n1 30", "R2 n1 2 40", "R3 0 b1 15", "R4 b1 b2 25", "R5 n1 b1 50"].join("\n"),
  },
};

const SUPPORTED_COMPONENTS = new Set(["R", "Z", "Y", "L", "C"]);
const ANALYSIS_COMPONENTS = new Set(["R", "Z", "Y"]);
const AUTO_DERIVED_FAMILIES = [
  { target: "h", label: "h", unit: "" },
  { target: "g", label: "g", unit: "" },
  { target: "Gamma", label: "Gamma / ABCD", unit: "" },
];
const EPS = 1e-10;

export function parseNetlist(text) {
  const ports = {
    p1: { id: "P1", positive: "1", negative: "0", voltage: "V1", current: "I1" },
    p2: { id: "P2", positive: "2", negative: "0", voltage: "V2", current: "I2" },
  };
  const components = [];
  const warnings = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripComment(rawLine).trim();
    if (!line) return;
    const tokens = line.split(/\s+/);
    const directive = tokens[0].toLowerCase();

    if (directive === ".port") {
      if (tokens.length < 4) {
        warnings.push(`Linea ${lineNumber}: .port incompleto. Use .port P1 nodo+ nodo-.`);
        return;
      }
      const portId = tokens[1].toUpperCase();
      if (portId === "P1") {
        ports.p1 = { ...ports.p1, positive: tokens[2], negative: tokens[3] };
      } else if (portId === "P2") {
        ports.p2 = { ...ports.p2, positive: tokens[2], negative: tokens[3] };
      } else {
        warnings.push(`Linea ${lineNumber}: puerto desconocido ${tokens[1]}.`);
      }
      return;
    }

    if (directive === ".ports") {
      if (tokens.length < 5) {
        warnings.push(`Linea ${lineNumber}: .ports incompleto. Use .ports p1+ p1- p2+ p2-.`);
        return;
      }
      ports.p1 = { ...ports.p1, positive: tokens[1], negative: tokens[2] };
      ports.p2 = { ...ports.p2, positive: tokens[3], negative: tokens[4] };
      return;
    }

    if (tokens.length < 4) {
      warnings.push(`Linea ${lineNumber}: componente incompleto. Formato: R1 nodoA nodoB valor.`);
      return;
    }

    const [id, nodeA, nodeB, rawValue] = tokens;
    const kind = id[0]?.toUpperCase();
    if (!SUPPORTED_COMPONENTS.has(kind)) {
      warnings.push(`Linea ${lineNumber}: tipo ${kind || "?"} no soportado. Use R, Z, Y, L o C.`);
      return;
    }
    if (tokens.length > 4) {
      warnings.push(`Linea ${lineNumber}: se ignoran tokens extra: ${tokens.slice(4).join(" ")}.`);
    }

    const numeric = parseScalar(rawValue);
    components.push({
      id,
      kind,
      nodeA,
      nodeB,
      rawValue,
      numeric,
      lineNumber,
    });
  });

  const portNodes = [ports.p1.positive, ports.p1.negative, ports.p2.positive, ports.p2.negative];
  const availableNodes = new Set(components.flatMap((component) => [component.nodeA, component.nodeB]));
  for (const node of portNodes) {
    if (!isGround(node) && components.length > 0 && !availableNodes.has(node)) {
      warnings.push(`El borne ${node} no aparece conectado a ningun componente.`);
    }
  }

  return { ports, components, warnings };
}

export function buildPreview(text) {
  const parsed = parseNetlist(text);
  const svg = buildSchematicSvg(parsed);
  const markdown = buildMarkdown(parsed, svg);
  return {
    ...parsed,
    svg,
    markdown,
  };
}

export function solveTwoPort(text) {
  const parsed = parseNetlist(text);
  const warnings = [...parsed.warnings];
  const unsupported = parsed.components.filter((component) => !ANALYSIS_COMPONENTS.has(component.kind));
  if (unsupported.length > 0) {
    warnings.push("El solucionador numerico del navegador calcula R/Z/Y. L y C quedan para el motor simbolico Python local.");
  }
  for (const component of parsed.components) {
    if (ANALYSIS_COMPONENTS.has(component.kind) && !Number.isFinite(component.numeric)) {
      throw new Error(`El componente ${component.id} necesita un valor numerico real para resolver en el navegador.`);
    }
  }

  const zCol1 = solveWithCurrents(parsed, 1, 0);
  const zCol2 = solveWithCurrents(parsed, 0, 1);
  const yCol1 = solveWithVoltages(parsed, 1, 0);
  const yCol2 = solveWithVoltages(parsed, 0, 1);

  const z = [
    [zCol1.v1, zCol2.v1],
    [zCol1.v2, zCol2.v2],
  ];
  const y = [
    [yCol1.i1, yCol2.i1],
    [yCol1.i2, yCol2.i2],
  ];
  const derivedFamilies = deriveFamiliesFromZ(z);

  const steps = [
    {
      title: "Parametros Z por definicion",
      text: "Para obtener la primera columna se impone I1 = 1 A e I2 = 0 A, equivalente a dejar abierto el puerto 2. Para la segunda columna se impone I1 = 0 A e I2 = 1 A.",
      equations: [`Z = ${formatMatrix(z, "ohm")}`],
    },
    {
      title: "Parametros Y por definicion",
      text: "Para obtener la primera columna se impone V1 = 1 V y V2 = 0 V, es decir puerto 2 en cortocircuito. Para la segunda columna se impone V1 = 0 V y V2 = 1 V.",
      equations: [`Y = ${formatMatrix(y, "S")}`],
    },
    {
      title: "Parametros derivados automaticos",
      text: "Desde la matriz Z calculada se obtienen automaticamente las familias h, g y Gamma/ABCD cuando cumplen sus condiciones de existencia.",
      equations: derivedFamilies.map((family) => (
        family.status === "ok"
          ? `${family.label} = ${formatMatrix(family.matrix, family.unit)}`
          : `${family.label}: ${family.message}`
      )),
    },
    {
      title: "Verificacion didactica",
      text: "Si z12 = z21 o y12 = y21, el cuadripolo pasivo bilateral queda verificado como reciproco dentro de la tolerancia numerica.",
      equations: [
        `z12 - z21 = ${formatNumber(z[0][1] - z[1][0])}`,
        `y12 - y21 = ${formatNumber(y[0][1] - y[1][0])}`,
      ],
    },
  ];

  return {
    z,
    y,
    derivedFamilies,
    steps,
    warnings,
    reciprocalZ: Math.abs(z[0][1] - z[1][0]) < 1e-7,
    reciprocalY: Math.abs(y[0][1] - y[1][0]) < 1e-7,
    symmetricZ: Math.abs(z[0][0] - z[1][1]) < 1e-7,
    symmetricY: Math.abs(y[0][0] - y[1][1]) < 1e-7,
  };
}

function deriveFamiliesFromZ(z) {
  return AUTO_DERIVED_FAMILIES.map((family) => {
    try {
      const conversion = convertMatrix("Z", family.target, z);
      return {
        ...family,
        status: "ok",
        matrix: conversion.result,
        conditions: conversion.conditions,
      };
    } catch (error) {
      return {
        ...family,
        status: "error",
        message: error.message,
      };
    }
  });
}

export function convertMatrix(sourceFamily, targetFamily, matrix) {
  const source = normalizeFamily(sourceFamily);
  const target = normalizeFamily(targetFamily);
  validateMatrix(matrix);
  if (source === target) {
    return {
      source,
      target,
      result: cloneMatrix(matrix),
      conditions: ["No hay conversion: la familia de origen coincide con la de destino."],
      steps: ["La matriz se conserva sin cambios."],
    };
  }
  if (source === "Y" && target === "Gamma") {
    const [[y11, y12], [y21, y22]] = matrix;
    requireNonZero(y21, "y21");
    const delta = determinant(matrix);
    return {
      source,
      target,
      result: [
        [-y22 / y21, -1 / y21],
        [-delta / y21, -y11 / y21],
      ],
      conditions: [`y21 = ${formatNumber(y21)} debe ser distinto de cero.`],
      steps: ["Conversion directa Y -> gamma con la convencion V1 = A V2 - B I2 e I1 = C V2 - D I2."],
    };
  }
  const toZ = matrixToZ(source, matrix);
  const fromZ = zToFamily(target, toZ.result);
  return {
    source,
    target,
    result: fromZ.result,
    conditions: [...toZ.conditions, ...fromZ.conditions],
    steps: [...toZ.steps, ...fromZ.steps],
  };
}

export function associateTwoPorts(type, matrixA, matrixB, bruneValues = []) {
  validateMatrix(matrixA);
  validateMatrix(matrixB);
  const association = associationInfo(type);
  const result = association.operation === "multiply" ? multiplyMatrices(matrixA, matrixB) : addMatrices(matrixA, matrixB);
  const brune = evaluateBrune(bruneValues);
  const steps = [
    `Tipo de asociacion: ${association.label}.`,
    `Familia conveniente: ${association.family}.`,
    association.operation === "multiply"
      ? "En cascada se multiplican matrices gamma respetando el orden de conexion."
      : `Para esta asociacion ideal se suman directamente los parametros ${association.family}.`,
    brune.message,
  ];
  return {
    family: association.family,
    label: association.label,
    result,
    operation: association.operation,
    steps,
    brune,
  };
}

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
    lines.push("| Componente | Conexion | Valor |");
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
    lines.push("## Resolucion MVP1", "");
    lines.push(`Matriz Z: ${formatMatrix(solution.z, "ohm")}`);
    lines.push("");
    lines.push(`Matriz Y: ${formatMatrix(solution.y, "S")}`);
    lines.push("");
    if (solution.derivedFamilies?.length) {
      lines.push("Matrices derivadas automaticamente:");
      lines.push("");
      for (const family of solution.derivedFamilies) {
        if (family.status === "ok") {
          lines.push(`- Matriz ${family.label}: ${formatMatrix(family.matrix, family.unit)}`);
        } else {
          lines.push(`- Matriz ${family.label}: ${family.message}`);
        }
      }
      lines.push("");
    }
    lines.push(`Reciprocidad por Z: ${solution.reciprocalZ ? "si" : "no"}. Simetria por Z: ${solution.symmetricZ ? "si" : "no"}.`);
    lines.push("");
  }

  if (conversion) {
    lines.push("## Conversion MVP2", "");
    lines.push(`${conversion.source} -> ${conversion.target}: ${formatMatrix(conversion.result)}`);
    lines.push("");
    lines.push(...conversion.conditions.map((condition) => `- ${condition}`));
    lines.push("");
  }

  if (association) {
    lines.push("## Asociacion MVP3", "");
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
    lines.push("\\subsection*{Parametros calculados}");
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
    lines.push("\\subsection*{Conversion}");
    lines.push(`\\[ ${conversion.source} \\rightarrow ${conversion.target}: ${matrixToLatex(conversion.result)} \\]`);
  }
  if (association) {
    lines.push("\\subsection*{Asociacion}");
    lines.push(`\\[ ${association.family}_{eq} = ${matrixToLatex(association.result)} \\]`);
  }
  return lines.join("\n");
}

export function parseMatrixText(text) {
  const clean = text
    .replace(/\[/g, " ")
    .replace(/\]/g, " ")
    .replace(/;/g, "\n")
    .trim();
  const rows = clean.split(/\n+/).map((row) => row.trim()).filter(Boolean);
  if (rows.length !== 2) {
    throw new Error("La matriz debe tener dos filas. Puede escribirse como 'a b; c d'.");
  }
  const matrix = rows.map((row) => row.split(/[,\s]+/).filter(Boolean).map(parseScalar));
  validateMatrix(matrix);
  return matrix;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return "indef.";
  if (Math.abs(value) < EPS) return "0";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return Number(value.toFixed(6)).toString();
}

export function formatMatrix(matrix, unit = "") {
  const suffix = unit ? ` ${unit}` : "";
  return `[[${formatNumber(matrix[0][0])}, ${formatNumber(matrix[0][1])}], [${formatNumber(matrix[1][0])}, ${formatNumber(matrix[1][1])}]]${suffix}`;
}

function buildMarkdown(parsed, svg) {
  const lines = [
    "# Vista previa del netlist",
    "",
    "## Diagrama SVG",
    "",
    "```svg",
    svg,
    "```",
    "",
    "## Puertos",
    "",
    "| Puerto | Tension | Corriente | Bornes |",
    "| --- | --- | --- | --- |",
    `| P1 | V1 | I1 | ${parsed.ports.p1.positive} - ${parsed.ports.p1.negative} |`,
    `| P2 | V2 | I2 | ${parsed.ports.p2.positive} - ${parsed.ports.p2.negative} |`,
    "",
    "## Componentes",
    "",
    "| Linea | Componente | Tipo | Conexion | Valor |",
    "| --- | --- | --- | --- | --- |",
  ];
  if (parsed.components.length === 0) {
    lines.push("| - | - | - | - | Sin componentes completos |");
  } else {
    for (const component of parsed.components) {
      lines.push(`| ${component.lineNumber} | ${component.id} | ${component.kind} | ${component.nodeA} - ${component.nodeB} | ${component.rawValue} |`);
    }
  }
  lines.push("", "## Advertencias", "");
  if (parsed.warnings.length === 0) {
    lines.push("- Sin advertencias.");
  } else {
    for (const warning of parsed.warnings) lines.push(`- ${warning}`);
  }
  return lines.join("\n");
}

function buildSchematicSvg(parsed) {
  if (isLatticeCandidate(parsed)) return buildLatticeSvg(parsed);

  const bottomPath = findBottomPath(parsed);
  if (bottomPath?.components.length) return buildDualRailSchematicSvg(parsed, bottomPath);

  const { ports, components } = parsed;
  const path = findTopPath(parsed) || findLongestChain(parsed, ports.p1.positive);
  const pathComplete = Boolean(path && path.nodes.at(-1) === ports.p2.positive);
  const pathNodes = path?.nodes?.length ? path.nodes : [ports.p1.positive];
  const seriesIds = new Set(path?.components.map((component) => component.id) || []);
  const pathNodeSet = new Set(pathNodes);
  const shunts = components.filter((component) => {
    if (seriesIds.has(component.id)) return false;
    const aOnPath = pathNodeSet.has(component.nodeA);
    const bOnPath = pathNodeSet.has(component.nodeB);
    return (aOnPath && isReferenceNode(component.nodeB, parsed)) || (bOnPath && isReferenceNode(component.nodeA, parsed));
  });
  const shuntIds = new Set(shunts.map((component) => component.id));
  const topBridges = components.filter((component) => {
    if (seriesIds.has(component.id) || shuntIds.has(component.id)) return false;
    return pathNodeSet.has(component.nodeA) && pathNodeSet.has(component.nodeB);
  });
  const otherComponents = components.filter((component) => !seriesIds.has(component.id) && !shuntIds.has(component.id) && !topBridges.some((bridge) => bridge.id === component.id));
  const shuntsByNode = groupBy(shunts, (component) => (pathNodeSet.has(component.nodeA) ? component.nodeA : component.nodeB));

  const leftTerminalX = 60;
  const leftNodeX = 150;
  const topOverflow = upperBridgeOverflow(topBridges.length);
  const topY = 148 + topOverflow;
  const bottomY = 340 + topOverflow;
  const segmentWidths = pathNodes.slice(0, -1).map((node, index) => {
    const nextNode = pathNodes[index + 1];
    const branchCount = Math.max(shuntsByNode.get(node)?.length || 0, shuntsByNode.get(nextNode)?.length || 0);
    return 150 + branchCount * 34;
  });
  const nodeX = new Map();
  nodeX.set(pathNodes[0], leftNodeX);
  for (let i = 1; i < pathNodes.length; i += 1) {
    nodeX.set(pathNodes[i], nodeX.get(pathNodes[i - 1]) + segmentWidths[i - 1]);
  }
  const lastNodeX = nodeX.get(pathNodes.at(-1)) || leftNodeX;
  const rightTerminalX = Math.max(900, lastNodeX + 170 + topBridges.length * 25);
  const width = rightTerminalX + 70;
  const height = Math.max(430, bottomY + 74 + otherComponents.length * 26);
  const parts = svgStart(width, height, "Esquema de cuadripolo");

  parts.push(line(leftTerminalX, topY, leftNodeX, topY));
  parts.push(line(leftTerminalX, bottomY, rightTerminalX, bottomY));
  parts.push(line(lastNodeX, topY, rightTerminalX, topY, pathComplete ? "wire" : "dash"));
  parts.push(terminal(leftTerminalX, topY), terminal(leftTerminalX, bottomY), terminal(rightTerminalX, topY), terminal(rightTerminalX, bottomY));
  parts.push(text(28, topY - 30, "1", "port"), text(27, bottomY + 32, "1'", "port"));
  parts.push(text(rightTerminalX + 20, topY - 30, "2", "port"), text(rightTerminalX + 20, bottomY + 32, "2'", "port"));
  parts.push(arrow(leftTerminalX + 6, topY - 38, leftTerminalX + 88, topY - 38), text(leftTerminalX + 42, topY - 54, "I1", "small"));
  parts.push(arrow(rightTerminalX - 6, topY - 38, rightTerminalX - 88, topY - 38), text(rightTerminalX - 48, topY - 54, "I2", "small"));
  parts.push(voltageArrow(leftTerminalX - 22, topY + 4, bottomY - 4, "V1"));
  parts.push(voltageArrow(rightTerminalX + 22, topY + 4, bottomY - 4, "V2"));

  pathNodes.forEach((node) => {
    const x = nodeX.get(node);
    parts.push(nodeDot(x, topY), text(x, topY + 30, node, "nodeLabel"));
  });

  for (const component of path?.components || []) {
    const x1 = nodeX.get(component.nodeA);
    const x2 = nodeX.get(component.nodeB);
    if (x1 === undefined || x2 === undefined) continue;
    parts.push(horizontalComponent(Math.min(x1, x2), Math.max(x1, x2), topY, component));
  }

  for (const [node, nodeShunts] of shuntsByNode.entries()) {
    const anchorX = nodeX.get(node);
    if (anchorX === undefined) continue;
    nodeShunts.forEach((component, index) => {
      const offset = (index - (nodeShunts.length - 1) / 2) * 62;
      parts.push(verticalComponent(anchorX + offset, topY, bottomY, component, anchorX));
    });
  }

  topBridges.forEach((component, index) => {
    const x1 = nodeX.get(component.nodeA);
    const x2 = nodeX.get(component.nodeB);
    if (x1 === undefined || x2 === undefined) return;
    const y = topY - 78 - index * 56;
    parts.push(line(x1, topY, x1, y), line(x2, topY, x2, y));
    parts.push(horizontalComponent(Math.min(x1, x2), Math.max(x1, x2), y, component));
  });

  if (!pathComplete) {
    parts.push(text((lastNodeX + rightTerminalX) / 2, topY - 26, "camino a P2 incompleto", "warnCenter"));
  }

  otherComponents.forEach((component, index) => {
    const y = bottomY + 56 + index * 26;
    parts.push(text(150, y, `${component.id}: ${component.nodeA} - ${component.nodeB} = ${component.rawValue}`, "small"));
  });
  if (components.length === 0) {
    parts.push(text(width / 2, 210, "Escribi componentes para ver el cuadripolo", "warnCenter"));
  }
  parts.push("</svg>");
  return parts.join("");
}

function buildDualRailSchematicSvg(parsed, bottomPath) {
  const { ports, components } = parsed;
  const topPath = findTopPath(parsed) || findLongestChain(parsed, ports.p1.positive);
  const topComplete = Boolean(topPath && topPath.nodes.at(-1) === ports.p2.positive);
  const topNodes = topPath?.nodes?.length ? topPath.nodes : [ports.p1.positive];
  const bottomNodes = bottomPath.nodes;
  const topIds = new Set(topPath?.components.map((component) => component.id) || []);
  const bottomIds = new Set(bottomPath.components.map((component) => component.id));
  const topNodeSet = new Set(topNodes);
  const bottomNodeSet = new Set(bottomNodes);
  const railIds = new Set([...topIds, ...bottomIds]);

  const railLinks = components.filter((component) => {
    if (railIds.has(component.id)) return false;
    const aTop = topNodeSet.has(component.nodeA);
    const bTop = topNodeSet.has(component.nodeB);
    const aBottom = bottomNodeSet.has(component.nodeA);
    const bBottom = bottomNodeSet.has(component.nodeB);
    return (aTop && bBottom) || (bTop && aBottom);
  });
  const linkIds = new Set(railLinks.map((component) => component.id));
  const topBridges = components.filter((component) => {
    if (railIds.has(component.id) || linkIds.has(component.id)) return false;
    return topNodeSet.has(component.nodeA) && topNodeSet.has(component.nodeB);
  });
  const topBridgeIds = new Set(topBridges.map((component) => component.id));
  const bottomBridges = components.filter((component) => {
    if (railIds.has(component.id) || linkIds.has(component.id) || topBridgeIds.has(component.id)) return false;
    return bottomNodeSet.has(component.nodeA) && bottomNodeSet.has(component.nodeB);
  });
  const bottomBridgeIds = new Set(bottomBridges.map((component) => component.id));
  const otherComponents = components.filter((component) => (
    !railIds.has(component.id)
    && !linkIds.has(component.id)
    && !topBridgeIds.has(component.id)
    && !bottomBridgeIds.has(component.id)
  ));

  const leftTerminalX = 60;
  const leftNodeX = 150;
  const topOverflow = upperBridgeOverflow(topBridges.length);
  const topY = 148 + topOverflow;
  const bottomY = 340 + topOverflow;
  const railSegments = Math.max(topNodes.length - 1, bottomNodes.length - 1, 1);
  const span = railSegments * 155 + Math.max(0, railLinks.length - 1) * 22;
  const rightNodeX = leftNodeX + span;
  const nodeX = new Map();
  assignRailNodePositions(nodeX, topNodes, leftNodeX, rightNodeX);
  assignRailNodePositions(nodeX, bottomNodes, leftNodeX, rightNodeX);

  const lastTopX = nodeX.get(topNodes.at(-1)) || leftNodeX;
  const lastBottomX = nodeX.get(bottomNodes.at(-1)) || leftNodeX;
  const rightTerminalX = Math.max(900, rightNodeX + 170 + topBridges.length * 25 + bottomBridges.length * 25);
  const width = rightTerminalX + 70;
  const bottomBridgeClearance = bottomBridges.length > 0 ? 140 + (bottomBridges.length - 1) * 56 : 74;
  const otherClearance = 74 + bottomBridges.length * 56 + otherComponents.length * 26;
  const height = Math.max(430, bottomY + Math.max(bottomBridgeClearance, otherClearance));
  const parts = svgStart(width, height, "Esquema de cuadripolo con rama inferior");

  parts.push(line(leftTerminalX, topY, nodeX.get(topNodes[0]) || leftNodeX, topY));
  parts.push(line(leftTerminalX, bottomY, nodeX.get(bottomNodes[0]) || leftNodeX, bottomY));
  parts.push(line(lastTopX, topY, rightTerminalX, topY, topComplete ? "wire" : "dash"));
  parts.push(line(lastBottomX, bottomY, rightTerminalX, bottomY));
  parts.push(terminal(leftTerminalX, topY), terminal(leftTerminalX, bottomY), terminal(rightTerminalX, topY), terminal(rightTerminalX, bottomY));
  parts.push(text(28, topY - 30, "1", "port"), text(27, bottomY + 32, "1'", "port"));
  parts.push(text(rightTerminalX + 20, topY - 30, "2", "port"), text(rightTerminalX + 20, bottomY + 32, "2'", "port"));
  parts.push(arrow(leftTerminalX + 6, topY - 38, leftTerminalX + 88, topY - 38), text(leftTerminalX + 42, topY - 54, "I1", "small"));
  parts.push(arrow(rightTerminalX - 6, topY - 38, rightTerminalX - 88, topY - 38), text(rightTerminalX - 48, topY - 54, "I2", "small"));
  parts.push(voltageArrow(leftTerminalX - 22, topY + 4, bottomY - 4, "V1"));
  parts.push(voltageArrow(rightTerminalX + 22, topY + 4, bottomY - 4, "V2"));

  topNodes.forEach((node) => {
    const x = nodeX.get(node);
    parts.push(nodeDot(x, topY), text(x, topY + 30, node, "nodeLabel"));
  });
  bottomNodes.forEach((node) => {
    const x = nodeX.get(node);
    parts.push(nodeDot(x, bottomY), text(x, bottomY + 30, node, "nodeLabel"));
  });

  for (const component of topPath?.components || []) {
    const x1 = nodeX.get(component.nodeA);
    const x2 = nodeX.get(component.nodeB);
    if (x1 === undefined || x2 === undefined) continue;
    parts.push(horizontalComponent(Math.min(x1, x2), Math.max(x1, x2), topY, component));
  }
  for (const component of bottomPath.components) {
    const x1 = nodeX.get(component.nodeA);
    const x2 = nodeX.get(component.nodeB);
    if (x1 === undefined || x2 === undefined) continue;
    parts.push(horizontalComponent(Math.min(x1, x2), Math.max(x1, x2), bottomY, component));
  }

  railLinks.forEach((component, index) => {
    const topNode = topNodeSet.has(component.nodeA) ? component.nodeA : component.nodeB;
    const bottomNode = bottomNodeSet.has(component.nodeA) ? component.nodeA : component.nodeB;
    const topX = nodeX.get(topNode);
    const bottomX = nodeX.get(bottomNode);
    if (topX === undefined || bottomX === undefined) return;
    if (Math.abs(topX - bottomX) < 2) {
      parts.push(verticalComponent(topX, topY, bottomY, component, topX));
    } else {
      parts.push(diagonalComponent(topX, topY, bottomX, bottomY, component, index % 2 === 0 ? -12 : 12));
    }
  });

  topBridges.forEach((component, index) => {
    const x1 = nodeX.get(component.nodeA);
    const x2 = nodeX.get(component.nodeB);
    if (x1 === undefined || x2 === undefined) return;
    const y = topY - 78 - index * 56;
    parts.push(line(x1, topY, x1, y), line(x2, topY, x2, y));
    parts.push(horizontalComponent(Math.min(x1, x2), Math.max(x1, x2), y, component));
  });
  bottomBridges.forEach((component, index) => {
    const x1 = nodeX.get(component.nodeA);
    const x2 = nodeX.get(component.nodeB);
    if (x1 === undefined || x2 === undefined) return;
    const y = bottomY + 78 + index * 56;
    parts.push(line(x1, bottomY, x1, y), line(x2, bottomY, x2, y));
    parts.push(horizontalComponent(Math.min(x1, x2), Math.max(x1, x2), y, component));
  });

  if (!topComplete) {
    parts.push(text((lastTopX + rightTerminalX) / 2, topY - 26, "camino a P2 incompleto", "warnCenter"));
  }
  otherComponents.forEach((component, index) => {
    const y = bottomY + 56 + bottomBridges.length * 56 + index * 26;
    parts.push(text(150, y, `${component.id}: ${component.nodeA} - ${component.nodeB} = ${component.rawValue}`, "small"));
  });
  parts.push("</svg>");
  return parts.join("");
}

function isLatticeCandidate(parsed) {
  const { ports, components } = parsed;
  if (ports.p1.negative === ports.p2.negative) return false;
  const requiredNodes = new Set([ports.p1.positive, ports.p1.negative, ports.p2.positive, ports.p2.negative]);
  const touchingPorts = components.filter((component) => requiredNodes.has(component.nodeA) && requiredNodes.has(component.nodeB));
  return touchingPorts.length >= 3;
}

function buildLatticeSvg(parsed) {
  const width = 980;
  const height = 430;
  const topY = 128;
  const bottomY = 326;
  const leftX = 110;
  const rightX = 860;
  const p = parsed.ports;
  const parts = svgStart(width, height, "Cuadripolo tipo X o lattice");
  parts.push(terminal(leftX, topY), terminal(leftX, bottomY), terminal(rightX, topY), terminal(rightX, bottomY));
  parts.push(text(leftX - 28, topY - 24, "1", "port"), text(leftX - 32, bottomY + 30, "1'", "port"));
  parts.push(text(rightX + 26, topY - 24, "2", "port"), text(rightX + 25, bottomY + 30, "2'", "port"));
  parts.push(arrow(leftX + 6, topY - 38, leftX + 88, topY - 38), text(leftX + 42, topY - 54, "I1", "small"));
  parts.push(arrow(rightX - 6, topY - 38, rightX - 88, topY - 38), text(rightX - 48, topY - 54, "I2", "small"));
  parts.push(voltageArrow(leftX - 22, topY + 4, bottomY - 4, "V1"));
  parts.push(voltageArrow(rightX + 22, topY + 4, bottomY - 4, "V2"));

  const coord = new Map([
    [p.p1.positive, [leftX, topY]],
    [p.p1.negative, [leftX, bottomY]],
    [p.p2.positive, [rightX, topY]],
    [p.p2.negative, [rightX, bottomY]],
  ]);
  parsed.components.forEach((component, index) => {
    const a = coord.get(component.nodeA);
    const b = coord.get(component.nodeB);
    if (!a || !b) return;
    const bend = index % 2 === 0 ? 0 : 18;
    parts.push(diagonalComponent(a[0], a[1], b[0], b[1], component, bend));
  });
  parts.push(text(width / 2, 38, "Cuadripolo X / lattice con bornes inferiores independientes", "warnCenter"));
  parts.push("</svg>");
  return parts.join("");
}

function solveWithCurrents(parsed, i1, i2) {
  const result = runMna(parsed, [
    { positive: parsed.ports.p1.positive, negative: parsed.ports.p1.negative, current: i1 },
    { positive: parsed.ports.p2.positive, negative: parsed.ports.p2.negative, current: i2 },
  ], []);
  return {
    v1: result.voltage(parsed.ports.p1.positive) - result.voltage(parsed.ports.p1.negative),
    v2: result.voltage(parsed.ports.p2.positive) - result.voltage(parsed.ports.p2.negative),
  };
}

function solveWithVoltages(parsed, v1, v2) {
  const result = runMna(parsed, [], [
    { label: "V1", positive: parsed.ports.p1.positive, negative: parsed.ports.p1.negative, voltage: v1 },
    { label: "V2", positive: parsed.ports.p2.positive, negative: parsed.ports.p2.negative, voltage: v2 },
  ]);
  return {
    i1: -result.sourceCurrent("V1"),
    i2: -result.sourceCurrent("V2"),
  };
}

function runMna(parsed, currentSources, voltageSources) {
  const nodes = collectAnalysisNodes(parsed);
  const nodeIndex = new Map(nodes.map((node, index) => [node, index]));
  const n = nodes.length;
  const size = n + voltageSources.length;
  const matrix = zeros(size, size);
  const rhs = Array(size).fill(0);

  for (const component of parsed.components) {
    if (!ANALYSIS_COMPONENTS.has(component.kind)) continue;
    const g = componentConductance(component);
    stampConductance(matrix, nodeIndex, component.nodeA, component.nodeB, g);
  }

  for (const source of currentSources) {
    stampCurrent(rhs, nodeIndex, source.positive, source.negative, source.current);
  }

  voltageSources.forEach((source, index) => {
    const column = n + index;
    const positive = nodeIndex.get(source.positive);
    const negative = nodeIndex.get(source.negative);
    if (positive !== undefined) {
      matrix[positive][column] += 1;
      matrix[column][positive] += 1;
    }
    if (negative !== undefined) {
      matrix[negative][column] -= 1;
      matrix[column][negative] -= 1;
    }
    rhs[column] = source.voltage;
  });

  const solution = solveLinearSystem(matrix, rhs);
  const sourceIndex = new Map(voltageSources.map((source, index) => [source.label, n + index]));
  return {
    voltage(node) {
      if (isGround(node)) return 0;
      const index = nodeIndex.get(node);
      return index === undefined ? 0 : solution[index];
    },
    sourceCurrent(label) {
      const index = sourceIndex.get(label);
      return index === undefined ? 0 : solution[index];
    },
  };
}

function collectAnalysisNodes(parsed) {
  const nodes = new Set();
  for (const component of parsed.components) {
    if (!isGround(component.nodeA)) nodes.add(component.nodeA);
    if (!isGround(component.nodeB)) nodes.add(component.nodeB);
  }
  for (const port of [parsed.ports.p1, parsed.ports.p2]) {
    if (!isGround(port.positive)) nodes.add(port.positive);
    if (!isGround(port.negative)) nodes.add(port.negative);
  }
  return Array.from(nodes).sort(naturalCompare);
}

function componentConductance(component) {
  if (!Number.isFinite(component.numeric)) {
    throw new Error(`${component.id} no tiene valor numerico real.`);
  }
  if (component.kind === "Y") return component.numeric;
  if (Math.abs(component.numeric) < EPS) throw new Error(`${component.id} tiene impedancia nula; la matriz nodal seria singular.`);
  return 1 / component.numeric;
}

function stampConductance(matrix, nodeIndex, nodeA, nodeB, conductance) {
  const a = nodeIndex.get(nodeA);
  const b = nodeIndex.get(nodeB);
  if (a !== undefined) matrix[a][a] += conductance;
  if (b !== undefined) matrix[b][b] += conductance;
  if (a !== undefined && b !== undefined) {
    matrix[a][b] -= conductance;
    matrix[b][a] -= conductance;
  }
}

function stampCurrent(rhs, nodeIndex, positive, negative, current) {
  const p = nodeIndex.get(positive);
  const n = nodeIndex.get(negative);
  if (p !== undefined) rhs[p] += current;
  if (n !== undefined) rhs[n] -= current;
}

function solveLinearSystem(matrix, rhs) {
  const n = rhs.length;
  const a = matrix.map((row, index) => [...row, rhs[index]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < EPS) {
      throw new Error("La matriz nodal es singular. Revise referencias, puertos abiertos o componentes desconectados.");
    }
    if (pivot !== col) [a[pivot], a[col]] = [a[col], a[pivot]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

function matrixToZ(source, matrix) {
  if (source === "Z") {
    return { result: cloneMatrix(matrix), conditions: [], steps: ["La matriz de origen ya es Z."] };
  }
  if (source === "Y") {
    const delta = determinant(matrix);
    requireNonZero(delta, "DeltaY");
    return {
      result: invertMatrix(matrix),
      conditions: [`DeltaY = ${formatNumber(delta)} debe ser distinto de cero.`],
      steps: ["Z = inv(Y)."],
    };
  }
  if (source === "h") {
    const [[h11, h12], [h21, h22]] = matrix;
    requireNonZero(h22, "h22");
    const delta = determinant(matrix);
    return {
      result: [
        [delta / h22, h12 / h22],
        [-h21 / h22, 1 / h22],
      ],
      conditions: [`h22 = ${formatNumber(h22)} debe ser distinto de cero.`],
      steps: ["Se despeja V2 desde la segunda ecuacion h para volver a la forma V = Z I."],
    };
  }
  if (source === "g") {
    const [[g11, g12], [g21, g22]] = matrix;
    requireNonZero(g11, "g11");
    const delta = determinant(matrix);
    return {
      result: [
        [1 / g11, -g12 / g11],
        [g21 / g11, delta / g11],
      ],
      conditions: [`g11 = ${formatNumber(g11)} debe ser distinto de cero.`],
      steps: ["Se despeja V1 desde la primera ecuacion g para volver a la forma V = Z I."],
    };
  }
  if (source === "Gamma") {
    const [[a, b], [c, d]] = matrix;
    requireNonZero(c, "C");
    return {
      result: [
        [a / c, (a * d - b * c) / c],
        [1 / c, d / c],
      ],
      conditions: [`C = ${formatNumber(c)} debe ser distinto de cero.`],
      steps: ["Se despejan V1 y V2 desde gamma usando la convencion del apunte."],
    };
  }
  throw new Error(`Familia no soportada: ${source}.`);
}

function zToFamily(target, z) {
  if (target === "Z") return { result: cloneMatrix(z), conditions: [], steps: ["Resultado expresado como Z."] };
  const [[z11, z12], [z21, z22]] = z;
  const delta = determinant(z);
  if (target === "Y") {
    requireNonZero(delta, "DeltaZ");
    return {
      result: invertMatrix(z),
      conditions: [`DeltaZ = ${formatNumber(delta)} debe ser distinto de cero.`],
      steps: ["Y = inv(Z)."],
    };
  }
  if (target === "h") {
    requireNonZero(z22, "z22");
    return {
      result: [
        [delta / z22, z12 / z22],
        [-z21 / z22, 1 / z22],
      ],
      conditions: [`z22 = ${formatNumber(z22)} debe ser distinto de cero.`],
      steps: ["Se despeja I2 para escribir V1 e I2 en funcion de I1 y V2."],
    };
  }
  if (target === "g") {
    requireNonZero(z11, "z11");
    return {
      result: [
        [1 / z11, -z12 / z11],
        [z21 / z11, delta / z11],
      ],
      conditions: [`z11 = ${formatNumber(z11)} debe ser distinto de cero.`],
      steps: ["Se despeja I1 para escribir I1 y V2 en funcion de V1 e I2."],
    };
  }
  if (target === "Gamma") {
    requireNonZero(z21, "z21");
    return {
      result: [
        [z11 / z21, delta / z21],
        [1 / z21, z22 / z21],
      ],
      conditions: [`z21 = ${formatNumber(z21)} debe ser distinto de cero.`],
      steps: ["Gamma = [[z11/z21, DeltaZ/z21], [1/z21, z22/z21]]."],
    };
  }
  throw new Error(`Familia no soportada: ${target}.`);
}

function normalizeFamily(family) {
  const key = String(family).trim().toLowerCase();
  const aliases = {
    z: "Z",
    impedancia: "Z",
    y: "Y",
    admitancia: "Y",
    h: "h",
    g: "g",
    gamma: "Gamma",
    abcd: "Gamma",
    transmision: "Gamma",
    principal: "Gamma",
  };
  if (!aliases[key]) throw new Error(`Familia no soportada: ${family}.`);
  return aliases[key];
}

function associationInfo(type) {
  const map = {
    cascade: { label: "Cascada", family: "Gamma", operation: "multiply" },
    seriesSeries: { label: "Serie-Serie", family: "Z", operation: "add" },
    parallelParallel: { label: "Paralelo-Paralelo", family: "Y", operation: "add" },
    seriesParallel: { label: "Serie-Paralelo", family: "h", operation: "add" },
    parallelSeries: { label: "Paralelo-Serie", family: "g", operation: "add" },
  };
  if (!map[type]) throw new Error(`Tipo de asociacion no soportado: ${type}.`);
  return map[type];
}

function evaluateBrune(values) {
  const numeric = values.map((value) => (value === "" || value === null || value === undefined ? NaN : parseScalar(value)));
  if (numeric.every((value) => Number.isNaN(value))) {
    return {
      status: "pending",
      valid: null,
      message: "Test de Brune pendiente: cargue las variables de interferencia de los dos ensayos si quiere validar la asociacion estructural.",
    };
  }
  if (numeric.some((value) => !Number.isFinite(value))) {
    return {
      status: "incomplete",
      valid: false,
      message: "Test de Brune incompleto: ambos ensayos deben tener una variable numerica.",
    };
  }
  const valid = numeric.every((value) => Math.abs(value) < 1e-9);
  return {
    status: valid ? "valid" : "invalid",
    valid,
    message: valid
      ? "Test de Brune: las variables de interferencia son cero; la suma/producto indicado es admisible."
      : "Test de Brune: alguna variable de interferencia no es cero; la asociacion modifica los cuadripolos individuales.",
  };
}

function parseScalar(raw) {
  if (typeof raw === "number") return raw;
  let text = String(raw).trim().replace(",", ".");
  if (!text) return NaN;
  const suffix = text.match(/^([-+]?\d+(?:\.\d+)?)([kKmMuUnNpP])$/);
  if (suffix) {
    const multipliers = { k: 1e3, K: 1e3, M: 1e6, m: 1e-3, u: 1e-6, U: 1e-6, n: 1e-9, N: 1e-9, p: 1e-12, P: 1e-12 };
    return Number(suffix[1]) * multipliers[suffix[2]];
  }
  if (/^[-+]?\d+(?:\.\d+)?\/[-+]?\d+(?:\.\d+)?$/.test(text)) {
    const [num, den] = text.split("/").map(Number);
    return den === 0 ? NaN : num / den;
  }
  if (!/^[0-9eE+\-*/().\s]+$/.test(text)) return NaN;
  try {
    const value = Function(`"use strict"; return (${text});`)();
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

function stripComment(line) {
  return line.replace(/[#;].*$/, "");
}

function validateMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 2 || !matrix.every((row) => Array.isArray(row) && row.length === 2)) {
    throw new Error("La matriz debe ser 2x2.");
  }
  for (const row of matrix) {
    for (const value of row) {
      if (!Number.isFinite(value)) throw new Error("La matriz solo admite numeros reales en esta version web.");
    }
  }
}

function determinant(matrix) {
  return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
}

function requireNonZero(value, label) {
  if (Math.abs(value) < EPS) {
    throw new Error(`${label} es cero; la conversion no existe para este caso degenerado.`);
  }
}

function invertMatrix(matrix) {
  const delta = determinant(matrix);
  requireNonZero(delta, "Determinante");
  return [
    [matrix[1][1] / delta, -matrix[0][1] / delta],
    [-matrix[1][0] / delta, matrix[0][0] / delta],
  ];
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function addMatrices(a, b) {
  return [
    [a[0][0] + b[0][0], a[0][1] + b[0][1]],
    [a[1][0] + b[1][0], a[1][1] + b[1][1]],
  ];
}

function multiplyMatrices(a, b) {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}

function zeros(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function collectNodes(parsed) {
  return new Set(parsed.components.flatMap((component) => [component.nodeA, component.nodeB]));
}

function assignRailNodePositions(nodeX, nodes, leftX, rightX) {
  if (nodes.length === 1) {
    nodeX.set(nodes[0], leftX);
    return;
  }
  const span = rightX - leftX;
  nodes.forEach((node, index) => {
    nodeX.set(node, leftX + (span * index) / (nodes.length - 1));
  });
}

function findBottomPath(parsed) {
  const start = parsed.ports.p1.negative;
  const end = parsed.ports.p2.negative;
  if (start === end) return null;

  const topPath = findTopPath(parsed);
  const topNodes = new Set(topPath?.nodes || [parsed.ports.p1.positive, parsed.ports.p2.positive]);
  const edges = parsed.components.filter((component) => !topNodes.has(component.nodeA) && !topNodes.has(component.nodeB));
  return findPathInEdges(edges, start, end);
}

function findTopPath(parsed) {
  const start = parsed.ports.p1.positive;
  const end = parsed.ports.p2.positive;
  const edges = parsed.components.filter((component) => !isReferenceNode(component.nodeA, parsed) && !isReferenceNode(component.nodeB, parsed));
  return findPathInEdges(edges, start, end);
}

function findLongestChain(parsed, start) {
  const edges = parsed.components.filter((component) => !isReferenceNode(component.nodeA, parsed) && !isReferenceNode(component.nodeB, parsed));
  let best = { nodes: [start], components: [] };
  const walk = (node, visitedNodes, usedComponents) => {
    if (usedComponents.length > best.components.length) best = { nodes: [...visitedNodes], components: [...usedComponents] };
    for (const component of edges) {
      if (usedComponents.includes(component)) continue;
      const next = component.nodeA === node ? component.nodeB : component.nodeB === node ? component.nodeA : null;
      if (!next || visitedNodes.includes(next)) continue;
      walk(next, [...visitedNodes, next], [...usedComponents, component]);
    }
  };
  walk(start, [start], []);
  return best;
}

function findPathInEdges(edges, start, end) {
  const paths = [];
  const walk = (node, visitedNodes, usedComponents) => {
    if (node === end) {
      paths.push({ nodes: [...visitedNodes], components: [...usedComponents] });
      return;
    }
    if (usedComponents.length > edges.length) return;
    for (const component of edges) {
      if (usedComponents.includes(component)) continue;
      const next = component.nodeA === node ? component.nodeB : component.nodeB === node ? component.nodeA : null;
      if (!next || visitedNodes.includes(next)) continue;
      walk(next, [...visitedNodes, next], [...usedComponents, component]);
    }
  };
  walk(start, [start], []);
  if (paths.length === 0) return null;
  paths.sort((a, b) => b.components.length - a.components.length);
  return paths[0];
}

function isReferenceNode(node, parsed) {
  return isGround(node) || node === parsed.ports.p1.negative || node === parsed.ports.p2.negative;
}

function isGround(node) {
  return ["0", "gnd", "ground", "ref"].includes(String(node).toLowerCase());
}

function groupBy(items, selector) {
  const map = new Map();
  for (const item of items) {
    const key = selector(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function upperBridgeOverflow(count) {
  return Math.max(0, count - 1) * 56;
}

function svgStart(width, height, label) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="min-width:${width}px" role="img" aria-label="${escapeHtml(label)}">`,
    "<style>",
    ".wire{stroke:#101010;stroke-width:4;fill:none;stroke-linecap:round;stroke-linejoin:round}",
    ".dash{stroke:#777;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:10 9}",
    ".thin{stroke:#101010;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}",
    ".box{fill:#fffef8;stroke:#101010;stroke-width:2.5;rx:3}",
    ".symbol{stroke:#101010;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}",
    ".plate{stroke:#101010;stroke-width:4;fill:none;stroke-linecap:round}",
    ".node{fill:#fff;stroke:#101010;stroke-width:3}",
    ".label{font:700 15px 'Segoe UI',Arial,sans-serif;fill:#101010;text-anchor:middle;dominant-baseline:middle}",
    ".value{font:13px 'Segoe UI',Arial,sans-serif;fill:#222;text-anchor:middle;dominant-baseline:middle}",
    ".small{font:15px 'Segoe UI',Arial,sans-serif;fill:#172026}",
    ".port{font:700 24px 'Segoe UI',Arial,sans-serif;fill:#050505}",
    ".nodeLabel{font:16px 'Segoe UI',Arial,sans-serif;fill:#111;text-anchor:middle}",
    ".warnCenter{font:17px 'Segoe UI',Arial,sans-serif;fill:#944400;text-anchor:middle}",
    ".pol{font:17px 'Segoe UI',Arial,sans-serif;fill:#111;text-anchor:middle}",
    "</style>",
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="#fff" stroke="#d8e0e3"/>`,
  ];
}

function horizontalComponent(x1, x2, y, component) {
  return componentBetween(x1, y, x2, y, component);
}

function verticalComponent(x, topY, bottomY, component, anchorX) {
  const centerY = (topY + bottomY) / 2;
  const stub = Math.abs(x - anchorX) > 1 ? line(anchorX, topY, x, topY) : "";
  return [
    stub,
    componentBetween(x, topY, x, bottomY, component, x, centerY),
  ].join("");
}

function diagonalComponent(x1, y1, x2, y2, component, bend = 0) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + bend;
  return componentBetween(x1, y1, x2, y2, component, cx, cy);
}

function componentBetween(x1, y1, x2, y2, component, centerOverrideX = null, centerOverrideY = null) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const totalLength = Math.hypot(dx, dy) || 1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const centerX = centerOverrideX ?? (x1 + x2) / 2;
  const centerY = centerOverrideY ?? (y1 + y2) / 2;
  const symbolLength = Math.min(88, Math.max(58, totalLength - 48));
  const half = symbolLength / 2;
  const ux = dx / totalLength;
  const uy = dy / totalLength;
  const startX = centerX - ux * half;
  const startY = centerY - uy * half;
  const endX = centerX + ux * half;
  const endY = centerY + uy * half;

  return [
    line(x1, y1, startX, startY),
    line(endX, endY, x2, y2),
    `<g transform="translate(${formatSvgNumber(centerX)} ${formatSvgNumber(centerY)}) rotate(${formatSvgNumber(angle)})">`,
    componentShape(component, symbolLength),
    "</g>",
    componentLabel(centerX, centerY, angle, component),
  ].join("");
}

function componentShape(component, length) {
  const kind = component.kind.toUpperCase();
  if (kind === "R") return resistorShape(length);
  if (kind === "L") return inductorShape(length);
  if (kind === "C") return capacitorShape(length);
  return genericComponentShape(length, component);
}

function resistorShape(length) {
  const left = -length / 2;
  const right = length / 2;
  const step = length / 8;
  const points = [[left, 0]];
  for (let i = 1; i < 8; i += 1) {
    points.push([left + step * i, i % 2 === 1 ? -13 : 13]);
  }
  points.push([right, 0]);
  return `<polyline class="symbol resistor-symbol" points="${points.map(([x, y]) => `${formatSvgNumber(x)},${formatSvgNumber(y)}`).join(" ")}"/>`;
}

function inductorShape(length) {
  const left = -length / 2;
  const coilWidth = length / 4;
  const parts = [];
  for (let i = 0; i < 4; i += 1) {
    const x = left + coilWidth * i;
    parts.push(`C ${formatSvgNumber(x + coilWidth * 0.15)} -18 ${formatSvgNumber(x + coilWidth * 0.85)} -18 ${formatSvgNumber(x + coilWidth)} 0`);
  }
  return `<path class="symbol inductor-symbol" d="M ${formatSvgNumber(left)} 0 ${parts.join(" ")}"/>`;
}

function capacitorShape(length) {
  return [
    `<path class="symbol capacitor-symbol" d="M ${formatSvgNumber(-length / 2)} 0 L -8 0 M 8 0 L ${formatSvgNumber(length / 2)} 0"/>`,
    `<path class="plate capacitor-symbol" d="M -8 -20 L -8 20 M 8 -20 L 8 20"/>`,
  ].join("");
}

function genericComponentShape(length, component) {
  const width = Math.min(84, Math.max(58, length));
  return [
    `<rect class="box" x="${formatSvgNumber(-width / 2)}" y="-22" width="${formatSvgNumber(width)}" height="44"/>`,
    text(0, -7, component.id, "label"),
    text(0, 13, `${component.kind} = ${escapeHtml(component.rawValue)}`, "value"),
  ].join("");
}

function componentLabel(x, y, angle, component) {
  if (!["R", "L", "C"].includes(component.kind.toUpperCase())) return "";
  const vertical = Math.abs(Math.sin((angle * Math.PI) / 180)) > 0.7;
  const labelX = vertical ? x + 34 : x;
  const labelY = vertical ? y - 8 : y - 30;
  const valueX = vertical ? x + 34 : x;
  const valueY = vertical ? y + 13 : y + 34;
  return [
    text(labelX, labelY, component.id, "label"),
    text(valueX, valueY, `${component.kind} = ${escapeHtml(component.rawValue)}`, "value"),
  ].join("");
}

function formatSvgNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function line(x1, y1, x2, y2, klass = "wire") {
  return `<path class="${klass}" d="M ${x1} ${y1} L ${x2} ${y2}"/>`;
}

function terminal(x, y) {
  return `<circle class="node" cx="${x}" cy="${y}" r="9"/>`;
}

function nodeDot(x, y) {
  return `<circle class="node" cx="${x}" cy="${y}" r="6"/>`;
}

function text(x, y, content, klass) {
  return `<text class="${klass}" x="${x}" y="${y}">${escapeHtml(content)}</text>`;
}

function arrow(x1, y1, x2, y2) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 12;
  const a1 = angle - Math.PI / 7;
  const a2 = angle + Math.PI / 7;
  return [
    line(x1, y1, x2, y2, "thin"),
    line(x2, y2, x2 - head * Math.cos(a1), y2 - head * Math.sin(a1), "thin"),
    line(x2, y2, x2 - head * Math.cos(a2), y2 - head * Math.sin(a2), "thin"),
  ].join("");
}

function voltageArrow(x, y1, y2, label) {
  return [
    arrow(x, y2, x, y1),
    text(x + 24, (y1 + y2) / 2, label, "small"),
    text(x + 12, y1 + 8, "+", "pol"),
    text(x + 12, y2 - 2, "-", "pol"),
  ].join("");
}

function matrixToLatex(matrix) {
  return `\\begin{bmatrix}${formatNumber(matrix[0][0])} & ${formatNumber(matrix[0][1])}\\\\${formatNumber(matrix[1][0])} & ${formatNumber(matrix[1][1])}\\end{bmatrix}`;
}

function latexFamilyLabel(label) {
  return String(label).replace("Gamma / ABCD", "\\Gamma");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
