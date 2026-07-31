(V5 - soft-limit sentinels - READ ONLY, no motion)
(Reads the macro-space copies of the soft-limit params via the +500 rule:)
(enable = setting #155 -> macro #655 ; values #161-168 -> #661-668.)
(Question: is enable 0 or 1, and are the disabled axes the +/-9999 sentinels.)

(Prime all slots to a literal first)
#491 = 1
#492 = 1
#493 = 1
#494 = 1

(Read soft-limit enable and three sentinel candidates)
#491 = #655
#492 = #661
#493 = #663
#494 = #668

(Report - two popups, press Enter through each)
#1510 = #491
#1511 = #492
#1505 = -5000(V5 enable655=%.0f negX661=%.1f)
G04 P2.0
#1510 = #493
#1511 = #494
#1505 = -5000(V5 negZ663=%.1f posZ668=%.1f)
G04 P2.0

M30
