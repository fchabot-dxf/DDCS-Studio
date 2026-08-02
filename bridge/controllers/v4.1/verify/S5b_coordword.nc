(S5b - does the DDCS V4.1 parser accept an EXPRESSION inside a coordinate word. ONE risky form per file.)
(t1536 t1538. wcsZeroAtCurrent and setWorkOffset in wizards dialects ddcs-v41.js both ship a bracketed)
(expression inside an axis word via G92, e.g. G90 G92 Z bracket hash1502 minus value close-bracket. That)
(form has never been watched run on real silicon. This file tests it directly, using G92, a WORK-COORDINATE)
(redefinition, NOT a physical move -- the controllers own zeroxy.nc and zeroall.nc do exactly this class of)
(write as normal, everyday operation.)

(NO MOTION. G92 does not move an axis; it changes what the CURRENT position is CALLED in the work frame.)
(SELF-RESTORING BY CONSTRUCTION, IF THE VARIABLE MAP IS RIGHT -- the bracketed expression reads what)
(ddcs-v41.js DECLARES to be the current work-Z, register #1508, vars wcsWork plus Z, and adds zero, so IF)
(number 1508 really is work-Z the line sets it to EXACTLY what it already was. THIS IS THE ONE FILE IN THE)
(KIT THAT WRITES CONTROLLER STATE, and the self-restore argument rests on that ONE assumption. If #1508 is)
(NOT work-Z, the register-means-something-else hazard this whole arc exists to guard against, this line)
(sets work-Z to whatever unrelated value #1508 holds -- silently, persistently, and nothing else in this)
(file would tell you. THAT IS WHY YOU MUST READ THE WORK-Z DRO BEFORE RUNNING THIS FILE AND AGAIN AFTER.)

(BEFORE RUNNING -- write down the current work-Z reading from the controllers own screen.)

(HOW TO READ THE RESULT -- read #190 same as every other file, see README.md, AND compare work-Z to what)
(you wrote down.)
(  work-Z UNCHANGED and #190 EQ 100 -- the STRONGEST pass available. It confirms BOTH that the expression)
(    evaluated and that #1508 genuinely is work-Z -- the variable map is correct.)
(  work-Z CHANGED, #190 EQ 100 -- the expression ran but #1508 is NOT work-Z. This is a REAL FINDING about)
(    the variable map, and more valuable than the parse result. Write down BOTH the before and after)
(    values, then reset work-Z yourself back to the value you noted before running this file.)
(  #190 EQ -99999, the sentinel, unchanged, with a SYNTAX ERROR -- the form was REJECTED, work-Z was never)
(    touched. Note the line number. Studios setWorkOffset and wcsZeroAtCurrent emit would need a different)
(    form for this target.)

(Prime)
#190 = -99999

(The probe -- an expression inside the Z axis word, via G92. Self-restoring: reads #1508, adds 0, writes it back.)
G90
G92 Z[#1508+0]

(Reached the end)
#190 = 100

M30
