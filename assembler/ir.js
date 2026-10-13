'use strict';
/**
 * ir.js
 * -----------------------------------------------------------------------
 * Passo 2 (parte b) e 3: statements -> IR pronto para o encoder.
 *
 *   1) expandStatements  - aplica #define e desenrola blocos #repeat
 *   2) pass1 (endereçamento) - percorre a lista já expandida, aplica
 *      #org, registra labels e classifica cada instrução na sua "forma"
 *      de codificação (ex: lda_imm, br_reg, push2...), calculando o
 *      endereço de cada uma.
 *   3) pass2 (resolução)    - agora que todo label tem endereço, resolve
 *      as expressões de imediato pendentes (ex: `br meu_label`).
 *
 * Resultado: uma lista de entradas { type:'pad', count } ou
 * { type:'instr', address, size, form, resolved, immWordValue? } que o
 * encoder consome diretamente.
 * -----------------------------------------------------------------------
 */

const { REGISTERS, FLAGS, BRANCH_SHORTHAND, OPCODES, sizeOfForm } = require('./isa');

function evalExpr(expr, symbols) {
  switch (expr.t) {
    case 'num': return expr.v;
    case 'ident': {
      if (!symbols.has(expr.v)) throw new Error(`símbolo indefinido: '${expr.v}'`);
      return symbols.get(expr.v);
    }
    case 'add': return evalExpr(expr.left, symbols) + evalExpr(expr.right, symbols);
    case 'sub': return evalExpr(expr.left, symbols) - evalExpr(expr.right, symbols);
    default: throw new Error(`expressão inválida: ${JSON.stringify(expr)}`);
  }
}

function regCode(name, line) {
  if (!(name in REGISTERS)) {
    throw new Error(`Linha ${line}: registrador inválido '%${name}'`);
  }
  return REGISTERS[name];
}

// ---------------------------------------------------------------------
// Passo 1a: expansão de #define e #repeat
// ---------------------------------------------------------------------
function expandStatements(statements, symbols, out) {
  for (const st of statements) {
    if (st.type === 'define') {
      const value = evalExpr(st.expr, symbols);
      if (symbols.has(st.name)) {
        throw new Error(`Linha ${st.line}: símbolo '${st.name}' redefinido`);
      }
      symbols.set(st.name, value);
      continue;
    }
    if (st.type === 'repeat') {
      const count = evalExpr(st.countExpr, symbols);
      if (!Number.isInteger(count) || count < 0) {
        throw new Error(`Linha ${st.line}: contagem de #repeat deve ser um inteiro >= 0`);
      }
      for (let k = 0; k < count; k++) {
        expandStatements(st.body, symbols, out);
      }
      continue;
    }
    out.push(st); // #org, label e instrução passam direto
  }
}

// ---------------------------------------------------------------------
// Classificação de instruções: (mnemonic, operandos) -> forma de opcode
// ---------------------------------------------------------------------
function expectCount(operands, count, mnemonic, line) {
  if (operands.length !== count) {
    throw new Error(`Linha ${line}: '${mnemonic}' espera ${count} operando(s), recebeu ${operands.length}`);
  }
}

function asReg(op, line) {
  if (op.kind !== 'reg') throw new Error(`Linha ${line}: esperava um registrador (%reg)`);
  return regCode(op.name, line);
}

function asMem(op, line) {
  if (op.kind !== 'mem') throw new Error(`Linha ${line}: esperava um endereço de memória [...]`);
  return op;
}

// destino de branch/call: aceita imediato (#expr) ou registrador (%reg)
function classifyTarget(op, line, immForm, regForm, extra) {
  if (op.kind === 'imm') {
    return { form: immForm, resolved: { ...extra }, deferred: { expr: op.expr, embedded: false } };
  }
  if (op.kind === 'reg') {
    return { form: regForm, resolved: { ...extra, r0: regCode(op.name, line) }, deferred: null };
  }
  throw new Error(`Linha ${line}: alvo inválido, esperava #imediato ou %registrador`);
}

