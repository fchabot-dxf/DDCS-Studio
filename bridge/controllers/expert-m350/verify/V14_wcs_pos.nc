( V14_wcs_pos - CAN A MACRO READ THE LIVE WORKPIECE-COORDINATE POSITION? )
( t1351. This decides how a PARAMETRIC op carries a frame it does not know at build time. )
(   THE EVIDENCE SO FAR: )
(     FOR  - the factory's own gotozero.nc reads #792 in a comparison: "IF #569<#792 GOTO1". )
(            That is macro USAGE on this controller, not a name in a variable list. )
(     GAP  - #790 for X and #791 for Y appear in NO captured factory macro. Same documented )
(            family, contiguous numbering, Z proven - but X and Y are inference until this runs. )
(   V7 does NOT answer it: V7 reads #880-#882, the MACHINE DRO. #790-#792 are the position in )
(   the ACTIVE WCS, which is the frame a skim / jog-referenced op actually needs. )
( THIS MACRO CUTS NOTHING AND MOVES NOTHING - it only assigns and reports. )

( HOW TO RUN IT: )
(   1. Jog somewhere clearly NOT zero on all three axes - say X30 Y20 Z-10 in the active WCS. )
(   2. WRITE DOWN what the screen's workpiece DRO reads for X, Y and Z. )
(   3. Run this macro and read the two messages it puts up - 2 seconds each. )
( HOW TO READ THE RESULT: )
(   #106 = 100 at the end. If it is still 0, the macro stopped early - note the LINE NUMBER )
(          the controller names: that line's variable is the one the parser does not have. )
(   The reported X/Y/Z should MATCH the workpiece DRO you wrote down. )
(     match on all three          -> #790/#791/#792 are readable and are the WCS position. )
(     Z matches, X/Y read -99999  -> Z only. The frame must come from somewhere else for X/Y. )
(     a syntax error on #790      -> X/Y are not addressable at all; only Z is. )
(     values that match the MACHINE DRO instead -> they are machine coords, NOT WCS - which )
(          would be a different fact and would need the WCS offset applied. )

( --- seed with an unmistakable sentinel: -99999 cannot be a real position --- )
#100 = -99999
#101 = -99999
#102 = -99999
#106 = 0

( --- the three reads. Plain assignments: no motion, no modal change. --- )
#100 = #790
#101 = #791
#102 = #792

( --- report --- )
#1510 = #100
#1511 = #101
#1505 = -5000(V14 WCS X=%.3f Y=%.3f)
G04 P2.0
#1510 = #102
#1505 = -5000(V14 WCS Z=%.3f)
G04 P2.0

( --- reached the end --- )
#106 = 100
M30
