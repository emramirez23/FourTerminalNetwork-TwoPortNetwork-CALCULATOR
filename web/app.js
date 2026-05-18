import {
  DEFAULT_NETLIST,
  EXAMPLES,
} from "./netlist.js?v=20260518-builder-topologies";
import { buildPreview } from "./core.js?v=20260518-builder-topologies";
import { associateTwoPorts, convertMatrix, parseMatrixText } from "./matrix.js?v=20260518-builder-topologies";
import { generateLatexReport, generateReport } from "./reports.js?v=20260518-builder-topologies";
import { solveTwoPort } from "./solver.js?v=20260518-builder-topologies";

const state = {
  preview: null,
  solution: null,
  conversion: null,
  association: null,
};

const STORAGE_KEYS = {
  theme: "cuadripolos-theme",
  language: "cuadripolos-language",
};

const ui = {
  theme: loadPreference(STORAGE_KEYS.theme, "light", ["light", "dark"]),
  language: loadPreference(STORAGE_KEYS.language, "es", ["es", "en"]),
};

const $ = (id) => document.getElementById(id);

const controls = {
  netlist: $("netlist"),
  schematic: $("schematic"),
  markdown: $("markdown"),
  warnings: $("warnings"),
  solveOutput: $("solveOutput"),
  conversionOutput: $("conversionOutput"),
  associationOutput: $("associationOutput"),
  exportOutput: $("exportOutput"),
  exampleButtons: $("exampleButtons"),
  matrixSource: $("matrixSource"),
  matrixTarget: $("matrixTarget"),
  matrixInputFields: matrixFields("matrixInput"),
  matrixInputLabelNodes: Array.from(document.querySelectorAll("[data-matrix-source-label]")),
  assocType: $("assocType"),
  assocAFields: matrixFields("assocA"),
  assocBFields: matrixFields("assocB"),
  brune1: $("brune1"),
  brune2: $("brune2"),
  builderValue: $("builderValue"),
  themeToggleBtn: $("themeToggleBtn"),
  languageToggleBtn: $("languageToggleBtn"),
};

