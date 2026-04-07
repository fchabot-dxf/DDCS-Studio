# DDCS Studio Generator Patterns

**Purpose**: Document the G-code patterns produced by each wizard generator  
**Use**: Reference for verifier to understand expected output structures

---

## 1. Corner Wizard (cornerWizard.js)

### 1.1 Purpose
Find workpiece corners by probing two edges (X and Y) with optional Z surface probe.

### 1.2 Corner Types
| Corner | X Direction | Y Direction |
|--------|-------------|-------------|
| FL (Front-Left) | + | + |
| FR (Front-Right) | - | + |
| BL (Back-Left) | + | - |
| BR (Back-Right) | - | - |

### 1.3 Generated Structure

```gcode
( Corner Finder | FL | X+ Y+ + Z Surface | G57 )
( DDCS M350 V10.0 - Pure Incremental Pattern )
( User positioned probe correctly before starting )
( Max probe: 60mm | Retract: 5mm | Travel: 50mm )
( Fast: 200 | Slow: 50 | SafeZ: 10mm | Scan depth: 5mm )

( Motion Variables - #1-#10 for seamless movement )
#1=60 ( Max probe distance )
#2=5 ( Retract after probe )
#3=200 ( Fast speed )
#4=50 ( Slow speed )
#5=3 ( Probe port )

( Pre-calculated motion values - #7-#19 )
#7=[0-#1] ( Negative max probe )
#8=#1     ( Positive max probe )
#9=[0-#2] ( Negative retract )
#10=#2    ( Positive retract )
#11=[0-#2*2] ( Negative double retract )
#12=[#2*2]   ( Positive double retract )
#13=#6      ( Positive clearance )
#14=[0-#6]  ( Negative clearance )
#15=50 ( Positive travel )
#16=[0-50] ( Negative travel )
#17=15 ( Plunge depth )
#18=[0-#17] ( Negative plunge )
#19=10 ( Safe Z )

( Target: G57 )
#70=820 (Base WCS address)

( Confirm Start )
#1505=1 (Press CYCLE START to probe)
M0

G91 ( INCREMENTAL MODE )

( Step 1: Z Surface Probe )
G31 Z#7 F#3 P#5 L0 Q1 ( Fast probe down )
IF #1922!=2 GOTO1
G0 Z#10 ( Retract up )
G31 Z#11 F#4 P#5 L0 Q1 ( Slow probe )
IF #1922!=2 GOTO1
#[#70+2]=#1927 (Save G57 Z offset)
G0 Z#9 ( Retract away from wall )
G0 Z#19 ( Safe Z above surface )

( Step 2: Y Probe )
G0 Z#18 ( Down to scan depth )
G31 Y#8 F#3 P#5 L0 Q1 ( Fast probe )
IF #1921!=2 GOTO1
G0 Y#9 ( Retract )
G31 Y#10 F#4 P#5 L0 Q1 ( Slow probe )
IF #1921!=2 GOTO1
#[#70+1]=#1926 (Save G57 Y offset)
G0 Y#9 ( Retract from wall )
G0 Z#19 ( Safe Z above surface )

( Step 3: Travel to X )
G0 Y#10 ( Clear Y edge by retract )
G0 X#16 ( Move away in X )
G0 Z#18 ( Down to scan depth )

( Step 4: X Probe )
G31 X#8 F#3 P#5 L0 Q1 ( Fast probe )
IF #1920!=2 GOTO1
G0 X#9 ( Retract )
G31 X#10 F#4 P#5 L0 Q1 ( Slow probe )
IF #1920!=2 GOTO1
#[#70+0]=#1925 (Save G57 X offset)
G0 X#9 ( Retract from wall )
G0 Z#19 ( Safe Z above surface )

( Dual Gantry Sync )
G91 ( Incremental mode for sync )
G1 A0 F#3 ( Move A to 0 position )
G90 ( Back to absolute mode )
#808=#883 ( Sync A with Y )

G90 ( Back to absolute )
#1505=-5000 (Corner FL Found!)
GOTO2

N1
#1505=1 (Probe Failed!)
G91 G0 Z10 ( Safe Z )
G90

N2
M30
```

