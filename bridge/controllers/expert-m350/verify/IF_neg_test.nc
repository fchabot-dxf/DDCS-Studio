(IF negative-decimal comparison test - settles the V3c/V3d abort cause)
(No motion. Replicates the exact guard comparisons that aborted in V3c/V3d.)
(Set #100 to -5. Tests whether -5 > -4.99 is FALSE and -5 < -5.01 is FALSE.)
(If either reports fired=1, the parser mishandles compares vs a negative decimal.)

(Prime)
#100 = 1
#101 = 1
#102 = 0
#103 = 0

(Set #100 = -5 via arithmetic, avoiding a bare negative literal in the assign)
#100 = 0 - 5

(Test A: -5 > -4.99 should be FALSE so it should NOT branch)
IF #100>-4.99 GOTO1
GOTO2
N1
#102 = 1
N2

(Test B: -5 < -5.01 should be FALSE so it should NOT branch)
IF #100<-5.01 GOTO3
GOTO4
N3
#103 = 1
N4

(Report - both should be 0 if negative-decimal compares are correct)
#1510 = #102
#1511 = #103
#1505 = -5000(IFneg Afired=%.0f Bfired=%.0f)
G04 P2.0

M30