const TEXT = {
  es: {
    "meta.title": "Simulador de Cuadripolos UTN",
    "hero.eyebrow": "Teoría de Circuitos II - UTN",
    "hero.title": "Simulador de cuadripolos",
    "hero.lead": "Dibuja la netlist en vivo, calcula parámetros Z/Y, convierte familias, asocia cuadripolos y genera una resolución tipo apunte.",
    "hero.author": "BY ELÍAS RAMÍREZ",
    "prefs.darkMode": "Modo oscuro",
    "prefs.lightMode": "Modo claro",
    "prefs.languageSwitch": "ENGLISH",
    "prefs.themeAria": "Cambiar tema",
    "prefs.languageAria": "Cambiar idioma",
    "sections.inputTag": "Entrada",
    "sections.netlistTitle": "Netlist",
    "netlistNote.title": "Convención fija de bornes",
    "netlistNote.body": "El diagrama siempre muestra 1, 1', 2 y 2'. Si no declaras .ports, la netlist usa P1=(1,0) y P2=(2,0): el nodo 0 es el retorno común dibujado como 1' y 2'. Para retornos independientes usa .ports 1 1' 2 2'.",
    "sections.previewTitle": "Circuito esquemático",
    "sections.solveTitle": "Resolver matrices",
    "sections.conversionTitle": "Conversión de matrices",
    "sections.associationTitle": "Asociar cuadripolos",
    "sections.exportTitle": "Explicación y exportación",
    "sections.auditTag": "Auditoría",
    "sections.auditTitle": "Markdown técnico del esquema",
    "actions.examples": "Ejemplos",
    "actions.clear": "Limpiar",
    "actions.solve": "Resolver",
    "actions.convert": "Convertir",
    "actions.associate": "Asociar",
    "actions.copyReport": "Copiar reporte",
    "actions.attenuatorSimulator": "Atenuadores",
    "actions.attenuatorSimulatorAria": "Abrir simulador de atenuadores",
    "fields.netlist": "Netlist",
    "fields.source": "Origen",
    "fields.target": "Destino",
    "fields.matrix2x2": "Matriz 2x2",
    "fields.assocType": "Tipo de asociación",
    "fields.twoPortA": "Cuadripolo A",
    "fields.twoPortB": "Cuadripolo B",
    "fields.brune1": "Brune ensayo 1",
    "fields.brune2": "Brune ensayo 2",
    "fields.brunePlaceholder": "0 si no interfiere",
    "builder.title": "Constructor rápido",
    "builder.description": "Primera versión de editor gráfico: agrega ramas típicas del apunte y actualiza el esquema.",
    "builder.value": "Valor",
    "builder.quickBranches": "Ramas rápidas",
    "builder.typicalTopologies": "Topologías típicas",
    "builder.series": "Serie 1-2",
    "builder.inputShunt": "Derivación entrada",
    "builder.middleShunt": "Derivación nodo medio",
    "builder.outputShunt": "Derivación salida",
    "examples.escalera": "Escalera resistiva del apunte",
    "examples.escaleraGuia": "Escalera guia problema 2",
    "examples.t": "Cuadripolo T",
    "examples.tSimetrico": "T simetrico",
    "examples.pi": "Cuadripolo pi",
    "examples.piSimetrico": "Pi simetrico",
    "examples.lEntrada": "L derivacion entrada + serie",
    "examples.lSalida": "L serie + derivacion salida",
    "examples.tPuenteado": "T puenteado",
    "examples.x": "Celosia / X simetrico",
    "examples.inferior": "Rama inferior con nodo b1",
    "assoc.cascade": "Cascada - usar Gamma",
    "assoc.seriesSeries": "Serie-Serie - usar Z",
    "assoc.parallelParallel": "Paralelo-Paralelo - usar Y",
    "assoc.seriesParallel": "Serie-Paralelo - usar h",
    "assoc.parallelSeries": "Paralelo-Serie - usar g",
    "assocLabel.cascade": "Cascada",
    "assocLabel.seriesSeries": "Serie-Serie",
    "assocLabel.parallelParallel": "Paralelo-Paralelo",
    "assocLabel.seriesParallel": "Serie-Paralelo",
    "assocLabel.parallelSeries": "Paralelo-Serie",
    "status.ready": "Listo",
    "status.error": "Error",
    "status.components": "{count} componente(s)",
    "messages.noWarnings": "Sin advertencias.",
    "messages.solveEmpty": "Cargue una netlist y pulse Resolver.",
    "messages.convertEmpty": "Inserte valores de las matrices y presione \"Convertir\".",
    "messages.associateEmpty": "Inserte valores de las matrices y presione \"Asociar\".",
    "matrix.z": "Matriz Z",
    "matrix.y": "Matriz Y",
    "matrix.prefix": "Matriz",
    "matrix.converted": "Matriz",
    "matrix.resultingTwoPort": "Cuadripolo resultante",
    "matrix.impedance": "Impedancia",
    "matrix.admittance": "Admitancia",
    "matrix.hybrid": "Híbrida",
    "matrix.inverseHybrid": "Híbrida inversa",
    "matrix.transmission": "Transmisión / ABCD",
    "states.verified": "verificada",
    "states.notVerified": "no verificada",
    "states.reciprocityZ": "Reciprocidad Z: {state}",
    "states.symmetryZ": "Simetría Z: {state}",
    "states.reciprocal": "Rec\u00edproco",
    "states.symmetric": "Sim\u00e9trico",
    "conditions.title": "Condiciones de existencia",
    "association.using": "{label} usando parámetros {family}.",
    "brune.pending": "Test de Brune pendiente: cargue las variables de interferencia de los dos ensayos si quiere validar la asociación estructural.",
    "brune.incomplete": "Test de Brune incompleto: ambos ensayos deben tener una variable numérica.",
    "brune.valid": "Test de Brune: las variables de interferencia son cero; la suma/producto indicado es admisible.",
    "brune.invalid": "Test de Brune: alguna variable de interferencia no es cero; la asociación modifica los cuadripolos individuales.",
  },
  en: {
    "meta.title": "UTN Two-Port Network Simulator",
    "hero.eyebrow": "Circuit Theory II - UTN",
    "hero.title": "Two-port network simulator",
    "hero.lead": "Draw the live netlist, calculate Z/Y parameters, convert matrix families, associate two-ports, and generate a study-note style solution.",
    "hero.author": "BY ELÍAS RAMÍREZ",
    "prefs.darkMode": "Dark mode",
    "prefs.lightMode": "Light mode",
    "prefs.languageSwitch": "ESPAÑOL",
    "prefs.themeAria": "Toggle theme",
    "prefs.languageAria": "Toggle language",
    "sections.inputTag": "Input",
    "sections.netlistTitle": "Netlist",
    "netlistNote.title": "Fixed terminal convention",
    "netlistNote.body": "The diagram always shows 1, 1', 2, and 2'. If .ports is omitted, the netlist uses P1=(1,0) and P2=(2,0): node 0 is the common return drawn as 1' and 2'. For independent returns use .ports 1 1' 2 2'.",
    "sections.previewTitle": "Engineering schematic",
    "sections.solveTitle": "Solve matrices",
    "sections.conversionTitle": "Matrix conversion",
    "sections.associationTitle": "Associate two-ports",
    "sections.exportTitle": "Explanation and export",
    "sections.auditTag": "Audit",
    "sections.auditTitle": "Technical schematic Markdown",
    "actions.examples": "Examples",
    "actions.clear": "Clear",
    "actions.solve": "Solve",
    "actions.convert": "Convert",
    "actions.associate": "Associate",
    "actions.copyReport": "Copy report",
    "actions.attenuatorSimulator": "Attenuators",
    "actions.attenuatorSimulatorAria": "Open attenuator simulator",
    "fields.netlist": "Netlist",
    "fields.source": "Source",
    "fields.target": "Target",
    "fields.matrix2x2": "2x2 matrix",
    "fields.assocType": "Association type",
    "fields.twoPortA": "Two-port A",
    "fields.twoPortB": "Two-port B",
    "fields.brune1": "Brune test 1",
    "fields.brune2": "Brune test 2",
    "fields.brunePlaceholder": "0 if no interference",
    "builder.title": "Quick builder",
    "builder.description": "First graphic-editor version: add common study-note branches and update the schematic.",
    "builder.value": "Value",
    "builder.quickBranches": "Quick branches",
    "builder.typicalTopologies": "Typical topologies",
    "builder.series": "Series 1-2",
    "builder.inputShunt": "Input shunt",
    "builder.middleShunt": "Middle-node shunt",
    "builder.outputShunt": "Output shunt",
    "examples.escalera": "Study-note resistive ladder",
    "examples.escaleraGuia": "Guide problem 2 ladder",
    "examples.t": "T two-port",
    "examples.tSimetrico": "Symmetric T",
    "examples.pi": "Pi two-port",
    "examples.piSimetrico": "Symmetric pi",
    "examples.lEntrada": "Input shunt + series L",
    "examples.lSalida": "Series + output shunt L",
    "examples.tPuenteado": "Bridged T",
    "examples.x": "Lattice / symmetric X",
    "examples.inferior": "Lower rail with node b1",
    "assoc.cascade": "Cascade - use Gamma",
    "assoc.seriesSeries": "Series-Series - use Z",
    "assoc.parallelParallel": "Parallel-Parallel - use Y",
    "assoc.seriesParallel": "Series-Parallel - use h",
    "assoc.parallelSeries": "Parallel-Series - use g",
    "assocLabel.cascade": "Cascade",
    "assocLabel.seriesSeries": "Series-Series",
    "assocLabel.parallelParallel": "Parallel-Parallel",
    "assocLabel.seriesParallel": "Series-Parallel",
    "assocLabel.parallelSeries": "Parallel-Series",
    "status.ready": "Ready",
    "status.error": "Error",
    "status.components": "{count} component(s)",
    "messages.noWarnings": "No warnings.",
    "messages.solveEmpty": "Load a netlist and press Solve.",
    "messages.convertEmpty": "Enter matrix values and press \"Convert\".",
    "messages.associateEmpty": "Enter matrix values and press \"Associate\".",
    "matrix.z": "Z matrix",
    "matrix.y": "Y matrix",
    "matrix.prefix": "Matrix",
    "matrix.converted": "Matrix",
    "matrix.resultingTwoPort": "Resulting two-port",
    "matrix.impedance": "Impedance",
    "matrix.admittance": "Admittance",
    "matrix.hybrid": "Hybrid",
    "matrix.inverseHybrid": "Inverse hybrid",
    "matrix.transmission": "Transmission / ABCD",
    "states.verified": "verified",
    "states.notVerified": "not verified",
    "states.reciprocityZ": "Z reciprocity: {state}",
    "states.symmetryZ": "Z symmetry: {state}",
    "states.reciprocal": "Reciprocal",
    "states.symmetric": "Symmetric",
    "conditions.title": "Existence conditions",
    "association.using": "{label} using {family} parameters.",
    "brune.pending": "Brune test pending: enter both interference variables if you want to validate the structural association.",
    "brune.incomplete": "Incomplete Brune test: both tests require a numeric variable.",
    "brune.valid": "Brune test: interference variables are zero, so the indicated sum/product is admissible.",
    "brune.invalid": "Brune test: at least one interference variable is not zero, so the association modifies the individual two-ports.",
  },
};

