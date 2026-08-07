(V17b - TRAILING GARBAGE after a COMPLETE expression. Ignored, or rejected?)
(Studio's two evaluators DISAGREE on exactly this case. The wizard-side one throws on)
(trailing input; the sim-side one parses what it can and silently drops the rest. Only)
(one of them can match the machine, and the other is lying to whoever reads it.)

(Uses SCRATCH #90 - see the register note in V17a. Do not use #190 here.)

(NO MOTION. One assignment.)

(HOW TO READ THE RESULT:)
(  popup TRAIL=3 - the trailing k 8 was IGNORED and 1 plus 2 evaluated. Sim behaviour;)
(    the wizard evaluator is the one that must change.)
(  popup TRAIL=anything else - it folded the garbage into the math. Write it down.)
(  NO POPUP, a syntax error instead - REJECTED. The wizard evaluator is the faithful one)
(    and the sim is the one that must change.)

(Prime)
#90 = -99999

(The probe)
#90 = [1 + 2 k 8]

(Report)
#1510 = #90
#1505 = -5000(V17b TRAIL=%.0f  3=ignored-like-sim  other=folded-in  none=rejected)
G04 P2.0

M30
