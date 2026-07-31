(V8 - does the dual-Y gantry A column mirror Y in the WCS table - READ ONLY)
(For G54: Y offset = #806, A offset = #808. base 805, Y=base+1, A=base+3.)
(If Yoff806 == Aoff808 the A axis is tracking Y in the WCS table. No motion.)

(Prime)
#101 = 1
#102 = 1

(Read G54 Y and A work offsets)
#101 = #806
#102 = #808

(Report)
#1510 = #101
#1511 = #102
#1505 = -5000(V8 G54 Yoff806=%.3f Aoff808=%.3f)
G04 P2.0

M30
