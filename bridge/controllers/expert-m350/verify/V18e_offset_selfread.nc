(V18e - reads the Z offset itself, before and after selecting H01, and reports both numbers)
(The screen cannot answer this: H01 is only selected while the program runs, M30 puts it back to)
(H00, and the message box sits over the Z row for exactly the window that matters.)

(Machine Z is #882, proven by V7 and by the #880 machine-X reading in FINDINGS.)
(Workpiece Z is #792, which the factory gotozero.nc uses in a comparison.)
(The applied offset is machine Z minus workpiece Z, and it has read -104.844 in every test so far.)

(Sets H01 to a test value, samples before and after, then puts H01 back. Commands no motion.)

(Prime)
#101 = 1
#102 = 1
#103 = 1
#104 = 1

(Keep the current H01 so this macro can restore it without help)
#2520 = #900
#900 = 10.0

(Sample before selecting)
#101 = #882
#102 = #792

G43 H01

(Sample after selecting)
#103 = #882
#104 = #792

#1510 = #101
#1511 = #102
#1505 = -5000(V18e before machZ=%.3f wcsZ=%.3f)
G04 P6.0

#1510 = #103
#1511 = #104
#1505 = -5000(V18e after machZ=%.3f wcsZ=%.3f)
G04 P6.0

(Put H01 back to the value this macro found)
#900 = #2520

#1510 = #900
#1505 = -5000(V18e H01 restored to %.3f)
G04 P4.0

M30
