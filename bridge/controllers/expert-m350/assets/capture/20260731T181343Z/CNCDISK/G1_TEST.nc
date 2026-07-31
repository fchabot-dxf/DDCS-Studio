( SPEED TEST - G1 feed vs G0 rapid, SAME distance, back to back )
( SAFETY: ensure at least 100mm clear travel in +X and +Y first. )
( Watch the feed readout. First pair = G1 F2000. Pause. Second pair = G0 rapid. )
G91
( ---- G1 feed at F2000 ---- )
G01 X80 Y80 F2000
G04 P1.0
G01 X-80 Y-80 F2000
( ---- gap so you can tell them apart ---- )
G04 P2.0
( ---- G0 rapid ---- )
G00 X80 Y80
G04 P1.0
G00 X-80 Y-80
G90
M30
