(V16 - DOES A G2/G3 ARC INTERPOLATE A Z AT THE SAME TIME. t1472.)
(This is the HELICAL form: one block that arcs in XY and descends in Z together.)

(WHY IT IS NOT ALREADY ANSWERED BY THE PLANAR ARCS WE HAVE SEEN:)
(  PLANAR G02/G03 with I and J is richly attested on this family - 7353 of them in the)
(  captured CNCDISK job that ran on THIS machine, plus the V4.1 factory slib-g's own)
(  G02 X0 I-#6 full circle. But across EVERY captured .nc in the repo, 7355 arc lines)
(  carry a Z exactly ZERO times, and the M350 reference documents no G02/G03 at all.)
(  A neighbouring form working proves only itself.)

(⚠ WHY IT MATTERS MORE THAN THE V13 SET: this one STEERS A CUT, and Studio ALREADY)
(  EMITS ONE. The circle-contour ramp entry sends a helical G3 to real machines today)
(  - one site, wizards/ops/contour.js - and nobody has confirmed the controller honours)
(  the Z. So this test is not only a gate on the true-arc helix; it is a check on emit)
(  that is already shipping.)

(⚠ THIS ONE MOVES. Unlike the V13 set there is no way to ask the question without)
(  motion - the whole question IS whether the machine descends while it arcs.)
(  BEFORE RUNNING:)
(    - TAKE THE TOOL OUT of the spindle, or fit a blunt dowel. Spindle stays OFF.)
(    - Park where there is at least 12mm of free travel in -X, 6mm either side in Y,)
(      and 2mm of free travel DOWN in Z. Nothing under the spindle.)
(    - Rapid override LOW, hand on feed-hold.)
(  The move is a single 5mm-radius circle descending 1mm at 300mm/min, in G91, so it)
(  is relative to wherever you parked and returns to its own start in XY.)

(HOW TO READ THE RESULT:)
(  popup Zdrop=1.000 - HELICAL ARCS WORK. The controller arced and descended together.)
(  popup Zdrop=0.000 - the arc RAN but the Z was IGNORED. This is the SILENT case and)
(    the dangerous one: the shipped contour ramp has been cutting its entry circles at)
(    one depth instead of descending, and the true-arc helix must stay refused.)
(  popup Zdrop=anything else - note the number. It moved, but not by what was asked.)
(  NO POPUP, a syntax error instead - the parser REJECTED the form and aborted the)
(    whole file before anything ran. Loud, safe, and a clear NO.)

(Prime)
#100 = 0
#101 = 0
#102 = 0

(Z before, from the work-position register the factory gotozero.nc itself reads)
#100 = #792

(THE PROBE - one full circle of radius 5 in -X, descending 1mm, incremental)
G91
G03 X0 Y0 I-5 J0 Z-1 F300

(Z after)
#101 = #792

(Put the 1mm back and leave the frame as we found it)
G00 Z1
G90

(Report)
#102 = [#100 - #101]
#1510 = #102
#1505 = -5000(V16 Zdrop=%.3f  1.000=helical-works  0.000=Z-IGNORED  none=rejected)
G04 P2.0

M30
