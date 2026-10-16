---
layout: post
title: "攻防世界 reverse II"
toc: true
date: 2026-07-27
categories: 分类名称
tags: [逆向工程]
---

# 攻防世界 reverse II

## crackeme - GFSJ1027（普通 x86 逆向）

拿到题目，扔进 Ubuntu 观察程序。密码验证题。

ELF 可执行文件，无壳。

IDA 静态分析：Ctrl + F 没有找到 main 函数。但是一定会有 start 函数：

```c
// positive sp value has been detected, the output may be wrong!
void __fastcall __noreturn start(__int64 a1, __int64 a2, int a3)
{
  __int64 v3; // rax
  int v4; // esi
  __int64 v5; // [rsp-8h] [rbp-8h] BYREF
  _UNKNOWN *retaddr; // [rsp+0h] [rbp+0h] BYREF

  v4 = v5;
  v5 = v3;
  sub_402180((int)sub_400ADF, v4, (int)&retaddr, (int)sub_402640, (int)sub_4026D0, a3, (__int64)&v5);
}
```

**标准 `__libc_start_main` 的 7 个参数**

```c
int __libc_start_main(
    int (*main)(int, char**, char**),  // 1. main 函数指针
    int argc,                          // 2. 参数个数
    char **argv,                       // 3. 参数数组
    void (*init)(void),                // 4. 初始化函数
    void (*fini)(void),                // 5. 清理函数
    void (*rtld_fini)(void),           // 6. 动态链接器的清理函数
    void *stack_end                    // 7. 栈顶指针
);
```

所以绝大多数的情况下，第一个参数就是 main 函数。

接下来看主函数逻辑。

```c++
int __fastcall main(int argc, const char **argv, const char **envp)
{
  int v3; // edx
  int v4; // ecx
  int v5; // r8d
  int v6; // r9d
  __int64 v7; // rsi
  int result; // eax
  int i; // [rsp+0h] [rbp-120h]
  int v10; // [rsp+4h] [rbp-11Ch]
  _BYTE *v11; // [rsp+8h] [rbp-118h]
  _BYTE v12[5]; // [rsp+10h] [rbp-110h] BYREF
  _BYTE v13[8]; // [rsp+15h] [rbp-10Bh] BYREF
  _BYTE v14[3]; // [rsp+1Dh] [rbp-103h] BYREF
  _BYTE v15[3]; // [rsp+25h] [rbp-FBh] BYREF
  unsigned __int64 v16; // [rsp+118h] [rbp-8h]

  v16 = __readfsqword(0x28u);
  sub_410E10(off_6CB848, 0, 2, 0);
  sub_410E10(off_6CB840, 0, 2, 0);
  sub_410E10(off_6CB838, 0, 2, 0);
  sub_410410((unsigned int)"input: ", 0, v3, v4, v5, v6);
  sub_440790(0, v12, 256);
  v11 = (_BYTE *)j_ifunc_4226A0(v12, 10);
  if ( v11 )
    *v11 = 0;
  if ( (unsigned int)j_ifunc_4274A0(v12, "flag{", 5) )
    goto LABEL_11;
  v10 = sub_424C60(v12);
  if ( v12[v10 - 1] != 125 )
    goto LABEL_11;
  v12[v10 - 1] = 0;
  if ( sub_424C60(v13) != 16 )
    goto LABEL_11;
  sub_42D630(v15, "nice2you", 8);
  sub_4009AE(v13, v14);
  v7 = (unsigned int)sub_424C60(v13);
  sub_400A8C(v13, v7, &unk_6CB0A0);
  for ( i = 0; i <= 7; ++i )
    v13[i + 8] ^= v13[i];
  if ( (unsigned __int8)sub_400D6A(v13) == 1 )
  {
    sub_410C40("ok");
    result = 0;
  }
  else
  {
LABEL_11:
    result = sub_410C40("error");
  }
  if ( __readfsqword(0x28u) != v16 )
    sub_4440D0();
  return result;
}
```

