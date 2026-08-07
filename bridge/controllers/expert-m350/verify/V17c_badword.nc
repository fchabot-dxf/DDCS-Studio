(V17c - UNREADABLE NUMERIC ARGUMENT. THE DECIDING TEST of the V17 set.)
(This decides what Studio emits for a wizard expression it cannot resolve.)
(If the controller REJECTS the line, Studio can emit the unresolved name verbatim and let)
(the machine refuse it - an error at execution, like any other syntax error.)
(If the controller TOLERATES it - whether it drops the word or reads it as zero - that)
(route is unsafe and Studio must hold the gate itself. BOTH tolerant outcomes are fatal)
(to emit-verbatim, so this file does not need to tell them apart. Reject vs tolerate only,)
(which is why it needs no motion to answer.)

(WHY A DWELL AND NOT AN AXIS WORD - this is a REAL MACHINE with motors and a spindle. The)
(axis-word form of this question is answered on the motorless V4.1 bench unit instead, by)
(S6d in bridge/controllers/v4.1/verify-motion/. Nothing is learned here that is worth)
(commanding an unknown motion form on the Bee. G04 P takes a numeric argument exactly like)
(an axis word does, so the parser gets the same question with no motion and no side effect.)

(Uses SCRATCH #90 - see the register note in V17a. Do not use #190 here; on the Expert)
(that is a PERSISTENT uservar and would clobber saved macro state.)

(NO MOTION. One dwell, one assignment. Nothing saved, nothing restored.)

(HOW TO READ THE RESULT:)
(  NO POPUP, a syntax error instead - REJECTED. Nothing ran, state pristine.)
(    Emit-verbatim is SAFE here - the machine is the gate, exactly as intended.)
(  popup BADWORD=777 - TOLERATED. Execution continued past an argument it could not read.)
(    Emit-verbatim is UNSAFE. Studio must refuse before this ships.)

(Prime)
#90 = -99999

(The probe)
G04 Pwidht

(Reached only if the unreadable argument was tolerated)
#90 = 777

(Report)
#1510 = #90
#1505 = -5000(V17c BADWORD=%.0f  777=tolerated-unsafe  none=rejected-safe)
G04 P2.0

M30