### 1.4 Key Patterns

**Variable direction selection:**
```javascript
const yProbeVar = (yDir === '+') ? '#8' : '#7';
const yRetractVar = (yDir === '+') ? '#9' : '#10';
const xProbeVar = (xDir === '+') ? '#8' : '#7';
const xRetractVar = (xDir === '+') ? '#9' : '#10';
```

**Probe sequence options:**
- YX: Probe Y first, then travel and probe X
- XY: Probe X first, then travel and probe Y

---

## 2. Middle Wizard (middleWizard.js)

### 2.1 Purpose
Find center of pockets (inside) or bosses (outside) by probing both edges.

### 2.2 Feature Types
| Type | Description | Probe Direction |
|------|-------------|-----------------|
| Pocket | Inside feature | Outward from center |
| Boss | Outside feature | Inward toward feature |

### 2.3 Generated Structure

```gcode
( Middle Finder | X Axis | Pocket (Inside) | G54 )
( DDCS M350 V10.0 Compliant )
( First probe: +X, then -X )
( Distance: 20mm | Retract: 2mm | Fast: 200 | Slow: 50 )
( Probe both axes: Yes )

( Motion Variables - #1-#10 for seamless movement )
#1=20      ( Max probe distance )
#2=2       ( Retract distance )
#3=200     ( Fast feed )
#4=50      ( Slow feed )
#5=3       ( Probe port )
#6=2       ( Clearance/jog distance )
( Result storage - #50+ for persistence )
#51=0      ( First edge result )
#52=0      ( Second edge result )
#53=0      ( Center result )

( Pre-calculated motion values - #7-#19 )
#7=[0-#1] ( Negative max probe )
#8=#1     ( Positive max probe )
#9=[0-#2] ( Negative retract )
#10=#2    ( Positive retract )
#11=[0-#2*2] ( Negative double retract )
#12=[#2*2]   ( Positive double retract )
#13=#6      ( Positive clearance )
#14=[0-#6]  ( Negative clearance )

( Target: G54 )
#10=805  ( Base address )

( Confirm Start )
#1505=1(Press CYCLE START to begin)
M0

G91  ( Incremental mode )

( === POCKET: Probe from inside toward walls === )

( Step 1: Probe +X )
G31 X#8 F#3 P#5 L0 Q1  ( Fast )
IF #1920!=2 GOTO1
G0 X#9  ( Retract )
G31 X#10 F#4 P#5 L0 Q1  ( Slow )
IF #1920!=2 GOTO1
#51=1 ( Wash: prime )
#51=#1925  ( Save first edge )
G0 X#9  ( Retract from wall )

( Auto-travel to opposite side )
G0 X#7  ( Move across by max probe distance )
G0 X#14  ( Additional clearance )

( Step 2: Probe -X )
G31 X#7 F#3 P#5 L0 Q1  ( Fast )
IF #1920!=2 GOTO1
G0 X#10  ( Retract )
G31 X#9 F#4 P#5 L0 Q1  ( Slow )
IF #1920!=2 GOTO1
#52=1 ( Wash: prime )
#52=#1925  ( Save second edge )
G0 X#10  ( Retract from wall )

( Calculate Center )
#53=[#51+#52]/2  ( Average of two edges )

( Write to WCS )
#[#10+0]=#53  ( Set G54 X to center )

( Dual Gantry Sync )
#808=#883  ( Sync A with Y machine pos )

G90  ( Back to absolute )
#1505=-5000(Center found at #53!)
GOTO2

N1
#1505=1(Probe failed - no contact!)
G90

N2
M30
```

### 2.4 Key Patterns

**Direction variables for pocket:**
```javascript
const firstProbeVar = (dir1Sign === '+') ? '#8' : '#7';
const firstRetractInv = (dir1Sign === '+') ? '#9' : '#10';
const oppProbeVar = (dir2Sign === '+') ? '#8' : '#7';
const oppRetractInv = (dir2Sign === '+') ? '#9' : '#10';
```