**思路**：

首先 `sub_410E10` 出现很多的这个函数，很可疑，而且后面跟上了 `off_6CB8**`，这很大概率是接收原码，点开 `off` 这三个确实都指向一串数据，那这个函数极大概率是加密逻辑（这个一会发你代码）。

然后 `input` 输入。

然后下面这个什么 `if` 啥的不用看内部函数也知道这个函数是判断逻辑。

而我们唯一需要看的点就是这一段：

```c++
sub_42D630(v15, "nice2you", 8);
sub_4009AE(v13, v14);
v7 = (unsigned int)sub_424C60(v13);
sub_400A8C(v13, v7, &unk_6CB0A0);
for ( i = 0; i <= 7; ++i )
  v13[i + 8] ^= v13[i];
```

以及上面的 `sub_410E10` 也许是加密的函数。

------

但是我判断失误，点开 `sub_410E10` 后并不是什么加密函数，而是有很多 “库函数标志”，很明显这是 C++ 的 `iostream` 库的初始化。

原因就是这个函数有很多的条件操作而非大量的循环 / 加密处理，比如正确怎样怎样，否则就报怎样的错误码。

所以我们只需要看：

```c
sub_42D630(v15, "nice2you", 8);
sub_4009AE(v13, v14);
v7 = (unsigned int)sub_424C60(v13);
sub_400A8C(v13, v7, &unk_6CB0A0);
for ( i = 0; i <= 7; ++i )
  v13[i + 8] ^= v13[i];
```

那么问题来了，原始对比数据在哪里？动态调试。

在原始码被加密前就可以看见原始码是什么。但前提是过 flag 格式规范，这一步需要自己追踪。

只要代码出现 `goto LABEL_11;` 就是格式不规范。

```c++
if ( (unsigned int)j_ifunc_4274A0(v12, "flag{", 5) );
if ( v12[v10 - 1] != 125 );
if ( sub_424C60(v13) != 16 );
```

其中第一个是要求以 `flag{ ` 开头，第二行以 `}` 结尾，第三行是中间有 16 个字符。

所以动态调试时直接输入 `flag{1234567890123456}` 就可以了。

断点下在 `sub_4009AE(v13, v14);` 这行的汇编处 `call    sub_4009AE` 并观察上一条的 RDI 寄存器。

动态调试试验效果。可以看到此时的 RDI 记录着 `1234567890123456nice2you`。

误打误撞，原来 `nice2you` 就是密钥。所以 `sub_42D630(v15, "nice2you", 8);` 是一个初始化函数。这时候单步执行可以看见完整的加密过程。

结束动态调试，这时候就可以大致摸清这个程序了。此时正常情况下，应该在对应 `if ( (unsigned __int8)sub_400D6A(v13) == 1 )` 处的汇编下断点，但是很明显这个程序并非是简简单单下断点就可以得到密文然后计算的类型。点开 `sub_400D6A(v13)` 就能发现这是需要一个一个算的。

经过前面的动态调试发现：

```c++
  sub_42D630(v15, "nice2you", 8);	// 初始化函数
  sub_4009AE(v13, v14);				// 加密

  v7 = (unsigned int)sub_424C60(v13);   // 初始化函数
  sub_400A8C(v13, v7, &unk_6CB0A0);     // 256 替换表 unk_6CB0A0

  // 后8字节异或前8字节
  for ( i = 0; i <= 7; ++i )
    v13[i + 8] ^= v13[i];

  // 验证
  if ( (unsigned __int8)sub_400D6A(v13) == 1 )
  {
    sub_410C40("ok");
    result = 0;
  }
```

后来查资料发现这个验证函数很有意思，这是一个 16 * 16 的矩阵。手算太麻烦所以需要用 **Z3 解线性方程**。

