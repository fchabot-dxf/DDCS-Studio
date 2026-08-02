(S5d - does DDCS V4.1 have WHILE DO END, or is caps.flow goto an UNDER-declaration. ONE risky form per file.)
(t1536 t1538. ddcs-v41.js declares caps.flow goto, IF GOTO only, but the FACTORY CORPUS ALREADY carries)
(WHILE DO END in V4.1s own shipped macros -- system-backup current slib.nc, five occurrences, and)
(macroMillCylinder.nc macroMillRect.nc, e.g. N1WHILE#13>0DO13 then END13. This file exists to move that from)
(factory-corpus-attested to BENCH-CONFIRMED -- and if it confirms, caps.flow is under-declaring a real)
(capability, worth lifting in a future act, NOT this one -- this act measures only.)

(NO MOTION. A counter, incremented 3 times inside the loop. Nothing physical touched, nothing to restore.)

(THIS FILES RISK CLASS DIFFERS FROM THE OTHER FIVE IN THIS KIT -- an untested loop construct could in)
(principle fail to terminate, a broken exit-condition comparison, not a broken axis -- NO MOTION means no)
(axis can move even if this happens. IF THE SCREEN APPEARS TO HANG for more than 15 SECONDS, THAT IS ITSELF)
(A FINDING, the loop is not terminating -- press STOP RESET, write that down, and do not re-run this file.)

(HOW TO READ THE RESULT -- read #190, see README.md for both the on-screen and the SMB uservar path.)
(  #190 EQ 3 -- WHILE DO END WORKS. caps.flow goto is confirmed to be under-declaring on V4.1.)
(  #190 EQ -99999, the sentinel, unchanged, with a SYNTAX ERROR -- WHILE was REJECTED. Note the line number.)
(    caps.flow goto stands confirmed correct.)
(  #190 EQ anything else, 0, 1, 2, or a value that never stops climbing -- the construct parsed but behaved)
(    wrong. Write the number down; if it never settles, that is the hang case above.)

(Prime)
#190 = -99999
#191 = 0

(The probe -- the exact fused, no-space form V4.1s own factory slib.nc and macroMillCylinder.nc use)
WHILE#191<3DO1
#191=[#191+1]
END1

(Reached the end -- report the counter)
#190 = #191

M30
