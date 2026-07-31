(Read end-program return mode #730 and safe-Z return #569)
(These decide whether M30 moves the machine at end-of-program.)
(MOTION-FREE until M30 - at the message press Esc to abort before M30.)

(Prime targets to a literal first - prevents persistent-var freeze)
#495 = 1
#496 = 1

(Read the two end-program config vars)
#495 = #730
#496 = #569

(Show them in a popup - read the numbers then press Esc)
#1510 = #495
#1511 = #496
#1505 = -5000(M30 mode 730=%.0f safeZ 569=%.1f press Esc)
G04 P2.0

M30
