import { convertMatrix, formatMatrix } from "./matrix.js?v=20260517-acentos-ui";
import { EPS, formatNumber, zeros } from "./math-utils.js?v=20260517-acentos-ui";
import { isGround, naturalCompare, parseNetlist } from "./netlist.js?v=20260517-acentos-ui";

const ANALYSIS_COMPONENTS = new Set(["R", "Z", "Y"]);
const AUTO_DERIVED_FAMILIES = [
  { target: "h", label: "h", unit: "" },
  { target: "g", label: "g", unit: "" },
  { target: "Gamma", label: "Gamma / ABCD", unit: "" },
];

export function solveTwoPort(text) {
  const parsed = parseNetlist(text);
  const warnings = [...parsed.warnings];
  const unsupported = parsed.components.filter((component) => !ANALYSIS_COMPONENTS.has(component.kind));
  if (unsupported.length > 0) {
    warnings.push("El solucionador numérico del navegador calcula R/Z/Y. L y C quedan para el motor simbólico Python local.");
  }
  for (const component of parsed.components) {
    if (ANALYSIS_COMPONENTS.has(component.kind) && !Number.isFinite(component.numeric)) {
      throw new Error(`El componente ${component.id} necesita un valor numérico real para resolver en el navegador.`);
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
      title: "Parámetros Z por definición",
      text: "Para obtener la primera columna se impone I1 = 1 A e I2 = 0 A, equivalente a dejar abierto el puerto 2. Para la segunda columna se impone I1 = 0 A e I2 = 1 A.",
      equations: [`Z = ${formatMatrix(z, "ohm")}`],
    },
    {
      title: "Parámetros Y por definición",
      text: "Para obtener la primera columna se impone V1 = 1 V y V2 = 0 V, es decir puerto 2 en cortocircuito. Para la segunda columna se impone V1 = 0 V y V2 = 1 V.",
      equations: [`Y = ${formatMatrix(y, "S")}`],
    },
    {
      title: "Parámetros derivados automáticos",
      text: "Desde la matriz Z calculada se obtienen automáticamente las familias h, g y Gamma/ABCD cuando cumplen sus condiciones de existencia.",
      equations: derivedFamilies.map((family) => (
        family.status === "ok"
          ? `${family.label} = ${formatMatrix(family.matrix, family.unit)}`
          : `${family.label}: ${family.message}`
      )),
    },
    {
      title: "Verificación didáctica",
      text: "Si z12 = z21 o y12 = y21, el cuadripolo pasivo bilateral queda verificado como recíproco dentro de la tolerancia numérica.",
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
    const conductance = componentConductance(component);
    stampConductance(matrix, nodeIndex, component.nodeA, component.nodeB, conductance);
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
    throw new Error(`${component.id} no tiene valor numérico real.`);
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
  const augmented = matrix.map((row, index) => [...row, rhs[index]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    }
    if (Math.abs(augmented[pivot][col]) < EPS) {
      throw new Error("La matriz nodal es singular. Revise referencias, puertos abiertos o componentes desconectados.");
    }
    if (pivot !== col) [augmented[pivot], augmented[col]] = [augmented[col], augmented[pivot]];
    const divisor = augmented[col][col];
    for (let j = col; j <= n; j += 1) augmented[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = col; j <= n; j += 1) augmented[row][j] -= factor * augmented[col][j];
    }
  }
  return augmented.map((row) => row[n]);
}