```python
from z3 import *

a = [Int(f'a{i}') for i in range(16)]
s = Solver()

# 每个变量限制在 0-255
for i in range(16):
    s.add(a[i] >= 0, a[i] <= 255)

# 方程1
s.add(-202850 * a[0] == -34078800)

# 方程2
s.add(182136 * a[0] - 75396 * a[1] == 18610884)

# 方程3
s.add(-360745 * a[1] - 465588 * a[2] - 300043 * a[0] == -145478307)

# 方程4
s.add(-97624 * a[0] + 386642 * a[3] - 515451 * a[2] + 42526 * a[1] == -8086825)

# 方程5
s.add(31288 * a[0] - 324524 * a[3] - 89265 * a[1] - 239750 * a[4] - 241348 * a[2] == -91924377)

# 方程6
s.add(-266640 * a[2] + 216272 * a[5] + 411737 * a[0] + 210304 * a[3] - 8658 * a[4] + 454111 * a[1] == 144299767)

# 方程7
s.add(-402351 * a[4] - 496724 * a[0] + 367831 * a[2] + 371046 * a[5] - 123257 * a[3] + 188174 * a[1] + 178541 * a[6] == -37352471)

# 方程8
s.add(-415443 * a[1] + 237549 * a[5] - 323336 * a[7] - 207212 * a[3] - 23780 * a[0] + 94300 * a[4] + 364867 * a[6] + 273839 * a[2] == -8993582)

# 方程9
s.add(511561 * a[5] - 215494 * a[0] + 44567 * a[6] + 179735 * a[2] + 55541 * a[8] - 204854 * a[7] - 160275 * a[1] + 441741 * a[4] + 443248 * a[3] == 57425926)

# 方程10
s.add(407430 * a[0] + 407030 * a[3] + 503571 * a[6] - 434809 * a[5] + 385646 * a[4] + 437781 * a[7] + 20147 * a[9] - 10713 * a[2] - 247694 * a[8] + 4963 * a[1] == 267063706)

# 方程11
s.add(128236 * a[7] - 189787 * a[4] + 298269 * a[2] + 117737 * a[8] - 59638 * a[1] + 503873 * a[5] - 288072 * a[9] - 449297 * a[3] - 307883 * a[6] - 60891 * a[0] + 313065 * a[10] == -99001600)

# 方程12
s.add(127585 * a[3] + 447223 * a[10] - 511720 * a[0] - 64919 * a[1] - 115935 * a[11] - 328029 * a[6] + 2659 * a[4] - 246110 * a[2] - 491943 * a[8] - 392232 * a[9] - 178041 * a[5] + 49684 * a[7] == -319105050)

# 方程13
s.add(431281 * a[7] + 303436 * a[10] + 322142 * a[8] + 190343 * a[2] + 522606 * a[5] - 368910 * a[9] + 427328 * a[12] - 403570 * a[11] - 430137 * a[0] + 436111 * a[4] - 435520 * a[6] - 267519 * a[3] - 525665 * a[1] == -150506496)

# 方程14
s.add(-423522 * a[4] - 393086 * a[6] - 323745 * a[12] + 463495 * a[1] + 345256 * a[8] + 138356 * a[7] - 225302 * a[0] + 251299 * a[11] - 82368 * a[9] - 428085 * a[10] + 71943 * a[13] + 425456 * a[2] + 56298 * a[3] - 365233 * a[5] == -14594715)

# 方程15
s.add(-26106 * a[14] - 143761 * a[3] + 15549 * a[13] - 503539 * a[10] - 398270 * a[9] + 36874 * a[2] - 84278 * a[7] + 434801 * a[12] - 472636 * a[0] + 448925 * a[8] - 46393 * a[5] - 129268 * a[4] - 43783 * a[11] + 60534 * a[6] + 441341 * a[1] == -38159340)

# 方程16
s.add(-408983 * a[3] - 453493 * a[9] + 246957 * a[5] + 197292 * a[15] - 62054 * a[8] - 21100 * a[6] - 500028 * a[14] - 386306 * a[2] + 415182 * a[13] + 24237 * a[0] - 414063 * a[4] + 524530 * a[1] + 93336 * a[10] + 7350 * a[12] + 129819 * a[11] - 293569 * a[7] == -124057838)

# 求解
var = s.check() == sat
m = s.model()
result = [m[a[i]].as_long() for i in range(16)]
print("解:", result)
print("字节:", bytes(result).hex())
```

