(V17e - A LITERAL DIVISION BY ZERO. Rejected at load, or tolerated by the DDCS Expert?)
(Studio's send gate PASSES a file containing a divide-by-zero - t1603 ruled it is not a)
(syntax error during validation, and guessing tight is the one failure the gate cannot)
(have. But no Expert hardware has been asked. This asks.)

(The runtime question rides along - if the file loads and runs, what does var 90 hold after)
(an assignment whose right side divided by zero? The sim treats it as unresolvable.)

(NO BRACKETS IN THESE COMMENTS - a bracket inside a comment aborts on the header.)

(NO MOTION. One assignment, scratch var 90, nothing saved.)

(HOW TO READ THE RESULT:)
(  NO POPUP and an Unrecognized file format error at the divide line - REJECTED AT LOAD.)
(    Studio's gate should tighten to match, with hardware behind it. The whole file aborted.)
(  DIVZERO=-99999 - it loaded and ran but the assignment did not stick. Tolerated, inert;)
(    the prime value survived.)
(  DIVZERO=anything else - the controller COMPUTED something for 1 over 0. Write the number)
(    down - it says what the firmware thinks infinity is.)

(Prime)
#90 = -99999

(The probe - a literal divide by zero)
#90 = [1 / 0]

(Report)
#1510 = #90
#1505 = -5000(V17e DIVZERO=%.0f  none=rejected  -99999=inert  other=computed)
G04 P2.0

M30
