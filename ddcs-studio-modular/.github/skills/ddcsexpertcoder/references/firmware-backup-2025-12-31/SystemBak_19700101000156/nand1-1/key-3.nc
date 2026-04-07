(MOVE TOOL CHANGE POSITION)

(=== MOTION CONFIGURATION ===)
(Custom parameters for moving to bare tool change position)
#420 = 2000      (Tool change move feed rate in mm/min - moderate speed)
#421 = 40        (Tool change acceleration % - gentle for bare gantry)

(Check if tool change position is configured)
IF [#472==0]*[#473==0] THEN #1505=-5000(ERROR: Tool change position not set! Use save_toolchange_position.nc)
IF [#472==0]*[#473==0] GOTO999

(Display tool change info and confirm)
#1510 = #472
#1511 = #473
#1512 = #420
#1513 = #421
#1505=1(Move to tool change X=%.1f Y=%.1f? Feed=%.0f mm/min, Accel=%.0f%%)
IF #1505==0 GOTO999

(Initialize)
G90 G17 G80 G49 M05 M09

(Safe retract Z first)
G28 Z0

(=== SAVE CURRENT MOTION PARAMETERS ===)
#430 = #2004     (Save current max velocity %)
#431 = #2005     (Save current acceleration %)

(=== SET CUSTOM MOTION FOR TOOL CHANGE ===)
#2004 = 50       (Set max velocity to 50% for TC move)
#2005 = [#421]   (Set custom acceleration)

(Calculate delta to tool change position - FIXED: uses #134-137)
#134 = #880          (Current X machine)
#135 = #881          (Current Y machine)
#136 = #472 - #134   (Delta X to TC position)
#137 = #473 - #135   (Delta Y to TC position)

(Move to tool change position with controlled motion)
G91                  (Incremental mode)
G01 F[#420] X[#136] Y[#137]  (Controlled feed rate move)
G90                  (Back to absolute)

(=== RESTORE ORIGINAL MOTION PARAMETERS ===)
#2004 = [#430]   (Restore max velocity)
#2005 = [#431]   (Restore acceleration)

(Display position and pause for tool change)
#1510 = #880
#1511 = #881
#1505=-5000(At tool change position X=%.1f Y=%.1f - Change bit manually)

(Pause for manual tool change)
M00

(Display completion)
#1505=-5000(Tool change complete - Ready to continue)

(Normal end)
N999
M30
