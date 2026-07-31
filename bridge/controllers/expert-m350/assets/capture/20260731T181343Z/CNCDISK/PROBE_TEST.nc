( SIMPLE Z TOOL-SETTER PROBE TEST -- HAND ON ESTOP )
( Jog the tool a few mm ABOVE the setter first. )
( Should STOP the instant it touches. Drives through? ESTOP. )
( Then change #31 from 1 to 0 and retry. )
#30 = 2
#31 = 1
#32 = -25
G91
G31 Z#32 F80 P#30 L#31 K0 Q1
G00 Z5
G90
M30
