(Find hole center with 3D touch probe)

#1=#2603  ;max movement X
#2=#2604  ;max movement Y
#3=#2605  ;fast speed

#14=20	  ;slow speed
#15=1  	  ;отскок
#16=3  ;input port number of the probe (YunKia V6 on IN03)
#17=[#2607-54]*5; Working coordinate system offset
#18=#2606  ;Double scan Y (for round samples)


#10=#880  ;current X machine position
#11=#881  ;current Y machine position

#20=0  ;left position
#21=0  ;right position
#22=0  ;back position
#23=0  ;front position
#24=0  ;X center
#25=0  ;Y center

//Y Axis. Try 1
G91 G31 Y-#2 F#3 P#16 L0 Q1  ;move back
IF #1921==1 GOTO1  ;edge not found!
#22=#1926  ;store back position
G53 Y[#22+#15]   ;отскок
G91 G31 Y[-#15*2] F#14 P#16 L0 Q1  ;move back
IF #1921==1 GOTO1  ;edge not found!
#22=#1926
G53 Y#11  ;returns to the starting point

G91 G31 Y#2 F#3 P#16 L0 Q1  ;move front
IF #1921==1 GOTO1  ;edge not found!
#23=#1926  ;store front position
G53 Y[#23-#15]   ;отскок
G91 G31 Y[#15*2] F#14 P#16 L0 Q1  ;move back
IF #1921==1 GOTO1  ;edge not found!
#23=#1926
#25=[#22+#23]/2  ;calc center Y
G53 Y#25  ;move to center Y

//X Axis
G91 G31 X-#1 F#3 P#16 L0 Q1  ;move left
IF #1920==1 GOTO1  ;edge not found!
#20=#1925  ;store left position
G53 X[#20+#15]   ;отскок
G91 G31 X[-#15*2] F#14 P#16 L0 Q1  ;move left
IF #1920==1 GOTO1  ;edge not found!
#20=#1925
G53 X#10  ;returns to the starting point

G91 G31 X#1 F#3 P#16 L0 Q1  ;move right
IF #1920==1 GOTO1  ;edge not found!
#21=#1925  ;store right position
G53 X[#21-#15]   ;отскок
G91 G31 X[#15*2] F#14 P#16 L0 Q1  ;move right
IF #1920==1 GOTO1  ;edge not found!
#21=#1925
#24=[#20+#21]/2  ;calc center X
G53 X#24  ;move to center X

//Y Axis. Try 2
IF #18==0 GOTO5		; If no double scan - exit
G91 G31 Y-#2 F#3 P#16 L0 Q1  ;move back
IF #1921==1 GOTO1  ;edge not found!
#22=#1926  ;store back position
G53 Y[#22+#15]   ;отскок
G91 G31 Y[-#15*2] F#14 P#16 L0 Q1  ;move back
IF #1921==1 GOTO1  ;edge not found!
#22=#1926
G53 Y#11  ;returns to the starting point

G91 G31 Y#2 F#3 P#16 L0 Q1  ;move front
IF #1921==1 GOTO1  ;edge not found!
#23=#1926  ;store front position
G53 Y[#23-#15]   ;отскок
G91 G31 Y[#15*2] F#14 P#16 L0 Q1  ;move back
IF #1921==1 GOTO1  ;edge not found!
#23=#1926
#25=[#22+#23]/2  ;calc center Y
G53 Y#25  ;move to center Y

N5

#[805+#17]=#880  ;clear X G54
#[806+#17]=#881  ;clear Y G54
;#[807+#17]=#882  ;clear Z G54
#1505=1(Center!)
GOTO2  ;end

N1
#1505=1(Edge not found!)

N2
M30  ;end



;G31 X Y Z F P L Q F
;X,Y,Z: direction and max distance of scan
;F: speed of scan
;P: input port number
;L: input type 0=N.O. 1=N.C.
;Q: 0=slow down 1=stop immediately
;K: status
;-> PARAMETER 0076 MUST BE "OPEN" <-










