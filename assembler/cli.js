#!/usr/bin/env node
'use strict';
/**
 * cli.js
 * -----------------------------------------------------------------------
 * Uso:
 *   node cli.js entrada.asm [saida.bin]
 *
 * Se `saida.bin` não for informado, usa o mesmo nome do arquivo de
 * entrada trocando a extensão para .bin.
 * -----------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const { assemble } = require('./assembler');

function main(argv) {
  const [inputPath, outputPathArg] = argv;
  if (!inputPath) {
    console.error('Uso: node cli.js entrada.asm [saida.bin]');
    process.exit(1);
  }

  const outputPath = outputPathArg || inputPath.replace(/\.[^.]+$/, '') + '.bin';
  const source = fs.readFileSync(inputPath, 'utf8');

  let bytes, symbols;
  try {
    ({ bytes, symbols } = assemble(source));
  } catch (err) {
    console.error(`Erro de montagem: ${err.message}`);
    process.exit(1);
  }

  fs.writeFileSync(outputPath, Buffer.from(bytes));

  console.log(`OK: ${bytes.length} bytes -> ${path.resolve(outputPath)}`);
  if (symbols.size > 0) {
    console.log('Símbolos:');
    for (const [name, value] of symbols.entries()) {
      console.log(`  ${name.padEnd(16)} = 0x${value.toString(16).padStart(4, '0')}`);
    }
  }
}

main(process.argv.slice(2));
