import fs from "node:fs";
import { assemble } from "./assembler.mjs";

const program = `
; ====================================================
; Interruption Table (0x0000 - 0x00FF)

org 0x0000
    dw main
    dw 0x0000
    dw 0x0000
    dw 0x0000
    dw 0x0000
    dw 0x0000
    dw 0x0000
    dw 0x0000
    dw 0x0000
    dw 0x0000
    dw ISR_IRQ10

; ====================================================
; Text (Início em 0x0100)

org 0x0100
main:
    lda %a, [#0x0200]       ; %a = Tamanho do vetor
    mov %b, %zero           ; %b = Índice i = 0
    mov %c, %zero           ; %c = Acumulador = 0

    LOOP_START:
    cmp %b, %a              ; Compara índice %b com %a
    brz #0x0112             ; Se %b == %a, pula para o fim do loop (sta)

    lda %d, [#0x0300 + %b]  ; Carrega vetor[i]
    add %c, %c, %d          ; Acumula a soma

    lda %e, [#0x0001]       ; Constante 1
    add %b, %b, %e          ; i++
    br #0x0005              ; Volta para LOOP_START

    sta %c, [#0x0201]       ; Salva resultado da soma

    pusha                   ; Preserva registradores
    call #0x011C            ; Chama subrotina CHECK_LIMIT
    popa                    ; Restaura registradores

    mov %a, %flags          ; Lê flags
    not %b, %a              ; Inverte bits
    and %c, %a, %b          ; AND
    mov %flags, %c          ; Grava de volta nas flags

    int #0x02               ; Dispara IRQ2 (Vector 0x0002)
    hlt                     ; Fim do programa principal

check_limit:
    push %a, %b
    lda %a, [#0x0050]       ; Limite = 80
    cmp %c, %a
    brn #0x0128             ; Se %c < %a, ignora o alerta

    int #0x0A               ; Dispara IRQ10 (Alerta)

    pop %a, %b
    iret

; ====================================================
; Interrupt Handlers

ISR_IRQ2:
    hlt

ISR_IRQ10:
    hlt

`;

const binaryOutput = assemble(program);
const words16 = binaryOutput.map((hex) => parseInt(hex, 16));

const txtContent = words16
    .map((word) => word.toString(2).padStart(16, "0"))
    .join("\n");

fs.writeFileSync("resultado.txt", txtContent, "utf-8");

const buffer = Buffer.alloc(words16.length * 2);
words16.forEach((word, index) => {
    buffer.writeUInt16BE(word, index * 2);
});

fs.writeFileSync("resultado.bin", buffer);
