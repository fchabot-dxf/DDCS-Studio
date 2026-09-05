(V23 - does 16062 ADVANCE, or does it only latch the line it is parked on?)
(V21 and V22 both sat on ONE dwell, so they proved it REPORTS a line,)
(not that it TRACKS progress. This file dwells on three separated lines.)
(Expect 16062 to read 8, then 11, then 14 -- eight seconds each.)
(No motion. Writes only true scratch: #100-#102, which are locals/globals,)
(not machine parameters on either controller.)
#100 = 1
G04 P8000
#101 = 2
(spacer comment so the next dwell is not adjacent)
G04 P8000
#102 = 3
(second spacer comment)
G04 P8000
M30
