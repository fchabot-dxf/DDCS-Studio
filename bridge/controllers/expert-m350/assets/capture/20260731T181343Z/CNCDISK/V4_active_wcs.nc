(V4 - Is active-WCS variable #578 writable - can software switch WCS)
(MOTION-FREE body: only writes/reads #578. No axis moves in the test.)
(Saves #578 first and restores it - you end back on your original WCS.)
(Read results in the user-var viewer:)
(#495 = original WCS number  #496 = #578 after writing 2  #497 = after restore)
(#498 = #730 end-program return mode  #499 = #569 safe-Z return height)
(IMPORTANT: at the final message press Esc - NOT Enter - to abort before M30)
(so the M30 end-of-program return cannot move the machine.)

(Prime all targets to a literal first - prevents persistent-var freeze)
#495 = 1
#496 = 1
#497 = 1
#498 = 1
#499 = 1

(SAVE original active WCS number)
#495 = #578

(Attempt to switch WCS by writing the variable)
#578 = 2
#496 = #578

(RESTORE original active WCS before anything else)
#578 = #495
#497 = #578

(Grab end-program config so we know if M30 itself moves)
#498 = #730
#499 = #569

(Report - the message popups PAUSE. Read values then press Esc to abort.)
#1510 = #495
#1511 = #496
#1505 = -5000(V4 orig=%.0f after write2=%.0f)
G04 P2.0
#1510 = #497
#1505 = -5000(V4 restored=%.0f press Esc now)
G04 P2.0

M30
