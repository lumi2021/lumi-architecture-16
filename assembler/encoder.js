'use strict';
/**
 * encoder.js
 * -----------------------------------------------------------------------
 * Passo 4: IR resolvido -> bytes (big-endian: cada palavra de 16 bits -
 * palavra de instrução, palavra de imediato, ou elemento de `dw` - é
 * gravada com o byte alto primeiro, seguido do byte baixo).
 * -----------------------------------------------------------------------
 */

const { OPCODES } = require('./isa');

function pushWordBE(bytes, word16) {
  bytes.push((word16 >> 8) & 0xff, word16 & 0xff);
}

function encode(ir) {
  const bytes = [];

  for (const entry of ir) {
    if (entry.type === 'pad') {
      for (let k = 0; k < entry.count; k++) bytes.push(0);
      continue;
    }

    if (entry.type === 'data') {
      for (const value of entry.resolvedValues) {
        if (entry.unit === 1) bytes.push(value & 0xff);
        else pushWordBE(bytes, value & 0xffff);
      }
      continue;
    }

    const spec = OPCODES[entry.form];
    if (!spec) throw new Error(`forma de instrução sem encoder: ${entry.form}`);

    const low9 = spec.build(entry.resolved) & 0x1ff;
    const word = ((spec.imm ? 1 : 0) << 15) | ((spec.opcode & 0x3f) << 9) | low9;
    pushWordBE(bytes, word);

    if (spec.imm) {
      pushWordBE(bytes, entry.immWordValue & 0xffff);
    }
  }

  return Uint8Array.from(bytes);
}

module.exports = { encode };