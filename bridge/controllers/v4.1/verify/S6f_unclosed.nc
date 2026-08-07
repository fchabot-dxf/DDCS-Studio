(S6f - UNCLOSED BRACKET. Does the controller CLOSE it, TRUNCATE, or ALARM?)
(Studio's sim currently evaluates an opening bracket with 1 + 2 and no closing bracket as 3 -)
(it parses what it can and ignores the missing close.)
(That is the LAST known place the sim is more lenient than the machine. t1573 fixed trailing)
(garbage after a valid prefix; this is the mirror case - a valid prefix with nothing after it.)
(It matters for the SEND GATE: the gate refuses what the parser refuses, so sim and machine)
(must agree before anything gates on them. Sim too strict = a false refusal that stops work.)
(NOTE - no square brackets appear in these comments on purpose: a bracket inside a comment)
(makes the controller abort on the header, which would read as a rejection of the TEST LINE.)
(#190 and #191 are used because the firmware owns #0-148 - never probe with one of those.)
(NO MOTION. Three assignments, no G or M words except M30.)
(READ #190:)
(  3      = the controller CLOSED the bracket for us and evaluated it. Sim already matches.)
(  -99999 = it ALARMED before the assignment. The sim is WRONG and must reject this too.)
(  0 or anything else = it parsed some THIRD way - write the number down verbatim.)
(If it alarms, expect the usual Unrecognized file format message quoting the line back.)
#190 = -99999
#191 = 0
#190 = [1 + 2
M30
