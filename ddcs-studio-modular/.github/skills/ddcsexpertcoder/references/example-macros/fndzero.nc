M98P501X2     (Home Z - Has Switch)
M98P501X0     (Home X - Has Switch)
M98P501X1     (Home Y - Has Switch, A follows as slave)

(Sync A machine position to match Y)
#883 = #881   (Copy Y machine coordinate to A machine coordinate)

(Mark A-axis as homed - turn home icon green)
#1518 = 1     (Set A-axis homed status)

(MSG, HOMING COMPLETE - A SYNCED TO Y)
M30