function classifyInstruction(mnemonicRaw, operands, line) {
  const m = mnemonicRaw.toLowerCase();

  const simple = { hlt: 'hlt', nop: 'nop', iret: 'iret', pusha: 'pusha', popa: 'popa' };
  if (m in simple) {
    expectCount(operands, 0, m, line);
    return { form: simple[m], resolved: {}, deferred: null };
  }

  if (m === 'lda' || m === 'sta') {
    expectCount(operands, 2, m, line);
    const r0 = asReg(operands[0], line);
    const mem = asMem(operands[1], line);
    const prefix = m; // 'lda' ou 'sta'
    if (mem.imm !== null && mem.reg === null) {
      return { form: `${prefix}_imm`, resolved: { r0 }, deferred: { expr: mem.imm, embedded: false } };
    }
    if (mem.imm === null && mem.reg !== null) {
      return { form: `${prefix}_reg`, resolved: { r0, r1: regCode(mem.reg, line) }, deferred: null };
    }
    if (mem.imm !== null && mem.reg !== null) {
      return { form: `${prefix}_idx`, resolved: { r0, r1: regCode(mem.reg, line) }, deferred: { expr: mem.imm, embedded: false } };
    }
    throw new Error(`Linha ${line}: endereço de memória vazio em '${m}'`);
  }

  if (m === 'mov') {
    expectCount(operands, 2, m, line);
    const [op0, op1] = operands;
    const isFlags = (op) => op.kind === 'reg' && op.name === 'flags';
    if (isFlags(op0) && !isFlags(op1)) {
      return { form: 'mov_to_flags', resolved: { r0: asReg(op1, line) }, deferred: null };
    }
    if (!isFlags(op0) && isFlags(op1)) {
      return { form: 'mov_from_flags', resolved: { r0: asReg(op0, line) }, deferred: null };
    }
    if (!isFlags(op0) && !isFlags(op1)) {
      return { form: 'mov_reg', resolved: { r0: asReg(op0, line), r1: asReg(op1, line) }, deferred: null };
    }
    throw new Error(`Linha ${line}: 'mov %flags, %flags' não existe`);
  }

  const alu3 = ['add', 'addc', 'sub', 'subc', 'and', 'or', 'xor'];
  if (alu3.includes(m)) {
    expectCount(operands, 3, m, line);
    return {
      form: m,
        resolved: {
          r0: asReg(operands[0], line),
          r1: asReg(operands[1], line),
          r2: asReg(operands[2], line),
        },
        deferred: null,
    };
  }

  if (m === 'not' || m === 'cmp') {
    expectCount(operands, 2, m, line);
    return { form: m, resolved: { r0: asReg(operands[0], line), r1: asReg(operands[1], line) }, deferred: null };
  }

  if (m === 'push' || m === 'pop') {
    if (operands.length < 1 || operands.length > 3) {
      throw new Error(`Linha ${line}: '${m}' aceita de 1 a 3 registradores`);
    }
    const regs = operands.map((o) => asReg(o, line));
    const form = `${m}${regs.length}`;
    const resolved = { r0: regs[0] };
    if (regs.length >= 2) resolved.r1 = regs[1];
    if (regs.length >= 3) resolved.r2 = regs[2];
    return { form, resolved, deferred: null };
  }

  if (m === 'call') {
    expectCount(operands, 1, m, line);
    return classifyTarget(operands[0], line, 'call_imm', 'call_reg', {});
  }

  if (m === 'int') {
    expectCount(operands, 1, m, line);
    const op = operands[0];
    if (op.kind !== 'imm') throw new Error(`Linha ${line}: 'int' espera #imediato`);
    return { form: 'int_', resolved: {}, deferred: { expr: op.expr, embedded: true, field: 'imm' } };
  }

  if (m === 'br' || m in BRANCH_SHORTHAND) {
    let flagName, v, target;
    if (m === 'br') {
      if (operands.length === 1) {
        flagName = 'always';
        v = 0;
        target = operands[0];
      } else if (operands.length === 3) {
        const [flagOp, vOp, targetOp] = operands;
        const flagLower = flagOp.kind === 'bare' ? flagOp.name.toLowerCase() : null;
        if (!flagLower || !(flagLower in FLAGS)) {
          throw new Error(`Linha ${line}: flag de branch inválida (use z, n, c, o, i ou always)`);
        }
        if (vOp.kind !== 'num' || (vOp.value !== 0 && vOp.value !== 1)) {
          throw new Error(`Linha ${line}: valor de flag (V) deve ser 0 ou 1`);
        }
        flagName = flagLower;
        v = vOp.value;
        target = targetOp;
      } else {
        throw new Error(`Linha ${line}: 'br' aceita (alvo) ou (flag, V, alvo)`);
      }
    } else {
      [flagName, v] = BRANCH_SHORTHAND[m];
      expectCount(operands, 1, m, line);
      target = operands[0];
    }
    return classifyTarget(target, line, 'br_imm', 'br_reg', { flag: FLAGS[flagName], v });
  }

  throw new Error(`Linha ${line}: mnemônico desconhecido '${mnemonicRaw}'`);
}

