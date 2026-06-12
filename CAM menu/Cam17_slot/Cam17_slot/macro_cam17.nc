(Slot)

(setup Variables #1170-#1180)
#1=#2670  ;Length X ---- +/- center to center distance
#2=#2671  ;Length Y
#3=#2672  ;Z depth
#4=#2673  ;Z step down
#5=#2674  ;Plunge rate - z axis
#6=#2675  ;Feed mm/min - x/y axis
#7=#2676  ;Spindle RPM
#8=#2677  ;Coolant? 1 On 0 Off
#9=#2678  ;Starting offset X
#10=#2679 ;Starting offset Y



(Working Variables)
#20=[9-#8]	;Coolant M8/M9
#21=0		;Current Z
#22=[#1+#9]	;X end point
#23=[#2+#10]	;Y end point



(Safe start)
G90
G17
G21
G28 G91 Z0
G90
S#7 M3
G17 G90 G94
G0 X#9 Y#10 Z5   ;Go to center
M#20    	 ;Coolant


		;X axis
IF[#1==0]GOTO1 ; jump to Y
N10
IF[#21==#3] GOTO1             ;at final depth jump to finish
#21=[#21-#4]			;z height - cut depth
IF[#21>#3] GOTO20		;dont go below final z
#21=#3
N20
G1 Z#21 F#5	
G1 X#22 F#6			;move to end of slot
G0 Z5
G0 X#9 Y#10 			; back to starting point
GOTO10



		;Y axis
      
N1
IF[#2==0]GOTO2 ; jump to end
#21=0 ;reset z
N30
IF[#21==#3] GOTO2             ;at final depth jump to finish
#21=[#21-#4]			;z height - cut depth
IF[#21>#3] GOTO40		;dont go below final z
#21=#3
N40
G1 Z#21 F#5	
G1 Y#23 F#6			;move to end of slot
G0 Z5
G0 X#9 Y#10 			; back to starting point
GOTO30


N2           		
G0 Z5		;Cleanup
G0 X0 Y0
M9
M5
M30