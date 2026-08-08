(S6h - A LITERAL DIVISION BY ZERO. Rejected at load, or tolerated?)
(t1603 ruled that a divide-by-zero during Studio's VALIDATION is not a syntax error, so the)
(send gate now passes a file containing one - guessing tight is the one failure the gate)
(cannot have. But no hardware has ever been asked. This probe asks.)

(The RUNTIME question rides along: if the file loads and runs, what does #190 hold after)
(an assignment whose right side divided by zero? The sim treats /0 as unresolvable.)

(NO BRACKETS IN COMMENTS - the parser aborts on a bracket inside a comment. Twice proven.)

(NO MOTION. Two assignments.)

(READ THE SCREEN AND #190:)
(  Unrecognized file format at the divide line = REJECTED AT LOAD. Studio's gate should)
(    tighten to match - and that tightening will have hardware behind it, like S6f.)
(  runs to M30, #190 = -99999 = loaded, but the assignment did not stick. Tolerated-inert.)
(  runs to M30, #190 = anything else = the controller COMPUTED something for 1/0.)
(    Write the number down - it says what the firmware thinks infinity is.)
#190 = -99999
#190 = [1 / 0]
M30
