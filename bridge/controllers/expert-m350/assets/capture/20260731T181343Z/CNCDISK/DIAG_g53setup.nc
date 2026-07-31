(DIAG - why did V3a abort - report the two guard values, no G53, no motion)
(578 after the G59 command should be 6 if G59 became active.)
(832 after we zero it should be 0 if the direct offset write took.)
(Saves/restores G59 offsets, reselects G54.)

(Prime all slots to a literal first)
#481 = 1
#482 = 1
#483 = 1
#484 = 1
#485 = 1
#486 = 1

(Save the G59 offsets we will borrow)
#481 = #830
#482 = #831
#483 = #832
#484 = #833

(Zero the G59 offsets - direct writes)
#830 = 0
#831 = 0
#832 = 0
#833 = 0

(Select G59 via the standard command)
G59

(Read the two guard values)
#485 = #578
#486 = #832

(Report both - read the numbers then press Enter to restore)
#1510 = #485
#1511 = #486
#1505 = -5000(DIAG 578=%.0f 832=%.0f press Enter)
G04 P2.0

(Restore G59 offsets and reselect G54)
#830 = #481
#831 = #482
#832 = #483
#833 = #484
G54

M30
