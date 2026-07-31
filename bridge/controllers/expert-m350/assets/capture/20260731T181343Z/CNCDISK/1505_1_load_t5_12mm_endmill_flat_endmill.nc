(#1505=1 Load T5 - 12mm endmill flat endmill)
#1505=1(Load T5 - 12mm endmill flat endmill)
IF #1505==0 GOTO2
( @DDCS:1 {"op":"user_surfacing_data","toolNum":5,"wcs":"active","originX":0,"originY":0,"stockAttach":"","pathDatum":"","offZ":0,"depth":0.5,"stepdown":1.2,"w":371.431,"h":54.758,"stepover":7.2,"strategy":"parallel","feed":2000,"plunge":750,"entry":"ramp","rampAngle":3,"helixDia":0,"helixPitch":1,"defV":1} )
G90   ( absolute )
M3 S12000   ( spindle on )
G04 P3000   ( spin-up dwell )
G0 Z5   ( clearance )
( Step Down z=-0.5 )
( parallel fill z=-0.5 )
G0 X0 Y3.6
G0 Z0.7
G1 X22.712 Y6.508 Z-0.5 F2000   ( ramp )
G1 X0 Y3.6
G1 X371.431 Y3.6
G1 X371.431 Y10.8
G1 X0 Y10.8
G1 X0 Y18
G1 X371.431 Y18
G1 X371.431 Y25.2
G1 X0 Y25.2
G1 X0 Y32.4
G1 X371.431 Y32.4
G1 X371.431 Y39.6
G1 X0 Y39.6
G1 X0 Y46.8
G1 X371.431 Y46.8
G1 X371.431 Y54
G1 X0 Y54
G0 Z5   ( retract )
M5   ( spindle off )
M9   ( coolant off )
#101 = 0   ( safe Z - G53 needs a variable )
G53 Z#101   ( retract )
M30
