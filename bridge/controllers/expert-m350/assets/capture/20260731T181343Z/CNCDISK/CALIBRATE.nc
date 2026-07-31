( Calibrate the setter reference. Run once, right after zeroing G54 Z0 with the surfacing tool. )
( Touches the setter and stores the reference in #2500. Writes no tool offset and no WCS. )

#40 = 0
#41 = 0
#42 = 0
#34 = 0
#36 = 0

#40 = -3          ( safe Z )
#41 = #635        ( setter X )
#42 = #636        ( setter Y )
#32 = -145        ( fast probe travel )
#33 = 3           ( back-off )
#35 = -6          ( re-probe travel )

G90
G53 Z#40          ( lift )
G53 X#41 Y#42     ( move over the setter )

G91
G31 Z#32 F800 P2 L1 K0 Q1    ( fast probe down )
G0 Z#33                       ( back off )
G31 Z#35 F80 P2 L1 K0 Q1      ( slow re-probe )
#34 = #1927                   ( setter touch )

G90
G53 Z#40          ( retract )

#36 = #1430          ( current tool Z offset )
#2500 = [#34 - #36]  ( setter reference )

#1510 = #2500
#1505 = -5000(Setter reference stored = %.3f)
G04 P2.0
M30
