(Startup homing per axis, then gantry sync)
M98P501X2     (Home Z, has switch)
M98P501X0     (Home X, has switch)
M98P501X1     (Home Y, has switch, A follows as slave)

(Sync A machine position to match Y)
#883 = #881   (Copy Y machine coordinate to A)
#1518 = 1     (Mark A homed)

(Zero B in place, no homing move)
#884 = 0      (Set B machine position to 0)
#1519 = 1     (Mark B homed)

M30
