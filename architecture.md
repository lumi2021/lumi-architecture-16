# Architecture

## Value notation

- `r[x]` - Any indexable register
- `immo[x]` - Any octet immediate value
- `immw[x]` - Any word immediate value
- `*` - Wildcard for ignored bits

## Interrupts

the address space 0x0000 - 0x00ff is reserved for hardware
and software interruptions

|     Vector      |           Interrupt            |
| :-------------: | :----------------------------: |
|     0x0000      |             Reset              |
|     0x0001      | Invalid Instruction Fault (IF) |
| 0x0002 - 0x00fe |         IRQ0 - IRQ252          |
|     0x00ff      |            NMI mask            |


Reset and Invalid Instruction Fault (IF) are non-maskable interrupts.

The NMI Mask is a 16-bit bitmask. Each bit indicates whether the
corresponding IRQ is configured as a non-maskable interrupt (NMI).
Bit 0 corresponds to IRQ0, bit 1 to IRQ1, and so on through bit 15,
which corresponds to IRQ15.

A set bit (`1`) indicates that the corresponding IRQ is non-maskable;
a cleared bit (`0`) indicates that it is maskable.

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

| Register | Description          |
| :------: | :------------------- |
|    PC    | Program Counter      |
|   Ins    | Instruction Register |
|   Arg    | Argument Register    |
|   Addr   | Address Register     |
|   Data   | Data Register        |
|  Flags   | Flags Register       |

## Flags

Status flags register:

