(V6 - tool-length H01 register write - macro #900 = H01 via the +500 rule)
(NON-DESTRUCTIVE: saves H01, writes 12.5, you check the H/Tool table UI, then)
(Enter restores the original. No motion. Confirms whether #900 IS the H01 offset.)

(Prime)
#101 = 1
#102 = 1

(Save original H01, then write a test value)
#101 = #900
#900 = 12.5
#102 = #900

(Report - while this popup is up, open the H/Tool table and check H01 reads 12.5)
#1510 = #102
#1511 = #101
#1505 = -5000(V6 H01 now=%.3f was=%.3f check H table)
G04 P2.0

(Restore original H01)
#900 = #101

M30
