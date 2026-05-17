import {
  addMatrices,
  cloneMatrix,
  determinant,
  formatNumber,
  invertMatrix,
  multiplyMatrices,
  parseScalar,
  requireNonZero,
  validateMatrix,
} from "./math-utils.js?v=20260517-acentos-ui";

export function convertMatrix(sourceFamily, targetFamily, matrix) {
  const source = normalizeFamily(sourceFamily);
  const target = normalizeFamily(targetFamily);
  validateMatrix(matrix);
  if (source === target) {
    return {
      source,
      target,
      result: cloneMatrix(matrix),
      conditions: ["No hay conversión: la familia de origen coincide con la de destino."],
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
      steps: ["Conversión directa Y -> gamma con la convención V1 = A V2 - B I2 e I1 = C V2 - D I2."],
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
    `Tipo de asociación: ${association.label}.`,
    `Familia conveniente: ${association.family}.`,
    association.operation === "multiply"
      ? "En cascada se multiplican matrices gamma respetando el orden de conexión."
      : `Para esta asociación ideal se suman directamente los parámetros ${association.family}.`,
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

export function parseMatrixText(text) {
  const clean = text.replace(/\[/g, " ").replace(/\]/g, " ").replace(/;/g, "\n").trim();
  const rows = clean.split(/\n+/).map((row) => row.trim()).filter(Boolean);
  if (rows.length !== 2) {
    throw new Error("La matriz debe tener dos filas. Puede escribirse como 'a b; c d'.");
  }
  const matrix = rows.map((row) => row.split(/[,\s]+/).filter(Boolean).map(parseScalar));
  validateMatrix(matrix);
  return matrix;
}

export function formatMatrix(matrix, unit = "") {
  const suffix = unit ? ` ${unit}` : "";
  return `[[${formatNumber(matrix[0][0])}, ${formatNumber(matrix[0][1])}], [${formatNumber(matrix[1][0])}, ${formatNumber(matrix[1][1])}]]${suffix}`;
}

export function normalizeFamily(family) {
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

function matrixToZ(source, matrix) {
  if (source === "Z") {
    return { result: cloneMatrix(matrix), conditions: [], steps: ["La matriz de origen ya es Z."] };
  }
  if (source === "Y") {
    const delta = determinant(matrix);
    requireNonZero(delta, "DeltaY");
    return {
      result: invertMatrix(matrix),
      conditions: [`ΔY = ${formatNumber(delta)} debe ser distinto de cero.`],
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
      steps: ["Se despeja V2 desde la segunda ecuación h para volver a la forma V = Z I."],
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
      steps: ["Se despeja V1 desde la primera ecuación g para volver a la forma V = Z I."],
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
      steps: ["Se despejan V1 y V2 desde gamma usando la convención del apunte."],
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
      conditions: [`ΔZ = ${formatNumber(delta)} debe ser distinto de cero.`],
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
      steps: ["Gamma = [[z11/z21, ΔZ/z21], [1/z21, z22/z21]]."],
    };
  }
  throw new Error(`Familia no soportada: ${target}.`);
}

function associationInfo(type) {
  const map = {
    cascade: { label: "Cascada", family: "Gamma", operation: "multiply" },
    seriesSeries: { label: "Serie-Serie", family: "Z", operation: "add" },
    parallelParallel: { label: "Paralelo-Paralelo", family: "Y", operation: "add" },
    seriesParallel: { label: "Serie-Paralelo", family: "h", operation: "add" },
    parallelSeries: { label: "Paralelo-Serie", family: "g", operation: "add" },
  };
  if (!map[type]) throw new Error(`Tipo de asociación no soportado: ${type}.`);
  return map[type];
}

function evaluateBrune(values) {
  const numeric = values.map((value) => (value === "" || value === null || value === undefined ? NaN : parseScalar(value)));
  if (numeric.every((value) => Number.isNaN(value))) {
    return {
      status: "pending",
      valid: null,
      message: "Test de Brune pendiente: cargue las variables de interferencia de los dos ensayos si quiere validar la asociación estructural.",
    };
  }
  if (numeric.some((value) => !Number.isFinite(value))) {
    return {
      status: "incomplete",
      valid: false,
      message: "Test de Brune incompleto: ambos ensayos deben tener una variable numérica.",
    };
  }
  const valid = numeric.every((value) => Math.abs(value) < 1e-9);
  return {
    status: valid ? "valid" : "invalid",
    valid,
    message: valid
      ? "Test de Brune: las variables de interferencia son cero; la suma/producto indicado es admisible."
      : "Test de Brune: alguna variable de interferencia no es cero; la asociación modifica los cuadripolos individuales.",
  };
}
