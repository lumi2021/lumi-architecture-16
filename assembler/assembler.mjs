import { OPCODES, REGISTERS, BRANCH_CONDITIONS } from "./encoding.mjs";

const KNOWN_COMMANDS = new Set([
    "hlt", "nop", "lda", "sta", "mov", "add", "addc", "sub", "subc",
    "and", "or", "xor", "not", "cmp", "push", "pusha", "pop", "popa",
    "br", "brz", "brnz", "brn", "brp", "brc", "brnc", "bro", "brno",
    "bri", "brni", "bi", "call", "int", "iret", "org", "dw", "word"
]);

function lexer(sourceCode) {
    const cleanCode = sourceCode
        .split("\n")
        .map((line) => line.split(";")[0])
        .join("\n");

    const rawTokens = cleanCode.trim().split(/\s+/).filter(Boolean);

    const statements = [];
    let currentMnemonic = null;
    let currentArgTokens = [];

    const flushStatement = () => {
        if (!currentMnemonic) return;
        const argsRaw = currentArgTokens.join(" ");
        const args = argsRaw
            ? argsRaw.split(",").map((arg) => arg.trim()).filter(Boolean)
            : [];
        statements.push({ mnemonic: currentMnemonic, args });
        currentMnemonic = null;
        currentArgTokens = [];
    };

    for (const token of rawTokens) {
        const lower = token.toLowerCase();
        if (KNOWN_COMMANDS.has(lower)) {
            flushStatement();
            currentMnemonic = lower;
        } else {
            if (currentMnemonic) {
                currentArgTokens.push(token);
            }
        }
    }
    flushStatement();

    return statements;
}

function parseImmediate(str) {
    if (!str) return 0;
    let clean = str.trim().replace("#", "");

    // Suporte ao formato hexadecimal terminado em 'h' / 'H' (ex: 00FFh)
    if (/^[0-9a-fA-F]+h$/i.test(clean)) {
        clean = "0x" + clean.slice(0, -1);
    }

    if (clean.startsWith("0x") || clean.startsWith("0X")) {
        return parseInt(clean, 16);
    }
    return parseInt(clean, 10);
}

