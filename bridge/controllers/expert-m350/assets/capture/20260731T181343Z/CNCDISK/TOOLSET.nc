( FIXED TOOL-LENGTH SETTER )
( Writes ONLY the current tool Z offset. Never touches G54 / WCS Z. )
( HAND ON ESTOP for the first runs. )
( JOG the tool a few mm ABOVE the setter, then run this. )

IF #1300==0 GOTO90

#30 = 2         ( probe input -> IN02, the port that works )
#31 = 1         ( trigger level )
#32 = -30       ( max probe travel down )
#33 = 8         ( retract after touch )

G91
G31 Z#32 F80 P#30 L#31 K0 Q1     ( probe down slow, stop on touch )
#34 = #1927                       ( machine Z at the touch )
G00 Z#33                          ( retract off the setter )
G90

#[1430 + [#1300 - 1]] = #34       ( write ONLY this tool's Z offset )

#1510 = #34
#1505 = -5000(Tool Z offset written = %.3f)
G04 P2.0
GOTO99

N90
#1505 = -5000(NO TOOL SELECTED - nothing written)
G04 P2.0

N99
M30
