(V18g - does G49 cancel a LIVE offset)
(Every earlier G49 run had H00 selected, so there was nothing to cancel and the result proved)
(nothing. This selects a real offset first, then cancels, and samples at all three points.)

(Both G49 forms are attested in the corpus - standalone and inside the combined safety block -)
(so the standalone form used here is not a guess.)

(The offset is machine Z minus workpiece Z, which is #882 minus #792.)
(If this macro stops early, V18b puts H01 back from #2520.)

(Prime)
#111 = 1
#112 = 1
#113 = 1

(Keep the current H01 and write a test value)
#2520 = #900
#900 = 10.0

(Sample with nothing selected)
#111 = [#882 - #792]

G43 H01

(Sample with the offset live)
#112 = [#882 - #792]

G49

(Sample after the cancel)
#113 = [#882 - #792]

#1510 = #111
#1511 = #112
#1505 = -5000(V18g none=%.3f selected=%.3f)
G04 P8.0

#1510 = #113
#1505 = -5000(V18g after G49=%.3f)
G04 P8.0

(Put H01 back)
#900 = #2520

#1510 = #900
#1505 = -5000(V18g H01 restored to %.3f)
G04 P4.0

M30
