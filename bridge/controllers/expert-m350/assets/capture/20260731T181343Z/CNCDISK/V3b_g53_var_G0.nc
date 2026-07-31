(V3b - G53 form test - VARIABLE WITH G0: G53 G0 Z#var)
(Same safe method as V3a: zero-offset G59 frame, current-Z target = no move.)
(Saves/restores G59 offsets, reselects G54. Assumes you start on G54.)

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

(Zero the G59 offsets)
#830 = 0
#831 = 0
#832 = 0
#833 = 0

(Select G59 - proven to switch the active frame)
G59

(GUARD - G59 Z offset must be zero)
#486 = #832
IF #486!=0 GOTO99

(HUMAN GATE - header must say G59 and Abs must equal Mach)
#1505 = 1(VERIFY header G59 and Abs=Mach - Enter runs G53 - Esc aborts)
IF #1505==0 GOTO99

(SAFE: current work Z == current machine Z)
#487 = #882

(THE TEST - variable, WITH G0)
G53 G0 Z#487

(Reached here = the form parsed and ran)
#488 = 1
#1510 = #488
#1505 = -5000(V3b G53 G0 Z#var RAN ok=%.0f press Enter)
G04 P2.0
GOTO98

N99
#1505 = 1(ABORT - G53 NOT tested - press Enter)
G04 P2.0

N98
(Restore G59 offsets and reselect G54)
#830 = #481
#831 = #482
#832 = #483
#833 = #484
G54

M30
