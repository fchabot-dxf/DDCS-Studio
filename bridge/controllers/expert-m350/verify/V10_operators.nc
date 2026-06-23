(V10 - does the FANUC word operator EQ work, or only C-style ==)
(No motion. If EQ is a syntax error the whole file fails to parse - then you)
(get a syntax-error popup and NO V10 message = EQ is rejected on this firmware.)

(Prime)
#100 = 1
#101 = 0

(Set a known value)
#100 = 5

(Try the FANUC word operator EQ)
IF #100 EQ 5 GOTO1
GOTO2
N1
#101 = 1
N2

(Report - EQ_branched=1 means EQ works; =0 means EQ parsed but did not branch)
#1510 = #101
#1505 = -5000(V10 EQ_branched=%.0f)
G04 P2.0

M30
