M115          (Execute standard startup homing)

(Wait for all axes to finish homing)
G04 P1.0      (Pause 1 second for homing to complete)

(Sync A machine position to match Y - for dual-axis gantry)
#883 = #881   (Copy Y machine coordinate to A machine coordinate)

(Mark A-axis as homed - turn home icon green)
#1518 = 1     (Set A-axis homed status)

(MSG, STARTUP HOMING COMPLETE - GANTRY SYNCED)
