(S5l - WHILE with a SPACE after it, mirroring the IF precedent on this controller.)
(IF#191 froze but IF #191 worked. S5j used WHILE#190 unspaced and the parser never opened)
(the loop - it only complained at END1. This file adds the one space.)
(NO MOTION. Terminates after 3 passes if the loop opens at all.)
(READ #190 - 3 means WHILE WORKS with a space. 1 or an error at END1 means it still did not open.)
#190 = 0
#191 = 3
WHILE #190<#191DO1
#190=#190+1
END1
M30