boot();

function boot() {
  applyTheme();
  hydrateExampleButtons();
  applyLanguage();
  controls.netlist.value = loadInitialNetlist();
  setMatrixFields(controls.matrixInputFields, zeroMatrix());
  setMatrixFields(controls.assocAFields, zeroMatrix());
  setMatrixFields(controls.assocBFields, zeroMatrix());
  controls.brune1.value = "0";
  controls.brune2.value = "0";

  controls.netlist.addEventListener("input", debounce(refreshPreview, 120));
  controls.themeToggleBtn.addEventListener("click", toggleTheme);
  controls.languageToggleBtn.addEventListener("click", toggleLanguage);
  $("solveBtn").addEventListener("click", runSolve);
  $("convertBtn").addEventListener("click", runConversion);
  $("associateBtn").addEventListener("click", runAssociation);
  controls.matrixSource.addEventListener("change", updateConversionMatrixInputNotation);
  $("reportBtn").addEventListener("click", showMarkdownReport);
  $("latexBtn").addEventListener("click", showLatexReport);
  $("jsonBtn").addEventListener("click", downloadJson);
  $("printBtn").addEventListener("click", () => window.print());
  $("copyReportBtn").addEventListener("click", copyReport);
  $("clearBtn").addEventListener("click", () => {
    controls.netlist.value = "";
    state.solution = null;
    state.conversion = null;
    state.association = null;
    controls.solveOutput.innerHTML = emptyMessage(t("messages.solveEmpty"));
    renderIdleConversionOutput();
    renderIdleAssociationOutput();
    refreshPreview();
  });
  $("addSeriesBtn").addEventListener("click", () => appendComponent("series"));
  $("addInputShuntBtn").addEventListener("click", () => appendComponent("inputShunt"));
  $("addMiddleShuntBtn").addEventListener("click", () => appendComponent("middleShunt"));
  $("addOutputShuntBtn").addEventListener("click", () => appendComponent("outputShunt"));
  enableSchematicPan();
  updateConversionMatrixInputNotation();

  refreshPreview();
  runSolve();
  renderIdleConversionOutput();
  renderIdleAssociationOutput();
}