**Center calculation:**
```gcode
#53=[#51+#52]/2  ( Average of two edges )
```

---

## 3. Edge Wizard (edgeWizard.js)

### 3.1 Purpose
Find single edge or both edges with width calculation.

### 3.2 Generated Structure

```gcode
( Edge Finder | X+ | G54 )
( DDCS M350 V10.0 Compliant )
( Distance: 20mm | Retract: 2mm | Fast: 200 | Slow: 50 )

( Motion Variables )
#1=20      ( Max probe distance )
#2=2       ( Retract distance )
#3=200     ( Fast feed )
#4=50      ( Slow feed )
#5=3       ( Probe port )
#6=2       ( Clearance/jog distance )
( Result storage )
#50=0      ( Edge result )
#51=0      ( Opposite edge result )
#54=0      ( Width )

( Pre-calculated motion values - #7-#19 )
#7=[0-#1] ( Negative max probe )
#8=#1     ( Positive max probe )
#9=[0-#2] ( Negative retract )
#10=#2    ( Positive retract )
#11=[0-#2*2] ( Negative double retract )
#12=[#2*2]   ( Positive double retract )
#13=#6      ( Positive clearance )
#14=[0-#6]  ( Negative clearance )

( Target: G54 )
#10=805  ( Base address )

( Confirm Start )
#1505=1(Press CYCLE START to probe X+)
M0

G91  ( Incremental mode )

( Fast Probe )
G31 X#8 F#3 P#5 L0 Q1
IF #1920!=2 GOTO1

( Retract )
G0 X#9

( Slow Probe )
G31 X#12 F#4 P#5 L0 Q1
IF #1920!=2 GOTO1
#50=1 ( Wash: prime )
#50=#1925  ( Save edge position )

( Write to WCS )
#[#10+0]=#50  ( Set G54 X to edge )

( Retract from edge )
G0 X#9

G90  ( Back to absolute )
#1505=-5000(Edge found!)
GOTO2

N1
#1505=1(Probe failed - no contact!)
G90

N2
M30
```

### 3.3 Probe Both Axes Pattern

```gcode
( After first edge found... )

( Auto-travel to opposite edge )
G0 X#7  ( Move across by max probe distance )
G0 X#14  ( Additional clearance )

( Step: Probe opposite edge )
G31 X#7 F#3 P#5 L0 Q1
IF #1920!=2 GOTO1
G0 X#10

( Slow Probe - Opposite )
G31 X#11 F#4 P#5 L0 Q1
IF #1920!=2 GOTO1
#51=1 ( Wash: prime )
#51=#1925  ( Save opposite edge )
G0 X#10  ( Retract from opposite edge )

( Compute width and center )
#54=[#51-#50]  ( OppositeEdge - Edge )
#53=[#50+#51]/2  ( Center between edges )
```

---

## 4. Communication Wizard (communicationWizard.js)

### 4.1 Purpose
Generate UI interaction commands: popups, status messages, input dialogs, beeps, alarms.

### 4.2 Communication Types

| Type | Variable | Purpose |
|------|----------|---------|
| popup | #1505 | Modal dialog with message |
| status | #1503 | Status bar message |
| input | #2070 | Numeric input dialog |
| beep | #2042 | System beep |
| alarm | #3000 | Trigger alarm |
| dwell | G4 P | Pause execution |
| keywait | #2038 | Wait for key press |

### 4.3 Generated Patterns

**Popup Message:**
```gcode
#1510=123.456        ( Data slot 1 )
#1511=100            ( Data slot 2 )
( Popup Message )
#1505=1
(MSG,Your message with [%.3f] and [%.0f])
M0
```

**Status Bar:**
```gcode
( Status Bar Update )
#1503=1
(MSG,Status message here)
```

**Numeric Input:**
```gcode
( Numeric Input - DDCS Safe )
#2070=105(Enter value here...)
#1175=#105 (Copy to persistent)
```

