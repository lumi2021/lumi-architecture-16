'use strict';
/**
 * assembler.js
 * -----------------------------------------------------------------------
 * assemble(source) roda o pipeline completo:
 *   lexer -> parser -> IR (macros + 2 passadas) -> encoder
 * e devolve { bytes, symbols }.
 * -----------------------------------------------------------------------
 */

const { tokenize } = require('./lexer');
const { parse } = require('./parser');
const { buildIR } = require('./ir');
const { encode } = require('./encoder');

function assemble(source) {
  const tokens = tokenize(source);
  const statements = parse(tokens);
  const { ir, symbols } = buildIR(statements);
  const bytes = encode(ir);
  return { bytes, symbols };
}

module.exports = { assemble };
