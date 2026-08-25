(V18b - the cancel half - does G49 remove the H01 offset, and does it touch the tool Z offset)
(Run after V18a, which saved the original H01 into #2520.)

(Cancels the modal state, reports both offset registers, then puts H01 back from #2520.)
(The tool Z offset for the active tool is reported so the two systems can be told apart.)

(AFTER THE FIRST MESSAGE: jog Z by hand a small amount and watch both Z columns.)
(Jog by hand rather than from a macro, so the motion stays under direct control.)

(Prime)
#101 = 1
#102 = 1

G49

(Read both offset registers while the test value is still loaded)
#101 = #900
#102 = #1430

#1510 = #101
#1511 = #102
#1505 = -5000(V18b G49 ran H01=%.3f toolZ=%.3f)
G04 P8.0

(Put H01 back to the value V18a recorded)
#900 = #2520

#1510 = #900
#1505 = -5000(V18b H01 restored to %.3f)
G04 P4.0

M30
