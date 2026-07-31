(MOVE SAFE PARK SPINDLE)

(=== MOTION CONFIGURATION ===)
(Custom parameters for moving to bare park position)
#400 = 1000      (Park move feed rate in mm/min - slower for safety)
#401 = 30        (Park acceleration % - gentler for bare gantry)

(Check if park position is configured)
IF [#470==0]*[#471==0] THEN #1505=-5000(ERROR: Park position not set! Use save_park_position.nc)
IF [#470==0]*[#471==0] GOTO999

(Display park position and confirm)
#1510 = #470
#1511 = #471
#1512 = #400
#1513 = #401
#1505=1(Park at X=%.1f Y=%.1f? Feed=%.0f mm/min, Accel=%.0f%%)
IF #1505==0 GOTO999

(Initialize)
G90 G17 G80 G49 M05 M09

(Safe retract Z first)
G28 Z0

(=== SAVE CURRENT MOTION PARAMETERS ===)
#410 = #2004     (Save current max velocity %)
#411 = #2005     (Save current acceleration %)

(=== SET CUSTOM MOTION FOR PARK ===)
#2004 = 50       (Set max velocity to 50% for park move)
#2005 = [#401]   (Set custom acceleration)

(Calculate delta to park position - FIXED: uses #130-133)
#130 = #880          (Current X machine)
#131 = #881          (Current Y machine)
#132 = #470 - #130   (Delta X to park)
#133 = #471 - #131   (Delta Y to park)

(Move to park with controlled motion)
G91                  (Incremental mode)
G01 F[#400] X[#132] Y[#133]  (Controlled feed rate move to park)
G90                  (Back to absolute)

(=== RESTORE ORIGINAL MOTION PARAMETERS ===)
#2004 = [#410]   (Restore max velocity)
#2005 = [#411]   (Restore acceleration)

(Display success)
#1510 = #880
#1511 = #881
#1505=-5000(Parked at X=%.1f Y=%.1f - Motion parameters restored)

(Normal end)
N999
M30
