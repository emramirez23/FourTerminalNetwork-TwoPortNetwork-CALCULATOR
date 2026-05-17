import assert from "node:assert/strict";
import {
  DEFAULT_NETLIST,
  EXAMPLES,
  associateTwoPorts,
  buildPreview,
  convertMatrix,
  generateLatexReport,
  generateReport,
  parseMatrixText,
  parseNetlist,
  solveTwoPort,
} from "./core.js";
import { parseNetlist as parseNetlistModule } from "./netlist.js";
import { convertMatrix as convertMatrixModule } from "./matrix.js";
import { solveTwoPort as solveTwoPortModule } from "./solver.js";

const close = (actual, expected, tolerance = 1e-5) => {
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${actual} ~= ${expected}`);
};

const svgHeight = (svg) => Number(svg.match(/viewBox="0 0 \d+ ([\d.]+)"/)?.[1] || 0);

const stackedTopBridgeNetlist = [
  "R1 1 n1 30",
  "R2 n1 0 40",
  "R3 n1 n2 50",
  "R4 n2 0 20",
  "R5 n2 2 10",
  "R6 n1 n2 50",
  "R7 n1 n2 50",
  "R8 n1 n2 50",
  "R9 n1 n2 50",
  "R10 n1 n2 50",
  "R11 n1 n2 50",
  "R12 n1 n2 50",
].join("\n");

const stackedDualRailNetlist = [
  ".ports 1 0 2 b2",
  "R1 1 n1 30",
  "R2 n1 2 40",
  "R3 0 b1 15",
  "R4 b1 b2 25",
  "R5 n1 b1 50",
  "R6 n1 2 50",
  "R7 n1 2 50",
  "R8 b1 b2 25",
  "R9 b1 b2 25",
  "R10 b1 b2 25",
].join("\n");

const previewCases = [
  EXAMPLES.escalera.netlist,
  EXAMPLES.t.netlist,
  EXAMPLES.pi.netlist,
  EXAMPLES.serie.netlist,
  EXAMPLES.derivacion.netlist,
  EXAMPLES.dobleParalelo.netlist,
  EXAMPLES.x.netlist,
  EXAMPLES.inferior.netlist,
  ["R1 1 n1 30", "R2 n1 0 40", "R3 n1 2 50"].join("\n"),
  [".ports 1 1' 2 2'", "R1 1 2 80", "R2 1' 2' 80", "R3 1 2' 120", "R4 1' 2 120"].join("\n"),
  ["R1 1 0 10", "R2 1 0 20", "R3 1 0 30"].join("\n"),
  ["R1 1 n1 10", "R2 n1 n2 20", "R3 n2 2 30", "R4 n1 0 40", "R5 n2 0 50"].join("\n"),
  ["Z1 1 n1 10", "Z2 n1 2 20", "Y1 n1 0 0.05"].join("\n"),
  ["R1 1 n1 10", "L1 n1 n2 1m", "C1 n2 2 100n", "R2 n1 0 50", "C2 n2 0 47n"].join("\n"),
  ["C1 1 n1 30", "C2 n1 0 40", "R1 n1 2 50"].join("\n"),
  [".ports 1 0 2 b2", "C1 1 n1 30", "C2 n1 2 40", "C3 0 b1 15", "C4 b1 b2 25", "C5 1 b1 50", "C6 n1 b2 60"].join("\n"),
  stackedTopBridgeNetlist,
  stackedDualRailNetlist,
  [".ports a b c b", "R1 a n1 12", "R2 n1 c 24", "R3 n1 b 36"].join("\n"),
];

for (const [index, netlist] of previewCases.entries()) {
  const preview = buildPreview(netlist);
  assert.match(preview.svg, /<svg/);
  assert.ok(preview.markdown.includes("Componentes"));
  assert.ok(preview.components.length > 0, `preview case ${index + 1} has components`);
}

const parsed = parseNetlist(DEFAULT_NETLIST);
assert.equal(parsed.components.length, 5);
assert.equal(parsed.ports.p1.positive, "1");
assert.equal(parsed.ports.p2.positive, "2");

const apostrophePorts = parseNetlist(".ports 1 1' 2 2'\nR1 1 2 80\nR2 1' 2' 80");
assert.equal(apostrophePorts.ports.p1.negative, "1'");
assert.equal(apostrophePorts.ports.p2.negative, "2'");

const duplicateIds = parseNetlistModule("R1 1 0 10\nR1 1 2 20");
assert.match(duplicateIds.warnings.join("\n"), /identificador R1 esta repetido/i);

const selfLoop = parseNetlistModule("R1 1 1 10");
assert.match(selfLoop.warnings.join("\n"), /mismo nodo en ambos extremos/i);

const scalarExpressions = parseNetlist([
  "R1 1 n1 .5k",
  "R2 n1 n2 2*(3+4)",
  "R3 n2 2 2**3",
  "R4 n2 0 1e-3",
  "R5 n2 n3 10m",
  "R6 n3 n4 10u",
  "R7 n4 n5 10M",
  "R8 n5 n6 10G",
  "R9 n6 n7 10k",
  "R10 n7 2 10K",
].join("\n"));
close(scalarExpressions.components[0].numeric, 500);
close(scalarExpressions.components[1].numeric, 14);
close(scalarExpressions.components[2].numeric, 8);
close(scalarExpressions.components[3].numeric, 0.001);
close(scalarExpressions.components[4].numeric, 0.01);
close(scalarExpressions.components[5].numeric, 0.00001);
close(scalarExpressions.components[6].numeric, 10000000);
close(scalarExpressions.components[7].numeric, 10000000000);
close(scalarExpressions.components[8].numeric, 10000);
close(scalarExpressions.components[9].numeric, 10000);

const lowerRailPreview = buildPreview(EXAMPLES.inferior.netlist);
assert.match(lowerRailPreview.svg, /rama inferior/);
assert.match(lowerRailPreview.svg, />b1</);
assert.doesNotMatch(lowerRailPreview.svg, /R3: 0 - b1/);
assert.doesNotMatch(lowerRailPreview.svg, /R4: b1 - b2/);

const passiveSymbolPreview = buildPreview(["R1 1 n1 10", "L1 n1 n2 1m", "C1 n2 2 100n", "R2 n1 0 50", "C2 n2 0 47n"].join("\n"));
assert.match(passiveSymbolPreview.svg, /resistor-symbol/);
assert.match(passiveSymbolPreview.svg, /inductor-symbol/);
assert.match(passiveSymbolPreview.svg, /capacitor-symbol/);
assert.match(passiveSymbolPreview.svg, /L -8 0 M 8 0 L/);
assert.doesNotMatch(passiveSymbolPreview.svg, /<rect class="box"[^>]*>.*R1/s);

const lCapacitorPreview = buildPreview(["C1 1 n1 30", "C2 n1 0 40", "R1 n1 2 50"].join("\n"));
assert.match(lCapacitorPreview.svg, /rotate\(90\)/);
assert.match(lCapacitorPreview.svg, /L -8 0 M 8 0 L/);

const diagonalCapacitorPreview = buildPreview([".ports 1 0 2 b2", "C1 1 n1 30", "C2 n1 2 40", "C3 0 b1 15", "C4 b1 b2 25", "C5 1 b1 50", "C6 n1 b2 60"].join("\n"));
assert.match(diagonalCapacitorPreview.svg, /capacitor-symbol/);
assert.match(diagonalCapacitorPreview.svg, /rotate\([1-8][0-9]\./);

const stackedTopPreview = buildPreview(stackedTopBridgeNetlist);
assert.ok(svgHeight(stackedTopPreview.svg) > 700);
assert.doesNotMatch(stackedTopPreview.svg, / y="-/);
assert.doesNotMatch(stackedTopPreview.svg, /d="[^"]* -\d/);

const stackedDualRailPreview = buildPreview(stackedDualRailNetlist);
assert.ok(svgHeight(stackedDualRailPreview.svg) > 500);
assert.doesNotMatch(stackedDualRailPreview.svg, / y="-/);

const solved = solveTwoPort(DEFAULT_NETLIST);
const solvedModule = solveTwoPortModule(DEFAULT_NETLIST);
close(solved.z[0][0], 610 / 11);
close(solved.z[0][1], 80 / 11);
close(solved.z[1][0], 80 / 11);
close(solved.z[1][1], 290 / 11);
assert.equal(solved.reciprocalZ, true);
assert.deepEqual(solvedModule.z, solved.z);
assert.deepEqual(solvedModule.y, solved.y);

const yFromZ = convertMatrix("Z", "Y", solved.z);
const yFromZModule = convertMatrixModule("Z", "Y", solved.z);
close(yFromZ.result[0][0], solved.y[0][0]);
close(yFromZ.result[0][1], solved.y[0][1]);
close(yFromZ.result[1][0], solved.y[1][0]);
close(yFromZ.result[1][1], solved.y[1][1]);
assert.deepEqual(yFromZModule.result, yFromZ.result);

const hFromZ = convertMatrix("Z", "h", solved.z);
assert.equal(hFromZ.target, "h");
const gFromZ = convertMatrix("Z", "g", solved.z);
assert.equal(gFromZ.target, "g");
const gammaFromZ = convertMatrix("Z", "Gamma", solved.z);
assert.equal(gammaFromZ.target, "Gamma");

const solvedFamilies = new Map(solved.derivedFamilies.map((family) => [family.target, family]));
assert.equal(solvedFamilies.get("h").status, "ok");
assert.equal(solvedFamilies.get("g").status, "ok");
assert.equal(solvedFamilies.get("Gamma").status, "ok");
close(solvedFamilies.get("h").matrix[0][0], hFromZ.result[0][0]);
close(solvedFamilies.get("g").matrix[1][1], gFromZ.result[1][1]);
close(solvedFamilies.get("Gamma").matrix[0][0], gammaFromZ.result[0][0]);

for (const netlist of [EXAMPLES.t.netlist, EXAMPLES.pi.netlist, EXAMPLES.inferior.netlist]) {
  const solution = solveTwoPort(netlist);
  assert.equal(solution.derivedFamilies.length, 3);
  assert.equal(solution.derivedFamilies.every((family) => family.status === "ok"), true);
}

const isolatedShunts = solveTwoPort(["R1 1 0 10", "R2 2 0 20"].join("\n"));
const isolatedFamilies = new Map(isolatedShunts.derivedFamilies.map((family) => [family.target, family]));
assert.equal(isolatedFamilies.get("h").status, "ok");
assert.equal(isolatedFamilies.get("g").status, "ok");
assert.equal(isolatedFamilies.get("Gamma").status, "error");
assert.match(isolatedFamilies.get("Gamma").message, /z21/i);

const report = generateReport({ netlist: DEFAULT_NETLIST, preview: buildPreview(DEFAULT_NETLIST), solution: solved });
assert.match(report, /Matriz h/);
assert.match(report, /Matriz g/);
assert.match(report, /Matriz Gamma \/ ABCD/);

const latexReport = generateLatexReport({ netlist: DEFAULT_NETLIST, solution: solved });
assert.match(latexReport, /\\Gamma/);

const matrix = parseMatrixText("1 2; 3 4");
assert.deepEqual(matrix, [[1, 2], [3, 4]]);

const cascade = associateTwoPorts("cascade", [[1, 40], [0, 1]], [[1, 30], [0.02, 1]], ["0", "0"]);
close(cascade.result[0][0], 1.8);
close(cascade.result[0][1], 70);
assert.equal(cascade.brune.valid, true);

const series = associateTwoPorts("seriesSeries", [[1, 2], [3, 4]], [[5, 6], [7, 8]], ["1", "0"]);
assert.deepEqual(series.result, [[6, 8], [10, 12]]);
assert.equal(series.brune.valid, false);

assert.throws(() => convertMatrix("Z", "Y", [[1, 2], [2, 4]]), /DeltaZ|Determinante/);
assert.throws(() => solveTwoPort("R1 1 2 10"), /singular/i);

console.log(`OK: ${previewCases.length + 55} pruebas de core ejecutadas.`);
