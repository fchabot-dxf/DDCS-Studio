(----------Locate Workpiece Corner Center With 3D Touch Probe----------)

(Operator Entered Variables)
  ;#2616: Workpiece corner
  ;#2617: X Traverse distance
  ;#2618: Y Traverse distance
  ;#2619: Z depth
  ;#2620: Traverse speed
  ;#2621: Coordinate system
  ;#2622: Probe ball diameter
  
(Set Machine Probing Cycle Initial Variables)
#10=#880  ;Starting X axis position
#11=#881  ;Starting Y axis position
#12=#882  ;Starting Z axis position
#13=[#2621-54]*5  ;Coordinate system offset parameter pointer 
#14=0  ;X Calculated corner center location
#15=0  ;Y Calculated corner center location
#16=0  ;Completed number of scans
#17=0  ;Located positions sum

(Define Traverse And Scanning Distances And Directions)
IF #2616!=1 GOTO1 ;Selected workpiece corner is not upper left
#25=1  ;Upper left: X scanning to be positive (Corner 1)
#26=-1  ;Upper left: Y scanning to be negative (Corner 1)
GOTO4
N1
IF #2616!=2 GOTO2 ;Selected workpiece corner is not upper right
#25=-1  ;Upper right: X scanning to be negative (Corner 2)
#26=-1  ;Upper right: Y scanning to be negative (Corner 2)
GOTO4
N2
IF #2616!=3 GOTO3 ;Selected Workpiece Corner Is Not Lower Left
#25=1  ;Lower left: X scanning to be positive (Corner 3)
#26=1  ;Lower left: Y Scanning to be positive (Corner 3)
GOTO4
N3
IF #2616!=4 GOTO11 ;Selected Workpiece Corner Is Not Lower Right
#25=-1  ;Lower Right: X scanning to be negative (Corner 4)
#26=1  ;Lower Right: Y scanning to be positive (Corner 4)
GOTO4