**System Beep:**
```gcode
( System Beep )
#2042=3
```

**Alarm:**
```gcode
( Trigger Alarm )
#3000=1(MSG,Alarm message!)
```

**Dwell:**
```gcode
G4 P5000
```

**Key Wait:**
```gcode
( Key Wait )
#2038=0
M0
```

### 4.4 Data Slots (#1510-#1513)

```gcode
( Up to 4 values can be displayed )
#1510=#value1
#1511=#value2
#1512=#value3
#1513=#value4
#1505=1(Values: [%.3f] [%.1f] [%.0f] [%.0f])
M0
```

---

## 5. WCS Wizard (wcsWizard.js)

### 5.1 Purpose
Zero work coordinate system offsets to current machine position.

### 5.2 WCS Options
| System | Base Address |
|--------|--------------|
| Auto-detect | #578 → calculate |
| G54 | #805 |
| G55 | #810 |
| G56 | #815 |
| G57 | #820 |
| G58 | #825 |
| G59 | #830 |

### 5.3 Generated Patterns

**Auto-detect Active WCS:**
```gcode
( WCS Zeroing - DDCS M350 Compliant )
( Direct #805+ writes - G10 not used )

( Auto-detect active WCS from #578 )
#150=#578
#151=805+[#150-1]*5

( Zero selected axes )
#[#151+0]=#880    ( X )
#[#151+1]=#881    ( Y )
#[#151+2]=#882    ( Z )
#[#151+3]=#883    ( A )
```

**Fixed WCS (G54-G59):**
```gcode
( WCS Zeroing - DDCS M350 Compliant )
( Direct #805+ writes - G10 not used )

( Fixed WCS: G57 - Base address #820 )
( Zero selected axes )
#820=#880    ( X )
#821=#881    ( Y )
#822=#882    ( Z )
```

**Dual Gantry Sync:**
```gcode
( Dual Gantry Sync - Slave A )
#[#151+3]=#883    ( Auto-detect )
( or )
#823=#883         ( Fixed G57 )
```

---

## 6. Common Patterns Across All Generators

### 6.1 Program Header

```gcode
( Operation Name | Parameters | WCS )
( DDCS M350 V10.0 Compliant )
( User instructions or positioning notes )
( Parameter summary: Distance | Speed | etc )
```

### 6.2 Variable Initialization

```gcode
( Motion Variables - #1-#10 for seamless movement )
#1=<dist>      ( Max probe distance )
#2=<retract>   ( Retract distance )
#3=<fast>      ( Fast feed )
#4=<slow>      ( Slow feed )
#5=<port>      ( Probe port )
#6=<clear>     ( Clearance distance )
```

### 6.3 Pre-Calculated Motion Variables

```gcode
( Pre-calculated motion values - #7-#19 )
#7=[0-#1]       ( Negative max probe )
#8=#1           ( Positive max probe )
#9=[0-#2]       ( Negative retract )
#10=#2          ( Positive retract )
#11=[0-#2*2]    ( Negative double retract )
#12=[#2*2]      ( Positive double retract )
#13=#6          ( Positive clearance )
#14=[0-#6]      ( Negative clearance )
```

### 6.4 Confirm Start

```gcode
( Confirm Start )
#1505=1 (Press CYCLE START to begin)
M0
```

### 6.5 Probe with Error Check

```gcode
G31 <axis>#<var> F#3 P#5 L<level> Q<stop>
IF #192<x>!=2 GOTO1
```

### 6.6 Variable Priming (Wash)

```gcode
#50=1 ( Wash: prime )
#50=#1925  ( Now safe to assign system var )
```

### 6.7 Success/Error Footer

```gcode
G90 ( Back to absolute )
#1505=-5000 (Success message!)
GOTO2

N1
#1505=1 (Error message!)
G91 G0 Z10 ( Safe Z )
G90

N2
M30
```

---

## Document Info

**Version**: 1.0  
**Last Updated**: February 2026  
**Based On**: DDCS Studio V9.49 Wizard Generators
