(S5c - does DDCS V4.1s IF GOTO actually BRANCH, not merely parse. ONE risky form per file.)
(t1536 t1538. ddcs-v41.js own ifGoto emits IF lhs EQ 0 GOTO1 style forms; the FACTORY CORPUS ALREADY carries)
(this exact idiom, system-backup current gotoz.nc line 1 equals IF#1406==0GOTO1, so this is factory-corpus)
(attested, not a guess. This file exists to move it from attested to BENCH-CONFIRMED, and, more importantly,)
(to catch the outcome a syntax check alone cannot: a comparison that PARSES but never actually branches would)
(look fine to the controller and silently wrong to every wizard that relies on IF GOTO for its control flow.)

(NO MOTION. Two plain variable assigns and one comparison. Nothing physical touched, nothing to restore.)

(TWO SEPARATE EXIT PATHS on purpose, not one shared tail, so a WRONG branch cannot be masked by whatever)
(runs after a correct one -- a fallthrough tail would overwrite either outcomes marker with the same final value.)

(HOW TO READ THE RESULT -- read #190, see README.md for both the on-screen and the SMB uservar path.)
(  #190 EQ 1  -- IF GOTO branched correctly. BENCH-CONFIRMED.)
(  #190 EQ -1 -- IF GOTO PARSED but did NOT branch, fell through when it should have jumped. This is the)
(    SILENTLY WRONG case: no error, no popup, and every IF GOTO based wizard would be broken on this target.)
(    The most important of the three outcomes to report accurately.)
(  #190 EQ -99999, the sentinel, unchanged, with a SYNTAX ERROR -- the comparison form was REJECTED outright.)
(    Note the line number. A loud, usable answer, not a failure of this test.)

(Prime)
#190 = -99999
#191 = 0

(The probe -- the exact form ddcs-v41.js emits and gotoz.nc already ships)
IF #191==0GOTO1
#190 = -1
GOTO2
N1
#190 = 1
N2

M30