得到：

```text
a89f51707109ed73f1ab89a849716737
```

这就是密文。

------

开始写逆向破解代码。

由于是逆向破解，所以还原出原码只需要反过来写代码就可以了。**异或的自逆性质：`A ^ B ^ B = A`。所以再异或一次就还原了第一步。**

```python
# 后8字节 ^= 前8字节
for i in range(8):
    data[i + 8] ^= data[i]
```

紧接着是表替换。表替换的逆向思路也是很简单：**正向是“拿索引查表”，逆向就是“拿值反查索引”。**

建立表：

```python
table = bytes([ 数据 ])
```

正向就是这样直接替换：

```python
data[i] = table[data[i]];
```

逆向就是：**已知替换后的值，要找回原始值。**

一种逆向思维是每位与表中都相同的数值替换回来，但是缺点很大：慢。

```python
for b in cipher:
    for i in range(256):
        if table[i] == b:
            plain.append(i)
            break
```

另一种方式就是**建立反向表**，然后直接查找替换。

```python
reverse_table = [0] * 256
for i in range(256):
    reverse_table[table[i]] = i

for b in cipher:
    plain.append(reverse_table[b])
```

最后就是那个加密函数了。**我完全可以不知道它是 ，直接照着代码逻辑逆向。**TEA 只是一个名字而已，并不代表什么。

```c++
__int64 __fastcall sub_4009AE(unsigned int *a1, _DWORD *a2)
{
  unsigned int v3; // [rsp+1Ch] [rbp-24h]
  unsigned int v4; // [rsp+20h] [rbp-20h]
  unsigned int i; // [rsp+24h] [rbp-1Ch]
  int v6; // [rsp+28h] [rbp-18h]

  v3 = *a1;
  v4 = a1[1];
  v6 = 0;
  for ( i = 0; i <= 0x1F; ++i )
  {
    v6 += 305419896;
    v3 += (v4 + v6) ^ (16 * v4 + *a2) ^ ((v4 >> 5) + a2[1]);
    v4 += (v3 + v6) ^ (16 * v3 + a2[2]) ^ ((v3 >> 5) + a2[3]);
  }
  *a1 = v3;
  a1[1] = v4;
  return v4;
}
```

v13 在 `nice2you` 前面，所以 v13 只能是数据不可能是密钥，v15 才是密钥。所以 a1 是数据，a2 是密钥。

先看函数逻辑：

`v6` 是一个**累加器**，初始为 0，每轮加 `305419896`（也就是 `0x12345678`）。32 轮之后，`v6` 等于 `0x12345678 * 32`。

然后，先算 v3，v3 算完后再利用 v3 算 v4。

最后覆盖数据。

所以逆向就是 **“反着做一遍”**

```python
def tea_decrypt(v3, v4, k):
    delta = 0x12345678
    sum_val = (delta * 32) & 0xFFFFFFFF   # 从最终值开始
    for _ in range(32):
        # 逆序：先还原 v4，再还原 v3
        v4 = (v4 - (((v3 << 4) + k[2]) ^ (v3 + sum_val) ^ ((v3 >> 5) + k[3]))) & 0xFFFFFFFF
        v3 = (v3 - (((v4 << 4) + k[0]) ^ (v4 + sum_val) ^ ((v4 >> 5) + k[1]))) & 0xFFFFFFFF
        sum_val = (sum_val - delta) & 0xFFFFFFFF
    return v3, v4
```

所以，结合上面的逻辑代码，优化后完整代码如下：

