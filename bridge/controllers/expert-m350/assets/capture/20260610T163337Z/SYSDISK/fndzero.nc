M98P501X2     (Home Z - Has Switch)
M98P501X0     (Home X - Has Switch)
M98P501X1     (Home Y - Has Switch, A follows as slave)
M98P501X4     (Home B - Has Switch, rotary axis)

(Sync A machine position to match Y - gantry slave)
#883 = #881   (Copy Y machine coordinate to A machine coordinate)

(Mark A and B axes as homed - turn home icons green)
#1518 = 1     (Set A-axis homed status)
#1519 = 1     (Set B-axis homed status)

(MSG, HOMING COMPLETE - A SYNCED TO Y, B HOMED)
M30
