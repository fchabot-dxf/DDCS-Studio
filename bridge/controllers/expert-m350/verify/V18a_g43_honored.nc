(V18a - the G43 half of V6 - is G43 H1 HONORED, or is the H register write the only path)
(V6 already proved macro #900 = param #400 = H01 and that the write needs no G43.)
(This asks the other half: whether the modal instruction changes the applied Z offset.)

(Saves the current H01 into #2520, writes a test value, then applies G43 H1.)
(V18b puts H01 back from #2520, so run this pair together.)

(No file on this controller has ever contained G43 - 0 of 289 vendor and capture programs -)
(so the instruction sits alone here and a parse error names this line and nothing else.)

(AFTER RUNNING: jog Z by hand a small amount and watch both Z columns.)
(A modal offset can stay off the display until the next Z move, so the jog is the real test.)
(Jog by hand rather than from a macro, so the motion stays under direct control.)

(Prime)
#101 = 1

(Keep the current H01 where the second macro can read it back)
#2520 = #900

(Write the test value through the address V6 confirmed)
#900 = 10.0
#101 = #900

#1510 = #101
#1511 = #2520
#1505 = -5000(V18a H01 now=%.3f was=%.3f)
G04 P3.0

G43 H1

#1505 = -5000(V18a G43 H1 ran - now jog Z and watch)
G04 P5.0

M30
