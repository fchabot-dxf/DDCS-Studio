(Copy Active WCS to Another WCS)
(Copies X, Y, A only - no Z)
(Prompts user for target WCS number)

(Prime variables)
#100 = 1
#101 = 1
#102 = 1
#103 = 1
#104 = 1
#105 = 1
#106 = 1

(Get active WCS number: 1=G54, 2=G55, etc.)
#100 = #578

(Prompt user for target WCS)
#2070 = 101(1=G54 2=G55 3=G56 4=G57 5=G58 6=G59)

(Calculate source base address: 805 + [WCS-1]*5)
#102 = 805 + [#100 - 1] * 5

(Calculate target base address)
#103 = 805 + [#101 - 1] * 5

(Read source WCS values - X, Y, A only)
#104 = #[#102]
#105 = #[#102 + 1]
#106 = #[#102 + 3]

(Prime target variables)
#[#103] = 1
#[#103 + 1] = 1
#[#103 + 3] = 1

(Write to target WCS - X, Y, A)
#[#103] = #104
#[#103 + 1] = #105
#[#103 + 3] = #106

(Success message - add 53 to show G54-G59 correctly)
#1510 = #100 + 53
#1511 = #101 + 53
#1505 = -5000(Copied XYA from G%.0f to G%.0f)

M30
