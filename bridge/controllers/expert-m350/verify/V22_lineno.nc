(V22 - does register 16062 count PHYSICAL FILE LINES or EXECUTABLE BLOCKS?)
(In V21 the two coincided, so that run could not tell them apart.)
(This file separates them: the long dwell sits at PHYSICAL LINE 12,)
(but it is only the 3rd EXECUTABLE block in the file.)
(If 16062 reads 12 -> physical file lines, comments included.)
(If 16062 reads 3  -> executable blocks only.)
(Commands no motion and writes nothing but a scratch variable.)
(padding comment to push the dwell down to line twelve)
(padding comment two)
#916 = 111
#917 = 222
G04 P20000
(after the dwell)
M30
