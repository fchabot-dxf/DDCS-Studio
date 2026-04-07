(KEY-6: 3D CORNER PROBE FOR G55)
(2024 Edition - Interactive Probe Configuration)

(=== QUICK SETUP IF NOT CONFIGURED ===)
IF #110!=0 GOTO10

#2070=110(Enter probe ball radius for Z offset [mm, e.g. 1.0]: )
#2070=111(Enter probe ball radius for XY offset [mm, e.g. 1.0]: )
#2070=112(Enter maximum search distance [mm, e.g. 50.0]: )
#2070=113(Enter clearance/retract height [mm, e.g. 5.0]: )

N10
(Display current probe configuration)
#1510 = #110
#1511 = #111
#1512 = #112
#1513 = #113
#1505=1(3D Probe: Ball R=%.2f/%.2f Search=%.1f Clear=%.1f - Continue?)
IF #1505==0 GOTO999

(Initialize)
G90 G17 G80 G49 M05 M09

(=== PROBE Z-AXIS ===)
#1505=-5000(Step 1/3: Probing Z-axis top surface...)

G91                      (Incremental mode)
G31 Z-[#112] F300.       (Fast search down)
IF #1922!=2 GOTO900      (Check probe triggered)

G00 Z3.                  (Back off)
G31 Z-5. F50.            (Slow accurate)
IF #1922!=2 GOTO900      (Check probe triggered)

#120 = #882              (Store Z machine position)
G00 Z[#113]              (Retract to clearance)
G90                      (Back to absolute)

(Switch to G55 and set Z zero)
G55
G10 L20 P2 Z[#110]       (Current position = ball radius)

(=== PROBE X-AXIS ===)
#1505=-5000(Step 2/3: Probing X-axis left edge...)

G00 Z[#113-2]            (Lower to 2mm below surface)
G91                      (Incremental)
G31 X-[#112] F300.       (Fast search left)
IF #1920!=2 GOTO900      (Check probe triggered)

G00 X3.                  (Back off)
G31 X-5. F50.            (Slow accurate)
IF #1920!=2 GOTO900      (Check probe triggered)

#121 = #880              (Store X machine position)
G00 X[#113]              (Retract clear)
G90                      (Absolute)

(=== PROBE Y-AXIS ===)
#1505=-5000(Step 3/3: Probing Y-axis front edge...)

G00 Z[#113-2]            (Lower slightly)
G91                      (Incremental)
G31 Y-[#112] F300.       (Fast search forward)
IF #1921!=2 GOTO900      (Check probe triggered)

G00 Y3.                  (Back off)
G31 Y-5. F50.            (Slow accurate)
IF #1921!=2 GOTO900      (Check probe triggered)

#122 = #881              (Store Y machine position)
G90                      (Absolute)

(Set XY zero in G55 accounting for ball radius)
G10 L20 P2 X[#111] Y[#111]

(Move to safe height)
G00 Z[#113]

(Display success)
#1510 = #5221  (G55 X - should be near ball radius)
#1511 = #5222  (G55 Y - should be near ball radius)
#1512 = #5223  (G55 Z - should be near ball radius)
#1505=-5000(G55 corner probed! X=%.3f Y=%.3f Z=%.3f)
GOTO999

(Probe failure)
N900
G90
G00 Z10
#1505=-5000(ERROR: Probe failed! Check probe contact and try again)
GOTO999

(Normal end)
N999
M30
