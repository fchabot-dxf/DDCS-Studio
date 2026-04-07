#20=1 //Beginning X coordinate
#1=324.5 //Final X coordinate
#21=0 //Beginning Y coordinate
#2=-265 //Final Y coordinate
#3=1 //Number of complete cycles (X snake, Y snake)
#4=0.1 //Removal per full cycle, mm (X snake, Y snake)
#5=15 //Milling step in X and Y, mm
#6=4000 //Milling speed
#7=2000 //Drilling speed Z
#8=24000 //Spindle speed
#9=2 //Safe height in Z-axis
#30=3.5 //Spindle unwind/stop pause, in seconds
#14=5 //Axis number for displaying remaining cycles. Only 5 and 4 can be set

;;Memorize SoftLimit state and turn them off.
#22=#655
#655=0

;;Remove the minuses from the settings.
#3=ABS[#3]
#3=ROUND[#3]
#4=ABS[#4]
#5=ABS[#5]
#9=ABS[#9]
IF [#14==5]+[#14==4] GOTO10 ;;If the coordinate display axis is incorrect, change to the 5th axis.
#14=5
N10

#30=#30*1000 ;;Convert seconds to milliseconds.

;;Calculate the X step
#10=#5
IF #1>0 GOTO1
#10=#10*-1
N1

;;Calculate the Y step
#11=#5
IF #2>0 GOTO2
#11=#11*-1
N2


;;Move the cutter so that it touches the table surface. Use the manual axis movement buttons and a piece of paper.

;
G4P-1
G1
;Move Z to table
;and press START
#1577=#882 ;;Memorize machine coordinates of table surface

#807 = #882-#[1430+[#1300-1]] ;;Zero the Z axis on the current table surface. So you can see where it was before milling.

G53 Z#1577+#9 ;;Z-axis to safe height
;;Check if the axes can move to these coordinates.
G53 X#20Y#21 
G53 X#1
G53 Y#2
G53 X#20
G53 Y#21

#[879+#14]=#3 ;;Show the number of cycles remaining in coordinates of the 5th or 4th axis.

M3 S#8 ;;Start spindle
G4P#30 ;;Spindle spin-up pause

N40
#1577=#1577-[#4/2] ;;Reduce the Z coordinate by half a step.
G53 Z#1577 F#7 ;;Drill.

;;Milling with a snake. Shift along the Y axis.
#12=#21 ;;Transfer the initial Y coordinates to a temporary variable.
WHILE ABS[#12+#11]<=ABS[#2] DO1
G53 Y#12 F#6 
G53 X#1 F#6
#12=#12+#11
G53 Y#12 F#6 
G53 X#20 F#6
#12=#12+#11
END1

IF ABS[#12-#11]==ABS[#2] GOTO22 ;;If the last step matched the Y dimension
IF ABS[#12]<ABS[#2] GOTO21 ;;If a shortened pass is to be performed.
;;Make a half-pass (right only)
G53 Y#2 F#6 
G53 X#1 F#6
G53 Y#21 F#6
G53 X#20
G53 Y#2 F#6
GOTO20 
N21
;;Perform a shortened pass
G53 Y#12 F#6 
G53 X#1 F#6
G53 Y#2 F#6 
G53 X#20 F#6
N22
G53 Y#21 F#6
G53 X#1
G53 Y#2 F#6
N20

#[879+#14]=#3-0.5 ;;Shows the number of cycles remaining in the 5th or 4th axis coordinates.

G53 Z#1577+#9 ;;Z to safe height
G53 X#20Y#21 ;;XY to start point
#1577=#1577-[#4/2] ;;Reduce the Z coordinate by half a step.
G53 Z#1577 F#7 ;;Drill in.

#13=#20 ;;Transfer the initial X coordinates to a temporary variable.
WHILE ABS[#13+#10]<=ABS[#1] DO2
G53 X#13 F#6 
G53 Y#2 F#6
#13=#13+#10
G53 X#13 F#6
G53 Y#21 F#6
#13=#13+#10
END2

;;Serpentine milling. Shift along the Y axis.
IF ABS[#13-#10]==ABS[#1] GOTO32 ;;If the last step coincides with the X dimension.
IF ABS[#13]<ABS[#1] GOTO31 ;;If you need to make a shortened pass.
;;Make a half-pass (upward only)
G53 X#1 F#6 
G53 Y#2 F#6
G53 X#20 F#6
G53 Y#21
G53 X#1 F#6
GOTO30 
N31
;;Perform a shortened pass
G53 X#13 F#6 
G53 Y#2 F#6
G53 X#1 F#6 
G53 Y#21 F#6
N32
G53 X#20 F#6
G53 Y#2
G53 X#1 F#6
N30

G53 Z#1577+#9 ;;Z to safe height
G53 X#20Y#21 ;;XY to start point

#3=#3-1 ;;Reduce the number of cycles
#[879+#14]=#3 ;;Show the number of cycles remaining in the 5th or 4th axis coordinates.
IF #3!=0 GOTO40 ;;If we need to make more passes, go to the beginning of the program.
M5 ;;Stop spindle
G4P#30 ;;Pause to stop the spindle
G53 Z#1577 ;;Move the cutter to the table to make it easier to repeat the program if more material needs to be removed.
#655=#22 ;;Return the SoftLimit state. 
;;Do NOT write M30 at the end. Because this command is glitchy. There are problems.
;;If you have removed little material, just run the program again. The cutter is already touching the new surface.

