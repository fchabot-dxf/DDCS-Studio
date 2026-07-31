(V7 - homed-DRO read - confirms the machine-zero origin the sim assumes)
(HOME ALL AXES FIRST with the controller home function, THEN run this macro.)
(Reads machine X/Y/Z DRO. Expected 5 / -5 / -5 per the dump #122-124.)
(Macro itself is motion-free - the homing is your manual step beforehand.)

(Prime)
#100 = 1
#101 = 1
#102 = 1

(Read machine DRO X/Y/Z)
#100 = #880
#101 = #881
#102 = #882

(Report)
#1510 = #100
#1511 = #101
#1505 = -5000(V7 DRO X=%.3f Y=%.3f)
G04 P2.0
#1510 = #102
#1505 = -5000(V7 DRO Z=%.3f)
G04 P2.0

M30
