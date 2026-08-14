/**
 * Lets an amount field be typed as arithmetic — "250000*5" for five months'
 * rent — instead of making the user reach for a calculator and paste the total.
 *
 * Hand-written rather than `eval`/`new Function`: those execute arbitrary code
 * from an input box, and the app ships a CSP that would block them anyway. The
 * grammar here is deliberately tiny — four operators, brackets, and numbers.
 *
 *   expr    := term (('+' | '-') term)*
 *   term    := factor (('*' | '/') factor)*
 *   factor  := ('+' | '-')? primary
 *   primary := number | '(' expr ')'
 */

export type AmountResult =
  /** Nothing typed yet — not an error, just nothing to show. */
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | {
      status: "ok";
      /** Whole shillings, ready for the API. */
      value: number;
      /** The exact result before rounding, when the two differ. */
      exact: number;
      /** True when the input was more than a plain number. */
      isExpression: boolean;
    };

/**
 * `x` and `×` both multiply, and `÷` divides: people write "250000 x 5" at
 * least as often as they reach for the asterisk. Commas are group separators,
 * so "250,000" is a number rather than two.
 */
const MULTIPLY = new Set(["*", "x", "X", "×"]);
const DIVIDE = new Set(["/", "÷"]);

type Token =
  | { kind: "number"; value: number }
  | { kind: "op"; value: "+" | "-" | "*" | "/" }
  | { kind: "paren"; value: "(" | ")" };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }

    if (char === "+" || char === "-") {
      tokens.push({ kind: "op", value: char });
      index += 1;
      continue;
    }

    if (MULTIPLY.has(char)) {
      tokens.push({ kind: "op", value: "*" });
      index += 1;
      continue;
    }

    if (DIVIDE.has(char)) {
      tokens.push({ kind: "op", value: "/" });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ kind: "paren", value: char });
      index += 1;
      continue;
    }

    if (/[\d.,]/.test(char)) {
      let raw = "";
      while (index < input.length && /[\d.,]/.test(input[index])) {
        raw += input[index];
        index += 1;
      }
      // Commas are separators, never decimal points — this is an en-US
      // formatted app throughout (`formatMoneyFull` uses en-US grouping).
      const cleaned = raw.replace(/,/g, "");
      if (cleaned === "" || cleaned === "." || !/^\d*\.?\d*$/.test(cleaned)) {
        return null;
      }
      const value = Number(cleaned);
      if (!Number.isFinite(value)) return null;
      tokens.push({ kind: "number", value });
      continue;
    }

    // Anything else — a letter, a stray symbol — is a typo, not an operator.
    return null;
  }

  return tokens;
}

function parse(tokens: Token[]): number | null {
  let index = 0;

  function peek(): Token | undefined {
    return tokens[index];
  }

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;

    for (;;) {
      const token = peek();
      if (token?.kind !== "op" || (token.value !== "+" && token.value !== "-")) {
        return left;
      }
      index += 1;
      const right = parseTerm();
      if (right === null) return null;
      left = token.value === "+" ? left + right : left - right;
    }
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;

    for (;;) {
      const token = peek();
      if (token?.kind !== "op" || (token.value !== "*" && token.value !== "/")) {
        return left;
      }
      index += 1;
      const right = parseFactor();
      if (right === null) return null;
      if (token.value === "/" && right === 0) return null;
      left = token.value === "*" ? left * right : left / right;
    }
  }

  function parseFactor(): number | null {
    const token = peek();
    if (token?.kind === "op" && (token.value === "+" || token.value === "-")) {
      index += 1;
      const operand = parseFactor();
      if (operand === null) return null;
      return token.value === "-" ? -operand : operand;
    }
    return parsePrimary();
  }

  function parsePrimary(): number | null {
    const token = peek();
    if (token === undefined) return null;

    if (token.kind === "number") {
      index += 1;
      return token.value;
    }

    if (token.kind === "paren" && token.value === "(") {
      index += 1;
      const inner = parseExpr();
      if (inner === null) return null;
      const closing = peek();
      if (closing?.kind !== "paren" || closing.value !== ")") return null;
      index += 1;
      return inner;
    }

    return null;
  }

  const result = parseExpr();
  // Trailing junk ("250000*5)" or "2 3") means the input was not one
  // expression, even though a prefix of it parsed.
  if (result === null || index !== tokens.length) return null;
  return result;
}

export function evaluateAmount(input: string): AmountResult {
  const trimmed = input.trim();
  if (trimmed === "") return { status: "empty" };

  const tokens = tokenize(trimmed);
  if (tokens === null || tokens.length === 0) {
    return { status: "invalid", message: "Enter a number, or a sum like 250000*5" };
  }

  const exact = parse(tokens);
  if (exact === null || !Number.isFinite(exact)) {
    return { status: "invalid", message: "Enter a number, or a sum like 250000*5" };
  }

  return {
    status: "ok",
    // TZS has no subunit and `Payment.amount` is an Int, so a division that
    // lands between shillings is rounded — and the UI says so rather than
    // quietly changing the figure.
    value: Math.round(exact),
    exact,
    isExpression: tokens.length > 1,
  };
}
