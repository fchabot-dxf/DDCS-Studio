(S5g - ATAN, SINGLE-operand form. Follow-up to S5f, which used the TWO-operand form)
(ATAN of 1 over 1 and stopped at that line with the sentinel intact.)

(WHY THIS FILE EXISTS - S5f cannot tell two different failures apart:)
(  a. ATAN is absent from the parser entirely, or)
(  b. ATAN EXISTS but the two-operand ATAN of y over x form is not supported.)
(SQRT ran correctly WITH spaces in the same expression shape, so spacing is not the suspect.)
(This file probes ATAN with ONE operand and nothing else on the line.)

(NO MOTION. One variable assignment. Nothing saved, nothing restored.)

(HOW TO READ THE RESULT - read #190.)
(  #190 EQ 4500 - ATAN EXISTS and takes ONE operand. ATAN of 1 is 45 degrees, times 100.)
(    That means S5f failed on the TWO-OPERAND form only, which is a form question, not a)
(    missing function - and Studio can emit the single-operand form instead.)
(  #190 EQ some other number - it computed something else. Write the number down; it says)
(    what the parser did instead, and a silently wrong value is the case emit must never)
(    lean on.)
(  #190 EQ -99999, unchanged - ATAN is absent from the parser. That is the loud answer)
(    and just as usable: the bearing stays baked, and we stop asking.)

(Prime)
#190 = -99999

(The probe - ATAN with a single operand)
#190 = [ATAN[1] * 100]

M30
