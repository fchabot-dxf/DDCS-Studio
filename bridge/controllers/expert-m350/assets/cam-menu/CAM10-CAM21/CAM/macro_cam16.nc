(Measure workpiece angle for G68 correction)
(v1.4)

#1=#2641  ;distance between points (mm)
#2=#2642  ;side axis: 1=X, 2=Y
#3=#2643  ;touch direction: +1 or -1
#4=#2644  ;scan speed (mm/min)
#5=#2645  ;probe diameter (mm)
#6=#2646  ;travel direction: +1 or -1
#7=#2647  ;search stroke (mm)
#8=2000   ;travel speed fixed

#14=20
#15=1
#10=#880
#11=#881
#20=0
#21=0
#22=0
#23=0
#24=0
#25=0
#26=0
#30=#1078
#31=#1080

IF #2==1 GOTO11
IF #2==2 GOTO21
GOTO98

N11
G91 G31 Y[#7*#3] F#4 P#30 L#31 Q1
IF #1921==0 GOTO1
#21=#1926
G91 G1 Y[#15*#3*-1] F#4
G91 G31 Y[#15*2*#3] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#21=[#1926+#5*#3/2]
#20=#880
G91 G1 Y[#15*#3*-1] F#4
G91 G1 X[#1*#6] F#8
G91 G31 Y[#7*#3] F#4 P#30 L#31 Q1
IF #1921==0 GOTO1
#23=#1926
G91 G1 Y[#15*#3*-1] F#4
G91 G31 Y[#15*2*#3] F#14 P#30 L#31 Q1
IF #1921==0 GOTO1
#23=[#1926+#5*#3/2]
#22=#880
G91 G1 Y[#15*#3*-1] F#4
GOTO31

N21
G91 G31 X[#7*#3] F#4 P#30 L#31 Q1
IF #1920==0 GOTO1
#20=#1925
G91 G1 X[#15*#3*-1] F#4
G91 G31 X[#15*2*#3] F#14 P#30 L#31 Q1
IF #1920==0 GOTO1
#20=[#1925+#5*#3/2]
#21=#881
G91 G1 X[#15*#3*-1] F#4
G91 G1 Y[#1*#6] F#8
G91 G31 X[#7*#3] F#4 P#30 L#31 Q1
IF #1920==0 GOTO1
#22=#1925
G91 G1 X[#15*#3*-1] F#4
G91 G31 X[#15*2*#3] F#14 P#30 L#31 Q1
IF #1920==0 GOTO1
#22=[#1925+#5*#3/2]
#23=#881
G91 G1 X[#15*#3*-1] F#4

N31
#25=[#22-#20]
#26=[#23-#21]
IF #2==1 GOTO32
#24=[#25/#26]*57.2957795
GOTO33
N32
#24=[#26/#25]*57.2957795
N33
#2648=#24
G53 X#10 Y#11
#1505=1(Angle done. See result param in CAM16 menu)
GOTO99

N1
G53 X#10 Y#11
#1505=1(Edge not found!)
GOTO99
N98
#1505=1(Invalid axis! Use 1=X 2=Y)
N99
M30
