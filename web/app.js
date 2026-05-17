import {
  DEFAULT_NETLIST,
  EXAMPLES,
  associateTwoPorts,
  buildPreview,
  convertMatrix,
  formatMatrix,
  generateLatexReport,
  generateReport,
  parseMatrixText,
  solveTwoPort,
} from "./core.js?v=20260516-theme-i18n";

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
  exampleSelect: $("exampleSelect"),
  matrixSource: $("matrixSource"),
  matrixTarget: $("matrixTarget"),
  matrixInput: $("matrixInput"),
  assocType: $("assocType"),
  assocA: $("assocA"),
  assocB: $("assocB"),
  brune1: $("brune1"),
  brune2: $("brune2"),
  builderValue: $("builderValue"),
  statusBadge: $("statusBadge"),
  themeToggleBtn: $("themeToggleBtn"),
  languageToggleBtn: $("languageToggleBtn"),
};

const TEXT = {
  es: {
    "meta.title": "Simulador de Cuadripolos UTN",
    "hero.eyebrow": "Teoria de Circuitos II - UTN",
    "hero.title": "Simulador educativo de cuadripolos",
    "hero.lead": "Dibuja la netlist en vivo, calcula parametros Z/Y, convierte familias, asocia cuadripolos y genera una resolucion tipo apunte.",
    "hero.cardText": "Version web estatica lista para Netlify",
    "prefs.darkMode": "Modo oscuro",
    "prefs.lightMode": "Modo claro",
    "prefs.languageSwitch": "ENGLISH",
    "prefs.themeAria": "Cambiar tema",
    "prefs.languageAria": "Cambiar idioma",
    "sections.inputTag": "Entrada",
    "sections.netlistTitle": "Netlist viva",
    "sections.previewTitle": "Esquema ingenieril",
    "sections.solveTitle": "Resolver matrices",
    "sections.conversionTitle": "Conversion de matrices",
    "sections.associationTitle": "Asociar cuadripolos",
    "sections.exportTitle": "Explicacion y exportacion",
    "sections.auditTag": "Auditoria",
    "sections.auditTitle": "Markdown tecnico del esquema",
    "actions.examples": "Ejemplos",
    "actions.load": "Cargar",
    "actions.clear": "Limpiar",
    "actions.solve": "Resolver",
    "actions.convert": "Convertir",
    "actions.associate": "Asociar",
    "actions.copyReport": "Copiar reporte",
    "fields.netlist": "Netlist",
    "fields.source": "Origen",
    "fields.target": "Destino",
    "fields.matrix2x2": "Matriz 2x2",
    "fields.assocType": "Tipo de asociacion",
    "fields.twoPortA": "Cuadripolo A",
    "fields.twoPortB": "Cuadripolo B",
    "fields.brune1": "Brune ensayo 1",
    "fields.brune2": "Brune ensayo 2",
    "fields.brunePlaceholder": "0 si no interfiere",
    "builder.title": "Constructor rapido",
    "builder.description": "Primera version de editor grafico: agrega ramas tipicas del apunte y actualiza el esquema.",
    "builder.value": "Valor",
    "builder.series": "Serie 1-2",
    "builder.inputShunt": "Derivacion entrada",
    "builder.middleShunt": "Derivacion nodo medio",
    "builder.outputShunt": "Derivacion salida",
    "builder.insertT": "Insertar T",
    "builder.insertPi": "Insertar pi",
    "builder.lowerRail": "Rama inferior",
    "builder.ladder": "Escalera",
    "examples.escalera": "Escalera resistiva del apunte",
    "examples.t": "Cuadripolo T",
    "examples.pi": "Cuadripolo pi",
    "examples.serie": "Impedancia serie Zs",
    "examples.derivacion": "Impedancia en derivacion Zp",
    "examples.dobleParalelo": "Dos derivaciones en paralelo",
    "examples.x": "Cuadripolo X / lattice",
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
    "matrix.z": "Matriz Z",
    "matrix.y": "Matriz Y",
    "matrix.prefix": "Matriz",
    "matrix.resultingTwoPort": "Cuadripolo resultante",
    "states.verified": "verificada",
    "states.notVerified": "no verificada",
    "states.reciprocityZ": "Reciprocidad Z: {state}",
    "states.symmetryZ": "Simetria Z: {state}",
    "conditions.title": "Condiciones de existencia",
    "association.using": "{label} usando parametros {family}.",
    "brune.pending": "Test de Brune pendiente: cargue las variables de interferencia de los dos ensayos si quiere validar la asociacion estructural.",
    "brune.incomplete": "Test de Brune incompleto: ambos ensayos deben tener una variable numerica.",
    "brune.valid": "Test de Brune: las variables de interferencia son cero; la suma/producto indicado es admisible.",
    "brune.invalid": "Test de Brune: alguna variable de interferencia no es cero; la asociacion modifica los cuadripolos individuales.",
  },
  en: {
    "meta.title": "UTN Two-Port Network Simulator",
    "hero.eyebrow": "Circuit Theory II - UTN",
    "hero.title": "Educational two-port simulator",
    "hero.lead": "Draw the live netlist, calculate Z/Y parameters, convert matrix families, associate two-ports, and generate a study-note style solution.",
    "hero.cardText": "Static web version ready for Netlify",
    "prefs.darkMode": "Dark mode",
    "prefs.lightMode": "Light mode",
    "prefs.languageSwitch": "ESPAÑOL",
    "prefs.themeAria": "Toggle theme",
    "prefs.languageAria": "Toggle language",
    "sections.inputTag": "Input",
    "sections.netlistTitle": "Live netlist",
    "sections.previewTitle": "Engineering schematic",
    "sections.solveTitle": "Solve matrices",
    "sections.conversionTitle": "Matrix conversion",
    "sections.associationTitle": "Associate two-ports",
    "sections.exportTitle": "Explanation and export",
    "sections.auditTag": "Audit",
    "sections.auditTitle": "Technical schematic Markdown",
    "actions.examples": "Examples",
    "actions.load": "Load",
    "actions.clear": "Clear",
    "actions.solve": "Solve",
    "actions.convert": "Convert",
    "actions.associate": "Associate",
    "actions.copyReport": "Copy report",
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
    "builder.series": "Series 1-2",
    "builder.inputShunt": "Input shunt",
    "builder.middleShunt": "Middle-node shunt",
    "builder.outputShunt": "Output shunt",
    "builder.insertT": "Insert T",
    "builder.insertPi": "Insert pi",
    "builder.lowerRail": "Lower rail",
    "builder.ladder": "Ladder",
    "examples.escalera": "Study-note resistive ladder",
    "examples.t": "T two-port",
    "examples.pi": "Pi two-port",
    "examples.serie": "Series impedance Zs",
    "examples.derivacion": "Shunt impedance Zp",
    "examples.dobleParalelo": "Two parallel shunts",
    "examples.x": "X / lattice two-port",
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
    "matrix.z": "Z matrix",
    "matrix.y": "Y matrix",
    "matrix.prefix": "Matrix",
    "matrix.resultingTwoPort": "Resulting two-port",
    "states.verified": "verified",
    "states.notVerified": "not verified",
    "states.reciprocityZ": "Z reciprocity: {state}",
    "states.symmetryZ": "Z symmetry: {state}",
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
  hydrateExamples();
  applyLanguage();
  controls.netlist.value = loadInitialNetlist();
  controls.matrixInput.value = "55.454545 7.272727; 7.272727 26.363636";
  controls.assocA.value = "1 40; 0 1";
  controls.assocB.value = "1 30; 0.02 1";

  controls.netlist.addEventListener("input", debounce(refreshPreview, 120));
  controls.themeToggleBtn.addEventListener("click", toggleTheme);
  controls.languageToggleBtn.addEventListener("click", toggleLanguage);
  $("solveBtn").addEventListener("click", runSolve);
  $("convertBtn").addEventListener("click", runConversion);
  $("associateBtn").addEventListener("click", runAssociation);
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
    refreshPreview();
  });
  $("loadExampleBtn").addEventListener("click", () => {
    const example = EXAMPLES[controls.exampleSelect.value];
    if (!example) return;
    controls.netlist.value = example.netlist;
    refreshPreview();
  });
  $("addSeriesBtn").addEventListener("click", () => appendComponent("series"));
  $("addInputShuntBtn").addEventListener("click", () => appendComponent("inputShunt"));
  $("addMiddleShuntBtn").addEventListener("click", () => appendComponent("middleShunt"));
  $("addOutputShuntBtn").addEventListener("click", () => appendComponent("outputShunt"));
  $("insertTBtn").addEventListener("click", () => replaceNetlist(EXAMPLES.t.netlist));
  $("insertPiBtn").addEventListener("click", () => replaceNetlist(EXAMPLES.pi.netlist));
  $("insertLowerBtn").addEventListener("click", () => replaceNetlist(EXAMPLES.inferior.netlist));
  $("insertLadderBtn").addEventListener("click", () => replaceNetlist(DEFAULT_NETLIST));
  enableSchematicPan();

  refreshPreview();
  runSolve();
  runConversion();
  runAssociation();
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
  runConversion();
  runAssociation();
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
  updateExampleLabels();
  updateAssociationOptions();
  controls.languageToggleBtn.textContent = t("prefs.languageSwitch");
  controls.languageToggleBtn.setAttribute("aria-label", t("prefs.languageAria"));
  controls.languageToggleBtn.setAttribute("aria-pressed", String(ui.language === "en"));

  updateStatusFromPreview();
}

