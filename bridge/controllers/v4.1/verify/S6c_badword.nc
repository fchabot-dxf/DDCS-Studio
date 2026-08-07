(S6c - UNREADABLE NUMERIC ARGUMENT. Is the line REJECTED, or TOLERATED?)
(This is the question that decides what Studio emits for an expression it cannot resolve.)
(If the controller REJECTS the line, Studio can emit the unresolved name verbatim and let)
(the machine refuse it - an error at execution, like any other syntax error.)
(If the controller TOLERATES it - whether it drops the word or reads it as zero - that)
(route is unsafe and Studio must hold the gate itself. BOTH tolerant outcomes are fatal)
(to emit-verbatim, so this file does not need to tell them apart. Reject vs tolerate only.)

(WHY A DWELL AND NOT AN AXIS WORD - this kit's invariant is NO MOTION, enforced by an)
(allowlist test, and that invariant is worth more than the convenience of probing G0 here.)
(G04 P takes a numeric argument exactly like an axis word does, so it asks the parser the)
(same question with no motion and no side effect: if P is read as zero the dwell is zero)
(seconds, and if the word is dropped the dwell is the default. Harmless either way.)

(WHAT THIS PROVES, AND WHAT IT DOES NOT - be honest when reading it:)
(  TOLERATED here is DECISIVE. A parser that accepts an unreadable numeric anywhere kills)
(    emit-verbatim outright; there is nothing left to check.)
(  REJECTED here is STRONG but NOT conclusive for the axis-word case, which may take a)
(    different code path. Confirm that with S6d in the verify-motion directory, which runs)
(    only on the motorless bench unit.)

(NO MOTION. One dwell, one assignment.)

(READ #190:)
(  -99999 = REJECTED. The file aborted before the assignment, nothing ran.)
(  777    = TOLERATED. Execution continued past an argument it could not read.)
(           Emit-verbatim is UNSAFE. Studio must refuse before this ships.)
#190 = -99999
G04 Pwidht
#190 = 777
M30
