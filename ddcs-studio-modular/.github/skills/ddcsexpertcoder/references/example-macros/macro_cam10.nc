(Find surface with 3D touch probe)

#1=#2600  ;max stroke Z
#2=#2601  ;Probe length
#3=200  ;fast speed

#14=20	  ;slow speed
#15=1  	  ;отскок
#16=3  ;input port number of the probe (YunKia V6 on IN03)
#17=[#2602-54]*5; Working coordinate system offset

#10=#882  ;current Z machine position
#20=0  ;Z position

//Z Axis.
G91 G31 Z-#1 F#3 P#16 L0 Q1  ;move back
IF #1921==1 GOTO1  ;edge not found!
#20=#1927  ;store position
G53 Z[#20+#15]   ;отскок
G91 G31 Z[-#15*2] F#14 P#16 L0 Q1  ;move back
IF #1922==1 GOTO1  ;edge not found!
#20=#1927
;G53 Z#10  ;returns to the starting point
G53 Z[#20+10]   ;отскок на 10мм

#[807+#17]=#20-#2  ;clear Z G54
#1505=1(Surface found!)
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










