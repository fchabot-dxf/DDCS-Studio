(S6d - MALFORMED AXIS WORD ON A MOTION BLOCK. The exact case Studio would emit.)
(S6c asked the same question with a dwell argument, which is safe but is a PROXY - an axis)
(word on a motion block may take a different code path. This file asks it directly.)

(*** THIS DIRECTORY IS NOT THE NO-MOTION KIT. ***)
(verify-motion exists so the ../verify kit can keep its no-motion invariant ABSOLUTE and)
(machine-checked. Nothing in here may be dropped onto a machine with motors attached.)

(*** RUN ONLY ON THE MOTORLESS V4.1 BENCH UNIT. ***)
(That unit has no motors and nothing attached, so a motion command there is a parser event)
(and nothing else. This file must NEVER be copied to the Expert, which is a real machine.)
(The Expert learns this answer from THIS unit, not from its own spindle.)

(NO PRIMING MOVE, deliberately. On a motorless unit there is nothing to park, and a G0 X0)
(would only add a second motion word for no information.)

(READ #190:)
(  -99999 = REJECTED. The file aborted, nothing ran. Emit-verbatim is SAFE for axis words)
(           too, and the machine is the gate exactly as intended.)
(  777    = TOLERATED. The controller accepted a coordinate it could not read.)
(           Emit-verbatim is UNSAFE. Studio must refuse before this ships.)
#190 = -99999
G0 Xwidht
#190 = 777
M30
