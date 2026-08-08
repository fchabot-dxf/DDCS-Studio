(V17d - UNCLOSED BRACKET. Does the DDCS Expert CLOSE it, TRUNCATE, or ALARM?)
(Studio's sim evaluates an opening bracket with 1 + 2 and no closing bracket as 3 - it)
(parses what it can and ignores the missing close. This checks whether the machine agrees.)
(It is the mirror of V17b trailing-garbage - there a valid prefix had junk after it, here a)
(valid prefix has nothing after it.)
(It matters for the SEND GATE - the gate refuses what the parser refuses, so sim and machine)
(must agree. Sim too lenient here = the gate passes a file the Expert would alarm on.)

(NO BRACKETS IN THESE COMMENTS - a bracket inside a comment aborts on the header and reads)
(as a rejection of the test line.)

(NO MOTION. Two assignments, scratch vars 90 and 91, nothing saved.)

(HOW TO READ THE RESULT:)
(  UNCLOSED=3 - the controller CLOSED the bracket and evaluated 1 + 2. Sim matches.)
(  UNCLOSED=anything else - it parsed a THIRD way. Write the number down verbatim.)
(  NO POPUP and an Unrecognized file format error - it ALARMED and aborted the whole file,)
(    so nothing ran including the popup. The sim is too lenient and its gate must reject)
(    this too. This is the loud answer.)

(Prime)
#90 = -99999
#91 = 0

(The probe - a valid prefix with no closing bracket)
#90 = [1 + 2

(Report)
#1510 = #90
#1505 = -5000(V17d UNCLOSED=%.0f  3=closed-like-sim  other=third-way  none=alarmed)
G04 P2.0

M30
