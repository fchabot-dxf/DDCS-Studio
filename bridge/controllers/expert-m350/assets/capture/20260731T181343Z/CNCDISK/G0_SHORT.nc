( G0 SHORT-MOVE SWEEP - is a bare short rapid slow, or only the macro? )
( SAFETY: needs ~90mm clear in +X. Watch each move. )
G91
( 40mm - should be quick )
G00 X40
G04 P1.5
G00 X-40
G04 P1.5
( 10mm )
G00 X10
G04 P1.5
G00 X-10
G04 P1.5
( 3mm - if short rapids are the problem, THIS one crawls for many seconds )
G00 X3
G04 P1.5
G00 X-3
G90
M30
