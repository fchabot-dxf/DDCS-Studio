(SAVE ACTIVE WCS XY ZERO - Auto-detects which coordinate system)
(Based on working park position macro pattern with variable priming)

(Prime ALL variables first to prevent freeze - CRITICAL!)
#100 = 1
#101 = 1
#102 = 1
#103 = 1
#104 = 1

(Get active WCS number: 1=G54, 2=G55, 3=G56, etc.)
#100 = #578

(Read current machine positions - now safe after priming)
#101 = #880  (Current X machine position)
#102 = #881  (Current Y machine position)

(Calculate WCS offset addresses)
(G54=#810-814 starts at 810, then +5 for each WCS)
(Actually: G54=#805-809, G55=#810-814, G56=#815-819)
#103 = 805 + [#100 - 1] * 5  (X offset address)
#104 = 806 + [#100 - 1] * 5  (Y offset address)

(Write to WCS offsets using indexed parameters)
#[#103] = #101  (Set WCS X offset = current machine X)
#[#104] = #102  (Set WCS Y offset = current machine Y)

(Display confirmation)
#1510 = #101
#1511 = #102
#1505=-5000(WCS XY zero saved at machine: X=%.1f Y=%.1f)

M30
