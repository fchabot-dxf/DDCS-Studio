(Pocket Y Middle Finder - Two-Pass Precision)
(Finds Y center of a pocket using inside probing)
(DDCS M350 V1.22 - Corrected Logic)

;=== CONFIGURATION ===
#30=3     ;probe port (adjust for your setup)
#31=0     ;probe polarity (0=NO, 1=NC)
#32=200   ;fast probe speed
#33=20    ;slow probe speed
#35=50    ;max probe distance
#40=#1170 ;probe radius (read from persistent storage)
#13=10    ;clearance move (positive, mm)
#14=-10   ;clearance move (negative, mm)
#9=-2     ;retract after probe (mm)
#10=2     ;slow re-approach distance (mm)

#1505=1(Ready to find pocket Y center? ESC=Cancel ENTER=Start)
IF #1505==0 GOTO2

;=== STEP 1: PROBE +Y WALL ===
G91
G31 Y#35 F#32 P#30 L#31 Q0
IF #1921!=2 GOTO1
#51=#1926      ;store +Y wall position (absolute)
#1921=0        ;clear probe status
G0 Y#9         ;retract 2mm
G31 Y#10 F#33 P#30 L#31 Q0
IF #1921!=2 GOTO1
#51=#1926      ;store precise +Y wall position
#1921=0        ;clear probe status
G0 Y#9         ;retract 2mm

;=== STEP 2: REPOSITION FOR -Y PROBE ===
G0 Y#14        ;move past start point toward -Y wall (use negative clearance)

;=== STEP 3: PROBE -Y WALL ===
G31 Y-#35 F#32 P#30 L#31 Q0
IF #1921!=2 GOTO1
#52=#1926      ;store -Y wall position (absolute)
#1921=0        ;clear probe status
G0 Y#9         ;retract 2mm
G31 Y-#10 F#33 P#30 L#31 Q0
IF #1921!=2 GOTO1
#52=#1926      ;store precise -Y wall position
#1921=0        ;clear probe status
G0 Y#9         ;retract 2mm

;=== CALCULATE CENTER ===
#53=[#51+#52]/2
#1505=-5000(Center found at #53!)

;=== END ===
GOTO2

;=== ERROR HANDLER ===
N1
#1505=1(Probe failed - check setup)

;=== END ===
N2
M30
