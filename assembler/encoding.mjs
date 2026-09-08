export const OPCODES = {
    HLT: 0x00, // 000000
    NOP: 0x01, // 000001
    LDA_IMM: 0x02, // 000010
    LDA_REG: 0x03, // 000011
    LDA_OFF: 0x04, // 000100
    STA_IMM: 0x05, // 000101
    STA_REG: 0x06, // 000110
    STA_OFF: 0x07, // 000111
    MOV_REG: 0x08, // 001000
    MOV_FROM_FLAGS: 0x09, // 001001
    MOV_TO_FLAGS: 0x0a, // 001010
    ADD: 0x0b, // 001011
    ADDC: 0x0c, // 001100
    SUB: 0x0d, // 001101
    SUBC: 0x0e, // 001110
    AND: 0x0f, // 001111
    OR: 0x10, // 010000
    XOR: 0x11, // 010001
    NOT: 0x12, // 010010
    CMP: 0x13, // 010011
    PUSH: 0x14, // 010100
    PUSHA: 0x15, // 010101
    POP: 0x16, // 010110
    POPA: 0x17, // 010111
    BR_DIR: 0x18, // 011000
    BR_IND: 0x19, // 011001
    CALL_DIR: 0x1a, // 011010
    CALL_IND: 0x1b, // 011011
    INT: 0x1c, // 011100
    IRET: 0x1d, // 011101
};

export const REGISTERS = {
    zero: 0,
    "%zero": 0,
    a: 1,
    "%a": 1,
    b: 2,
    "%b": 2,
    c: 3,
    "%c": 3,
    d: 4,
    "%d": 4,
    e: 5,
    "%e": 5,
    sp: 6,
    "%sp": 6,
    bp: 7,
    "%bp": 7,
};

export const BRANCH_CONDITIONS = {
    br: { flag: 5, v: 0 },
    brz: { flag: 0, v: 1 },
    brnz: { flag: 0, v: 0 },
    brn: { flag: 1, v: 1 },
    brp: { flag: 1, v: 0 },
    brc: { flag: 2, v: 1 },
    brnc: { flag: 2, v: 0 },
    bro: { flag: 3, v: 1 },
    brno: { flag: 3, v: 0 },
    bri: { flag: 4, v: 1 },
    brni: { flag: 4, v: 0 },
};
