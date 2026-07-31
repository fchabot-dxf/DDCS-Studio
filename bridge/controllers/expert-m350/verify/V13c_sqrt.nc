(V13c - does the DDCS Expert macro parser have SQRT. ONE risky form per file.)
(RUN THIS ONE FIRST of the V13 set. SQRT is the single function that three shipped)
(boundaries wait on - the raster ramp distance-to-centre, the rest-machining corner)
(clip, and pocketfill's rest half. The lift plan is web/data/trigEvidence.js.)

(WHY THIS FILE EXISTS ALONGSIDE V13_trig.nc - verify HANDOFF safety rule 3: a syntax)
(error aborts the WHOLE file and nothing executes. V13_trig.nc probes four functions)
(in one file with COS and SIN AHEAD of SQRT, and the firmware libm import table holds)
(sqrt and atan but NOT cos or sin - so the LIKELY result there is an abort on the COS)
(line that never reaches SQRT at all. This file cannot be blinded that way.)

(NO MOTION. A single variable assignment. Nothing saved, nothing restored.)

(HOW TO READ THE RESULT:)
(  popup SQRTx100=300 - SQRT WORKS. The square root of 9 is 3, times 100.)
(  popup SQRTx100=anything else - it PARSED but did not compute. That is a SILENTLY)
(    WRONG value, the exact case the corpus rule forbids new emit from leaning on.)
(    Write the number down - it says what the parser did instead.)
(  NO POPUP, a syntax error instead - the parser REJECTED SQRT and aborted the whole)
(    file before anything ran. That is the LOUD failure, and it is just as usable an)
(    answer as a yes. Note the line number the error names.)

(Prime)
#100 = 0

(The probe - the exact form V13_trig.nc uses)
#100 = [SQRT[9] * 100]

(Report)
#1510 = #100
#1505 = -5000(V13c SQRTx100=%.0f  300=works  other=silent-wrong  none=rejected)
G04 P2.0

M30
