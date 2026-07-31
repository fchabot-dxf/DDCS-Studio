(KEY-4: TOOL CHANGE POSITION)
(2024 Edition - Custom Motion Profile for Bare Positions)

(=== MOTION CONFIGURATION ===)
(Custom parameters for moving to bare tool change position)
#730 = 2000     (Tool change move feed rate in mm/min - moderate speed)
#731 = 40        (Tool change acceleration % - gentle for bare gantry)

(Check if tool change position is configured)
IF [#603==0]*[#604==0] THEN #1505=-5000(ERROR: Tool change position not set! Use save_toolchange_position.nc)
IF [#603==0]*[#604==0] GOTO999

(Optional: Ask for tool number)
#2070=800(Enter new tool number [or ESC to skip]: )

(Display tool change info and confirm)
#1510 = #603
#1511 = #604
#1512 = #730
#1513 = #731
IF #800==0 THEN #1505=1(Move to tool change X=%.1f Y=%.1f? Feed=%.0f mm/min, Accel=%.0f%%)
IF #800!=0 THEN #1514=#800
IF #800!=0 THEN #1505=1(Tool change T%.0f at X=%.1f Y=%.1f? Feed=%.0f mm/min, Accel=%.0f%%)
IF #1505==0 GOTO999

(Initialize)
G90 G17 G80 G49 M05 M09

(Safe retract Z first)
G28 Z0

(=== SAVE CURRENT MOTION PARAMETERS ===)
#740 = #2004     (Save current max velocity %)
#741 = #2005     (Save current acceleration %)

(=== SET CUSTOM MOTION FOR TOOL CHANGE ===)
#2004 = 50       (Set max velocity to 50% for TC move)
#2005 = [#731]   (Set custom acceleration)

(Calculate delta to tool change position)
#500 = #880          (Current X machine)
#501 = #881          (Current Y machine)
#510 = #603 - #500   (Delta X to TC position)
#511 = #604 - #501   (Delta Y to TC position)

(Move to tool change position with controlled motion)
G91                  (Incremental mode)
G01 F[#730] X[#510] Y[#511]  (Controlled feed rate move)
G90                  (Back to absolute)

(=== RESTORE ORIGINAL MOTION PARAMETERS ===)
#2004 = [#740]   (Restore max velocity)
#2005 = [#741]   (Restore acceleration)

(Display position and pause for tool change)
#1510 = #880
#1511 = #881
IF #800==0 THEN #1505=-5000(At tool change position X=%.1f Y=%.1f - Motion restored)
IF #800!=0 THEN #1512=#800
IF #800!=0 THEN #1505=-5000(Ready for T%.0f at X=%.1f Y=%.1f - Motion restored)

(Pause for manual tool change)
M00

(Display completion)
#1505=-5000(Tool change complete - Ready to continue)

(Normal end)
N999
M30
