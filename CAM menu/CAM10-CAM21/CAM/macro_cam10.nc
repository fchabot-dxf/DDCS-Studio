(Find surface with 3D touch probe)
(v1.1)

#1=#2600  ;max stroke Z
#2=#2601  ;Probe length
#3=200    ;fast speed

#14=20    ;slow speed
#15=1     ;отскок
#17=[#2602-54]*5  ;Working coordinate system offset
#18=#2624  ;Z offset (e.g. -1 for stock allowance)

#10=#882  ;current Z machine position
#20=0     ;Z position

#30=#1078  ;input port number of the probe
#31=#1080  ;Floating tool setter effective level

//Z Axis.
G91 G31 Z-#1 F#3 P#30 L#31 Q1  ;move down
IF #1922==0 GOTO1  ;edge not found!
#20=#1927  ;store position
G53 Z[#20+#15]   ;отскок
G91 G31 Z[-#15*2] F#14 P#30 L#31 Q1  ;slow precise scan
IF #1922==0 GOTO1  ;edge not found!
#20=#1927
G53 Z[#20+10]   ;отскок на 10мм

#[807+#17]=#20-#2+#18  ;clear Z G54 with offset
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
