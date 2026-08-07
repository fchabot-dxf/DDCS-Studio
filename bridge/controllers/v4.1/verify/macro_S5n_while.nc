(S5n - WHILE in MACRO PARSER MODE. The filename prefix macro is what unlocks it.)
(Standard G-code mode has no loop stack, which is why every earlier WHILE failed at END1.)
(Same body as S5j, which failed - the ONLY change is this file's NAME.)
(NO MOTION. Terminates after 3 passes if the loop opens.)
(READ #190 - 3 means WHILE WORKS in macro mode. 0 or an END1 error means the prefix is not the unlock.)
#190 = 0
#191 = 3
WHILE#190<#191DO1
#190=#190+1
END1
M30