| 15  | 14  | 13  | 12  | 11  | 10  |  9  |  8  |  7 .. 0   |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-------: |
|  Z  |  N  |  C  |  O  |  I  |  H  | \*  | \*  | Interrupt |

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
lda %r0, [#immw0]
```

Loads the value in address `#immw0` to `r0` register.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 0 |     | 23 ... 24 |
| :-: | :------: | :-----: | :-----: | --- | :-------: |
|  1  |  000010  |   r0    |   \*    |     |  #immw0   |

- r0 - destination register
- immw0 - immediate address

```
r0 <- Mem[immw0]
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
lda %r0, [#immw0 + %r1]
```

Loads the value in address `#immw0 + r1` into `r0`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |     | 23 ... 24 |
| :-: | :------: | :-----: | :-----: | :-----: | --- | :-------: |
|  1  |  000100  |   r0    |   r1    |   \*    |     |  #immw0   |

- r0 - target register
- r1 - offset register
- immw0 - base immediate value

```
r0 <- Mem[immw0 + r1]
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
sta %r0, [#immw0]
```

Stores the value in `r0` to address `#immw0`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 0 |     | 23 ... 24 |
| :-: | :------: | :-----: | :-----: | :-: | :-------: |
|  1  |  000101  |   r0    |   \*    |     |  #immw0   |

- r0 - origin register
- immw0 - immediate address

```
Mem[immw0] <- r0
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
sta %r0, [#immw0 + %r1]
```

Stores the value in `r0` to address `#immw0 + r1`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |     | 31 ... 16 |
| :-: | :------: | :-----: | :-----: | :-----: | :-: | :-------: |
|  1  |  000111  |   r0    |   r1    |   \*    |     |  #immw0   |

```
Mem[immw0 + r1] <- r0
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

```asm
mov %r0, #immw0
```

Loads the immwediate value `#immw0` directly into register `r0`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 0 |     | 31 ... 16 |
| :-: | :------: | :-----: | :-----: | --- | :-------: |
|  1  |  001001  |   r0    |   \*    |     |  #immw0   |

- r0 - destination register
- immw0 - immediate value

```
r0 <- immw0
Z N C O I H
+ + - - - -
```

Cycles:

```verilog
Ins <- Mem[pc] (PC += 1)
Arg <- Mem[pc] (PC += 1)

r0 <- Arg
```

```asm
mov %r0, %flags
```

Copy data from flags register into register `r0`

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001010  |   r0    |   \*    |   \*    |

```asm
mov %flags, %r0
```

Copy data from register `r0` into flags register

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001011  |   r0    |   \*    |   \*    |

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
|  0  |  001100  |   r0    |   r1    |   r2    |

```asm
addc %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001101  |   r0    |   r1    |   r2    |

```asm
sub %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001110  |   r0    |   r1    |   r2    |

```asm
subc %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  001111  |   r0    |   r1    |   r2    |

```asm
and %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010000  |   r0    |   r1    |   r2    |

```asm
or %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010001  |   r0    |   r1    |   r2    |

```asm
xor %r0, %r1, %r2
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010010  |   r0    |   r1    |   r2    |

```asm
not %r0, %r1
```

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010011  |   r0    |   r1    |   000   |

---

### Bit Manipulation

```asm
setb %r0, #pos, V
```

Sets (`V = 1`) or clears (`V = 0`) bit `pos` of register `r0`, leaving the other bits untouched. Writes to `Zero` are ignored.

| 15  | 14 ... 9 | 8 ... 6 |  5  | 4 ... 1 |  0  |
| :-: | :------: | :-----: | :-: | :-----: | :-: |
|  0  |  010100  |   r0    |  V  |   pos   | \*  |

- r0 - target register
- pos - bit position (0 - 15)
- V - value to write to the bit

```
r0[pos] <- V
Z N C O I H
- - - - - -
```

Cycles:

```verilog
Ins <- Mem[PC] (PC += 1)

ALU-1-A <- r0
ALU-1-B <- mask(pos, V)
r0 <- ALU-1-R
```

```asm
setf #pos, V
```

Sets (`V = 1`) or clears (`V = 0`) bit `pos` of the flags register. Positions follow the flags table (15 = Z, 14 = N, 13 = C, 12 = O, 11 = I, 10 = H, 7 ... 0 = Interrupt).

| 15  | 14 ... 9 | 8 ... 6 |  5  | 4 ... 1 |  0  |
| :-: | :------: | :-----: | :-: | :-----: | :-: |
|  0  |  010101  |   \*    |  V  |   pos   | \*  |

- pos - bit position (0 - 15)
- V - value to write to the bit

```
Flags[pos] <- V
Z N C O I H
only the selected bit changes
```

Cycles:

```verilog
Ins <- Mem[PC] (PC += 1)

Flags[pos] <- V
```

---

### Comparison

```asm
cmp %r0, %r1
```

Subtracts `r1` form `r0`, update flags and discards the result.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010110  |   r0    |   r1    |   \*    |

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
|  0  |  010111  |   r0    |   \*    |

```asm
push %r0, %r1
```

Writes `r0` and `r1` into the stack

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010111  |   r0    |   r1    |   000   |

```asm
push %r0, %r1, %r2
```

Writes `r0`, `r1` and `r2` into the stack

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  010111  |   r0    |   r1    |   r2    |

```asm
pusha
```

Writes all registers into the stack

| 15  | 14 ... 9 | 8 ... 0 |
| :-: | :------: | :-----: |
|  0  |  011000  |   \*    |

```asm
pop %r0
```

Retrieves from the top of the stack to `r0`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 0 |
| :-: | :------: | :-----: | :-----: |
|  0  |  011001  |   r0    |   \0    |

```asm
pop %r0, %r1
```

Retrieves from the top of the stack to `r0` and `r1`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  011001  |   r0    |   r1    |   000   |

```asm
pop %r0, %r1, %r2
```

Retrieves from the top of the stack to `r0`, `r1` and `r2`.

| 15  | 14 ... 9 | 8 ... 6 | 5 ... 3 | 2 ... 0 |
| :-: | :------: | :-----: | :-----: | :-----: |
|  0  |  011001  |   r0    |   r1    |   r2    |

```asm
popa
```

Writes all registers into the stack

| 15  | 14 ... 9 | 8 ... 0 |
| :-: | :------: | :-----: |
|  0  |  011010  |   \*    |

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
br #immw0           ; flag = 101,  V = X
br flag, V, #immw0  ; flag = flag, V = V
brz #immw0          ; flag = 000,  V = 1
brnz #immw0         ; flag = 000,  V = 0
brn #immw0          ; flag = 001,  V = 1
brp #immw0          ; flag = 001,  V = 0
brc #immw0          ; flag = 010,  V = 1
brnc #immw0         ; flag = 010,  V = 0
bro #immw0          ; flag = 011,  V = 1
brno #immw0         ; flag = 011,  V = 0
bri #immw0          ; flag = 100,  V = 1
brni #immw0         ; flag = 100,  V = 0
```

Jumps to address `#immw0` if `flag` matches `V` or if `flag` is `101`.

| 15  | 14 ... 9 | 8 ... 6 |  5  | 4 ... 0 |     | 31 ... 16 |
| :-: | :------: | :-----: | :-: | :-----: | --- | :-------: |
|  1  |  011011  |  flag   |  V  |  00000  |     |  #immw0   |

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
br %r0              ; flag = 101,  V = X
br flag, V, %r0     ; flag = flag, V = V
brz #immw0, %r0     ; flag = 000,  V = 1
brnz #immw0, %r0    ; flag = 000,  V = 0
brn #immw0, %r0     ; flag = 001,  V = 1
brp #immw0, %r0     ; flag = 001,  V = 0
brc #immw0, %r0     ; flag = 010,  V = 1
brnc #immw0, %r0    ; flag = 010,  V = 0
bro #immw0, %r0     ; flag = 011,  V = 1
brno #immw0, %r0    ; flag = 011,  V = 0
bri #immw0, %r0     ; flag = 100,  V = 1
brni #immw0, %r0    ; flag = 100,  V = 0
```

Jumps to address stored in `r0` if `flag` matches `V` or if `flag` is `101`.

| 15  | 14 ... 9 | 8 ... 6 |  5  | 4 ... 2 | 1 0 |
| :-: | :------: | :-----: | :-: | :-----: | :-: |
|  0  |  011100  |  flag   |  V  |   r0    | 00  |

#### Direct / Indirect Call

```asm
call #immw0       ; Chamada Direta
call %r0         ; Chamada Indireta
```

Jumpos to `immw0` or `r0` after saving `pc` into the stack;

**Direct Call:**

| 15  | 14 ... 9 | 8 ... ... 0 |     | 131 ... 16 |
| :-: | :------: | :---------: | :-: | ---------- |
|  1  |  011101  |     \*      |     | #immw0     |

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
|  0  |  011110  |   r0    |   \*   |

Cycles:

```verilog
Ins <- Mem[PC]

Mem[SP] <- PC (SP -= 2)
PC <- r0
```

### Interrupt

```asm
int #immw0
```

Performs software interrupt `#immw0 & 0xff`

| 15  | 14 ... 9 |  8  | 7 ... 0 |
| :-: | :------: | :-: | :-----: |
|  0  |  011111  | \*  | #immo0  |

```asm
iret
```

Returns from an interrupt

| 15  | 14 ... 9 | 8 ... 0 |
| :-: | :------: | :-----: |
|  0  |  100000  |   \*    |
