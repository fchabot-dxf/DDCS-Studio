(Set Probe Radius - Persistent Storage)
(Stores probe radius in #1170 for all probe macros)
(DDCS M350 V1.22 - Verified Working)

;=== SET PROBE RADIUS ===
;Adjust this value for your probe diameter
;For a 2mm diameter probe, radius = 1mm
;For a 6mm diameter probe, radius = 3mm
;For a 1/4" (6.35mm) probe, radius = 3.175mm

#1170=1    ;probe radius in mm (CHANGE THIS VALUE)

#1505=-5000(Probe radius set to [%.3f]mm)
M30