(X Axis Probing)
N4
G#2621  ;Set coordinate system entered value
IF #2617==0 GOTO7 ;If X traverse distance equals zero, go to Y scanning
#1503 = 1(Traverse X distance to clear workpiece)
G91 G31 X[#2617*#25*-1] F#2620 P#1078 L#1080 Q1  ;X traverse opposite direction of scanning at traverse speed, if probe turns on, stop immediately
IF #1920>2 GOTO12  ;End of travel limit switch reached
IF #1920==2 GOTO13  ;Collision 

#1503 = 1(Lower probe to Z scanning depth)
G91 G31 Z#2619 F#632 P#1078 L#1080 Q1  ;Z Lower to scanning depth, if probe turns on, stop immediately
IF #1922==2 GOTO13  ;Collision

#1503 = 1(Scan toward X edge)
G91 G31 X[#2617*#25] F#632 P#1078 L#1080 Q1  ;X traverse direction of scanning toward workpiece, if probe turns on, stop immediately
IF #1920>2 GOTO12  ;End of travel limit switch reached
IF #1920==0 GOTO14  ;Edge not found 

N5
#1503 = 1(Scan slowly away from X edge)
G91 G31 X-[#2617*#25] F10 P#1078 L[1-#1080] Q1  ;X Traverse opposite direction of scanning away from workpiece, when probe turns off, stop immediately
#17=#1925+#17  ;Add X axis machine tool coordinates after G31 detection trigger to previous value for averaging
#16=#16+1  ;Increment completed number of scans
IF #16==#631 GOTO6  ;Compare number of scans with machine setting
#1503 = 1(Scan slowly toward X edge)
G91 G31 X[#2617*#25] F10 P#1078 L#1080 Q1  ;X traverse direction of scanning toward workpiece, if probe turns on, stop immediately
IF #1920>2 GOTO12  ;End of travel limit switch reached
IF #1920==0 GOTO14  ;Edge not found 
GOTO5

N6
#1503 = 1(Move probe away from workpiece)
G91 G1 X-[5*#25] F#632  ;X Traverse away from edge 5mm
#1503 = 1(Return Z axis to starting point)
G53 Z#12  ;Return Z axis to Starting Point
#1503 = 1(Return X axis to starting point)
G53 X#10  ;Return X axis to starting point
#14=[[#17/#16]+[[#2622*#25]/2]] ;Calculated X corner center = average X axis edge position + probe diameter * direction divided by 2

(Y Axis Probing)
N7
#16=0  ;Zero completed number of scans
#17=0  ;Zero located positions for averaging
G#2621  ;Set coordinate system entered value
IF #2618==0 GOTO15 ;If Y Traverse Distance Equals Zero, End Program
#1503 = 1(Traverse Y distance to clear workpiece)
G91 G31 Y[#2618*#26*-1] F#2620 P#1078 L#1080 Q1  ;Y traverse opposite direction of scanning at traverse speed, if probe turns on, stop immediately
IF #1921>2 GOTO12  ;End of travel limit switch reached
IF #1921==2 GOTO13  ;Collision 

#1503 = 1(Lower probe to Z scanning depth)
G91 G31 Z#2619 F#632 P#1078 L#1080 Q1  ;Z Lower to scanning depth, if probe turns on, stop immediately
IF #1922==2 GOTO13  ;Collision

#1503 = 1(Scan toward Y edge)
G91 G31 Y[#2618*#26] F#632 P#1078 L#1080 Q1  ;Y traverse direction of scanning toward workpiece, if probe turns on, stop immediately
IF #1921>2 GOTO12  ;End of travel limit switch reached
IF #1921==0 GOTO14  ;Edge not found 

N8
#1503 = 1(Scan slowly away from Y edge)
G91 G31 Y-[#2618*#26] F10 P#1078 L[1-#1080] Q1  ;Y Traverse opposite direction of scanning away from workpiece, when probe turns off, stop immediately
#17=#1926+#17  ;Add Y axis machine tool coordinates after G31 detection trigger to previous value for averaging
#16=#16+1  ;Increment completed number of scans
IF #16==#631 GOTO9  ;Compare number of scans with machine setting
#1503 = 1(Scan slowly toward Y edge)
G91 G31 Y[#2618*#26] F10 P#1078 L#1080 Q1  ;Y traverse direction of scanning toward workpiece, if probe turns on, stop immediately
IF #1921>2 GOTO12  ;End of travel limit switch reached
IF #1921==0 GOTO14  ;Edge not found 
GOTO8

N9
#1503 = 1(Move probe away from workpiece)
G91 G1 Y-[5*#26] F#632 ;Y Traverse Away From Edge 5mm 
#1503 = 1(Return Z axis to starting point)
G53 Z#12  ;Return Z Axis To Starting Point
#15=[[#17/#16]+[[#2622*#26]/2]] ;Calculated Y corner center= average X axis edge position + probe diameter * direction divided by 2
#1503 = 1(Move to corner center)
G53 X#14 Y#15 ;Move to center

N10
IF #2617==0 GOTO11 ;If X Traverse Distance Equals Zero, Do Not Zero X Axis
#[805+#13]=#880  ;Set Coordinate System X Zero Offset To X Machine Position

N11 
IF #2618==0 GOTO15 ;If Y Traverse Distance Equals Zero, End Program
#[806+#13]=#881  ;Set Coordinate System Y Zero Offset To Y Machine Position
GOTO15

N12
G53 Z#12 ;Move Z to starting position
#1505=1(End of travel limit switch reached!)
GOTO15

N13
G53 Z#12 ;Move Z to starting position
#1505=1(Collision!)
GOTO15

N14
G53 Z#12 ;Move Z to starting position
#1505=1(Edge not found!)

N15
G53 Z#12 ;Move Z to starting position
M30 ;Program end

(System Macro Address Fuctional Descriptions)
  ;#631: Number of times to probe
  ;#632: Initial speed of probing
  ;#800: Machine coordinate X position
  ;#801: Machine coordinate Y position
  ;#802: Machine coordinate Z position
  ;#805: G54 coordinate system X zero offset
  ;#806: G54 coordinate system Y zero offset
  ;#1078: Floating probe input channel
  ;#1080: Floating probe input effective level
  ;#1920: G31 X-axis detection result 0: No detection 1: Detection initialization 2: Signal detected 3: Negative limit touched 4: Positive limit touched 
  ;#1921: G31 Y-axis detection result 0: No detection 1: Detection initialization 2: Signal detected 3: Negative limit touched 4: Positive limit touched
  ;#1922: G31 Z-axis detection result 0: No detection 1: Detection initialization 2: Signal detected 3: Negative limit touched 4: Positive limit touched
  ;#1925: X-axis machine tool coordinates after G31 detection trigger
  ;#1926: Y-axis machine tool coordinates after G31 detection trigger
  ;#1927: Z-axis machine tool coordinates after G31 detection trigger

(G31 Probe Move Variable Table: Note That Macro Scan Switch Parameter #76 Must Be Set To 1 - "Open")
  ;G31 X Y Z F P L Q F
  ;X,Y,Z: Direction and max distance of scan
  ;F: Speed of scan
  ;P: Input port number
  ;L: Input type (0=N.O. 1=N.C.)
  ;Q: Upon detection: 0=slow down 1=stop immediately
  ;K: Status