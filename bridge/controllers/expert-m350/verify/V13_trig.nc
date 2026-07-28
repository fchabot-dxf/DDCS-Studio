( V13_trig - DOES THE DDCS EXPERT MACRO LANGUAGE HAVE TRIG? )
( t1279. The evidence conflicts and neither side is a test: )
(   AGAINST - zero trig uses across the 59 captured factory macros, and the firmware's )
(             libm import table holds asin/acos/atan/sqrt but NOT cos/sin. )
(   FOR     - the community MacroB reference [advanced-macro-mathematics.md] writes )
(             COS/SIN/SQRT/ATAN freely and calls them proven. )
( This macro settles it. It CUTS NOTHING and MOVES NOTHING - it only assigns variables. )

( HOW TO READ THE RESULT, on the controller's variable page: )
(   #601 = 100 always. If #601 is 100 and nothing else changed, the macro ran to the end. )
(   #602 = 50  if COS worked   [ COS 60 = 0.5, x100 ]. Unchanged 0 = it did not. )
(   #603 = 50  if SIN worked   [ SIN 30 = 0.5, x100 ]. )
(   #604 = 300 if SQRT worked  [ SQRT 9 = 3, x100 ]. )
(   #605 = 4500 if ATAN worked [ ATAN 1/1 = 45 deg, x100 ]. )
( IF THE CONTROLLER STOPS WITH A SYNTAX ERROR, note WHICH LINE NUMBER it names - that )
( line's function is the one the parser does not have. Then the answer is NO for that one. )

( --- seed every result so an untouched slot is unmistakable --- )
#601 = 0
#602 = 0
#603 = 0
#604 = 0
#605 = 0

( --- the four probes. Each is a plain assignment: no motion, no modal change. --- )
#602 = [COS[60] * 100]
#603 = [SIN[30] * 100]
#604 = [SQRT[9] * 100]
#605 = [ATAN[1] / [1] * 100]

( --- reached the end --- )
#601 = 100
M30
