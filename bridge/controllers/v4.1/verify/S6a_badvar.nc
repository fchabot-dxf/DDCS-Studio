(S6a - MALFORMED VARIABLE REFERENCE. Does the controller TRUNCATE or ALARM?)
(Studio's sim silently reads #191k8 as #191 and DISCARDS the k8 - no error is ever raised.)
(If the real controller alarms instead, the sim is lying to the preview about a broken program.)
(#191 is used as the source because the firmware owns #0-148 - never probe with one of those.)
(NO MOTION. Two assignments.)
(READ #190 - 1234 means it TRUNCATED to #191, matching the sim. Sim is faithful.)
(-99999 means it ALARMED before the assignment - the sim is WRONG and must stop too.)
(0 or anything else means it parsed the reference some THIRD way - write down the number.)
#190 = -99999
#191 = 1234
#190 = #191k8
M30
