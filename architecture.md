# Architecture

## Value notation

- `r[x]` - Any indexable register
- `imm[x]` - Any immediate value
- `*` - Wildcard for ignored bits

## Interrupt vectors

the address space 0x0000 - 0x00ff is reserved for hardware
and software interruptions

|     Vector      |         Interrupt         |
| :-------------: | :-----------------------: |
|     0x0000      |           Reset           |
|     0x0001      | Invalid Instruction Fault |
| 0x0002 - 0xffff |       IRQ0 - IRQ253       |

## Registers

| Index | Register | Description              |
| :---: | :------: | :----------------------- |
|  000  |   Zero   | Read-only, aways 0       |
|  001  |    A     | General Purpose Register |
|  010  |    B     | General Purpose Register |
|  011  |    C     | General Purpose Register |
|  100  |    D     | General Purpose Register |
|  101  |    E     | General Purpose Register |
|  110  |    SP    | Stack Pointer            |
|  111  |    BP    | Base Pointer             |

**Non-indexable**

| Register |     Description      |
| :------: | :------------------: |
|    PC    |   Program Counter    |
|   Ins    | Instruction Register |
|   Arg    |  Argument Register   |
|   Addr   |   Address Register   |
|   Data   |    Data Register     |
|  Flags   |    Flags Register    |

## Flags

|   Nome    | Letra |
| :-------: | :---: |
|   Zero    |   Z   |
| Negative  |   N   |
|   Carry   |   C   |
| Overflow  |   O   |
| Interrupt |   I   |
|  Halted   |   H   |

## ISA

### Halt, No Operation

```asm
hlt
```

Halts the machine while waiting for an interrupt signal.

| 15  | 14 ... 9 | 8 ... 0 |
| :-: | :------: | :-----: |
|  0  |  000000  |   \*    |

```
Z N C O I H
- - - - - +
```

```asm
nop
```

No operation. 1 cycle spent.

| 15  | 14 ... 9 | 8 ... 0 |
| :-: | :------: | :-----: |
|  0  |  000001  |   \*    |

Cycles:

```verilog
instruction reg <- Mem[pc] (pc += 1)
```

### Load from Memory

```asm
lda %r0, [#imm0]
```

Loads the value in address `#imm0` to `r0` register.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 0 |     |   23 ... 16   |   31 ... 24    |
| :-: | :------: | :-----: | :-----: | --- | :-----------: | :------------: |
|  1  |  000010  |   r0    |   \*    |     | imm0 low byte | imm0 high byte |

- r0 - destination register
- imm0 - immediate address

```
r0 <- Mem[imm0]
Z N C O I H
+ + - - - -
```

Cycles:

```verilog
Ins <- Mem[pc] (PC += 1)
Arg <- Mem[pc] (PC += 1)

Addr <- Arg
r0 <- Data
```

```asm
lda %r0, [%r1]
```

Loads the value in address `r1` into `r0`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  000011  |   r0    |   r1    |   000   |

```
r0 <- Mem[r1]
Z N C O I H
+ + - - - -
```

Cycles:

```verilog
Inst <- Mem[PC] (PC += 1)

addr reg <- r1
r0 <- data
```

```asm
lda %r0, [#imm0 + %r1]
```

Loads the value in address `#imm0 + r1` into `r0`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |     |   23 ... 16   |   31 ... 24    |
| :-: | :------: | :-----: | :-----: | :-----: | --- | :-----------: | :------------: |
|  1  |  000100  |   r0    |   r1    |   \*    |     | imm0 low byte | imm0 high byte |

- r0 - target register
- r1 - offset register
- imm0 - base immediate value

```
r0 <- Mem[imm0 + r1]
Z N C O I H
+ + - - - -
```

Cycles:

```verilog
Ins <- Mem[PC] PC += 1
Arg  <- Mem[PC] PC += 1

ALU-1-A <- Arg
ALU-1-B <- r1
Addr <- ALU-1-R
r0 <- Data
```

---

### Store to Memory

