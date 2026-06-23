(V11 - is GOTO with a space before the label rejected - the E-GOTOSPACE rule)
(No motion. The IF below uses "GOTO 1" WITH a space. If that is a syntax error)
(the whole file fails to parse - syntax-error popup and NO V11 message = rejected.)
(If you get the V11 message with ran=1, then GOTO-space is actually accepted.)

(Prime)
#100 = 1
#101 = 0

(Set a known value)
#100 = 5

(Try IF with a SPACE before the label number)
IF #100==5 GOTO 1
GOTO2
N1
#101 = 1
N2

(Report - ran=1 means the spaced GOTO branched and is accepted)
#1510 = #101
#1505 = -5000(V11 gotospace_ran=%.0f)
G04 P2.0

M30
