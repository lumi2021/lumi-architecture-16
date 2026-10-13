'use strict';
/**
 * lexer.js
 * -----------------------------------------------------------------------
 * Passo 1 do assembler: transforma o texto-fonte em uma lista plana de
 * tokens. Não entende nada de instruções ainda — só reconhece a "forma"
 * dos símbolos (número, identificador, registrador, etc).
 * -----------------------------------------------------------------------
 */

const PUNCT = {
  ',': 'COMMA',
  '[': 'LBRACKET',
  ']': 'RBRACKET',
  '+': 'PLUS',
  '-': 'MINUS',
  ':': 'COLON',
  '#': 'HASH',
  '%': 'PERCENT',
};

function isDigit(ch) { return ch >= '0' && ch <= '9'; }
function isIdentStart(ch) { return /[A-Za-z_]/.test(ch); }
function isIdentChar(ch) { return /[A-Za-z0-9_]/.test(ch); }

function tokenize(source) {
  const tokens = [];
  let line = 1;
  let i = 0;
  const n = source.length;

  function push(type, value) {
    tokens.push({ type, value, line });
  }

  while (i < n) {
    const ch = source[i];

    if (ch === '\n') {
      push('NEWLINE', '\n');
      line++;
      i++;
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++;
      continue;
    }

    // comentário até o fim da linha
    if (ch === ';') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }

    // número: 0x.., 0b.., decimal
    if (isDigit(ch)) {
      let start = i;
      if (ch === '0' && (source[i + 1] === 'x' || source[i + 1] === 'X')) {
        i += 2;
        while (i < n && /[0-9a-fA-F]/.test(source[i])) i++;
        push('NUMBER', parseInt(source.slice(start + 2, i), 16));
        continue;
      }
      if (ch === '0' && (source[i + 1] === 'b' || source[i + 1] === 'B')) {
        i += 2;
        while (i < n && /[01]/.test(source[i])) i++;
        push('NUMBER', parseInt(source.slice(start + 2, i), 2));
        continue;
      }
      while (i < n && isDigit(source[i])) i++;
      push('NUMBER', parseInt(source.slice(start, i), 10));
      continue;
    }

    // identificador (mnemônico, label, nome de define, nome de registrador...)
    if (isIdentStart(ch)) {
      let start = i;
      i++;
      while (i < n && isIdentChar(source[i])) i++;
      push('IDENT', source.slice(start, i));
      continue;
    }

    if (PUNCT[ch]) {
      push(PUNCT[ch], ch);
      i++;
      continue;
    }

    throw new Error(`Linha ${line}: caractere inesperado '${ch}'`);
  }

  push('EOF', null);
  return tokens;
}

module.exports = { tokenize };
