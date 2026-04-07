(KEY-7: SPINDLE WARMUP - 60 SECOND)
(2024 Edition - FIXED: Safe variable addresses)

(=== CONFIGURATION ===)
#140 = 6000      (Step 1: Low speed RPM)
#141 = 12000     (Step 2: Working speed RPM)
#142 = 30        (30 seconds at each speed)

(Single confirmation)
#1505=1(Warm up spindle?)
IF #1505==0 GOTO999

(Initialize - stop spindle if running)
M05 M09

(=== 60-SECOND WARMUP ===)
#1510 = #140
#1505=-5000(Starting at %.0f RPM...)

M03 S[#140]      (Start at 6,000 RPM)
G04 P[#142]      (Run for 30 seconds)

(Ramp to working speed - no stop)
#1510 = #141
#1505=-5000(Ramping to %.0f RPM...)

M03 S[#141]      (Increase to 12,000 RPM)
G04 P[#142]      (Run for 30 seconds)

(Stop)
M05

(Complete)
#1505=-5000(Warmup complete - Spindle ready!)

(Normal end)
N999
M30
