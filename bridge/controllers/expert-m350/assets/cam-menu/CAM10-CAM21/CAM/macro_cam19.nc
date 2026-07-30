(Measure hole diameter - find center first, then measure)
(v3.0)

#1=#2665  ;approx hole diameter (mm)
#2=#2666  ;scan speed (mm/min)
#3=#2667  ;probe diameter (mm)
#4=#2668  ;double precision: 0=off, 1=on
#5=#2669  ;Z lift (mm)

#14=20
#15=1
#18=[#1/2+3]
#10=#880
#11=#881
#12=#882
#20=0
#21=0
#22=0
#23=0
#24=0
#25=0
#26=0
#27=0
#30=#1078
#31=#1080

//=== STAGE 1: FIND CENTER ===
//--- X minus ---
G91 G31 X-#18 F#2 P#30 L#31 Q1
IF #1920==0 GOTO1
#20=#1925
G53 X[#20+#15]
G91 G31 X[-#15*2] F#14 P#30 L#31 Q1
IF #1920==0 GOTO1
#20=#1925
G53 X#10
//--- X plus ---
G91 G31 X#18 F#2 P#30 L#31 Q1
IF #1920==0 GOTO1
#21=#1925
G53 X[#21-#15]
G91 G31 X[#15*2] F#14 P#30 L#31 Q1
IF #1920==0 GOTO1
#21=#1925
G53 X#10
//--- Y minus ---
G91 G31 Y-#18 F#2 P#30 L#31 Q1
IF #1921==0 GOTO1
#22=#1926
G53 Y[#22+#15]
G91 G31 Y[-#15*2] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#22=#1926
G53 Y#11
//--- Y plus ---
G91 G31 Y#18 F#2 P#30 L#31 Q1
IF #1921==0 GOTO1
#23=#1926
G53 Y[#23-#15]
G91 G31 Y[#15*2] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#23=#1926
G53 Y#11

//--- move to found center ---
#24=[#20+#21]/2  ;center X
#25=[#22+#23]/2  ;center Y
G53 X#24 Y#25

//=== STAGE 2: MEASURE DIAMETER FROM CENTER ===
//--- X minus ---
G91 G31 X-#18 F#2 P#30 L#31 Q1
IF #1920==0 GOTO1
#20=#1925
G53 X[#20+#15]
G91 G31 X[-#15*2] F#14 P#30 L#31 Q1
IF #1920==0 GOTO1
#20=#1925
G53 X#24
//--- X plus ---
G91 G31 X#18 F#2 P#30 L#31 Q1
IF #1920==0 GOTO1
#21=#1925
G53 X[#21-#15]
G91 G31 X[#15*2] F#14 P#30 L#31 Q1
IF #1920==0 GOTO1
#21=#1925
G53 X#24
//--- Y minus ---
G91 G31 Y-#18 F#2 P#30 L#31 Q1
IF #1921==0 GOTO1
#22=#1926
G53 Y[#22+#15]
G91 G31 Y[-#15*2] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#22=#1926
G53 Y#25
//--- Y plus ---
G91 G31 Y#18 F#2 P#30 L#31 Q1
IF #1921==0 GOTO1
#23=#1926
G53 Y[#23-#15]
G91 G31 Y[#15*2] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#23=#1926
G53 Y#25

#26=[#21-#20+#3]  ;diameter X (inner: span + probe dia)
#27=[#23-#22+#3]  ;diameter Y (inner: span + probe dia)
#50=[#26+#27]/2   ;average diameter
#2671=#50
G53 X#24 Y#25
G91 G1 Z#5 F500
#1505=1(Done. See result param in CAM19 menu)
GOTO99

N1
G53 X#10 Y#11
G91 G1 Z#5 F500
#1505=1(Edge not found!)
N99
M30
