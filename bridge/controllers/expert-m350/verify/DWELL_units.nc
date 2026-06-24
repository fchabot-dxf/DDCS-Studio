(G04 dwell UNITS probe - motion-free, no axis moves)
(After you press Enter on a popup, COUNT THE SECONDS until the NEXT popup appears.)
(That gap is the dwell time - it tells us whether P means milliseconds or seconds.)
(Expected if the dialect is right: both gaps are about 3 seconds.)
(If TEST 1 instead HANGS for a long time, integer P is SECONDS - press Reset, big finding.)

(TEST 1 - integer P3000)
#1505 = 1(TEST 1 - press Enter then count seconds to the next popup)
G04 P3000

(TEST 2 - decimal P3.0)
#1505 = 1(Gap was integer P3000. Press Enter and count again)
G04 P3.0

#1505 = 1(Gap was decimal P3.0. Done - press Enter)
M30
