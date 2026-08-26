(V18d - the two-digit H form - V18a wrote G43 H1 and the modal H stayed at H00)
(A posted program already on this controller writes H01 with two digits, so the one-digit)
(form is the difference between the two cases and is the thing this changes.)

(Sets H01 to a test value, then selects it with G43 H01, then reports.)
(V18b puts H01 back from #2520, so run that afterwards.)

(AFTER RUNNING: read the H field in the modal block, then jog Z and watch both Z columns.)
(The number that decides this is Mach Z minus Abs Z. It has been -104.844 throughout so far.)

(Prime)
#101 = 1

(Keep the current H01 where V18b can read it back)
#2520 = #900

(Write the test value)
#900 = 10.0
#101 = #900

#1510 = #101
#1505 = -5000(V18d H01 holds %.3f - selecting with two digits)
G04 P3.0

G43 H01

#1505 = -5000(V18d G43 H01 ran - read the H field then jog Z)
G04 P8.0

M30