```asm
sta %r0, [#imm0]
```

Stores the value in `r0` to address `#imm0`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 0 |     |   23 ... 16   |   31 ... 24    |
| :-: | :------: | :-----: | :-----: | :-: | :-----------: | :------------: |
|  1  |  000101  |   r0    |   \*    |     | imm0 low byte | imm0 high byte |

- r0 - origin register
- imm0 - immediate address

```
Mem[imm0] <- r0
Z N C O I H
- - - - - -
```

```asm
sta %r0, [%r1]
```

Stores the value of `r0` to address `r1`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  000110  |   r0    |   r1    |   000   |

```
Mem[r1] <- r0
Z N C O I H
- - - - - -
```

```asm
sta %r0, [#imm0 + %r1]
```

Stores the value in `r0` to address `#imm0 + r1`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |     |   23 ... 16   |   31 ... 24    |
| :-: | :------: | :-----: | :-----: | :-----: | :-: | :-----------: | :------------: |
|  1  |  000111  |   r0    |   r1    |   \*    |     | imm0 low byte | imm0 high byte |

```
Mem[imm0 + r1] <- r0
Z N C O I H
- - - - - -
```

---

### Move Registers

```asm
mov %r0, %r1
```

Copy data from register `r0` into register `r1`

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001000  |   r0    |   r1    |   \*    |

- r0 - destiny register
- r1 - origin register

```
r0 <- r1
Z N C O I H
+ + - - - -
```

---

### Arithmetic

```asm
add %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001001  |   r0    |   r1    |   r2    |

```asm
addc %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001010  |   r0    |   r1    |   r2    |

```asm
sub %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001011  |   r0    |   r1    |   r2    |

```asm
subc %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001100  |   r0    |   r1    |   r2    |

```asm
not %r0, %r1
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001011  |   r0    |   000   |   r1    |

```asm
and %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001101  |   r0    |   r1    |   r2    |

```asm
or %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001110  |   r0    |   r1    |   r2    |

```asm
xor %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001111  |   r0    |   r1    |   r2    |

```asm
not %r0, %r1
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010000  |   r0    |   r1    |   000   |

---

### Comparison

```asm
cmp %r0, %r1
```

Subtracts `r1` form `r0`, update flags and discards the result.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010001  |   r0    |   r1    |   \*    |

```
r0 - r1 (salva flags)
Z N C O I H
+ + + + - -
```

Cycles:

```verilog
Ins <- Mem[PC] (PC += 1)

ALU-1-A <- r0
ALU-1-B <- r1
flags updated
```

---

### Stack

```asm
push %r0
```

Writes `r0` to the stack.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 0 |
| :-: | :------: | :-----: | :-----: |
|  0  |  010010  |   r0    |   \*    |

```asm
push %r0, %r1
```

Writes `r0` and `r1` into the stack

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010010  |   r0    |   r1    |   000   |

```asm
push %r0, %r1, %r2
```

Writes `r0`, `r1` and `r2` into the stack

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010010  |   r0    |   r1    |   r2    |

```asm
pusha
```

Writes all registers into the stack

| 15  | 14 ... 9 | 8 ... 0 |
| :-: | :------: | :-----: |
|  0  |  010011  |   \*    |

```asm
pop %r0
```

Retrieves from the top of the stack to `r0`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 0 |
| :-: | :------: | :-----: | :-----: |
|  0  |  010100  |   r0    |   \0    |

```asm
pop %r0, %r1
```

Retrieves from the top of the stack to `r0` and `r1`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010100  |   r0    |   r1    |   000   |

```asm
pop %r0, %r1, %r2
```

Retrieves from the top of the stack to `r0`, `r1` and `r2`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010100  |   r0    |   r1    |   r2    |

```asm
popa
```

Writes all registers into the stack

| 15  | 14 ... 9 | 8 ... 0 |
| :-: | :------: | :-----: |
|  0  |  010101  |   \*    |

---

### Branch

Flags table (3 bits):

```
    000 = Z
    001 = N
    010 = C
    011 = O
    100 = I
    101 = ALWAYS
    110 = reserved
    111 = reserved
