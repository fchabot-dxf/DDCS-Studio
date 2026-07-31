(V13b - does the DDCS Expert macro parser have SIN. ONE risky form per file.)
(Run V13c_sqrt.nc FIRST - that is the one the shipped boundaries wait on. This one)
(and V13a_cos.nc are the LIKELY failures: the firmware libm import table holds sqrt)
(and atan but NOT cos or sin. See V13c_sqrt.nc for the full why-split reasoning.)

(RUN THIS EVEN IF V13a REJECTED COS. The two are separate imports and a parser that)
(lacks one may still have the other - collapsing them is exactly the mistake the)
(three-state evidence table exists to prevent.)

(NO MOTION. A single variable assignment. Nothing saved, nothing restored.)

(HOW TO READ THE RESULT:)
(  popup SINx100=50 - SIN WORKS. The sine of 30 degrees is 0.5, times 100.)
(  popup SINx100=anything else - it PARSED but did not compute. A SILENTLY WRONG)
(    value. Write the number down.)
(  NO POPUP, a syntax error instead - the parser REJECTED SIN and aborted the whole)
(    file before anything ran. That is the LOUD failure. Note the line number.)

(Prime)
#100 = 0

(The probe - the exact form V13_trig.nc uses)
#100 = [SIN[30] * 100]

(Report)
#1510 = #100
#1505 = -5000(V13b SINx100=%.0f  50=works  other=silent-wrong  none=rejected)
G04 P2.0

M30
