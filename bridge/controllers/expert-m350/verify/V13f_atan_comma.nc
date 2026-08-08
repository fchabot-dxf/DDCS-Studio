(V13f - ATAN via the V4.1 COMMA form. The Expert REJECTED the slash form ATAN of 1 over 1)
(with a syntax error at V13_trig L53. V4.1 accepts the comma form ATAN of 1 comma 2, so this)
(tries the SAME comma form here. If it parses, the Expert atan2 IS the comma form and Studio's)
(probeToSlot.js slash emit is wrong for this controller.)

(Unequal operands 1 and 2 so if it parses, the ORDER also shows in one shot.)

(NO BRACKETS IN THESE COMMENTS - a bracket inside a comment aborts on the header.)

(NO MOTION. One assignment, scratch var 90, nothing saved or restored.)

(HOW TO READ THE RESULT - popup, and if none read the screen:)
(  ATANC=2657 - ATAN of 1 comma 2 = 26.565. The comma form WORKS and dy-over-dx order holds.)
(    Studio should emit the comma form for the Expert.)
(  ATANC=6343 - the comma form works but MIRRORED, 63.435. Order is reversed - fix the order.)
(  ATANC=2250 - it took ATAN of 1 then divided by 2 = 22.5, not a two-operand atan2. Note it.)
(  anything else - write the number down verbatim; it says what it computed.)
(  NO POPUP and an Unrecognized file format error - the comma form is ALSO rejected. Neither)
(    slash nor comma works, so the Expert has no two-operand atan; Studio needs another path.)

(Prime)
#90 = -99999

(The probe - the V4.1 comma formulation)
#90 = [ATAN[1, 2] * 100]

(Report)
#1510 = #90
#1505 = -5000(V13f ATANC=%.0f  2657=comma-ok  6343=mirrored  2250=not-atan2  none=rejected)
G04 P2.0

M30