// ---------------------------------------------------------------------
// Diretivas de dados: db (1 byte por valor) / dw (2 bytes por valor)
// ---------------------------------------------------------------------
function operandToExpr(op, line) {
  if (op.kind === 'num') return { t: 'num', v: op.value };
  if (op.kind === 'bare') return { t: 'ident', v: op.name };
  if (op.kind === 'imm') return op.expr;
  throw new Error(`Linha ${line}: valor de dado inválido (use número, #imediato ou um símbolo)`);
}

// ---------------------------------------------------------------------
// Passo 1b (endereçamento) + Passo 2 (resolução)
// ---------------------------------------------------------------------
function buildIR(statements) {
  const symbols = new Map();
  const flat = [];
  expandStatements(statements, symbols, flat);

  const ir = [];
  let address = 0;

  for (const st of flat) {
    if (st.type === 'org') {
      const target = evalExpr(st.expr, symbols);
      if (target < address) {
        throw new Error(`Linha ${st.line}: #org retrocede (atual=0x${address.toString(16)}, alvo=0x${target.toString(16)})`);
      }
      if (target > address) {
        ir.push({ type: 'pad', count: target - address });
        address = target;
      }
      continue;
    }

    if (st.type === 'label') {
      if (symbols.has(st.name)) {
        throw new Error(`Linha ${st.line}: label '${st.name}' já foi definida`);
      }
      symbols.set(st.name, address);
      continue;
    }

    // dados brutos: db (bytes) / dw (palavras de 16 bits)
    const mLower = st.mnemonic.toLowerCase();
    if (mLower === 'db' || mLower === 'dw') {
      if (st.operands.length === 0) {
        throw new Error(`Linha ${st.line}: '${mLower}' precisa de ao menos um valor`);
      }
      const unit = mLower === 'db' ? 1 : 2;
      const exprs = st.operands.map((op) => operandToExpr(op, st.line));
      const size = unit * exprs.length;
      ir.push({ type: 'data', address, size, unit, exprs, line: st.line });
      address += size;
      continue;
    }

    // instrução
    const classified = classifyInstruction(st.mnemonic, st.operands, st.line);
    const size = sizeOfForm(classified.form);
    ir.push({
      type: 'instr',
      address,
      size,
      form: classified.form,
        resolved: classified.resolved,
        deferred: classified.deferred,
        mnemonic: st.mnemonic,
        line: st.line,
    });
    address += size;
  }

  // pass2: resolve expressões pendentes (podem referenciar labels definidas depois)
  for (const entry of ir) {
    if (entry.type === 'instr' && entry.deferred) {
      const value = evalExpr(entry.deferred.expr, symbols);
      if (entry.deferred.embedded) {
        entry.resolved[entry.deferred.field] = value;
      } else {
        entry.immWordValue = value & 0xffff;
      }
    }
    if (entry.type === 'data') {
      const mask = entry.unit === 1 ? 0xff : 0xffff;
      entry.resolvedValues = entry.exprs.map((e) => evalExpr(e, symbols) & mask);
    }
  }

  return { ir, symbols };
}

module.exports = { buildIR, evalExpr };