```python
import struct

# 1. 最终密文（Z3解出）
data = bytearray(bytes.fromhex("a89f51707109ed73f1ab89a849716737"))

# 2. 逆异或
for i in range(8):
    data[i + 8] ^= data[i]

# 3. 逆表替换
table = bytes([
    0x25, 0x3A, 0x4C, 0x27, 0x8E, 0x5F, 0xA8, 0xC5, 0x20, 0xC2, 0xFF, 0x8B, 0x28, 0x30, 0xB4, 0x3C,
    0x19, 0xC0, 0x2F, 0x6A, 0x65, 0x24, 0x8C, 0x13, 0x7E, 0xF6, 0x3E, 0x17, 0xDD, 0x89, 0x55, 0x82,
    0x57, 0x03, 0xF1, 0xE1, 0x3D, 0xB8, 0x31, 0x67, 0x00, 0x22, 0x2D, 0xA7, 0x32, 0x58, 0x8F, 0xCF,
    0x78, 0x39, 0x73, 0x44, 0x34, 0xD8, 0x77, 0x12, 0x88, 0xF5, 0x51, 0x75, 0xC9, 0x7F, 0x7B, 0x0F,
    0xE5, 0xF8, 0x6E, 0xE2, 0x83, 0x05, 0x47, 0x72, 0xFE, 0xE0, 0xF7, 0xF0, 0x04, 0x9A, 0x80, 0x1C,
    0x8D, 0xEF, 0x4E, 0x33, 0xAA, 0x66, 0x9C, 0x37, 0xB1, 0x21, 0x85, 0x1D, 0xAF, 0x81, 0x42, 0x5B,
    0xC7, 0x9D, 0xE6, 0x38, 0x8A, 0x49, 0x7A, 0xAE, 0xD0, 0xDF, 0xFB, 0x79, 0x18, 0xDC, 0xF3, 0xA5,
    0x59, 0x29, 0xEB, 0xB0, 0x0D, 0x43, 0xEC, 0xEE, 0xCC, 0x2E, 0xF9, 0x08, 0x74, 0x5E, 0x50, 0xBA,
    0xE4, 0x61, 0xA6, 0x14, 0x54, 0xE8, 0xDB, 0xB5, 0xFA, 0xD9, 0xED, 0xA3, 0x01, 0xB3, 0x11, 0x2B,
    0x96, 0x6F, 0x52, 0x36, 0x23, 0x16, 0x1E, 0xF2, 0x40, 0x6C, 0x48, 0x35, 0x9E, 0xB9, 0x45, 0xC3,
    0x02, 0x7D, 0x97, 0x94, 0x4A, 0xD1, 0x95, 0xCB, 0xC4, 0x2C, 0xA4, 0x15, 0x07, 0xBD, 0xA2, 0xAB,
    0x9F, 0xB6, 0x9B, 0xFD, 0xB2, 0x53, 0x64, 0x5A, 0xDE, 0x0B, 0x70, 0xBE, 0x76, 0xE9, 0x4D, 0xBF,
    0xEA, 0xF4, 0xAC, 0x86, 0x0C, 0x6B, 0x63, 0x5C, 0x71, 0x91, 0x2A, 0x3B, 0x09, 0x90, 0xFC, 0x98,
    0x46, 0xA9, 0x69, 0xB7, 0xD7, 0xDA, 0xC1, 0x93, 0xC8, 0xD4, 0x06, 0x4F, 0x62, 0x6D, 0x3F, 0xBC,
    0x92, 0x84, 0x26, 0x68, 0x60, 0xE3, 0xD6, 0xC6, 0xCA, 0x1A, 0xCE, 0xAD, 0x10, 0x1F, 0xBB, 0x41,
    0x7C, 0xA0, 0x5D, 0x0E, 0x1B, 0x99, 0xE7, 0x4B, 0xD2, 0xCD, 0x0A, 0xD3, 0xA1, 0x87, 0xD5, 0x56
])

# 构建反向表：reverse_table[table[i]] = i
reverse_table = [0] * 256
for i in range(256):
    reverse_table[table[i]] = i

# 逆表替换
for i in range(16):
    data[i] = reverse_table[data[i]]

# 4. TEA 解密
key_bytes = data[8:16] + b"nice2you"
k = struct.unpack("<4I", key_bytes)

def tea_decrypt(v, k):
    v0, v1 = struct.unpack("<2I", v)
    delta = 0x12345678
    sum_val = (delta * 32) & 0xFFFFFFFF
    for _ in range(32):
        v1 = (v1 - (((v0 << 4) + k[2]) ^ (v0 + sum_val) ^ ((v0 >> 5) + k[3]))) & 0xFFFFFFFF
        v0 = (v0 - (((v1 << 4) + k[0]) ^ (v1 + sum_val) ^ ((v1 >> 5) + k[1]))) & 0xFFFFFFFF
        sum_val = (sum_val - delta) & 0xFFFFFFFF
    return struct.pack("<2I", v0, v1)

# 5.flag
first_half = tea_decrypt(bytes(data[:8]), k)
original = first_half + bytes(data[8:])
print("Flag: flag{" + original.decode() + "}")
```

