(V13a - does the DDCS Expert macro parser have COS. ONE risky form per file.)
(Run V13c_sqrt.nc FIRST - that is the one the shipped boundaries wait on. This one)
(and V13b_sin.nc are the LIKELY failures: the firmware libm import table holds sqrt)
(and atan but NOT cos or sin. See V13c_sqrt.nc for the full why-split reasoning.)

(WHAT A YES WOULD BUY: the polygon and ellipse boundaries in POCKET_SHAPE_GAP and)
(CONTOUR_PARAMETRIC_GAP name trig - but both also record a SECOND reason that COS)
(cannot lift, so a yes here narrows the reason rather than opening a conversion.)
(web/data/trigEvidence.js carries that distinction so the visit is not oversold.)

(NO MOTION. A single variable assignment. Nothing saved, nothing restored.)

(HOW TO READ THE RESULT:)
(  popup COSx100=50 - COS WORKS. The cosine of 60 degrees is 0.5, times 100.)
(  popup COSx100=anything else - it PARSED but did not compute. A SILENTLY WRONG)
(    value. Write the number down.)
(  NO POPUP, a syntax error instead - the parser REJECTED COS and aborted the whole)
(    file before anything ran. That is the LOUD failure. Note the line number.)

(Prime)
#100 = 0

(The probe - the exact form V13_trig.nc uses)
#100 = [COS[60] * 100]

(Report)
#1510 = #100
#1505 = -5000(V13a COSx100=%.0f  50=works  other=silent-wrong  none=rejected)
G04 P2.0

M30
