(V13e - ATAN ARGUMENT ORDER on the DDCS Expert. V13d used EQUAL operands, so 45 came out)
(the same whichever order the controller read them and could not settle it. This uses 1 and)
(2, which differ, so the order shows. Studio emits the alignment angle as ATAN of dy over dx)
(in data probeToSlot.js and pins a convention no Expert hardware has ever confirmed.)

(It matters - a real angle comes from a dx and a dy. Wrong order gives the COMPLEMENT,)
(26.565 instead of 63.435, so an alignment rotation comes out mirrored.)

(NO BRACKETS IN THESE COMMENTS - a bracket inside a comment aborts the whole file on the)
(header and reads as a rejection of the test line. Proven on this controller twice.)

(NO MOTION. One assignment, scratch var 90, nothing saved or restored.)

(HOW TO READ THE RESULT - popup, and if none read the screen:)
(  ATANORD=2657 - ATAN of 1 over 2 = 26.565. Studio dy-over-dx order is CORRECT.)
(  ATANORD=6343 - the OPPOSITE, ATAN of 2 over 1 = 63.435. Studio is MIRRORED and every)
(    angle it makes from a dx and a dy is wrong. Fix the parser convention.)
(  ATANORD=2250 - it took ATAN of 1 then divided by 2 = 22.5, NOT a two-operand atan2 at)
(    all. The whole atan2 assumption is wrong. Write it down.)
(  anything else - write the number down verbatim; it says what it computed.)
(  NO POPUP and an Unrecognized file format error - the two-operand form was REJECTED and)
(    the whole file aborted, so V13d two-operand atan does not stand either. Note the line.)

(Prime)
#90 = -99999

(The probe - unequal operands so the order is visible)
#90 = [ATAN[1] / [2] * 100]

(Report)
#1510 = #90
#1505 = -5000(V13e ATANORD=%.0f  2657=studio-ok  6343=mirrored  2250=not-atan2  none=rejected)
G04 P2.0

M30
