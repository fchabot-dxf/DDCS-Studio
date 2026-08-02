(S5h - does WHILE PARSE and FALL THROUGH. The loop body can NEVER run, so this CANNOT hang.)
(S5d froze, but a freeze has TWO causes - WHILE unsupported, or the loop never terminating.)
(This file removes the second cause entirely - the condition is FALSE on entry.)
(NO MOTION. CANNOT LOOP. If this hangs, WHILE itself is the problem.)
(READ #190 - 55 means WHILE parsed and fell through correctly, so WHILE WORKS.)
(-99999 with an error at the WHILE or END line means the parser rejects WHILE.)
(A HANG here would be a real surprise and is itself the answer.)
#190 = -99999
#191 = 0
WHILE#191>5DO1
#190 = -1
END1
#190 = 55
M30