function parseToIR(tokens) {
    return tokens.flatMap(({ mnemonic, args }) => {
        // Diretivas
        if (mnemonic === "org") {
            return [{ type: "ORG", address: parseImmediate(args[0]) }];
        }

        if (mnemonic === "dw" || mnemonic === "word") {
            // Permite múltiplos valores na mesma diretiva: dw 0x0001, 0x0002, 0x0003
            return args.map((arg) => ({
                type: "RAW_DATA",
                value: parseImmediate(arg),
            }));
        }

        // Instruções de Controle
        if (mnemonic === "hlt") return [{ type: "HLT" }];
        if (mnemonic === "nop") return [{ type: "NOP" }];
        if (mnemonic === "iret") return [{ type: "IRET" }];
        if (mnemonic === "pusha") return [{ type: "PUSHA" }];
        if (mnemonic === "popa") return [{ type: "POPA" }];

        // Movimentação de Flags
        if (mnemonic === "mov") {
            if (args[1] === "%flags") {
                return [{ type: "MOV_FROM_FLAGS", r0: REGISTERS[args[0]] }];
            }
            if (args[0] === "%flags") {
                return [{ type: "MOV_TO_FLAGS", r0: REGISTERS[args[1]] }];
            }
            return [{
                type: "MOV_REG",
                r0: REGISTERS[args[0]],
                r1: REGISTERS[args[1]],
            }];
        }

        // Leitura da Memória (LDA)
        if (mnemonic === "lda") {
            const r0 = REGISTERS[args[0]];
            const src = args[1];

            if (src.includes("+")) {
                const match = src.match(/\[#([^+]+)\+\s*(%[a-z0-9]+)\]/i);
                return [{
                    type: "LDA_OFF",
                    r0,
                    imm: parseImmediate(match[1]),
                    r1: REGISTERS[match[2]],
                }];
            } else if (src.startsWith("[#")) {
                const immStr = src.replace("[", "").replace("]", "");
                return [{ type: "LDA_IMM", r0, imm: parseImmediate(immStr) }];
            } else if (src.startsWith("[%")) {
                const regStr = src.replace("[", "").replace("]", "");
                return [{ type: "LDA_REG", r0, r1: REGISTERS[regStr] }];
            }
        }

        // Escrita na Memória (STA)
        if (mnemonic === "sta") {
            const r0 = REGISTERS[args[0]];
            const dest = args[1];

            if (dest.includes("+")) {
                const match = dest.match(/\[#([^+]+)\+\s*(%[a-z0-9]+)\]/i);
                return [{
                    type: "STA_OFF",
                    r0,
                    imm: parseImmediate(match[1]),
                    r1: REGISTERS[match[2]],
                }];
            } else if (dest.startsWith("[#")) {
                const immStr = dest.replace("[", "").replace("]", "");
                return [{ type: "STA_IMM", r0, imm: parseImmediate(immStr) }];
            } else if (dest.startsWith("[%")) {
                const regStr = dest.replace("[", "").replace("]", "");
                return [{ type: "STA_REG", r0, r1: REGISTERS[regStr] }];
            }
        }

        // Aritmética e Lógica
        if (
            ["add", "addc", "sub", "subc", "and", "or", "xor"].includes(mnemonic)
        ) {
            return [{
                type: mnemonic.toUpperCase(),
                r0: REGISTERS[args[0]],
                r1: REGISTERS[args[1]],
                r2: REGISTERS[args[2]],
            }];
        }

        if (mnemonic === "not") {
            return [{
                type: "NOT",
                r0: REGISTERS[args[0]],
                r1: REGISTERS[args[1]],
            }];
        }

        if (mnemonic === "cmp") {
            return [{
                type: "CMP",
                r0: REGISTERS[args[0]],
                r1: REGISTERS[args[1]],
            }];
        }

        if (mnemonic === "push") {
            return [{
                type: "PUSH",
                r0: REGISTERS[args[0]] || 0,
                r1: REGISTERS[args[1]] || 0,
                r2: REGISTERS[args[2]] || 0,
            }];
        }

        if (mnemonic === "pop") {
            return [{
                type: "POP",
                r0: REGISTERS[args[0]] || 0,
                r1: REGISTERS[args[1]] || 0,
                r2: REGISTERS[args[2]] || 0,
            }];
        }

        if (BRANCH_CONDITIONS[mnemonic] || mnemonic === "bi") {
            const cond = BRANCH_CONDITIONS[mnemonic] || BRANCH_CONDITIONS.br;
            const target = args[0];

            if (target.startsWith("#")) {
                return [{
                    type: "BR_DIR",
                    flag: cond.flag,
                    v: cond.v,
                    imm: parseImmediate(target),
                }];
            } else if (target.startsWith("%")) {
                return [{
                    type: "BR_IND",
                    flag: cond.flag,
                    v: cond.v,
                    r0: REGISTERS[target],
                }];
            }
        }

        if (mnemonic === "call") {
            const target = args[0];
            if (target.startsWith("#")) {
                return [{ type: "CALL_DIR", imm: parseImmediate(target) }];
            } else {
                return [{ type: "CALL_IND", r0: REGISTERS[target] }];
            }
        }

        if (mnemonic === "int") {
            return [{ type: "INT", imm: parseImmediate(args[0]) }];
        }

        throw new Error(`Instrução ou formato não reconhecido: ${mnemonic}`);
    });
}

function getInstructionWords(node) {
    const words = [];
    switch (node.type) {
        case "HLT":
            words.push(OPCODES.HLT << 9);
            break;

        case "NOP":
            words.push(OPCODES.NOP << 9);
            break;

        case "LDA_IMM":
            words.push((1 << 15) | (OPCODES.LDA_IMM << 9) | (node.r0 << 6));
            words.push(node.imm & 0xffff);
            break;

        case "LDA_REG":
            words.push((OPCODES.LDA_REG << 9) | (node.r0 << 6) | (node.r1 << 3));
            break;

        case "LDA_OFF":
            words.push(
                (1 << 15) |
                    (OPCODES.LDA_OFF << 9) |
                    (node.r0 << 6) |
                    (node.r1 << 3)
            );
            words.push(node.imm & 0xffff);
            break;

        case "STA_IMM":
            words.push((1 << 15) | (OPCODES.STA_IMM << 9) | (node.r0 << 6));
            words.push(node.imm & 0xffff);
            break;

        case "STA_REG":
            words.push((OPCODES.STA_REG << 9) | (node.r0 << 6) | (node.r1 << 3));
            break;

        case "STA_OFF":
            words.push(
                (1 << 15) |
                    (OPCODES.STA_OFF << 9) |
                    (node.r0 << 6) |
                    (node.r1 << 3)
            );
            words.push(node.imm & 0xffff);
            break;

        case "MOV_REG":
            words.push((OPCODES.MOV_REG << 9) | (node.r0 << 6) | (node.r1 << 3));
            break;

        case "MOV_FROM_FLAGS":
            words.push((OPCODES.MOV_FROM_FLAGS << 9) | (node.r0 << 6));
            break;

        case "MOV_TO_FLAGS":
            words.push((OPCODES.MOV_TO_FLAGS << 9) | (node.r0 << 6));
            break;

        case "ADD":
        case "ADDC":
        case "SUB":
        case "SUBC":
        case "AND":
        case "OR":
        case "XOR":
            words.push(
                (OPCODES[node.type] << 9) |
                    (node.r0 << 6) |
                    (node.r1 << 3) |
                    node.r2
            );
            break;

        case "NOT":
            words.push((OPCODES.NOT << 9) | (node.r0 << 6) | (node.r1 << 3));
            break;

        case "CMP":
            words.push((OPCODES.CMP << 9) | (node.r0 << 6) | (node.r1 << 3));
            break;

        case "PUSH":
            words.push(
                (OPCODES.PUSH << 9) |
                    (node.r0 << 6) |
                    (node.r1 << 3) |
                    node.r2
            );
            break;

        case "PUSHA":
            words.push(OPCODES.PUSHA << 9);
            break;

        case "POP":
            words.push(
                (OPCODES.POP << 9) |
                    (node.r0 << 6) |
                    (node.r1 << 3) |
                    node.r2
            );
            break;

        case "POPA":
            words.push(OPCODES.POPA << 9);
            break;

        case "BR_DIR":
            words.push(
                (1 << 15) |
                    (OPCODES.BR_DIR << 9) |
                    (node.flag << 6) |
                    (node.v << 5)
            );
            words.push(node.imm & 0xffff);
            break;

        case "BR_IND":
            words.push(
                (OPCODES.BR_IND << 9) |
                    (node.flag << 6) |
                    (node.v << 5) |
                    (node.r0 << 2)
            );
            break;

        case "CALL_DIR":
            words.push((1 << 15) | (OPCODES.CALL_DIR << 9));
            words.push(node.imm & 0xffff);
            break;

        case "CALL_IND":
            words.push((OPCODES.CALL_IND << 9) | (node.r0 << 6));
            break;

        case "INT":
            words.push((OPCODES.INT << 9) | (node.imm & 0xff));
            break;

        case "IRET":
            words.push(OPCODES.IRET << 9);
            break;

        default:
            throw new Error(
                `Instrução IR não mapeada para codificação: ${node.type}`
            );
    }
    return words;
}

function encoder(irList) {
    const memoryMap = new Map();
    let currentAddress = 0;

    for (const node of irList) {
        if (node.type === "ORG") {
            currentAddress = node.address;
            continue;
        }

        if (node.type === "RAW_DATA") {
            memoryMap.set(currentAddress, node.value & 0xffff);
            currentAddress += 1;
            continue;
        }

        const words = getInstructionWords(node);
        for (const word of words) {
            memoryMap.set(currentAddress, word & 0xffff);
            currentAddress += 1;
        }
    }

    if (memoryMap.size === 0) return [];

    const maxAddress = Math.max(...memoryMap.keys());
    const result = [];

    for (let addr = 0; addr <= maxAddress; addr++) {
        const val = memoryMap.get(addr) ?? 0x0000;
        result.push(val);
    }

    return result;
}

export function assemble(sourceCode) {
    const tokens = lexer(sourceCode);
    const ir = parseToIR(tokens);
    const binaryWords = encoder(ir);
    return binaryWords.map((word) => "0x" + word.toString(16).padStart(4, "0"));
}