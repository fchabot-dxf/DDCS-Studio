(SAVE PARK POSITION)
(FIXED - Uses safe variables #470-471)

#470 = #880  (Save current X machine position)
#471 = #881  (Save current Y machine position)

(Display confirmation)
#1510 = #470
#1511 = #471
#1505=-5000(Park position saved: X=%.1f Y=%.1f)

M30
