# Lumi's architecture 16

Lumi's architectue 16 (or LA-16) is a tiny RISC 16-bits CPU architecture.
It has it own instruction set documented in [ISA.md](./ISA.md)

## Block diagram:
![Block diagram](./block-diagram.png)

Characteristics:
- Little endian
- 16-bit bytes and words
- 5 general-purpoise word-sized registers
- 16-bit instructions
- 32-bit extended instructions

**Reset pointer:** 0x0000
**Interrupt pointer:** 0x0001
