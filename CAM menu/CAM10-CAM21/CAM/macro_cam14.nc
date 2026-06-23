(Find inner corner with 3D touch probe)
(v1.2)

#1=#2625  ;max movement X
#2=#2626  ;max movement Y
#3=#2627  ;fast speed
#6=#2629  ;X axis direction
#7=#2630  ;Y axis direction
#8=#2628  ;Probe diameter
#9=#2632  ;Double precision scan: 0=off, 1=on

#14=20    ;slow speed
#15=1     ;отскок
#17=[#2631-54]*5  ;Working coordinate system offset

#10=#880  ;current X machine position
#11=#881  ;current Y machine position
#12=#882  ;current Z machine position

#20=0  ;X position
#22=0  ;Y position

#30=#1078  ;input port number of the probe
#31=#1080  ;Floating tool setter effective level

//Y Axis.
IF #7==0 GOTO4  ;Если Y отключена, то переход

G91 G31 Y[#2*#7*-1] F#3 P#30 L#31 Q1  ;fast scan toward wall
IF #1921==0 GOTO1  ;edge not found!
#22=#1926

G91 G1 Y[#15*#7] F#3  ;отскок после быстрого (от стенки)
G91 G31 Y[#15*2*#7*-1] F#14 P#30 L#31 Q1  ;slow precise scan 1
IF #1921==0 GOTO1  ;edge not found!
#22=#1926
G91 G1 Y[#15*#7] F#3  ;отскок после scan 1

IF #9==0 GOTO6  ;skip double scan
G91 G31 Y[#15*2*#7*-1] F#14 P#30 L#31 Q1  ;slow precise scan 2
IF #1921==0 GOTO1  ;edge not found!
#22=#1926
G91 G1 Y[#15*#7] F#3  ;отскок после scan 2
N6
#22=[#22-#8*#7/2]  ;probe radius compensation Y

G53 Y#11   ;returns to the starting point


//X Axis
N4

IF #6==0 GOTO5  ;Если X отключена, то переход

G91 G31 X[#1*#6*-1] F#3 P#30 L#31 Q1  ;fast scan toward wall
IF #1920==0 GOTO1  ;edge not found!
#20=#1925

G91 G1 X[#15*#6] F#3  ;отскок после быстрого (от стенки)
G91 G31 X[#15*2*#6*-1] F#14 P#30 L#31 Q1  ;slow precise scan 1
IF #1920==0 GOTO1  ;edge not found!
#20=#1925
G91 G1 X[#15*#6] F#3  ;отскок после scan 1

IF #9==0 GOTO7  ;skip double scan
G91 G31 X[#15*2*#6*-1] F#14 P#30 L#31 Q1  ;slow precise scan 2
IF #1920==0 GOTO1  ;edge not found!
#20=#1925
G91 G1 X[#15*#6] F#3  ;отскок после scan 2
N7
#20=[#20-#8*#6/2]  ;probe radius compensation X

G53 X#10   ;returns to the starting point


N5

IF #6==0 GOTO8
#[805+#17]=#20  ;set X zero at corner
N8
IF #7==0 GOTO9
#[806+#17]=#22  ;set Y zero at corner
N9

#1505=1(Inner corner found!)
GOTO10

N1
#1505=1(Edge not found!)
GOTO10

N3
#1505=1(Collision!)
GOTO10

N10
G53 Z#12  ;safe Z
G53 X#10 Y#11  ;return to start
M30  ;end
