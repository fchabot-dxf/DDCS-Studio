(Corner | FR OUTSIDE | X neg Y pos | G54)
( @DDCS:1 {"op":"user_corner_data","dist":500,"retract":5,"f_fast":200,"f_slow":50,"port":3,"radius":2,"travelDist":50,"safeZ":10,"scanDepth":5,"cross1_x":44.78,"cross1_y":16.905,"probeZFirst":false,"travelApproach":"auto","travelShape":"dogleg","wcs":"G54","syncA":true,"corner":"FR","probeSeq":"YX","defV":1} )
( Corner | FR OUTSIDE | X neg Y pos | G54 )
( Probe dist: 500mm | Retract: 5mm )
( Fast: 200 | Slow: 50 | SafeZ: 10mm | ScanDepth: 5mm )
( === CONFIGURATION === )
#1=500 ( Max probe distance )
#2=5 ( Retract distance )
#3=200 ( Fast feedrate )
#4=50 ( Slow feedrate )
#5=3 ( Probe port )
#6=2 ( Probe stylus radius )
( === CALCULATED MOTIONS === )
#7=[0-#1] ( Negative max probe )
#8=#1 ( Positive max probe )
#9=[0-#2] ( Negative retract )
#10=#2 ( Positive retract )
#15=50 ( Positive travel = travelDist )
#16=[0-#15] ( Negative travel )
#19=10 ( Safe Z retract distance )
#20=5 ( Scan depth )
#17=[#19+#20] ( Plunge depth = safeZ + scanDepth )
#18=[0-#17] ( Negative plunge )
#23=44.78 ( Wall 1 to Wall 2 traverse X )
#24=16.905 ( Wall 1 to Wall 2 traverse Y )
( Target: G54 )
#70=805 ( Base WCS address )
( Confirm Start )
#1505=1 ( Hover OUTSIDE the FR corner material. Press Enter )
G91   ( incremental )
( Step 1: Y Probe )
G31 Y#8 F#3 P#5 L0 Q1
IF #1921!=2 GOTO1
G0 Y#9
G31 Y#8 F#4 P#5 L0 Q1
IF #1921!=2 GOTO1
#101=[#1926+#6] ( Trigger Pos + Radius )
#73=[#70+1] ( WCS Y Address )
#[#73]=#101 ( Save to G54 Y )
G0 Y#9
G0 Z#19
( Step 2: REPOSITION: Traverse past corner and set up for X )
G0 X#23
G0 Y#24
G0 Z[0-#19]
( Step 3: X Probe )
G31 X#7 F#3 P#5 L0 Q1
IF #1920!=2 GOTO1
G0 X#10
G31 X#7 F#4 P#5 L0 Q1
IF #1920!=2 GOTO1
#102=[#1925-#6] ( Trigger Pos - Radius )
#[#70]=#102 ( Save to G54 X )
G0 X#10
G0 Z#19
( Dual Gantry Sync )
#74=[#70+3] ( Base WCS + Slave Offset )
#[#74]=#883 ( Sync A offset with Y )
G90   ( absolute )
#1505=-5000 ( Corner FR found )
GOTO2
( === ERROR HANDLER === )
N1
G91   ( incremental )
G0 Z#17
G90   ( absolute )
#1505=1 ( ERROR: Probe failed to trigger )
N2
M30