function toggleTheme() {
  ui.theme = ui.theme === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEYS.theme, ui.theme);
  applyTheme();
}

function toggleLanguage() {
  ui.language = ui.language === "es" ? "en" : "es";
  localStorage.setItem(STORAGE_KEYS.language, ui.language);
  applyLanguage();
  refreshPreview();
  runSolve();
}

function applyTheme() {
  document.documentElement.dataset.theme = ui.theme;
  if (!controls.themeToggleBtn) return;
  controls.themeToggleBtn.textContent = ui.theme === "dark" ? t("prefs.lightMode") : t("prefs.darkMode");
  controls.themeToggleBtn.setAttribute("aria-label", t("prefs.themeAria"));
  controls.themeToggleBtn.setAttribute("aria-pressed", String(ui.theme === "dark"));
}

function applyLanguage() {
  document.documentElement.lang = ui.language;
  document.title = t("meta.title");

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });

  applyTheme();
  updateExampleButtonLabels();
  updateAssociationOptions();
  controls.languageToggleBtn.textContent = t("prefs.languageSwitch");
  controls.languageToggleBtn.setAttribute("aria-label", t("prefs.languageAria"));
  controls.languageToggleBtn.setAttribute("aria-pressed", String(ui.language === "en"));

  if (state.conversion) {
    runConversion();
  } else {
    renderIdleConversionOutput();
  }

  if (state.association) {
    runAssociation();
  } else {
    renderIdleAssociationOutput();
  }

}