```

#### Direct / Indirect Branch

```asm
br #imm0          ; flag = 101,  V = X
br flag, V, #imm  ; flag = flag, V = V
brz #imm          ; flag = 000,  V = 1
brnz #imm         ; flag = 000,  V = 0
brn #imm          ; flag = 001,  V = 1
brp #imm          ; flag = 001,  V = 0
brc #imm          ; flag = 010,  V = 1
brnc #imm         ; flag = 010,  V = 0
bro #imm          ; flag = 011,  V = 1
brno #imm         ; flag = 011,  V = 0
bri #imm          ; flag = 100,  V = 1
brni #imm         ; flag = 100,  V = 0
```

Jumps to address `#imm0` if `flag` matches `V` or if `flag` is `101`.

| 15  | 14 ... 9 | 8 ... 6 |  5  | 4 ... 0 |     |   23 ... 16   |   31 ... 24    |
| :-: | :------: | :-----: | :-: | :-----: | --- | :-----------: | :------------: |
|  1  |  010101  |  flag   |  V  |  00000  |     | imm0 low byte | imm0 high byte |

Cycles:

```verilog
Ins <- Mem[PC] (PC += 1)
Arg <- Mem[PC] (PC += 1)

if (flag == 101) {
    PC <- Arg
} else {
    if (Flags[flag] == V) PC <- Arg
    else PC += 1
}
```

```asm
bi %r0            ; flag = 101,  V = X
bi flag, V, %r0   ; flag = flag, V = V
biz #imm          ; flag = 000,  V = 1
binz #imm         ; flag = 000,  V = 0
bin #imm          ; flag = 001,  V = 1
bip #imm          ; flag = 001,  V = 0
bic #imm          ; flag = 010,  V = 1
binc #imm         ; flag = 010,  V = 0
bio #imm          ; flag = 011,  V = 1
bino #imm         ; flag = 011,  V = 0
bii #imm          ; flag = 100,  V = 1
bini #imm         ; flag = 100,  V = 0
```

Jumps to address stored in `r0` if `flag` matches `V` or if `flag` is `101`.

| 15  | 14 ... 9 | 8 ... 6 |  5  | 4 ... 2 | 1 0 |
| :-: | :------: | :-----: | :-: | :-----: | :-: |
|  0  |  010110  |  flag   |  V  |   r0    | 00  |

#### Direct / Indirect Call

```asm
call #imm0       ; Chamada Direta
call %r0         ; Chamada Indireta
```

Jumpos to `imm0` or `r0` after saving `pc` into the stack;

**Direct Call:**

| 15  | 14 ... 9 | 8 ... ... 0 |     | 23 ... 16     |   31 ... 24    |
| :-: | :------: | :---------: | :-: | ------------- | :------------: |
|  1  |  010111  |     \*      |     | imm0 low byte | imm0 high byte |

Cycles:

```verilog
Ins <- Mem[PC] (PC += 1)
Arg <- Mem[PC] (PC += 1)

Mem[SP] <- SP (SP -= 2)
PC <- Arg
```

**Indirect Call:**

| 15  | 14 ... 9 | 8 ... 6 | 5 .. 0 |
| :-: | :------: | :-----: | :----: |
|  0  |  011000  |   r0    |   \*   |

Cycles:

```verilog
Ins <- Mem[PC]

Mem[SP] <- PC (SP -= 2)
PC <- r0
```

#### Interrupt

```verilog
int #imm0
```

Performs software interrupt `#imm0 & 0xff`

| 15  | 14 ... 9 |  8  | 7 ... 0 |
| :-: | :------: | :-: | :-----: |
|  0  |  011000  | \*  |  #imm0  |

```verilog
iret
```

Returns from an interrupt

| 15  | 14 ... 9 | 8 ... 0 |
| :-: | :------: | :-----: |
|  0  |  011001  |   \*    |
