import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildPreview } from "./core.js";
import { DEFAULT_NETLIST, EXAMPLES } from "./netlist.js";
import { solveTwoPort } from "./solver.js";

const ATTEMPTS = 5;
const VALUES = [12, 27, 50, 82, 150];
const TOLERANCE = 1e-5;

const resolvableExamples = {
  escalera: {
    z: [[610 / 11, 80 / 11], [80 / 11, 290 / 11]],
    y: [[0.01870967741935484, -0.005161290322580644], [-0.005161290322580644, 0.039354838709677424]],
  },
  escaleraGuia: {
    z: [[73.64, 3.24], [3.24, 29.84]],
    y: [[0.013644760667971392, -0.0014815356757448836], [-0.0014815356757448836, 0.03367292813637443]],
  },
  t: {
    z: [[75, 50], [50, 85]],
    y: [[0.021935483870967745, -0.012903225806451613], [-0.012903225806451613, 0.01935483870967742]],
  },
  tSimetrico: {
    z: [[75, 50], [50, 75]],
    y: [[0.024, -0.016], [-0.016, 0.024]],
  },
  pi: {
    z: [[54.54545454545454, 36.36363636363636], [36.36363636363636, 50.9090909090909]],
    y: [[0.035, -0.025], [-0.025, 0.0375]],
  },
  piSimetrico: {
    z: [[58.33333333333333, 41.666666666666664], [41.666666666666664, 58.33333333333333]],
    y: [[0.035, -0.025], [-0.025, 0.035]],
  },
  lEntrada: {
    z: [[40, 40], [40, 70]],
    y: [[0.058333333333333334, -0.03333333333333333], [-0.03333333333333333, 0.03333333333333333]],
  },
  lSalida: {
    z: [[70, 40], [40, 40]],
    y: [[0.03333333333333333, -0.03333333333333333], [-0.03333333333333333, 0.058333333333333334]],
  },
  tPuenteado: {
    z: [[67.1428571428571, 52.85714285714281], [52.85714285714281, 67.1428571428571]],
    y: [[0.03916666666666667, -0.03083333333333333], [-0.03083333333333333, 0.03916666666666667]],
  },
  x: {
    z: [[210, 90], [90, 210]],
    y: [[0.005833333333333334, -0.0025], [-0.0025, 0.005833333333333334]],
  },
  inferior: {
    z: [[95, 50], [50, 115]],
    y: [[0.013649851632047473, -0.0059347181008902045], [-0.005934718100890209, 0.011275964391691397]],
  },
};

const quickBranches = {
  series: (value) => `${DEFAULT_NETLIST}\nR6 1 2 ${value}`,
  inputShunt: (value) => `${DEFAULT_NETLIST}\nR6 1 0 ${value}`,
  middleShunt: (value) => `${DEFAULT_NETLIST}\nR6 n1 0 ${value}`,
  outputShunt: (value) => `${DEFAULT_NETLIST}\nR6 2 0 ${value}`,
};

const results = [];

for (const [name, buildNetlist] of Object.entries(quickBranches)) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const netlist = buildNetlist(VALUES[attempt - 1]);
    const preview = buildPreview(netlist);
    const solution = solveTwoPort(netlist);
    assert.equal(preview.components.length, 6, `${name} intento ${attempt}: debe agregar un componente`);
    assertFiniteSolution(solution, `${name} intento ${attempt}`);
    results.push({ group: "rama rapida", name, attempt, status: "ok", z: solution.z, y: solution.y });
  }
}

for (const [name, expected] of Object.entries(resolvableExamples)) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const preview = buildPreview(EXAMPLES[name].netlist);
    const solution = solveTwoPort(EXAMPLES[name].netlist);
    assert.ok(preview.svg.includes("<svg"), `${name} intento ${attempt}: debe dibujar SVG`);
    assertFiniteSolution(solution, `${name} intento ${attempt}`);
    assertMatrixClose(solution.z, expected.z, `${name} intento ${attempt} Z`);
    assertMatrixClose(solution.y, expected.y, `${name} intento ${attempt} Y`);
    results.push({ group: "topologia tipica", name, attempt, status: "ok", z: solution.z, y: solution.y });
  }
}

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
await mkdir(join(repoRoot, "artifacts", "web_mvp_checks"), { recursive: true });
await writeFile(
  join(repoRoot, "artifacts", "web_mvp_checks", "quick_builder_results.json"),
  JSON.stringify({
    attemptsPerTopology: ATTEMPTS,
    totalChecks: results.length,
    results,
  }, null, 2),
);

console.log(`OK: ${results.length} verificaciones del constructor rapido (${ATTEMPTS} intentos por topologia).`);

function assertFiniteSolution(solution, label) {
  assertMatrixFinite(solution.z, `${label} Z`);
  assertMatrixFinite(solution.y, `${label} Y`);
  assert.equal(solution.reciprocalZ, true, `${label}: redes pasivas deben ser reciprocas`);
}

function assertMatrixFinite(matrix, label) {
  for (const row of matrix) {
    for (const value of row) {
      assert.ok(Number.isFinite(value), `${label}: valor no finito ${value}`);
    }
  }
}

function assertMatrixClose(actual, expected, label) {
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      assert.ok(
        Math.abs(actual[row][col] - expected[row][col]) < TOLERANCE,
        `${label}[${row},${col}] esperado ${expected[row][col]}, obtenido ${actual[row][col]}`,
      );
    }
  }
}
