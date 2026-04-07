(SAVE NATIVE SYSTEM FIXED SENSOR POSITION)
(Jog probe over sensor, then run this to save position to System Settings)

(Safety: Prime User Variables to prevent M350 freeze bug)
(We use volatile user vars #100/#101 as buffers)
#100 = 0
#101 = 0

(Action: Save Machine Coordinates to System Parameters Pr135/Pr136)
(NOTE: This updates the internal settings for the Native Fixed Probe button)

(Step 1: Read Machine Coordinates into Buffer)
#100 = #880  (Read Machine X)
#101 = #881  (Read Machine Y)

(Step 2: Write Buffer to System Parameters)
#635 = #100  (Update Pr135 [Fixed Probe X])
#636 = #101  (Update Pr136 [Fixed Probe Y])

(Display confirmation)
#1510 = #635
#1511 = #636
#1505 = -5000(System Sensor Updated: X=%.3f Y=%.3f)

M30