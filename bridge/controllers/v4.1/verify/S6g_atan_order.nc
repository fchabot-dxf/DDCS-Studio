(S6g - ATAN ARGUMENT ORDER. S5o could not settle this and Studio is currently ASSUMING.)
(S5o proved the comma form works, but it used ATAN of 1 comma 1 - both arguments EQUAL -)
(so 45 degrees comes out the same whichever order the controller reads them in. Studio's)
(parser pins a convention that no hardware has ever confirmed.)

(It matters: any real use computes an angle from a dx and a dy. Wrong order gives the)
(COMPLEMENT - 26.6 degrees instead of 63.4 - so an alignment rotation would be mirrored.)

(NO BRACKETS IN THESE COMMENTS. The V4.1 aborts on a bracket inside a comment, so a probe)
(written carelessly fails on its own header and gets misread as a rejection of the test.)
(That has now happened twice in this directory - S5o and S6f - so it is worth the note.)

(NO MOTION. One assignment.)

(READ #190:)
(  2657 = ATAN of y comma x, i.e. atan2 of 1 over 2 = 26.565 degrees. Studio's assumption)
(         is CORRECT and the quadrant convention stands.)
(  6343 = the OPPOSITE order, atan2 of 2 over 1 = 63.435 degrees. Studio is MIRRORED and)
(         every angle it computes from a dx and dy is wrong. Fix the parser.)
(  -99999 or a syntax error = the comma form does not work in this position after all,)
(         which would also contradict S5o. Note it and say so.)
(  anything else = write the number down; it says what it computed instead.)
#190 = -99999
#190 = [ATAN[1, 2] * 100]
M30