flag：

```text
flag{y0u_g0t_p455c0d3}
```

------

## riskv-and-reward - GFSJ0872（架构识别 + 环境搭建）

ELF 可执行文件，无壳。

IDA 静态分析：Ctrl + F 没有找到 main 函数。但是从汇编码指令看得出来该程序架构与普通架构不一样，所以这一次的 start 函数与上一题的不一样，这就需要逐一判断。

```c
void __noreturn start(__int64 a1,__int64 a2,__int64 a3,__int64 a4,__int64 a5,__int64 a6,__int64 a7,__int64 a8,int a9,...)
{
  __int64 v9; // a0
  __int64 v10; // a0
  va_list va; // [sp+8h] [+8h] BYREF

  va_start(va, a9);
  sub_12640(0x160B8u, 0, 0);			// 初始化
  v9 = sub_123E4(&sub_12428);
  sub_12484(v9);
  v10 = sub_1232C(a9, (char *)va, 0);	// 主函数
  sub_123F8(v10);						// 退出
}
```

从函数传参上基本可以看出 `sub_1232C` 就算 main。双击进入该函数事实也确实如此（有字符串）。

而且该函数的结果传给最后的退出函数。所以这个就是 main 函数。

```c
int __cdecl main(int argc, const char **argv, const char **envp)
{
  _DWORD v4[32]; // [sp+8h] [-D8h] BYREF
  _BYTE v5[68]; // [sp+88h] [-58h] BYREF
  int i; // [sp+CCh] [-14h]

  sub_12524(v5, "tjb3csFt0rrutrh_wiv5__fi}k_1ih`{xIcrhsoyBmyw1CyT3rvxStT_jq40_zrq(", 0x40u);
  sub_12524(v4, "(", 0x80u);
  for ( i = 0; i <= 31LL; ++i )
    sub_12724((unsigned __int8)v5[v4[i]]);
  sub_12724(10);
  return 0;
}
```

但是这两个函数一个是 `memcpy`，一个是 `fputc`。并没有找到实际的加密，而且那一串字符也并不像是加密的样子。

所以我查看了 wp 这题真正考的**不是逆向算法，而是 “架构识别 + 环境搭建”。**

从汇编层面也能看出来汇编码与正常的 x64 和 x86 的汇编码不一样。

不是所有题都是 x86/x64，还有 ARM、MIPS、RISC-V……。遇到不认识的架构，要知道怎么查、怎么搭环境、怎么跑起来。很多时候，**能把程序跑起来，就已经赢了**。

  1\. **安装 Docker**

  2\. **拉取镜像并运行**：

```bash
sudo docker run --privileged -v /home:/home -it sorear/fedora-riscv-wip
```

  3\. **进入容器后运行程序：**

```bash
cd /home/[用户名]/[文件夹]
./riskv_and_reward
```

程序会直接输出 flag。

```text
BITSCTF{s0m3_r1sc5_4r3_w0rth_1t}
```

------

如果你在阅读时发现了任何错误，请评论或发邮件告诉我，因为错误是学习和发展的一部分！
