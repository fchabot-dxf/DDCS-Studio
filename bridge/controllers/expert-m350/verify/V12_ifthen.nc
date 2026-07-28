(V12 - does IF cond THEN inline-assign work, or only IF ... GOTO)
(camMacroKit CAM-slot macros emit IF #x GT [n] THEN #x=[n] clamps. The verified findings)
(confirm IF/GOTO + WHILE/DO/END but NOT the inline THEN-assign. This tests it directly.)
(No motion - a pure variable clamp - safe. If IF..THEN is a syntax error the WHOLE file)
(fails to parse: you get a syntax-error popup and NO V12 message = IF..THEN is rejected.)

(Prime a value above the clamp limit)
#100 = 5

(The exact clamp form camMacroKit uses - if IF..THEN works, #100 clamps 5 down to 3)
IF #100 GT 3 THEN #100 = 3

(Report - clamp=3 means IF..THEN WORKS; =5 means it parsed but did NOT assign)
#1510 = #100
#1505 = -5000(V12 IF-THEN clamp=%.0f  3=works 5=noassign  no-popup=syntax-rejected)
G04 P2.0

M30
