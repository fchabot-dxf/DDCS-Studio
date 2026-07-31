( Set tool 1 length offset. Run after each manual tool change. )
( Touches the setter and writes only tool 1 Z offset. Does not change any WCS. )

#40 = 0
#41 = 0
#42 = 0
#34 = 0

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

#1430 = [#34 - #2500]   ( tool 1 Z offset from the touch and the stored reference )

#1510 = #1430
#1505 = -5000(Tool 1 Z offset = %.3f)
G04 P2.0
M30
