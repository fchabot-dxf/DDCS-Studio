( G53 vs NORMAL short-move test - X axis only )
( Does the tool-setter's move type - G53 machine-coord - crawl on a SHORT move? )
( SAFETY: ensure ~20mm CLEAR travel in +X. Machine must be HOMED for G53. )
( WATCH: is the G53 5mm move much slower than the normal 5mm move? )

#100 = #880           ( capture current machine X )
#102 = [#100 + 5]     ( 5mm away - brackets required on DDCS )

( ---- reference: NORMAL relative 5mm rapid (should be fine) ---- )
G91 G00 X5
G04 P1.5
G91 G00 X-5
G04 P2.0

( ---- G53 machine-coord 5mm rapid, via variable (as DDCS requires) ---- )
G90
G53 X#102
G04 P1.5
G53 X#100

M30
