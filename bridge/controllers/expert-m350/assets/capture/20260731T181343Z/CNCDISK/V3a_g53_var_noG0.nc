(V3a - which G53 form is accepted - VARIABLE no-G0 form: G53 Z#var)
(SAFE: borrow G59 as a ZERO-OFFSET frame. The G59 command is PROVEN to switch)
(the active frame on this machine - DIAG 2026-06-19 showed header G59 + Abs==Mach.)
(With G59 offset zeroed, work Z == machine Z, so commanding the current Z cannot)
(move under EITHER G53 behavior - honored or ignored.)
(Guard: G59 Z offset must read 0. Human gate: you confirm the header before the move.)
(Saves/restores G59 offsets, reselects G54. Assumes you start on G54. No move.)

(Prime all slots to a literal first)
#481 = 1
#482 = 1
#483 = 1
#484 = 1
#486 = 1
#487 = 1
#488 = 0

(Save the G59 offsets we will borrow)
#481 = #830
#482 = #831
#483 = #832
#484 = #833

(Zero the G59 offsets - direct writes, house style)
#830 = 0
#831 = 0
#832 = 0
#833 = 0

(Select G59 - proven to switch the active frame on this machine)
G59

(GUARD - G59 Z offset must be zero before we trust the frame)
#486 = #832
IF #486!=0 GOTO99

(HUMAN GATE - look now: header must say G59 and Abs must equal Mach.)
(Press Enter to run the G53 line, or Esc to abort.)
#1505 = 1(VERIFY header G59 and Abs=Mach - Enter runs G53 - Esc aborts)
IF #1505==0 GOTO99

(SAFE: current work Z == current machine Z. Target = current Z = no move.)
#487 = #882

(THE TEST - variable, no G0)
G53 Z#487

(Reached here with no syntax error and no alarm = the form parsed and ran)
#488 = 1
#1510 = #488
#1505 = -5000(V3a G53 Z#var RAN ok=%.0f press Enter)
G04 P2.0
GOTO98

N99
#1505 = 1(ABORT - G53 NOT tested - press Enter)
G04 P2.0

N98
(Restore G59 offsets and reselect your original G54 - selects only no write)
#830 = #481
#831 = #482
#832 = #483
#833 = #484
G54

M30
