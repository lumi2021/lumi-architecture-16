'use strict';
/**
 * isa.js
 * -----------------------------------------------------------------------
 * Definição centralizada da ISA (architecture.md). Tanto o IR (para saber
 * o tamanho de cada instrução) quanto o encoder (para gerar os bytes)
 * importam essas tabelas, então o formato só é descrito uma vez.
 * -----------------------------------------------------------------------
 */

// Registradores indexáveis (3 bits)
const REGISTERS = {
  zero: 0b000,
  a: 0b001,
  b: 0b010,
  c: 0b011,
  d: 0b100,
  e: 0b101,
  sp: 0b110,
  bp: 0b111,
};

// Códigos de flag usados nas instruções de branch (3 bits)
const FLAGS = {
  z: 0b000,
  n: 0b001,
  c: 0b010,
  o: 0b011,
  i: 0b100,
  always: 0b101,
};

// Mnemônicos "atalho" de branch -> [flag, valor esperado]
const BRANCH_SHORTHAND = {
  brz: ['z', 1],
  brnz: ['z', 0],
  brn: ['n', 1],
  brp: ['n', 0],
  brc: ['c', 1],
  brnc: ['c', 0],
  bro: ['o', 1],
  brno: ['o', 0],
  bri: ['i', 1],
  brni: ['i', 0],
};

/**
 * Tabela de opcodes.
 *   opcode : 6 bits (bits 14..9 da palavra de instrução)
 *   imm    : se true, uma palavra de 16 bits de imediato segue a instrução
 *   build  : (operandosResolvidos) => valor de 9 bits (bits 8..0)
 */
const OPCODES = {
  hlt:            { opcode: 0b000000, imm: false, build: () => 0 },
  nop:            { opcode: 0b000001, imm: false, build: () => 0 },

  lda_imm:        { opcode: 0b000010, imm: true,  build: (o) => (o.r0 << 6) },
  lda_reg:        { opcode: 0b000011, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) },
  lda_idx:        { opcode: 0b000100, imm: true,  build: (o) => (o.r0 << 6) | (o.r1 << 3) },

  sta_imm:        { opcode: 0b000101, imm: true,  build: (o) => (o.r0 << 6) },
  sta_reg:        { opcode: 0b000110, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) },
  sta_idx:        { opcode: 0b000111, imm: true,  build: (o) => (o.r0 << 6) | (o.r1 << 3) },

  mov_reg:        { opcode: 0b001000, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) },
  mov_from_flags: { opcode: 0b001001, imm: false, build: (o) => (o.r0 << 6) },
  mov_to_flags:   { opcode: 0b001010, imm: false, build: (o) => (o.r0 << 6) },

  add:            { opcode: 0b001011, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) | o.r2 },
  addc:           { opcode: 0b001100, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) | o.r2 },
  sub:            { opcode: 0b001101, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) | o.r2 },
  subc:           { opcode: 0b001110, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) | o.r2 },
  and:            { opcode: 0b001111, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) | o.r2 },
  or:             { opcode: 0b010000, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) | o.r2 },
  xor:            { opcode: 0b010001, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) | o.r2 },
  not:            { opcode: 0b010010, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) },

  cmp:            { opcode: 0b010011, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) },

  push1:          { opcode: 0b010100, imm: false, build: (o) => (o.r0 << 6) },
  push2:          { opcode: 0b010100, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) },
  push3:          { opcode: 0b010100, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) | o.r2 },
  pusha:          { opcode: 0b010101, imm: false, build: () => 0 },

  pop1:           { opcode: 0b010110, imm: false, build: (o) => (o.r0 << 6) },
  pop2:           { opcode: 0b010110, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) },
  pop3:           { opcode: 0b010110, imm: false, build: (o) => (o.r0 << 6) | (o.r1 << 3) | o.r2 },
  popa:           { opcode: 0b010111, imm: false, build: () => 0 },

  br_imm:         { opcode: 0b011000, imm: true,  build: (o) => (o.flag << 6) | (o.v << 5) },
  br_reg:         { opcode: 0b011001, imm: false, build: (o) => (o.flag << 6) | (o.v << 5) | (o.r0 << 2) },

  call_imm:       { opcode: 0b011010, imm: true,  build: () => 0 },
  call_reg:       { opcode: 0b011011, imm: false, build: (o) => (o.r0 << 6) },

  int_:           { opcode: 0b011100, imm: false, build: (o) => (o.imm & 0xff) },
  iret:           { opcode: 0b011101, imm: false, build: () => 0 },
};

// Tamanho em bytes de cada forma: 4 se carrega imediato de 16 bits, senão 2.
function sizeOfForm(form) {
  const spec = OPCODES[form];
  if (!spec) throw new Error(`forma de instrução desconhecida: ${form}`);
  return spec.imm ? 4 : 2;
}

module.exports = { REGISTERS, FLAGS, BRANCH_SHORTHAND, OPCODES, sizeOfForm };
