(S5b - does the DDCS V4.1 parser accept an EXPRESSION inside a coordinate word. ONE risky form per file.)
(t1536 t1538. wcsZeroAtCurrent and setWorkOffset in wizards dialects ddcs-v41.js both ship a bracketed)
(expression inside an axis word via G92, e.g. G90 G92 Z bracket hash1502 minus value close-bracket. That)
(form has never been watched run on real silicon. This file tests it directly, using G92, a WORK-COORDINATE)
(redefinition, NOT a physical move -- the controllers own zeroxy.nc and zeroall.nc do exactly this class of)
(write as normal, everyday operation.)

(NO MOTION. G92 does not move an axis; it changes what the CURRENT position is CALLED in the work frame.)
(SELF-RESTORING BY CONSTRUCTION, not by a separate restore file -- the bracketed expression reads the)
(CURRENT work-Z, register #1508, ddcs-v41.js vars wcsWork plus Z, and adds zero, so the line sets work-Z to)
(EXACTLY what it already was. No prior value needs saving and no second file is needed to put it back.)

(HOW TO READ THE RESULT -- read #190, see README.md for both the on-screen and the SMB uservar path.)
(  #190 EQ 100 -- an EXPRESSION INSIDE A COORDINATE WORD parsed and ran, via G92.)
(  #190 EQ -99999, the sentinel, unchanged, with a SYNTAX ERROR -- the form was REJECTED. Note the line)
(    number. Studios setWorkOffset and wcsZeroAtCurrent emit would need a different form for this target.)

(Prime)
#190 = -99999

(The probe -- an expression inside the Z axis word, via G92. Self-restoring: reads #1508, adds 0, writes it back.)
G90
G92 Z[#1508+0]

(Reached the end)
#190 = 100

M30
