(V3c - G53 form test - LITERAL no-G0: G53 Z-5)
(Literal -5 must equal current machine Z. Zero-offset G59 frame makes work==machine.)
(Extra guard: abort unless Z is within 0.01mm of -5, so the worst case move is 0.01mm.)
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

(GUARD 1 - G59 Z offset must be zero)
#486 = #832
IF #486!=0 GOTO99

(GUARD 2 - current Z must be within 0.01 of the literal -5 we are about to send)
#487 = #882
IF #487>-4.99 GOTO99
IF #487<-5.01 GOTO99

(HUMAN GATE - header must say G59, Abs==Mach, and Z must read -5)
#1505 = 1(VERIFY G59 + Abs=Mach + Z=-5 - Enter runs G53 - Esc aborts)
IF #1505==0 GOTO99

(THE TEST - literal, no G0)
G53 Z-5

(Reached here = the form parsed and ran)
#488 = 1
#1510 = #488
#1505 = -5000(V3c G53 Z-5 literal RAN ok=%.0f press Enter)
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
