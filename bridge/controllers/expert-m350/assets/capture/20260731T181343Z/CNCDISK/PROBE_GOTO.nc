( Tool-setter probe. Jogs over the setter, fast probe then slow re-probe. )
( Uses the stored Fixed Probe X and Y. )

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
#34 = #1927                   ( touch Z )

G90
G53 Z#40          ( retract )

#1510 = #34
#1505 = -5000(Setter touch Z = %.3f)
G04 P2.0
M30
