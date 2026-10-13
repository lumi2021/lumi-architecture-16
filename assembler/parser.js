'use strict';
/**
 * parser.js
 * -----------------------------------------------------------------------
 * Passo 2 (parte a): tokens -> lista de "statements" (AST simples).
 *
 * Statements possíveis:
 *   { type: 'label',    name, line }
 *   { type: 'define',   name, expr, line }
 *   { type: 'org',      expr, line }
 *   { type: 'repeat',   countExpr, body: [statements...], line }
 *   { type: 'instr',    mnemonic, operands: [...], line }
 *
 * Operandos possíveis:
 *   { kind: 'reg',  name }                      %a, %flags, ...
 *   { kind: 'imm',  expr }                       #expr
 *   { kind: 'mem',  imm: expr|null, reg: name|null }   [ ... ]
 *   { kind: 'bare', name }                       identificador solto (nome de flag em br)
 *   { kind: 'num',  value }                      número solto (bit V em br)
 *
 * `expr` (usado em imm/define/org/repeat) é:
 *   { t: 'num', v }
 *   { t: 'ident', v: nome }
 *   { t: 'add'|'sub', left, right }
 * -----------------------------------------------------------------------
 */

const DIRECTIVES = new Set(['define', 'org', 'repeat', 'endrepeat']);

function parse(tokens) {
  let pos = 0;

  function peek(offset = 0) { return tokens[pos + offset]; }
  function next() { return tokens[pos++]; }
  function check(type) { return peek().type === type; }
  function expect(type) {
    if (!check(type)) {
      const t = peek();
      throw new Error(`Linha ${t.line}: esperava ${type}, encontrou ${t.type} (${t.value})`);
    }
    return next();
  }
  function skipNewlines() { while (check('NEWLINE')) next(); }

  // expr := termo (('+' | '-') termo)*
  function parseExpr() {
    let left = parseTerm();
    while (check('PLUS') || check('MINUS')) {
      const op = next().type === 'PLUS' ? 'add' : 'sub';
      const right = parseTerm();
      left = { t: op, left, right };
    }
    return left;
  }

  function parseTerm() {
    if (check('NUMBER')) return { t: 'num', v: next().value };
    if (check('IDENT')) return { t: 'ident', v: next().value };
    const t = peek();
    throw new Error(`Linha ${t.line}: esperava número ou identificador em expressão`);
  }

  // [ #expr | %reg | #expr + %reg ]
  function parseMemory() {
    expect('LBRACKET');
    let imm = null;
    let reg = null;
    if (check('HASH')) {
      next();
      // aqui só um termo (número/ident), pois '+' já tem significado próprio
      // (indexação por registrador) dentro de colchetes: [#imm + %reg]
      imm = parseTerm();
      if (check('PLUS')) {
        next();
        expect('PERCENT');
        reg = expect('IDENT').value.toLowerCase();
      }
    } else if (check('PERCENT')) {
      next();
      reg = expect('IDENT').value.toLowerCase();
    } else {
      const t = peek();
      throw new Error(`Linha ${t.line}: endereço de memória inválido`);
    }
    expect('RBRACKET');
    return { kind: 'mem', imm, reg };
  }

  function parseOperand() {
    if (check('PERCENT')) {
      next();
      return { kind: 'reg', name: expect('IDENT').value.toLowerCase() };
    }
    if (check('HASH')) {
      next();
      return { kind: 'imm', expr: parseExpr() };
    }
    if (check('LBRACKET')) {
      return parseMemory();
    }
    if (check('NUMBER')) {
      return { kind: 'num', value: next().value };
    }
    if (check('IDENT')) {
      // mantém a caixa original: pode ser um nome de flag (z/n/c/o/i) OU
      // um símbolo (#define/label) usado em `db`/`dw`, que é case-sensitive
      return { kind: 'bare', name: next().value };
    }
    const t = peek();
    throw new Error(`Linha ${t.line}: operando inválido (${t.type})`);
  }

  function parseOperandList() {
    const operands = [];
    if (check('NEWLINE') || check('EOF')) return operands;
    operands.push(parseOperand());
    while (check('COMMA')) {
      next();
      operands.push(parseOperand());
    }
    return operands;
  }

  // Statement de diretiva: já consumimos o HASH, o próximo IDENT é a palavra-chave
  function parseDirective(line) {
    const keyword = expect('IDENT').value.toLowerCase();
    if (keyword === 'define') {
      const name = expect('IDENT').value;
      const expr = parseExpr();
      return { type: 'define', name, expr, line };
    }
    if (keyword === 'org') {
      const expr = parseExpr();
      return { type: 'org', expr, line };
    }
    if (keyword === 'repeat') {
      const countExpr = parseExpr();
      skipNewlines();
      const body = parseStatements(['endrepeat']);
      // consome o "#endrepeat" que encerrou o bloco
      expect('HASH');
      const end = expect('IDENT').value.toLowerCase();
      if (end !== 'endrepeat') {
        throw new Error(`Linha ${line}: #repeat sem #endrepeat correspondente`);
      }
      return { type: 'repeat', countExpr, body, line };
    }
    throw new Error(`Linha ${line}: diretiva desconhecida '#${keyword}'`);
  }

  // Lê statements até EOF ou até encontrar uma diretiva cuja palavra-chave
  // esteja em `stopKeywords` (usado para fechar blocos #repeat). Nesse caso
  // o HASH + IDENT de parada NÃO são consumidos aqui — o chamador cuida disso.
  function parseStatements(stopKeywords) {
    const statements = [];
    skipNewlines();
    while (!check('EOF')) {
      if (stopKeywords && check('HASH') && peek(1).type === 'IDENT' &&
        stopKeywords.includes(peek(1).value.toLowerCase())) {
        return statements;
        }

        const t = peek();

      if (t.type === 'HASH') {
        next();
        statements.push(parseDirective(t.line));
        skipNewlines();
        continue;
      }

      if (t.type === 'IDENT' && peek(1).type === 'COLON') {
        const name = next().value;
        next(); // ':'
        statements.push({ type: 'label', name, line: t.line });
        skipNewlines();
        continue;
      }

      if (t.type === 'IDENT') {
        const mnemonic = next().value;
        const operands = parseOperandList();
        statements.push({ type: 'instr', mnemonic, operands, line: t.line });
        if (!check('EOF')) expect('NEWLINE');
        skipNewlines();
        continue;
      }

      throw new Error(`Linha ${t.line}: statement inválido começando com ${t.type}`);
    }
    if (stopKeywords) {
      throw new Error('Fim do arquivo dentro de um bloco #repeat sem #endrepeat');
    }
    return statements;
  }

  return parseStatements(null);
}

module.exports = { parse };
