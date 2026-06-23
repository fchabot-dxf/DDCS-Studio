(DANGER - DO NOT RUN - 2026-06-19 this macro MOVED the axis)
(G10 L20 P6 X25 is NOT honored as an offset write on this fw - the X25)
(executes as a G90/G01 move. Kept only as the V1 evidence. See FINDINGS.md)
(V1 - Does G10 L20 actually write a WCS offset - headline skill-vs-dump test)
(Target is G59 X offset register #830 - base 805 plus 5 per WCS)
(MOTION-FREE: only writes/reads offset registers. No axis moves.)
(Active WCS is NOT changed - G10 L20 P6 targets G59 by the P-word.)
(Saves #830 first and restores it at the end - leaves no trace.)
(Read results in the user-var viewer: #495 #496 #497 should all be EQUAL.)

(Prime all targets to a literal first - prevents persistent-var freeze)
#495 = 1
#496 = 1
#497 = 1
#498 = 1

(SAVE original G59 X offset so we can restore it)
#498 = #830

(EXPECTED value a correct write should store = machine X - target)
#497 = #880 - 25

(Method A - G10 L20 value-semantics: make current X read 25 on G59)
G10 L20 P6 X25
#495 = #830

(Method B - direct register write to the same intent, round-trip)
#830 = #880 - 25
#496 = #830

(Report: A vs expected, then B - read #495/#496/#497 if msg scrolls)
#1510 = #495
#1511 = #497
#1505 = -5000(V1 A G10=%.4f expect=%.4f)
G04 P2.0
#1510 = #496
#1505 = -5000(V1 B direct=%.4f)
G04 P2.0

(RESTORE original G59 X offset)
#830 = #498

M30
