(S5j - WHILE in the EXACT shape the factory's own macros use. macroMillCylinder.nc line 76.)
(S5d used a LITERAL in the condition and a BRACKETED increment. The factory uses a VARIABLE)
(in the condition and a BARE increment. This file copies the factory form exactly.)
(#190 is the counter, #191 is the limit - the two registers declared safe on this post.)
(RUN 9_INCR AND 10_WHILE0 FIRST. They cannot hang. This one can, if the increment fails.)
(NO MOTION. READ #190 - 3 means the loop ran three times and exited: WHILE WORKS.)
(0 or a hang means the counter never advanced. An error names the line that was rejected.)
#190 = 0
#191 = 3
WHILE#190<#191DO1
#190=#190+1
END1
M30
