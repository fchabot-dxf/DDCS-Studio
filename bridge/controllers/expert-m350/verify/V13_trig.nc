( V13_trig - DOES THE DDCS EXPERT MACRO LANGUAGE HAVE TRIG? )
( t1279. The evidence conflicts and neither side is a test: )
(   AGAINST - zero trig uses across the 59 captured factory macros, and the firmware's )
(             libm import table holds asin/acos/atan/sqrt but NOT cos/sin. )
(   FOR     - the community MacroB reference, advanced-macro-mathematics.md, writes )
(             COS/SIN/SQRT/ATAN freely and calls them proven. )
( This macro settles it. It CUTS NOTHING and MOVES NOTHING - it only assigns variables. )

( t1466 - FIVE SQUARE-BRACKET PAIRS REMOVED FROM THE COMMENTS BELOW, and it mattered. )
( Verify HANDOFF safety rule 1 says a comment may carry no inner parens and no square )
( brackets. This file carried five bracketed comments, on the one macro that decides )
( everything. A parse abort on line 5 would have read as TRIG REJECTED when the real )
( cause was a comment - a false negative on the decider, and it would have cost a )
( machine visit to not-learn. Found by reading. Nothing about the test itself changed. )

( t1466 - HOW THIS FILE RELATES TO V13a..V13d, and which to run: )
( A syntax error aborts the WHOLE file and nothing executes - safety rule 3 - so four )
( probes in one file means the FIRST missing function blinds the other three, and COS )
( and SIN sit AHEAD of SQRT here while the libm table above predicts those two are )
( exactly the ones that fail. So: )
(   RUN THIS FILE FIRST. If it reaches the end, one run answers all four - the best )
(   case, and cheap. Its ABORT is evidence in its own right: it proves an unknown )
(   function fails LOUD on this controller, which is the question the corpus rule turns )
(   on, and which no split file can answer on its own. )
(   THEN RUN V13c_sqrt.nc, and V13a / V13b / V13d, whenever this file did NOT reach the )
(   end. One function per file, so none of them can be blinded. V13c first - SQRT is )
(   the one that three shipped boundaries wait on. )
( The lift plan - what each answer changes in Studio - is web/data/trigEvidence.js. )

( HOW TO READ THE RESULT, on the controller's variable page: )
(   #601 = 100 always. If #601 is 100 and nothing else changed, the macro ran to the end. )
(   #602 = 50  if COS worked.   COS 60 = 0.5, x100. Unchanged 0 = it did not. )
(   #603 = 50  if SIN worked.   SIN 30 = 0.5, x100. )
(   #604 = 300 if SQRT worked.  SQRT 9 = 3, x100. )
(   #605 = 4500 if ATAN worked. ATAN 1/1 = 45 deg, x100. )
( A slot holding a number that is NEITHER its seed NOR its expected value is the third )
( outcome and the important one: the function PARSED and returned something wrong. )
( Write that number down - it is the silently-wrong case the corpus rule forbids. )
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
