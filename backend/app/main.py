from __future__ import annotations

from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from backend.app.analysis import AnalysisError
from backend.app.conversion import ConversionError
from backend.app.parser import NetlistParseError
from backend.app.services import convert_matrix, preview_netlist, solve_netlist


class SolveRequest(BaseModel):
    netlist: str = Field(..., min_length=1)
    families: list[Literal["Z", "Y"]] = Field(default_factory=lambda: ["Z", "Y"])


class ConvertRequest(BaseModel):
    source_family: str = Field(..., examples=["Z"])
    matrix: list[list[str | int | float]] = Field(..., examples=[[["610/11", "80/11"], ["80/11", "290/11"]]])
    target_families: list[str] = Field(default_factory=lambda: ["Y"], examples=[["Y", "h", "g", "Gamma"]])


class PreviewRequest(BaseModel):
    netlist: str = Field(default="")


app = FastAPI(title="Simulador de Cuadripolos", version="0.3.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/netlist-preview", response_class=HTMLResponse)
def netlist_preview_page() -> str:
    return _NETLIST_PREVIEW_HTML


@app.post("/solve")
def solve(request: SolveRequest) -> dict[str, object]:
    try:
        return solve_netlist(request.netlist, request.families)
    except (NetlistParseError, AnalysisError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/convert")
def convert(request: ConvertRequest) -> dict[str, object]:
    try:
        return convert_matrix(request.source_family, request.matrix, request.target_families)
    except ConversionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/preview/netlist")
def preview(request: PreviewRequest) -> dict[str, object]:
    return preview_netlist(request.netlist)


_NETLIST_PREVIEW_HTML = """
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Vista previa de netlist</title>
  <style>
    :root {
      --bg: #f5f7f8;
      --ink: #172026;
      --muted: #61717c;
      --line: #c9d3d8;
      --panel: #ffffff;
      --accent: #0f766e;
      --warn: #9a3412;
      --code: #10242a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: "Segoe UI", "Aptos", sans-serif;
    }
    header {
      padding: 18px 24px 10px;
      border-bottom: 1px solid var(--line);
      background: #eef3f4;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0;
    }
    header p {
      margin: 6px 0 0;
      color: var(--muted);
      max-width: 900px;
    }
    main {
      display: grid;
      grid-template-columns: minmax(320px, 0.85fr) minmax(360px, 1.15fr);
      gap: 16px;
      padding: 16px;
      min-height: calc(100vh - 82px);
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
      min-width: 0;
      overflow: hidden;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }
    .status {
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
    }
    textarea {
      width: 100%;
      min-height: 520px;
      padding: 14px;
      border: 0;
      resize: vertical;
      outline: none;
      color: var(--code);
      font: 15px/1.5 "Cascadia Mono", Consolas, monospace;
      background: #fbfdfd;
    }
    .output {
      display: grid;
      grid-template-rows: auto auto minmax(260px, 1fr);
      gap: 0;
      min-height: 620px;
    }
    .graph {
      padding: 12px;
      border-bottom: 1px solid var(--line);
      overflow: auto;
      background: #fbfdfd;
    }
    .graph svg {
      width: 100%;
      min-width: 620px;
      height: auto;
      display: block;
    }
    .warnings {
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      color: var(--warn);
      min-height: 42px;
      font-size: 14px;
      white-space: pre-wrap;
    }
    pre {
      margin: 0;
      padding: 14px;
      overflow: auto;
      white-space: pre-wrap;
      font: 13px/1.45 "Cascadia Mono", Consolas, monospace;
      color: var(--code);
    }
    .toolbar {
      display: flex;
      gap: 8px;
      padding: 10px 14px;
      border-top: 1px solid var(--line);
      background: #f7faf9;
    }
    button {
      border: 1px solid var(--accent);
      background: var(--accent);
      color: white;
      border-radius: 5px;
      padding: 8px 11px;
      cursor: pointer;
      font-weight: 700;
    }
    button.secondary {
      color: var(--accent);
      background: white;
    }
    @media (max-width: 900px) {
      main { grid-template-columns: 1fr; }
      textarea { min-height: 320px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Vista previa de netlist</h1>
    <p>Escribi componentes en formato <code>R1 nodoA nodoB valor</code>. El diagrama, la tabla y las advertencias se actualizan mientras tipeas.</p>
    <p>Convencion: el grafico muestra <code>1</code>, <code>1'</code>, <code>2</code> y <code>2'</code>. Sin <code>.ports</code>, la netlist usa <code>P1=(1,0)</code> y <code>P2=(2,0)</code>; el nodo <code>0</code> es el retorno comun dibujado como <code>1'</code> y <code>2'</code>.</p>
  </header>
  <main>
    <section>
      <div class="section-title">
        <span>Netlist</span>
        <span class="status" id="inputStatus">Listo</span>
      </div>
      <textarea id="netlist" spellcheck="false"></textarea>
      <div class="toolbar">
        <button id="exampleBtn" type="button">Cargar ejemplo</button>
        <button id="clearBtn" class="secondary" type="button">Limpiar</button>
      </div>
    </section>
    <section class="output">
      <div class="section-title">
        <span>Esquema y Markdown</span>
        <span class="status" id="previewStatus">Esperando entrada</span>
      </div>
      <div class="graph" id="graph">Sin componentes completos todavia.</div>
      <div class="warnings" id="warnings">Sin advertencias.</div>
      <pre id="markdown"></pre>
    </section>
  </main>
  <script>
    const sample = [
      "R1 1 n1 30",
      "R2 n1 0 40",
      "R3 n1 n2 50",
      "R4 n2 0 20",
      "R5 n2 2 10"
    ].join("\\n");
    const input = document.getElementById("netlist");
    const markdown = document.getElementById("markdown");
    const graph = document.getElementById("graph");
    const warnings = document.getElementById("warnings");
    const inputStatus = document.getElementById("inputStatus");
    const previewStatus = document.getElementById("previewStatus");
    let timer = 0;
    async function updatePreview() {
      inputStatus.textContent = "Actualizando";
      try {
        const response = await fetch("/preview/netlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ netlist: input.value })
        });
        const data = await response.json();
        markdown.textContent = data.markdown;
        warnings.textContent = data.warnings.length ? data.warnings.join("\\n") : "Sin advertencias.";
        previewStatus.textContent = `${data.components.length} componente(s)`;
        graph.innerHTML = data.svg || "Sin diagrama.";
      } catch (error) {
        warnings.textContent = String(error);
        previewStatus.textContent = "Error";
      } finally {
        inputStatus.textContent = "Listo";
      }
    }

    function scheduleUpdate() {
      window.clearTimeout(timer);
      timer = window.setTimeout(updatePreview, 180);
    }

    document.getElementById("exampleBtn").addEventListener("click", () => {
      input.value = sample;
      updatePreview();
    });
    document.getElementById("clearBtn").addEventListener("click", () => {
      input.value = "";
      updatePreview();
    });
    input.addEventListener("input", scheduleUpdate);
    const params = new URLSearchParams(window.location.search);
    input.value = params.get("netlist") || sample;
    updatePreview();
  </script>
</body>
</html>
"""
