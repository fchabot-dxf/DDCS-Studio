(SAVE TOOL CHANGE POSITION)
(FIXED - Uses safe variables #472-473)

#472 = #880  (Save current X machine position)
#473 = #881  (Save current Y machine position)

(Display confirmation)
#1510 = #472
#1511 = #473
#1505=-5000(Tool change position saved: X=%.1f Y=%.1f)

M30
