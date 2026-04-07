#1=23 //Length X
#2=35 //Width Y
#3=2 //Depth Z
#4=0 //Center X Pocket
#5=0 //Center Y Pocket
#8=2 //StepDown
#9=2 //Safety Z
#12=0 //Start Z
#13=5 //ToolDiameter
#14=45 //%Overlap Less than 50 to prevent nibbling sides
#15=0 //0 Climb CCW 1 Conventional milling CW
#25=1 //ToolNumber or active tool #1300
#28=50 //FeedZ
#29=100 //FeedXY
#31=5 //CornerRadius
#19=2000 //S Spindle Speed
G[53+#578] ;Save the current coordinate system

;#17 Smallest width of the pocket
;#18 actual Depth of Z
;#20 Amount of steps of overlap
;#30 Current overlap step
;#32=Cuurrent Radius
#16=#13/100*#14 ;OverlapValue
#17=#1 ;Get the smalest value out of the pocket dim
IF #1<=#2 GOTO3 ;when 2 is smaller than 1 set 17 to 2
#17=#2
N3IF #13>#17 GOTO6 ;ToolDiaToBig
IF #31>#17/2 GOTO17
#18=#12 ;StartDepthZ
#20=FIX[[#17-#13]/[#16*2]]
;AmountoffstepsOverlap
#30=#20 ;StepContrl
#21=#4-#1/2+#13/2 ;MinX
#23=#5-#2/2+#13/2 ;MinY
#22=#4+#1/2-#13/2 ;MaxX
#24=#5+#2/2-#13/2 ;MaxY
#32=#31-#13/2 ;radius
G17G90
T#25 ;T1: 5 mm 4 flute endmill 
M3S#19
G0Z#9 ;go to safe Z height
G0X#4Y#5 ;Go to pocket centre

WHILE #18<#3 DO2 ;full depth not reached
G0Z#9 ;go to safe Z height
#18=#18+#8 ;next depth
IF #18<#3 GOTO4
#18=#3
N4G0X#4Y#5 ;go to start position of pocket
G1Z-#18F#28 ;go to next depth
WHILE #30>=0 DO1 ;full overlap not finished
;calculate the inbetween overlap coordinates
#33=#32-#16*#30 ;radius
IF #33>=0 GOTO30
#33=0
N30
IF [#23+#16*#30+#33==0] + [#[21+#15]+#16*#30*[1-#15*2]+#33*[1-#15*2]==0] GOTO51 ;Elimination of unnecessary movements if #31=5, #1=23, #2=35
G01X#[21+#15]+#16*#30*[1-#15*2]+#33*[1-#15*2] Y#24-#16*#30 F#29
G[3-#15]X#[21+#15]+#16*#30*[1-#15*2] Y#24-#16*#30-#33 R#33
G1Y#23+#16*#30+#33
G[3-#15]X#[21+#15]+#16*#30*[1-#15*2]+#33*[1-#15*2] Y#23+#16*#30 R#33
N51
G1X#[22-#15]-#16*#30*[1-#15*2]-#33*[1-#15*2]
G[3-#15]X#[22-#15]-#16*#30*[1-#15*2] Y#23+#16*#30+#33 R#33
G1Y#24-#16*#30-#33
G[3-#15]X#[22-#15]-#16*#30*[1-#15*2]-#33*[1-#15*2] Y#24-#16*#30 R#33
G1X#[21+#15]+#16*#30*[1-#15*2]+#33*[1-#15*2]
#30=#30-1 ;amount off overlap cycle -1
END1
N11#30=#20
;calculate next overlap pass
END2

G0Z#9 ;go to safety height
GOTO12
N6 ;ToolToBig
#1505 = 1 ;ToolDiameterToBig
GOTO12
N17 ;RadiusToBig
#1505 = 1 ;RadiusToBig
N12M730