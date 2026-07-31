(MANUAL G55 XY ZERO)
(2024 Edition - Set current position as G55 zero)

(Display current position)
#1510 = #5221  (Current X work coordinate)
#1511 = #5222  (Current Y work coordinate)
#1505=1(Set current position as G55 XY zero? X=%.3f Y=%.3f)
IF #1505==0 GOTO999

(Safety: Stop spindle)
M05

(Switch to G55 coordinate system)
G55

(Set current position as X0 Y0 in G55)
(G10 L20 P2 targets G55 specifically)
G10 L20 P2 X0. Y0.

(Display confirmation)
#1510 = #5221  (Should now be 0.000)
#1511 = #5222  (Should now be 0.000)
#1505=-5000(G55 XY zero set! X=%.3f Y=%.3f - Z unchanged)

(Normal end)
N999
M30
