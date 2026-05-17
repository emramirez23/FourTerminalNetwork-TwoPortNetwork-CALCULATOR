export const EPS = 1e-10;

export function formatNumber(value) {
  if (!Number.isFinite(value)) return "indef.";
  if (Math.abs(value) < EPS) return "0";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return Number(value.toFixed(6)).toString();
}

export function parseScalar(raw) {
  if (typeof raw === "number") return raw;
  let text = String(raw).trim().replace(",", ".");
  if (!text) return NaN;
  const suffix = text.match(/^([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)([gGkKmMuUnNpP])$/i);
  if (suffix) {
    const multipliers = {
      G: 1e9,
      g: 1e9,
      k: 1e3,
      K: 1e3,
      M: 1e6,
      m: 1e-3,
      u: 1e-6,
      U: 1e-6,
      n: 1e-9,
      N: 1e-9,
      p: 1e-12,
      P: 1e-12,
    };
    return Number(suffix[1]) * multipliers[suffix[2]];
  }
  if (!/^[0-9eE+\-*/().\s]+$/.test(text)) return NaN;
  try {
    const value = evaluateNumericExpression(text);
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

export function validateMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 2 || !matrix.every((row) => Array.isArray(row) && row.length === 2)) {
    throw new Error("La matriz debe ser 2x2.");
  }
  for (const row of matrix) {
    for (const value of row) {
      if (!Number.isFinite(value)) throw new Error("La matriz solo admite numeros reales en esta version web.");
    }
  }
}

export function determinant(matrix) {
  return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
}

export function requireNonZero(value, label) {
  if (Math.abs(value) < EPS) {
    throw new Error(`${label} es cero; la conversion no existe para este caso degenerado.`);
  }
}

export function invertMatrix(matrix) {
  const delta = determinant(matrix);
  requireNonZero(delta, "Determinante");
  return [
    [matrix[1][1] / delta, -matrix[0][1] / delta],
    [-matrix[1][0] / delta, matrix[0][0] / delta],
  ];
}

export function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

export function addMatrices(a, b) {
  return [
    [a[0][0] + b[0][0], a[0][1] + b[0][1]],
    [a[1][0] + b[1][0], a[1][1] + b[1][1]],
  ];
}

export function multiplyMatrices(a, b) {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}

export function zeros(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function evaluateNumericExpression(text) {
  const parser = {
    index: 0,
    input: text,
    consume(token) {
      this.skipWhitespace();
      if (this.input.startsWith(token, this.index)) {
        this.index += token.length;
        return true;
      }
      return false;
    },
    skipWhitespace() {
      while (/\s/.test(this.input[this.index] || "")) this.index += 1;
    },
    parseExpression() {
      let value = this.parseTerm();
      while (true) {
        if (this.consume("+")) value += this.parseTerm();
        else if (this.consume("-")) value -= this.parseTerm();
        else return value;
      }
    },
    parseTerm() {
      let value = this.parsePower();
      while (true) {
        if (this.consume("*")) value *= this.parsePower();
        else if (this.consume("/")) value /= this.parsePower();
        else return value;
      }
    },
    parsePower() {
      const base = this.parseUnary();
      if (this.consume("**")) {
        return base ** this.parsePower();
      }
      return base;
    },
    parseUnary() {
      if (this.consume("+")) return this.parseUnary();
      if (this.consume("-")) return -this.parseUnary();
      return this.parsePrimary();
    },
    parsePrimary() {
      if (this.consume("(")) {
        const value = this.parseExpression();
        if (!this.consume(")")) throw new Error("missing closing parenthesis");
        return value;
      }
      return this.parseNumber();
    },
    parseNumber() {
      this.skipWhitespace();
      const match = this.input.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/i);
      if (!match) throw new Error("expected number");
      this.index += match[0].length;
      return Number(match[0]);
    },
  };

  const value = parser.parseExpression();
  parser.skipWhitespace();
  if (parser.index !== parser.input.length) throw new Error("unexpected token");
  return value;
}
