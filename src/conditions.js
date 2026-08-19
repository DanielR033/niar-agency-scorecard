// Parses and evaluates the boolean condition strings that live in
// src/questions.json's `derivations` object (tier rules, validation-gate
// risk signals, pre-processing triggers). This exists so that every
// threshold, option id and field name tiering.js needs stays in the JSON —
// nothing here hardcodes instrument content, only the grammar those
// strings are written in.
//
// Grammar (case-sensitive on keywords, as written in the source data):
//   expr       := orExpr
//   orExpr     := andExpr ('OR' andExpr)*
//   andExpr    := notExpr ('AND' notExpr)*
//   notExpr    := ['not'] atom
//   atom       := '(' orExpr ')' | 'default' | comparison
//   comparison := IDENT 'in' '[' list ']'
//               | IDENT 'includes' 'any' 'of' '[' list ']'
//               | IDENT 'includes' 'any' WORD 'classification'
//               | IDENT 'includes' STRING ['only']
//               | IDENT ('==' | '!=') STRING
//               | IDENT ('<=' | '>=' | '<' | '>') NUMBER
//   list       := STRING (',' STRING)*

const KEYWORDS = new Set([
  "AND",
  "OR",
  "not",
  "in",
  "includes",
  "any",
  "of",
  "only",
  "classification",
  "default",
]);

function tokenize(source) {
  const re = /'[^']*'|<=|>=|==|!=|[()[\],<>]|[A-Za-z_][A-Za-z0-9_.]*|-?\d+(?:\.\d+)?/g;
  const tokens = [];
  let match;
  while ((match = re.exec(source)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function isString(tok) {
  return tok.startsWith("'") && tok.endsWith("'");
}

function unquote(tok) {
  return tok.slice(1, -1);
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  next() {
    return this.tokens[this.pos++];
  }

  expect(tok) {
    const got = this.next();
    if (got !== tok) throw new Error(`Expected '${tok}' but got '${got}'`);
    return got;
  }

  parse() {
    const node = this.parseOr();
    if (this.pos !== this.tokens.length) {
      throw new Error(`Unexpected trailing token '${this.peek()}'`);
    }
    return node;
  }

  parseOr() {
    let node = this.parseAnd();
    while (this.peek() === "OR") {
      this.next();
      node = { type: "or", left: node, right: this.parseAnd() };
    }
    return node;
  }

  parseAnd() {
    let node = this.parseNot();
    while (this.peek() === "AND") {
      this.next();
      node = { type: "and", left: node, right: this.parseNot() };
    }
    return node;
  }

  parseNot() {
    if (this.peek() === "not") {
      this.next();
      return { type: "not", node: this.parseAtom() };
    }
    return this.parseAtom();
  }

  parseAtom() {
    if (this.peek() === "(") {
      this.next();
      const node = this.parseOr();
      this.expect(")");
      return node;
    }
    if (this.peek() === "default") {
      this.next();
      return { type: "literal", value: true };
    }
    return this.parseComparison();
  }

  parseList() {
    this.expect("[");
    const values = [];
    if (this.peek() !== "]") {
      values.push(unquote(this.next()));
      while (this.peek() === ",") {
        this.next();
        values.push(unquote(this.next()));
      }
    }
    this.expect("]");
    return values;
  }

  parseComparison() {
    const field = this.next();

    if (this.peek() === "in") {
      this.next();
      const values = this.parseList();
      return { type: "in", field, values };
    }

    if (this.peek() === "includes") {
      this.next();
      if (this.peek() === "any") {
        this.next();
        if (this.peek() === "of") {
          this.next();
          const values = this.parseList();
          return { type: "includesAnyOf", field, values };
        }
        const classification = this.next();
        this.expect("classification");
        return { type: "includesAnyClassification", field, classification };
      }
      const value = unquote(this.next());
      let only = false;
      if (this.peek() === "only") {
        this.next();
        only = true;
      }
      return { type: "includes", field, value, only };
    }

    const op = this.next();
    if (op === "==" || op === "!=") {
      const value = unquote(this.next());
      return { type: op === "==" ? "eq" : "neq", field, value };
    }
    if (op === "<=" || op === ">=" || op === "<" || op === ">") {
      const value = Number(this.next());
      return { type: "cmp", op, field, value };
    }

    throw new Error(`Unrecognised operator '${op}' for field '${field}'`);
  }
}

export function parseCondition(source) {
  return new Parser(tokenize(source)).parse();
}

// context: { getAnswer(field) -> string | number | array, resolveOptionField(field, value, attr) -> any }
export function evaluateAst(node, context) {
  switch (node.type) {
    case "literal":
      return node.value;
    case "or":
      return evaluateAst(node.left, context) || evaluateAst(node.right, context);
    case "and":
      return evaluateAst(node.left, context) && evaluateAst(node.right, context);
    case "not":
      return !evaluateAst(node.node, context);
    case "in": {
      const value = context.getAnswer(node.field);
      return node.values.includes(value);
    }
    case "includes": {
      const value = context.getAnswer(node.field) ?? [];
      const arr = Array.isArray(value) ? value : [value];
      if (node.only) return arr.length === 1 && arr[0] === node.value;
      return arr.includes(node.value);
    }
    case "includesAnyOf": {
      const value = context.getAnswer(node.field) ?? [];
      const arr = Array.isArray(value) ? value : [value];
      return arr.some((v) => node.values.includes(v));
    }
    case "includesAnyClassification": {
      const value = context.getAnswer(node.field) ?? [];
      const arr = Array.isArray(value) ? value : [value];
      return arr.some(
        (v) => context.resolveOptionField(node.field, v, "classification") === node.classification
      );
    }
    case "eq":
      return context.getAnswer(node.field) === node.value;
    case "neq":
      return context.getAnswer(node.field) !== node.value;
    case "cmp": {
      const value = context.getAnswer(node.field);
      if (typeof value !== "number") return false;
      switch (node.op) {
        case "<=":
          return value <= node.value;
        case ">=":
          return value >= node.value;
        case "<":
          return value < node.value;
        case ">":
          return value > node.value;
      }
      return false;
    }
    default:
      throw new Error(`Unknown node type '${node.type}'`);
  }
}

export function evaluateCondition(source, context) {
  return evaluateAst(parseCondition(source), context);
}

// Pulls the numeric threshold out of a divergence-reading condition string
// (e.g. "... >= 1.5 on the same dimension" -> 1.5), so the threshold always
// comes from questions.json rather than being retyped in divergence.js.
export function extractThreshold(source) {
  const matches = source.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) throw new Error(`No numeric threshold found in '${source}'`);
  return Number(matches[matches.length - 1]);
}
