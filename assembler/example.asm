#define BUF_ADDR 0x2000

#org 0x0000
dw #loop

#org 0x0100
start:
    hlt
    nop
    lda %a, [#BUF_ADDR]
    lda %b, [%sp]
    lda %c, [#BUF_ADDR + %d]
    sta %a, [#BUF_ADDR]
    sta %b, [%sp]
    sta %c, [#BUF_ADDR + %d]
    mov %a, %b
    mov %a, %flags
    mov %flags, %b
    add %a, %b, %c
    addc %a, %b, %c
    sub %a, %b, %c
    subc %a, %b, %c
    and %a, %b, %c
    or %a, %b, %c
    xor %a, %b, %c
    not %a, %b
    cmp %a, %b
    push %a
    push %a, %b
    push %a, %b, %c
    pusha
    pop %a
    pop %a, %b
    pop %a, %b, %c
    popa
    br #loop
    brz #loop
    brnz #loop
    brn #loop
    brp #loop
    brc #loop
    brnc #loop
    bro #loop
    brno #loop
    bri #loop
    brni #loop
    br z, 1, #loop
    br %sp
    call #loop
    call %sp
    int #10

loop:
    iret