function updateExampleButtonLabels() {
  for (const button of controls.exampleButtons.querySelectorAll("[data-example-key]")) {
    button.textContent = exampleLabel(button.dataset.exampleKey);
  }
}

function updateAssociationOptions() {
  for (const option of controls.assocType.options) {
    option.textContent = t(`assoc.${option.value}`);
  }
}

function t(key, params = {}) {
  const template = TEXT[ui.language]?.[key] ?? TEXT.es[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
}

function loadPreference(key, fallback, allowedValues) {
  const value = localStorage.getItem(key);
  return allowedValues.includes(value) ? value : fallback;
}

function enableSchematicPan() {
  const surface = controls.schematic;
  const pan = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  };

  surface.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });

  surface.addEventListener("pointerdown", (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    pan.active = true;
    pan.pointerId = event.pointerId;
    pan.startX = event.clientX;
    pan.startY = event.clientY;
    pan.scrollLeft = surface.scrollLeft;
    pan.scrollTop = surface.scrollTop;
    surface.classList.add("is-panning");
    surface.setPointerCapture(event.pointerId);
  });

  surface.addEventListener("pointermove", (event) => {
    if (!pan.active || event.pointerId !== pan.pointerId) return;
    event.preventDefault();
    surface.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
    surface.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
  });

  const stopPan = (event) => {
    if (!pan.active || event.pointerId !== pan.pointerId) return;
    pan.active = false;
    pan.pointerId = null;
    surface.classList.remove("is-panning");
    if (surface.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId);
    }
  };

  surface.addEventListener("pointerup", stopPan);
  surface.addEventListener("pointercancel", stopPan);
  surface.addEventListener("lostpointercapture", () => {
    pan.active = false;
    pan.pointerId = null;
    surface.classList.remove("is-panning");
  });
}

function hydrateExampleButtons() {
  controls.exampleButtons.replaceChildren();
  for (const [key, example] of Object.entries(EXAMPLES)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.dataset.exampleKey = key;
    button.textContent = exampleLabel(key, example);
    button.addEventListener("click", () => replaceNetlist(example.netlist));
    controls.exampleButtons.appendChild(button);
  }
}

function exampleLabel(key, example = EXAMPLES[key]) {
  return t(`examples.${key}`) || example?.label || key;
}

