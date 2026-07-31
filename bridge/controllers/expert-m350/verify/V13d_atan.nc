(V13d - does the DDCS Expert macro parser have ATAN, in the two-operand form.)
(ONE risky form per file. See V13c_sqrt.nc for the full why-split reasoning.)

(THIS ONE IS NOT A LIFT - IT IS A DEFECT CHECK ON SHIPPED EMIT. Studio ALREADY sends)
(ATAN to real machines: data/probeToSlot.js emits the alignment slot's angle as)
(  #54=ATAN #52 over #53)
(in exactly the two-operand form probed below. Nobody has ever confirmed the)
(controller accepts it. So a NO here does not defer a feature - it means the)
(alignment probe has been emitting either an unparseable macro or a wrong angle,)
(and that is the highest-stakes row in web/data/trigEvidence.js.)

(NO MOTION. A single variable assignment. Nothing saved, nothing restored.)

(HOW TO READ THE RESULT:)
(  popup ATANx100=4500 - ATAN WORKS. The arctangent of 1 over 1 is 45 degrees.)
(  popup ATANx100=anything else - it PARSED but did not compute. A SILENTLY WRONG)
(    value - and the shipped alignment angle is that same wrong value. Write the)
(    number down; 45 wrong by a known factor is a different repair from 45 lost.)
(  NO POPUP, a syntax error instead - the parser REJECTED the form and aborted the)
(    whole file before anything ran. Then the shipped alignment slot has never run)
(    to completion on this controller either. Note the line number.)

(Prime)
#100 = 0

(The probe - the exact form V13_trig.nc uses, and the form probeToSlot.js emits)
#100 = [ATAN[1] / [1] * 100]

(Report)
#1510 = #100
#1505 = -5000(V13d ATANx100=%.0f  4500=works  other=silent-wrong  none=rejected)
G04 P2.0

M30