function updateExampleLabels() {
  for (const option of controls.exampleSelect.options) {
    option.textContent = exampleLabel(option.value);
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

function hydrateExamples() {
  controls.exampleSelect.replaceChildren();
  for (const [key, example] of Object.entries(EXAMPLES)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = exampleLabel(key, example);
    controls.exampleSelect.appendChild(option);
  }
}

function exampleLabel(key, example = EXAMPLES[key]) {
  return t(`examples.${key}`) || example?.label || key;
}

function loadInitialNetlist() {
  const params = new URLSearchParams(window.location.search);
  const requestedNetlist = params.get("netlist");
  if (!requestedNetlist) return DEFAULT_NETLIST;
  const matchingExample = Object.entries(EXAMPLES).find(([, example]) => example.netlist === requestedNetlist);
  if (matchingExample) controls.exampleSelect.value = matchingExample[0];
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
    updateStatusFromPreview();
  } catch (error) {
    controls.schematic.innerHTML = emptyMessage(error.message);
    controls.warnings.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    controls.statusBadge.textContent = t("status.error");
  }
}

function updateStatusFromPreview() {
  if (!state.preview) {
    controls.statusBadge.textContent = t("status.ready");
    return;
  }
  controls.statusBadge.textContent = t("status.components", { count: state.preview.components.length });
}

function runSolve() {
  try {
    const solution = solveTwoPort(controls.netlist.value);
    state.solution = solution;
    controls.solveOutput.innerHTML = [
      matrixCard(t("matrix.z"), solution.z, "ohm"),
      matrixCard(t("matrix.y"), solution.y, "S"),
      derivedFamiliesHtml(solution.derivedFamilies),
      `<div class="result-grid">
        <span class="${solution.reciprocalZ ? "ok" : "warn"}">${escapeHtml(t("states.reciprocityZ", { state: t(solution.reciprocalZ ? "states.verified" : "states.notVerified") }))}</span>
        <span class="${solution.symmetricZ ? "ok" : "warn"}">${escapeHtml(t("states.symmetryZ", { state: t(solution.symmetricZ ? "states.verified" : "states.notVerified") }))}</span>
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
    const matrix = parseMatrixText(controls.matrixInput.value);
    const conversion = convertMatrix(controls.matrixSource.value, controls.matrixTarget.value, matrix);
    state.conversion = conversion;
    controls.conversionOutput.innerHTML = [
      matrixCard(`${conversion.source} -> ${conversion.target}`, conversion.result),
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
    const matrixA = parseMatrixText(controls.assocA.value);
    const matrixB = parseMatrixText(controls.assocB.value);
    const association = associateTwoPorts(controls.assocType.value, matrixA, matrixB, [controls.brune1.value, controls.brune2.value]);
    state.association = association;
    const label = associationLabel(controls.assocType.value, association.label);
    controls.associationOutput.innerHTML = [
      `<p>${escapeHtml(t("association.using", { label, family: association.family }))}</p>`,
      matrixCard(t("matrix.resultingTwoPort"), association.result),
      `<p class="${association.brune.valid === false ? "warn" : association.brune.valid === true ? "ok" : "note"}">${escapeHtml(bruneMessage(association.brune))}</p>`,
      `<div class="steps">${association.steps.map((step) => `<p>${escapeHtml(step)}</p>`).join("")}</div>`,
    ].join("");
    showMarkdownReport();
  } catch (error) {
    state.association = null;
    controls.associationOutput.innerHTML = errorBox(error.message);
  }
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

function matrixCard(title, matrix, unit = "") {
  return `<div class="matrix-card">
    <h4>${escapeHtml(title)}</h4>
    <div class="matrix">
      <span>${escapeHtml(formatNumberCell(matrix[0][0]))}</span>
      <span>${escapeHtml(formatNumberCell(matrix[0][1]))}</span>
      <span>${escapeHtml(formatNumberCell(matrix[1][0]))}</span>
      <span>${escapeHtml(formatNumberCell(matrix[1][1]))}</span>
    </div>
    <code>${escapeHtml(formatMatrix(matrix, unit))}</code>
  </div>`;
}

function derivedFamiliesHtml(derivedFamilies = []) {
  if (!derivedFamilies.length) return "";
  return `<div class="derived-grid">${derivedFamilies.map((family) => {
    if (family.status === "ok") {
      return matrixCard(`${t("matrix.prefix")} ${family.label}`, family.matrix, family.unit);
    }
    return `<div class="matrix-card warn-box">
      <h4>${escapeHtml(t("matrix.prefix"))} ${escapeHtml(family.label)}</h4>
      <p>${escapeHtml(family.message)}</p>
    </div>`;
  }).join("")}</div>`;
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
