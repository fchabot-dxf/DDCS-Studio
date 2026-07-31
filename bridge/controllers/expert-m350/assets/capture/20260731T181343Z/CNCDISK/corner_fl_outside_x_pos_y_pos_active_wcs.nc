(Corner | FL OUTSIDE | X pos Y pos | Active WCS)
( @DDCS:1 {"op":"user_corner_data","dist":500,"retract":5,"f_fast":200,"f_slow":50,"port":3,"radius":2,"travelDist":50,"safeZ":10,"scanDepth":5,"clearMode":"hop","hopDist":15,"planeZ":10,"cross1_x":-31.591,"cross1_y":14.706,"probeZFirst":false,"travelApproach":"auto","travelShape":"dogleg","wcs":"active","syncA":false,"corner":"FL","probeSeq":"YX","defV":1} )
( Corner | FL OUTSIDE | X pos Y pos | Active WCS )
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
#23=-31.591 ( Wall 1 to Wall 2 traverse X )
#24=14.706 ( Wall 1 to Wall 2 traverse Y )
( Read Active WCS )
#71=#578 ( Active WCS index: 1=G54 2=G55 etc )
#72=[#71-1] ( Zero-based index )
#70=[805+[#72*5]] ( Base WCS address )
( Confirm Start )
#1505=1 ( Hover OUTSIDE the FL corner material. Press Enter )
G91   ( incremental )
( Step 1: Y Probe )
G31 Y#8 F#3 P#5 L0 Q1
IF #1921!=2 GOTO1
G0 Y#9
G31 Y#8 F#4 P#5 L0 Q1
IF #1921!=2 GOTO1
#101=[#1926+#6] ( Trigger Pos + Radius )
#73=[#70+1] ( WCS Y Address )
#[#73]=#101 ( Save to Active WCS Y )
G0 Y#9
#95=#882 ( @saveProbeZ )
( Clearance hop - capped at the machine margin )
#43=[#95+15]
#42=#520
IF #42<0 GOTO91
#42=-5 ( safe-Z margin - baked fallback; controller #520 wins if set )
N91
IF #43<#42 GOTO92
#43=#42 ( cap the hop at the safe machine margin )
N92
G90   ( absolute )
G53 Z#43
G91   ( incremental )
( Step 2: REPOSITION: Traverse past corner and set up for X )
G0 X#23
G0 Y#24
G90   ( absolute )
G53 Z#95 ( @returnProbeZ )
G91   ( incremental )
( Step 3: X Probe )
G31 X#8 F#3 P#5 L0 Q1
IF #1920!=2 GOTO1
G0 X#9
G31 X#8 F#4 P#5 L0 Q1
IF #1920!=2 GOTO1
#102=[#1925+#6] ( Trigger Pos + Radius )
#[#70]=#102 ( Save to Active WCS X )
G0 X#9
#95=#882 ( @saveProbeZ )
( Safe-Z retract - machine frame )
#42=#520
IF #42<0 GOTO93
#42=-5 ( safe-Z margin - baked fallback; controller #520 wins if set )
N93
G90   ( absolute )
G53 Z#42
G91   ( incremental )
G90   ( absolute )
#1505=-5000 ( Corner FL found )
GOTO2
( === ERROR HANDLER === )
N1
( Safe-Z retract - machine frame )
#42=#520
IF #42<0 GOTO94
#42=-5 ( safe-Z margin - baked fallback; controller #520 wins if set )
N94
G90   ( absolute )
G53 Z#42
#1505=1 ( ERROR: Probe failed to trigger )
N2
M30
