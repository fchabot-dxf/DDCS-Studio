(S6e - DOES A REJECTED FILE RUN THE LINES BEFORE THE BAD ONE?)
(S6a left #191 holding 1234 - the value it assigns on the line BEFORE its bad line - which)
(suggests the V4.1 executes up to the fault and THEN stops, rather than refusing the whole)
(file the way the Expert does. That is a different safety story: refuses-to-start versus)
(cuts-three-ops-then-halts. This file settles it with a fresh sentinel S6a never wrote.)

(NO MOTION. One assignment, then a deliberately malformed one.)

(READ #191 over SMB - sysdisk uservar slot 91, byte offset 728, float64 little-endian:)
(  5678 = the good line RAN before the bad line was rejected. PARTIAL EXECUTION.)
(         A rejected program is not inert - it does everything up to the fault.)
(  1234 = still S6a's old value, so this file ran NOTHING. Whole-file reject, like)
(         the Expert. A rejected program never starts.)
#191 = 5678
#190 = #191k8
M30
