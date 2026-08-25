(V18c - does the H01 word on its own select the tool length offset)
(V18a showed G43 goes modal but the H stayed at H00, so the offset never changed.)
(A posted program on this controller writes H01 attached to a Z move and carries no G43 at all,)
(so the H word is the selector here and the two-digit form is the one the corpus uses.)

(This tries the word by itself first, because a standalone block commands no motion.)
(H01 is left selected so the next macro can cancel it.)

(Run V18a first: it puts 10.0 into H01 and leaves it there.)
(AFTER RUNNING: read the modal line at the lower right, then jog Z and watch both Z columns.)

(Prime)
#101 = 1

#101 = #900

#1510 = #101
#1505 = -5000(V18c H01 register holds %.3f - selecting H01)
G04 P3.0

H01

#1505 = -5000(V18c H01 word ran - read the modal line then jog Z)
G04 P6.0

M30
