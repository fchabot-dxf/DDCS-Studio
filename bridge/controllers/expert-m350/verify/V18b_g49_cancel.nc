(V18b - the cancel half - does G49 remove the H01 offset, and does it touch the tool Z offset)
(Run after V18a. The tool Z offset for the active tool is reported so the two can be told apart.)

(AFTER RUNNING: jog Z by hand a small amount and watch both Z columns.)
(Jog by hand rather than from a macro, so the motion stays under direct control.)

(Prime)
#101 = 1
#102 = 1

G49

(Read both offset registers after the cancel)
#101 = #900
#102 = #1430

#1510 = #101
#1511 = #102
#1505 = -5000(V18b G49 ran H01=%.3f toolZ=%.3f)
G04 P5.0

M30
