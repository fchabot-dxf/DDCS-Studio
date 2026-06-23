(Measure slot width - probe starts inside at center)
(v2.0)
(Place probe inside slot at center, at working depth, then run)

#1=#2681  ;axis: 1=X, 2=Y
#2=#2682  ;approx slot width (mm)
#3=#2683  ;scan speed (mm/min)
#4=#2684  ;probe diameter (mm)
#5=#2685  ;Z lift after measurement (mm, positive)
#6=#2686  ;working coordinate system: 54-59

#7=5      ;delta margin (mm)
#8=2000   ;travel speed fixed
#14=20    ;slow scan speed
#15=1     ;retract
#17=[#6-54]*5
#18=[#2/2+#7]  ;half width + delta = search stroke

#10=#880
#11=#881
#12=#882
#20=0  ;wall minus
#21=0  ;wall plus
#22=0  ;width result
#30=#1078
#31=#1080

IF #1==1 GOTO11
IF #1==2 GOTO21
GOTO98

//--- X axis ---
N11
G91 G31 X-#18 F#3 P#30 L#31 Q1   ;scan minus toward wall1
IF #1920==0 GOTO1
#20=#1925
G91 G1 X[#15] F#3
G91 G31 X[-#15*2] F#14 P#30 L#31 Q1  ;slow scan wall1
IF #1920==0 GOTO1
#20=#1925
G53 X#10                ;return to center before scanning wall2
G91 G31 X#18 F#3 P#30 L#31 Q1    ;scan plus toward wall2
IF #1920==0 GOTO1
#21=#1925
G91 G1 X[-#15] F#3
G91 G31 X[#15*2] F#14 P#30 L#31 Q1   ;slow scan wall2
IF #1920==0 GOTO1
#21=#1925
#22=[#21-#20+#4]        ;width = span + probe diameter (inner)
#23=[#20+#21]/2         ;center X
G53 X#23                ;move to center
G91 G1 Z#5 F#8          ;Z lift
#[805+#17]=#880         ;set X zero at center
GOTO30

//--- Y axis ---
N21
G91 G31 Y-#18 F#3 P#30 L#31 Q1
IF #1921==0 GOTO1
#20=#1926
G91 G1 Y[#15] F#3
G91 G31 Y[-#15*2] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#20=#1926
G53 Y#11                ;return to center before scanning wall2
G91 G31 Y#18 F#3 P#30 L#31 Q1
IF #1921==0 GOTO1
#21=#1926
G91 G1 Y[-#15] F#3
G91 G31 Y[#15*2] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#21=#1926
#22=[#21-#20+#4]
#23=[#20+#21]/2
G53 Y#23
G91 G1 Z#5 F#8
#[806+#17]=#881         ;set Y zero at center

N30
#2688=#22
#1505=1(Slot done. Zero at center. See result CAM21)
GOTO99

N1
G91 G1 Z#5 F#8
G53 X#10 Y#11
#1505=1(Edge not found!)
GOTO99
N98
#1505=1(Invalid axis! Use 1=X 2=Y)
N99
M30
