(G90   ( absolute ))
( @DDCS:1 {"op":"user_surfacing_data","toolNum":"","wcs":"active","originX":0,"originY":0,"stockAttach":"","pathDatum":"","offZ":0,"depth":0.5,"stepdown":0.5,"w":366.924,"h":45.384,"stepover":7.2,"strategy":"parallel","feed":800,"plunge":200,"entry":"ramp","rampAngle":3,"helixDia":0,"helixPitch":1,"defV":1} )
G90   ( absolute )
G0 Z5   ( clearance )
( Step Down z=-0.5 )
( parallel fill z=-0.5 )
G0 X0 Y3.6
G0 Z0
G1 X9.489 Y4.588 Z-0.5 F800   ( ramp )
G1 X0 Y3.6
G1 X366.924 Y3.6
G1 X366.924 Y10.8
G1 X0 Y10.8
G1 X0 Y18
G1 X366.924 Y18
G1 X366.924 Y25.2
G1 X0 Y25.2
G1 X0 Y32.4
G1 X366.924 Y32.4
G1 X366.924 Y39.6
G1 X0 Y39.6
G0 Z5   ( retract )
M5   ( spindle off )
M9   ( coolant off )
#101 = 0   ( safe Z - G53 needs a variable )
G53 Z#101   ( retract )
M30
