(Measure boss width - probe starts above center)
(v2.1)
(Place probe above boss center, then run)

#1=#2673  ;axis: 1=X, 2=Y
#2=#2674  ;approx boss width (mm)
#3=#2675  ;scan speed (mm/min)
#4=#2676  ;probe diameter (mm)
#5=#2677  ;Z drop depth (mm, positive value)

#6=1000   ;travel speed fixed
#7=5      ;delta margin (mm)
#14=20    ;slow scan speed
#15=1     ;retract
#18=[#2/2+#7]  ;half width + delta

#10=#880
#11=#881
#12=#882
#20=0  ;edge minus side
#21=0  ;edge plus side
#22=0  ;width result
#30=#1078
#31=#1080

IF #1==1 GOTO11
IF #1==2 GOTO21
GOTO98

//--- X axis ---
N11
G91 G1 X-#18 F#6        ;move to minus side (half width + delta)
G91 G1 Z-#5 F500         ;drop Z
G91 G31 X#18 F#3 P#30 L#31 Q1   ;scan in plus toward edge1
IF #1920==0 GOTO1
#20=#1925
G91 G1 X[-#15] F#3      ;retract
G91 G31 X[#15*2] F#14 P#30 L#31 Q1  ;slow scan edge1
IF #1920==0 GOTO1
#20=#1925
G91 G1 X[-#15] F#3        ;retract from edge1
G91 G1 Z#5 F500          ;raise Z to start height
G53 X#10                ;back to start X
G91 G1 X#18 F#6         ;move to plus side (half width + delta)
G91 G1 Z-#5 F500         ;drop Z
G91 G31 X-#18 F#3 P#30 L#31 Q1  ;scan in minus toward edge2
IF #1920==0 GOTO1
#21=#1925
G91 G1 X[#15] F#3
G91 G31 X[-#15*2] F#14 P#30 L#31 Q1  ;slow scan edge2
IF #1920==0 GOTO1
#21=#1925
G91 G1 X[#15] F#3        ;retract from edge2
G91 G1 Z#5 F500          ;raise Z
#22=[#20-#21]
IF #22<0 GOTO33
GOTO34
N33
#22=#22*-1
N34
#22=[#22-#4]            ;subtract probe diameter
#23=[#20+#21]/2         ;center X (machine)
G53 X#23                ;move to center
GOTO30

//--- Y axis ---
N21
G91 G1 Y-#18 F#6
G91 G1 Z-#5 F500
G91 G31 Y#18 F#3 P#30 L#31 Q1
IF #1921==0 GOTO1
#20=#1926
G91 G1 Y[-#15] F#3
G91 G31 Y[#15*2] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#20=#1926
G91 G1 Z#5 F500
G53 Y#11
G91 G1 Y#18 F#6
G91 G1 Z-#5 F500
G91 G31 Y-#18 F#3 P#30 L#31 Q1
IF #1921==0 GOTO1
#21=#1926
G91 G1 Y[#15] F#3
G91 G31 Y[-#15*2] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#21=#1926
G91 G1 Y[#15] F#3        ;retract from edge2
G91 G1 Z#5 F500
#22=[#20-#21]
IF #22<0 GOTO43
GOTO44
N43
#22=#22*-1
N44
#22=[#22-#4]
#23=[#20+#21]/2
G53 Y#23

N30
#2680=#22
G53 Z#12               ;safe Z return
#1505=1(Boss done. Probe at center. See result CAM20)
GOTO99

N1
G91 G1 Z#5 F500
G53 X#10 Y#11
G53 Z#12
#1505=1(Edge not found!)
GOTO99
N98
#1505=1(Invalid axis! Use 1=X 2=Y)
N99
M30
