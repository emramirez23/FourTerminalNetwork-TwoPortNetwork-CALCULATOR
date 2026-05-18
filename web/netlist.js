import { parseScalar } from "./math-utils.js?v=20260518-builder-topologies";

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
  escaleraGuia: {
    label: "Escalera guia problema 2",
    netlist: ["R1 1 n1 50", "R2 n1 n2 30", "R3 n2 n3 37", "R4 n3 2 5", "R5 n1 0 60", "R6 n2 0 10", "R7 n3 0 54"].join("\n"),
  },
  t: {
    label: "Cuadripolo T",
    netlist: ["R1 1 n1 25", "R2 n1 2 35", "R3 n1 0 50"].join("\n"),
  },
  tSimetrico: {
    label: "T simetrico",
    netlist: ["R1 1 n1 25", "R2 n1 2 25", "R3 n1 0 50"].join("\n"),
  },
  pi: {
    label: "Cuadripolo pi",
    netlist: ["R1 1 0 100", "R2 1 2 40", "R3 2 0 80"].join("\n"),
  },
  piSimetrico: {
    label: "Pi simetrico",
    netlist: ["R1 1 0 100", "R2 1 2 40", "R3 2 0 100"].join("\n"),
  },
  lEntrada: {
    label: "L derivacion entrada + serie",
    netlist: ["R1 1 0 40", "R2 1 2 30"].join("\n"),
  },
  lSalida: {
    label: "L serie + derivacion salida",
    netlist: ["R1 1 2 30", "R2 2 0 40"].join("\n"),
  },
  tPuenteado: {
    label: "T puenteado",
    netlist: ["R1 1 n1 20", "R2 n1 2 20", "R3 n1 0 50", "R4 1 2 100"].join("\n"),
  },
  x: {
    label: "Celosia / X simetrico",
    netlist: [".ports 1 1p 2 2p", "R1 1 2 120", "R2 1p 2p 120", "R3 1 2p 300", "R4 1p 2 300"].join("\n"),
  },
  inferior: {
    label: "Rama inferior con nodo b1",
    netlist: [".ports 1 0 2 b2", "R1 1 n1 30", "R2 n1 2 40", "R3 0 b1 15", "R4 b1 b2 25", "R5 n1 b1 50"].join("\n"),
  },
};

const SUPPORTED_COMPONENTS = new Set(["R", "Z", "Y", "L", "C"]);

export function parseNetlist(text) {
  const ports = {
    p1: { id: "P1", positive: "1", negative: "0", voltage: "V1", current: "I1" },
    p2: { id: "P2", positive: "2", negative: "0", voltage: "V2", current: "I2" },
  };
  const components = [];
  const warnings = [];
  const usedIds = new Set();

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripComment(rawLine).trim();
    if (!line) return;
    const tokens = line.split(/\s+/);
    const directive = tokens[0].toLowerCase();

    if (directive === ".port") {
      if (tokens.length < 4) {
        warnings.push(`Línea ${lineNumber}: .port incompleto. Use .port P1 nodo+ nodo-.`);
        return;
      }
      const portId = tokens[1].toUpperCase();
      if (portId === "P1") {
        ports.p1 = { ...ports.p1, positive: tokens[2], negative: tokens[3] };
      } else if (portId === "P2") {
        ports.p2 = { ...ports.p2, positive: tokens[2], negative: tokens[3] };
      } else {
        warnings.push(`Línea ${lineNumber}: puerto desconocido ${tokens[1]}.`);
      }
      return;
    }

    if (directive === ".ports") {
      if (tokens.length < 5) {
        warnings.push(`Línea ${lineNumber}: .ports incompleto. Use .ports p1+ p1- p2+ p2-.`);
        return;
      }
      ports.p1 = { ...ports.p1, positive: tokens[1], negative: tokens[2] };
      ports.p2 = { ...ports.p2, positive: tokens[3], negative: tokens[4] };
      return;
    }

    if (tokens.length < 4) {
      warnings.push(`Línea ${lineNumber}: componente incompleto. Formato: R1 nodoA nodoB valor.`);
      return;
    }

    const [id, nodeA, nodeB, rawValue] = tokens;
    const kind = id[0]?.toUpperCase();
    if (!SUPPORTED_COMPONENTS.has(kind)) {
      warnings.push(`Línea ${lineNumber}: tipo ${kind || "?"} no soportado. Use R, Z, Y, L o C.`);
      return;
    }
    if (tokens.length > 4) {
      warnings.push(`Línea ${lineNumber}: se ignoran tokens extra: ${tokens.slice(4).join(" ")}.`);
    }
    if (usedIds.has(id.toUpperCase())) {
      warnings.push(`Línea ${lineNumber}: el identificador ${id} está repetido.`);
    }
    if (nodeA === nodeB) {
      warnings.push(`Línea ${lineNumber}: ${id} conecta el mismo nodo en ambos extremos.`);
    }

    usedIds.add(id.toUpperCase());
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
      warnings.push(`El borne ${node} no aparece conectado a ningún componente.`);
    }
  }

  return { ports, components, warnings };
}

export function stripComment(line) {
  return line.replace(/[#;].*$/, "");
}

export function isGround(node) {
  return ["0", "gnd", "ground", "ref"].includes(String(node).toLowerCase());
}

export function collectNodes(parsed) {
  return new Set(parsed.components.flatMap((component) => [component.nodeA, component.nodeB]));
}

export function groupBy(items, selector) {
  const map = new Map();
  for (const item of items) {
    const key = selector(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}
