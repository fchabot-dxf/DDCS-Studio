(Find outer edge center with 3D touch probe)

#1=#2608  ;max movement X
#2=#2609  ;max movement Y
#3=#2610  ;fast speed
//#4=#2611	; safe Z
#5=#2611	; scanning depth Z
#6=#2612	; X axis
#7=#2613	; Y axis



#14=20	  ;slow speed
#15=1  	  ;отскок
#16=3  ;input port number of the probe (YunKia V6 on IN03)
#17=[#2615-54]*5; Working coordinate system offset
#18=#2606  ;Double scan Y (for round samples)

#10=#880  ;current X machine position
#11=#881  ;current Y machine position
#12=#882  ;current Z machine position

#20=0  ;left position
#21=0  ;right position
#22=0  ;back position
#23=0  ;front position
#24=0  ;X center
#25=0  ;Y center

//Y Axis. 
IF #7==0 GOTO4		;Если Y отключена, то переход

G53 Z#12	;	safe Z
G91 G31 Y-#2 F[#3*3] P#16 L0 Q1  ;move back
IF #1921!=1 GOTO3  ;Collision

G91 G31 Z#5 F#3 P#16 L0 Q1  ;Scanning height
IF #1922!=1 GOTO3  ;Collision

G91 G31 Y#2 F#3 P#16 L0 Q1  ;fast scan
IF #1921==1 GOTO1  ;edge not found!
#22=#1926  ;edge found

G53 Y[#22-#15]   ;отскок
G91 G31 Y[#15*2] F#14 P#16 L0 Q1  ;Scanning
IF #1921==1 GOTO1  ;edge not found!

#22=#1926 ; Edge found
G53 Z#12	;	safe Z
G53 Y#11  ;returns to the starting point


G91 G31 Y#2 F[#3*3] P#16 L0 Q1  ;move forward
IF #1921!=1 GOTO3  ;Collision

G91 G31 Z#5 F#3 P#16 L0 Q1  ;Scanning height
IF #1922!=1 GOTO3  ;Collision

G91 G31 Y-#2 F#3 P#16 L0 Q1  ;fast scan
IF #1921==1 GOTO1  ;edge not found!
#23=#1926  ;edge found

G53 Y[#23+#15]   ;отскок
G91 G31 Y[#15*-2] F#14 P#16 L0 Q1  ;Scanning
IF #1921==1 GOTO1  ;edge not found!
#23=#1926 ; Edge found

#25=[#22+#23]/2  ;calc center Y
G53 Z#12		;safe Z
G53 Y#25  ;move to center Y



//X Axis
N4

IF #6==0 GOTO5		;Если X отключена, то переход

G53 Z#12	;	safe Z
G91 G31 X-#1 F[#3*3] P#16 L0 Q1  ;move back
IF #1920!=1 GOTO3  ;Collision

G91 G31 Z#5 F#3 P#16 L0 Q1  ;Scanning height
IF #1922!=1 GOTO3  ;Collision

G91 G31 X#1 F#3 P#16 L0 Q1  ;fast scan
IF #1920==1 GOTO1  ;edge not found!
#20=#1925  ;Edge found

G53 X[#20-#15]   ;отскок
G91 G31 X[#15*2] F#14 P#16 L0 Q1  ;Scanning
IF #1920==1 GOTO1  ;edge not found!

#20=#1925 ; Edge found
G53 Z#12	;safe Z
G53 X#10  ;returns to the starting point


G91 G31 X#1 F[#3*3] P#16 L0 Q1  ;move back
IF #1920!=1 GOTO3  ;Collision

G91 G31 Z#5 F#3 P#16 L0 Q1  ;Scanning height
IF #1922!=1 GOTO3  ;Collision

G91 G31 X-#1 F#3 P#16 L0 Q1  ;fast scan
IF #1920==1 GOTO1  ;edge not found!
#21=#1925  ;Edge found

G53 X[#21+#15]   ;отскок
G91 G31 X[#15*-2] F#14 P#16 L0 Q1  ;Scanning
IF #1920==1 GOTO1  ;edge not found!

#21=#1925 ; Edge found

#24=[#20+#21]/2  ;calc center X
G53 Z#12	;safe Z
G53 X#24  ;move to center X

//Y Axis. Double scan
IF #7==0 GOTO5		;Если Y отключена, то переход
IF #18==0 GOTO5		;Если Double Y отключена, то переход

G53 Z#12	;	safe Z
G91 G31 Y-#2 F[#3*3] P#16 L0 Q1  ;move back
IF #1921!=1 GOTO3  ;Collision

G91 G31 Z#5 F#3 P#16 L0 Q1  ;Scanning height
IF #1922!=1 GOTO3  ;Collision

G91 G31 Y#2 F#3 P#16 L0 Q1  ;fast scan
IF #1921==1 GOTO1  ;edge not found!
#22=#1926  ;edge found

G53 Y[#22-#15]   ;отскок
G91 G31 Y[#15*2] F#14 P#16 L0 Q1  ;Scanning
IF #1921==1 GOTO1  ;edge not found!

#22=#1926 ; Edge found
G53 Z#12	;	safe Z
G53 Y#11  ;returns to the starting point


G91 G31 Y#2 F[#3*3] P#16 L0 Q1  ;move forward
IF #1921!=1 GOTO3  ;Collision

G91 G31 Z#5 F#3 P#16 L0 Q1  ;Scanning height
IF #1922!=1 GOTO3  ;Collision

G91 G31 Y-#2 F#3 P#16 L0 Q1  ;fast scan
IF #1921==1 GOTO1  ;edge not found!
#23=#1926  ;edge found

G53 Y[#23+#15]   ;отскок
G91 G31 Y[#15*-2] F#14 P#16 L0 Q1  ;Scanning
IF #1921==1 GOTO1  ;edge not found!
#23=#1926 ; Edge found

#25=[#22+#23]/2  ;calc center Y
G53 Z#12		;safe Z
G53 Y#25  ;move to center Y

N5 (Center Calculation)

IF #6==0 GOTO6
#[805+#17]=#880  ;clear X G54
N6
IF #7==0 GOTO7
#[806+#17]=#881  ;clear Y G54
N7
;#[807+#17]=#882  ;clear Z G54

#1505=1(Center!)
GOTO10

N1
G53 Z#12	;safe Z
#1505=1(Edge not found!)
GOTO10

N3
G53 Z#12	;safe Z
#1505=1(Collision!)
GOTO10

N10
G53 Z#12	;safe Z
M30  ;end


;G31 X Y Z F P L Q F
;X,Y,Z: direction and max distance of scan
;F: speed of scan
;P: input port number
;L: input type 0=N.O. 1=N.C.
;Q: 0=slow down 1=stop immediately
;K: status
;-> PARAMETER 0076 MUST BE "OPEN" <-