function loadInitialNetlist() {
  const params = new URLSearchParams(window.location.search);
  const requestedNetlist = params.get("netlist");
  if (!requestedNetlist) return DEFAULT_NETLIST;
  return requestedNetlist;
}

function refreshPreview() {
  try {
    const preview = buildPreview(controls.netlist.value);
    state.preview = preview;
    controls.schematic.innerHTML = preview.svg;
    controls.markdown.value = preview.markdown;
    controls.warnings.innerHTML = preview.warnings.length
      ? preview.warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")
      : `<p>${escapeHtml(t("messages.noWarnings"))}</p>`;
  } catch (error) {
    controls.schematic.innerHTML = emptyMessage(error.message);
    controls.warnings.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function runSolve() {
  try {
    const solution = solveTwoPort(controls.netlist.value);
    state.solution = solution;
    controls.solveOutput.innerHTML = [
      solveMatricesGallery(solution),
      `<div class="result-grid">
        ${verificationBadge("states.reciprocal", solution.reciprocalZ)}
        ${verificationBadge("states.symmetric", solution.symmetricZ)}
      </div>`,
      stepsHtml(solution.steps),
      solution.warnings.length ? warningsHtml(solution.warnings) : "",
    ].join("");
    showMarkdownReport();
  } catch (error) {
    state.solution = null;
    controls.solveOutput.innerHTML = errorBox(error.message);
  }
}

function runConversion() {
  try {
    const matrix = readMatrixFields(controls.matrixInputFields);
    const conversion = convertMatrix(controls.matrixSource.value, controls.matrixTarget.value, matrix);
    state.conversion = conversion;
    controls.conversionOutput.innerHTML = [
      matrixCard({
        title: `${t("matrix.converted")} ${conversion.source} -> ${conversion.target}`,
        symbol: conversion.target,
        matrix: conversion.result,
      }),
      conditionsHtml(conversion.conditions),
      `<div class="steps">${conversion.steps.map((step) => `<p>${escapeHtml(step)}</p>`).join("")}</div>`,
    ].join("");
    showMarkdownReport();
  } catch (error) {
    state.conversion = null;
    controls.conversionOutput.innerHTML = errorBox(error.message);
  }
}

function runAssociation() {
  try {
    const matrixA = readMatrixFields(controls.assocAFields);
    const matrixB = readMatrixFields(controls.assocBFields);
    const association = associateTwoPorts(controls.assocType.value, matrixA, matrixB, [controls.brune1.value, controls.brune2.value]);
    state.association = association;
    const label = associationLabel(controls.assocType.value, association.label);
    controls.associationOutput.innerHTML = [
      `<p>${escapeHtml(t("association.using", { label, family: association.family }))}</p>`,
      matrixCard({
        title: t("matrix.resultingTwoPort"),
        symbol: association.family,
        matrix: association.result,
      }),
      `<p class="${association.brune.valid === false ? "warn" : association.brune.valid === true ? "ok" : "note"}">${escapeHtml(bruneMessage(association.brune))}</p>`,
      `<div class="steps">${association.steps.map((step) => `<p>${escapeHtml(step)}</p>`).join("")}</div>`,
    ].join("");
    showMarkdownReport();
  } catch (error) {
    state.association = null;
    controls.associationOutput.innerHTML = errorBox(error.message);
  }
}

function renderIdleConversionOutput() {
  controls.conversionOutput.innerHTML = emptyMessage(t("messages.convertEmpty"));
}

function renderIdleAssociationOutput() {
  controls.associationOutput.innerHTML = emptyMessage(t("messages.associateEmpty"));
}

function associationLabel(type, fallback) {
  const label = t(`assocLabel.${type}`);
  return label === `assocLabel.${type}` ? fallback : label;
}

function bruneMessage(brune) {
  const key = `brune.${brune.status}`;
  const message = t(key);
  return message === key ? brune.message : message;
}

function verificationBadge(labelKey, passed) {
  const label = t(labelKey);
  const status = t(passed ? "states.verified" : "states.notVerified");
  const icon = passed ? "&#10003;" : "&#10005;";
  return `<span class="state-badge state-badge--${passed ? "ok" : "error"}" title="${escapeHtml(`${label}: ${status}`)}" aria-label="${escapeHtml(`${label}: ${status}`)}">
    <span class="state-badge__label">${escapeHtml(label)}</span>
    <span class="state-badge__icon" aria-hidden="true">${icon}</span>
  </span>`;
}

function showMarkdownReport() {
  const report = generateReport({
    netlist: controls.netlist.value,
    preview: state.preview,
    solution: state.solution,
    conversion: state.conversion,
    association: state.association,
  });
  controls.exportOutput.value = report;
}

function showLatexReport() {
  controls.exportOutput.value = generateLatexReport({
    netlist: controls.netlist.value,
    solution: state.solution,
    conversion: state.conversion,
    association: state.association,
  });
}

function copyReport() {
  controls.exportOutput.select();
  document.execCommand("copy");
}

function downloadJson() {
  const payload = {
    netlist: controls.netlist.value,
    preview: state.preview,
    solution: state.solution,
    conversion: state.conversion,
    association: state.association,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cuadripolo.json";
  link.click();
  URL.revokeObjectURL(url);
}

function appendComponent(kind) {
  const value = controls.builderValue.value.trim() || "50";
  const id = nextComponentId();
  const snippets = {
    series: `${id} 1 2 ${value}`,
    inputShunt: `${id} 1 0 ${value}`,
    middleShunt: `${id} n1 0 ${value}`,
    outputShunt: `${id} 2 0 ${value}`,
  };
  const current = controls.netlist.value.trim();
  controls.netlist.value = current ? `${current}\n${snippets[kind]}` : snippets[kind];
  refreshPreview();
}

function replaceNetlist(text) {
  controls.netlist.value = text;
  refreshPreview();
  runSolve();
}

function nextComponentId() {
  const matches = controls.netlist.value.match(/\bR(\d+)\b/gi) || [];
  const max = matches.reduce((acc, item) => Math.max(acc, Number(item.slice(1)) || 0), 0);
  return `R${max + 1}`;
}

function matrixFields(prefix) {
  return [
    $(`${prefix}11`),
    $(`${prefix}12`),
    $(`${prefix}21`),
    $(`${prefix}22`),
  ];
}

function zeroMatrix() {
  return [
    [0, 0],
    [0, 0],
  ];
}

function setMatrixFields(fields, matrix) {
  const values = [matrix[0][0], matrix[0][1], matrix[1][0], matrix[1][1]];
  fields.forEach((field, index) => {
    if (!field) return;
    field.value = String(values[index]);
  });
}

function readMatrixFields(fields) {
  const values = fields.map((field) => field?.value?.trim() ?? "");
  return parseMatrixText(`${values[0]} ${values[1]}; ${values[2]} ${values[3]}`);
}

function updateConversionMatrixInputNotation() {
  const family = controls.matrixSource.value || "Z";
  const symbol = matrixInputSymbol(family);
  const spoken = matrixInputSpokenFamily(family);
  controls.matrixInputLabelNodes.forEach((node) => {
    const index = node.dataset.matrixSourceLabel;
    node.innerHTML = `<span class="matrix-index-glyph">${escapeHtml(symbol)}</span><span class="matrix-index-sub">${escapeHtml(index)}</span>`;
  });
  controls.matrixInputFields.forEach((field, index) => {
    const suffix = ["11", "12", "21", "22"][index];
    field.setAttribute("aria-label", `${spoken} ${suffix}`);
  });
}

function matrixInputSymbol(family) {
  const map = {
    Z: "Z",
    Y: "Y",
    h: "h",
    g: "g",
    Gamma: "Γ",
  };
  return map[family] || family;
}

function matrixInputSpokenFamily(family) {
  const map = {
    Z: "Coeficiente Z",
    Y: "Coeficiente Y",
    h: "Coeficiente h",
    g: "Coeficiente g",
    Gamma: "Coeficiente Gamma",
  };
  return map[family] || "Coeficiente";
}

function matrixCard({ title, symbol, matrix }) {
  return `<div class="matrix-card">
    <h4>${escapeHtml(title)}</h4>
    <div class="matrix-equation">
      <span class="matrix-symbol" aria-label="Simbolo de matriz ${escapeHtml(symbol)}">
        <span class="matrix-bar" aria-hidden="true">|</span>
        <span class="matrix-name">${escapeHtml(symbol)}</span>
        <span class="matrix-bar" aria-hidden="true">|</span>
        <span class="matrix-equals" aria-hidden="true">=</span>
      </span>
      <div class="matrix">
        <span>${escapeHtml(formatNumberCell(matrix[0][0]))}</span>
        <span>${escapeHtml(formatNumberCell(matrix[0][1]))}</span>
        <span>${escapeHtml(formatNumberCell(matrix[1][0]))}</span>
        <span>${escapeHtml(formatNumberCell(matrix[1][1]))}</span>
      </div>
    </div>
  </div>`;
}

function solveMatricesGallery(solution) {
  const cards = [
    matrixCard({ title: `${t("matrix.z")} (${t("matrix.impedance")})`, symbol: "Z", matrix: solution.z }),
    matrixCard({ title: `${t("matrix.y")} (${t("matrix.admittance")})`, symbol: "Y", matrix: solution.y }),
    ...derivedFamiliesCards(solution.derivedFamilies),
  ];
  return `<div class="matrix-gallery matrix-gallery--solve">${cards.join("")}</div>`;
}

function derivedFamiliesHtml(derivedFamilies = []) {
  if (!derivedFamilies.length) return "";
  return `<div class="matrix-gallery">${derivedFamiliesCards(derivedFamilies).join("")}</div>`;
}

function derivedFamiliesCards(derivedFamilies = []) {
  return derivedFamilies.map((family) => {
    if (family.status === "ok") {
      return matrixCard({
        title: `${t("matrix.prefix")} ${family.label} (${matrixFamilyName(family.target)})`,
        symbol: family.target,
        matrix: family.matrix,
      });
    }
    return `<div class="matrix-card warn-box">
      <h4>${escapeHtml(t("matrix.prefix"))} ${escapeHtml(family.label)}</h4>
      <p>${escapeHtml(family.message)}</p>
    </div>`;
  });
}

function stepsHtml(steps) {
  return `<div class="steps">${steps.map((step) => `
    <article>
      <h4>${escapeHtml(step.title)}</h4>
      <p>${escapeHtml(step.text)}</p>
      ${(step.equations || []).map((equation) => `<code>${escapeHtml(equation)}</code>`).join("")}
    </article>`).join("")}</div>`;
}

function conditionsHtml(conditions) {
  if (!conditions.length) return "";
  return `<div class="conditions"><strong>${escapeHtml(t("conditions.title"))}</strong>${conditions.map((condition) => `<p>${escapeHtml(condition)}</p>`).join("")}</div>`;
}

function warningsHtml(warnings) {
  return `<div class="warn-box">${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</div>`;
}

function errorBox(message) {
  return `<div class="error-box">${escapeHtml(message)}</div>`;
}

function emptyMessage(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function formatNumberCell(value) {
  if (!Number.isFinite(value)) return "indef.";
  if (Math.abs(value) < 1e-10) return "0";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return Number(value.toFixed(5)).toString();
}

function matrixFamilyName(family) {
  const names = {
    Z: t("matrix.impedance"),
    Y: t("matrix.admittance"),
    h: t("matrix.hybrid"),
    g: t("matrix.inverseHybrid"),
    Gamma: t("matrix.transmission"),
  };
  return names[family] || family;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
