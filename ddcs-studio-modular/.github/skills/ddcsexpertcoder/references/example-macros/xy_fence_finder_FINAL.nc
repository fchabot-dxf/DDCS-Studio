(XY Fence Finder - Two-Pass Precision)
(Finds X and Y fence positions for G54 reference)
(DDCS M350 V1.22 - Verified Working)

;=== CONFIGURATION ===
#30=3     ;probe port (adjust for your setup)
#31=0     ;probe polarity (0=NO, 1=NC)
#32=200   ;fast probe speed
#33=20    ;slow probe speed
#35=50    ;max probe distance
#40=#1170 ;probe radius (read from persistent storage)

#1505=1(Ready to find XY fence? ESC=Cancel ENTER=Start)
IF #1505==0 GOTO2

;=== X AXIS - FIND FENCE POSITION ===
#1900=#30   ;X probe port
#1910=#31   ;X probe polarity
#1905=0     ;X stop mode (0=decelerate)
#1915=2     ;X limit protection (2=positive direction)

;Fast approach
G91
G31 X#35 F#32 P#30 L#31 Q0
IF #1920!=2 GOTO1
#101=#1925      ;store fast position
#1920=0         ;clear probe status
G0 X-2          ;retract 2mm
IF #1920==2 GOTO1  ;check if probe triggered during retract

;Slow precise probe
G31 X5 F#33 P#30 L#31 Q0
IF #1920!=2 GOTO1
#101=#1925      ;store precise position
#1920=0         ;clear probe status

;Apply radius compensation (SUBTRACT for outside probing)
#102=#101-#40   ;fence position = trigger - radius
#805=#102       ;set G54 X offset

G0 X-10         ;clear fence
IF #1920==2 GOTO1  ;check if probe triggered during move
#1505=1(X fence found! Continue to Y? ESC=Cancel ENTER=Continue)
IF #1505==0 GOTO2

;=== Y AXIS - FIND FENCE POSITION ===
#1901=#30   ;Y probe port
#1911=#31   ;Y probe polarity
#1906=0     ;Y stop mode (0=decelerate)
#1916=2     ;Y limit protection (2=positive direction)

;Fast approach
G31 Y#35 F#32 P#30 L#31 Q0
IF #1921!=2 GOTO1
#103=#1926      ;store fast position
#1921=0         ;clear probe status
G0 Y-2          ;retract 2mm
IF #1921==2 GOTO1  ;check if probe triggered during retract

;Slow precise probe
G31 Y5 F#33 P#30 L#31 Q0
IF #1921!=2 GOTO1
#103=#1926      ;store precise position
#1921=0         ;clear probe status

;Apply radius compensation (SUBTRACT for outside probing)
#104=#103-#40   ;fence position = trigger - radius
#806=#104       ;set G54 Y offset
#808=#104       ;set A offset (G54) - dual gantry sync

G0 Y-10         ;clear fence
IF #1921==2 GOTO1  ;check if probe triggered during move
#1505=-5000(Fence found! X=[%.3f] Y=[%.3f])
GOTO2

;=== ERROR HANDLER ===
N1
#1505=1(Probe failed - check setup)

;=== END ===
N2
M30
