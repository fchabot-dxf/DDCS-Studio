(Front Left Corner Finder - 2mm Probe)
(Automatic positioning with 50mm probe distances)
(DDCS M350 V1.22 - Verified Working)

;=== CONFIGURATION ===
#30=3     ;probe port (adjust for your setup)
#31=0     ;probe polarity (0=NO, 1=NC)
#32=200   ;fast probe speed
#33=20    ;slow probe speed
#35=50    ;max probe distance
#40=#1170 ;probe radius (read from persistent storage)

#1505=1(Ready to probe corner? ESC=Cancel ENTER=Start)
IF #1505==0 GOTO2

;=== Z AXIS - FIND TOP SURFACE ===
#1902=#30   ;Z probe port
#1912=#31   ;Z probe polarity
#1907=0     ;Z stop mode (0=decelerate)
#1917=1     ;Z limit protection (1=negative)

G91 G31 Z-#35 F#32 P#30 L#31 Q0
IF #1922!=2 GOTO1
#100=#1927
#1922=0        ;clear probe status before retract
G0 Z2
G31 Z-5 F#33 P#30 L#31 Q0
IF #1922!=2 GOTO1
#100=#1927
#1922=0        ;clear probe status
#807=#100
G0 Z10
IF #1922==2 GOTO1  ;check if probe triggered during move
#1505=1(Z found! Continue to X probe? ESC=Cancel ENTER=Continue)
IF #1505==0 GOTO2

;Position for X probe
G0 X-50    ;move left of edge
IF #1920==2 GOTO1  ;check if probe triggered during move
G0 Z-15    ;lower to 5mm below surface (from Z10 retract)
IF #1922==2 GOTO1  ;check if probe triggered during move

;=== X AXIS - FIND LEFT EDGE ===
#1900=#30   ;X probe port
#1910=#31   ;X probe polarity
#1905=0     ;X stop mode
#1915=2     ;X limit protection (2=positive)

G31 X#35 F#32 P#30 L#31 Q0
IF #1920!=2 GOTO1
#101=#1925
#1920=0        ;clear probe status
G0 X-2     ;retract away from edge
G31 X5 F#33 P#30 L#31 Q0
IF #1920!=2 GOTO1
#101=#1925
#1920=0        ;clear probe status
#102=#101+#40  ;apply probe radius compensation (ADD for inside corner)
#805=#102
G0 X-10    ;clear edge
IF #1920==2 GOTO1  ;check if probe triggered during move
#1505=1(X found! Continue to Y probe? ESC=Cancel ENTER=Continue)
IF #1505==0 GOTO2

;Position for Y probe
G0 Y-50    ;move in front of edge FIRST (avoid crash)
IF #1921==2 GOTO1  ;check if probe triggered during move
G0 X25     ;move further into workpiece area for Y probe
IF #1920==2 GOTO1  ;check if probe triggered during move

;=== Y AXIS - FIND FRONT EDGE ===
#1901=#30   ;Y probe port
#1911=#31   ;Y probe polarity
#1906=0     ;Y stop mode
#1916=2     ;Y limit protection (2=positive)

G31 Y#35 F#32 P#30 L#31 Q0
IF #1921!=2 GOTO1
#103=#1926
#1921=0        ;clear probe status
G0 Y-2     ;retract away from edge
G31 Y5 F#33 P#30 L#31 Q0
IF #1921!=2 GOTO1
#103=#1926
#1921=0        ;clear probe status
#104=#103+#40  ;apply probe radius compensation (ADD for inside corner)
#806=#104      ;set Y offset (G54)
#808=#104      ;set A offset (G54) - dual gantry sync
G0 Y-10    ;clear edge
IF #1921==2 GOTO1  ;check if probe triggered during move
#1505=-5000(Y found)

;=== MOVE TO CORNER ===
G90        ;switch to absolute mode
G54
G0 Z10     ;safe height
G0 X0 Y0   ;move to corner
#1505=-5000(Corner set at X0 Y0 Z0!)
GOTO2

;=== ERROR HANDLER ===
N1
#1505=1(Probe failed - check setup)

;=== END ===
N2
M30
