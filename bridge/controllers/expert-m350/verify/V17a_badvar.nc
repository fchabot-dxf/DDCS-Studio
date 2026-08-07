(V17a - MALFORMED VARIABLE REFERENCE. Does the parser TRUNCATE or REJECT?)
(Studio's sim silently reads #91k8 as #91 and DISCARDS the k8 - no error is ever raised.)
(If the Expert rejects it instead, the sim is lying to the preview about a broken program.)

(REGISTER CHOICE - this differs from the V4.1 twin of this test on purpose. That file uses)
(#190 and #191, which are V4.1-native free. On the Expert those land in the PERSISTENT)
(uservar band #100 to #549 and would clobber saved macro state. This file uses SCRATCH)
(#90 and #91 - band #1 to #99, nothing persists, clear of the dialect reservations at)
(#42 #43 #70 to #72 and clear of #95 saved-probe-Z.)

(NO MOTION. Two assignments. Nothing saved, nothing restored.)

(HOW TO READ THE RESULT:)
(  popup BADVAR=1234 - it TRUNCATED to #91, matching the sim. Sim is faithful.)
(  popup BADVAR=anything else - it parsed the reference a THIRD way. Write the number)
(    down; that number says what the parser did instead.)
(  NO POPUP, a syntax error instead - REJECTED. Whole file aborted, nothing ran, state)
(    pristine. That is the loud answer, and Studio's sim must be made to stop too.)

(Prime)
#90 = -99999
#91 = 1234

(The probe)
#90 = #91k8

(Report)
#1510 = #90
#1505 = -5000(V17a BADVAR=%.0f  1234=truncated-like-sim  other=third-way  none=rejected)
G04 P2.0

M30
