# Virtual Button Control via #2037 - Quick Reference

**Purpose**: Programmatic control of controller interface buttons through macro variable #2037

**Complete Reference**: `Virtual_button_function_codes_COMPLETE.xlsx` (201 KeyValue codes)

---

## Quick Start

### Basic Formula

```gcode
#2037 = 65536 + (KeyValue - 1000)
```

**Where**:
- `65536` = Press (2^16)
- `KeyValue` = From tables below
- `1000` = Offset to subtract

**Example**:
```gcode
; Press ENTER (KeyValue 1013)
#2037 = 65536 + [1013 - 1000]   ; = 65536 + 13 = 65549
```

---

## Most Common Keys (Quick Reference)

| KeyValue | Function | #2037 Value | Usage |
|----------|----------|-------------|-------|
| 1013 | **Enter** | 65549 | Confirm/Execute |
| 1027 | **Esc** | 65563 | Cancel/Exit |
| 1328 | **Start** | 65864 | Start program |
| 1329 | **Pause** | 65865 | Pause program |
| 1327 | **Reset** | 65863 | Controller reset |
| 1331 | **Spindle** | 65867 | Toggle spindle |
| 1320 | **Clear** | 65856 | Clear/Reset screen |

---

## Key Categories

### 1. Navigation (16 keys)
- Monitor (1373), Program (1374), Param (1375)
- IO (1376), System Log (1377), System Info (1378)
- Probe (1323), Work Zero (1321), Home (1322)
- Coord Set (1387), Local/U Disk (1389/1390)
- Break (1363), Manual (1326), MDI (1348)

### 2. Functional Actions (12 keys)
- Backspace (1008), Enter (1013), Esc (1027)
- Arrow keys: Left (1016), Up (1017), Right (1018), Down (1019)
- Shift (1025), Spindle (1331), Reset (1327)
- Start (1328), Pause (1329)

### 3. Manual Jogging (18 keys)
- X+/X- (1307/1308), Y+/Y- (1309/1310), Z+/Z- (1311/1312)
- A+/A- (1313/1314), B+/B- (1315/1316), C+/C- (1317/1318)
- Step increments: 0.001 to 100mm (1332-1341)

### 4. Feed/Speed Control (16 keys)
- Feed override: 0%-120% (1352-1362)
- Spindle override: 50%-120% (1342-1351)

### 5. Spindle Control (9 keys)
- Direction: CW/CCW (1298/1299), Stop (1300)
- Speed presets: 6000-24000 RPM (1301-1306)

### 6. Program Control (10 keys)
- Open/Close file (1380/1381)
- Edit/Delete file (1382/1383)
- Play/Stop (1328/1363)
- Single step/Break (1364/1363)

### 7. Advanced Functions (20+ keys)
- Work offsets: G54-G59 (1391-1396)
- Tool offsets (1397-1406)
- Coordinate display modes (1407-1409)
- Unit toggle (1410)

---

## Complete Tables

**For complete 201-code reference**, see:
- `Virtual_button_function_codes_COMPLETE.xlsx`
- Includes all navigation, jogging, feed/speed, spindle, program control, and advanced functions

---

## Usage Examples

### Example 1: Auto-Start Program
```gcode
O1000 (Auto-Start Demo)
; Load file via UI first, then run this
#2037 = 65536 + [1328 - 1000]   ; Press START
M30
```

### Example 2: Navigate to Probe Screen
```gcode
O2000 (Go to Probe Screen)
#2037 = 65536 + [1323 - 1000]   ; Press PROBE button
G4 P1   ; Wait 1 second for screen load
M30
```

### Example 3: Set Feed Override to 80%
```gcode
O3000 (Set 80% Feed Rate)
#2037 = 65536 + [1356 - 1000]   ; 80% feed override
M30
```

### Example 4: Spindle Speed Preset
```gcode
O4000 (Set Spindle 18000 RPM)
#2037 = 65536 + [1305 - 1000]   ; 18000 RPM preset
M30
```

---

## Calculation Helper

**To calculate #2037 value for any KeyValue**:

```
Step 1: Find KeyValue in tables (e.g., 1013 for ENTER)
Step 2: Subtract 1000: 1013 - 1000 = 13
Step 3: Add 65536: 65536 + 13 = 65549
Step 4: Use in code: #2037 = 65549
```

**Or use formula directly**:
```gcode
#2037 = 65536 + [KeyValue - 1000]
```

---

## Important Notes

### Timing Considerations
- Add `G4 P1` (1 second delay) after virtual button press
- Allows controller to process screen changes
- Critical for navigation sequences

### Press vs Release
- **Press**: Bit 16 = 1 (multiply by 65536)
- **Release**: Bit 16 = 0 (rarely needed)
- Most operations only need Press

### Controller State
- Virtual buttons work in any mode (Auto/Manual/MDI)
- Some buttons only work in specific screens
- Test button availability before automating

---

## Key Value Quick Lookup

**Navigation** (Screen switching):
- Monitor: 1373
- Program: 1374
- Probe: 1323
- IO: 1376
- Manual: 1326
- MDI: 1348

**Control** (Operation):
- Start: 1328
- Pause: 1329
- Reset: 1327
- Spindle: 1331
- Enter: 1013
- Esc: 1027

**Jogging** (Manual movement):
- X+: 1307, X-: 1308
- Y+: 1309, Y-: 1310
- Z+: 1311, Z-: 1312

**Feed Override** (Speed control):
- 50%: 1352
- 80%: 1356
- 100%: 1358
- 120%: 1362

**Spindle Presets** (RPM):
- 6000: 1301
- 12000: 1303
- 18000: 1305
- 24000: 1306

---

## Common Use Cases

### Automated Testing
```gcode
; Navigate to IO screen and check inputs
#2037 = 65536 + [1376 - 1000]   ; IO screen
G4 P1
; Check inputs via visual inspection
```

### Feed Rate Adjustment
```gcode
; Reduce feed to 50% for precision pass
#2037 = 65536 + [1352 - 1000]   ; 50% feed
G1 X100 F500   ; Execute precise move
; Restore 100% feed
#2037 = 65536 + [1358 - 1000]   ; 100% feed
```

### Spindle Control
```gcode
; Set spindle to 18000 RPM and start
#2037 = 65536 + [1305 - 1000]   ; 18000 RPM preset
G4 P1
#2037 = 65536 + [1331 - 1000]   ; Spindle ON
G4 P3   ; Wait 3 seconds for spindle
```

---

## Advanced: Work Coordinate Selection

**G54-G59 via Virtual Buttons**:
```gcode
; Switch to G55 work coordinate
#2037 = 65536 + [1392 - 1000]   ; G55 button
G4 P0.5
; Now operating in G55 coordinate system
```

---

## Troubleshooting

**Button doesn't work**:
- Check if in correct screen/mode
- Verify KeyValue is correct from table
- Add delay after press (G4 P1)
- Check controller state (not in alarm)

**Screen doesn't change**:
- Navigation buttons require screen transition time
- Use G4 P1 minimum delay
- Some screens only accessible from specific modes

**Spindle doesn't respond**:
- Check if already running
- Verify VFD communication
- Use Spindle toggle (1331) instead of presets

---

## Related Documentation

- `Virtual_button_function_codes_COMPLETE.xlsx` - Complete 201-code table
- `Virtual_button_function__2037_.pdf` - Official specification
- `k-button-assignments.md` - Physical K-button programming
- `software-technical-spec.md` - Macro programming reference

---

## Document Status

**Type**: Quick reference + navigation hub  
**Authority**: [CONFIRMED] Official documentation  
**KeyValue Count**: 201 codes available  
**Last Updated**: January 2026

**For complete table with all 201 codes**, see `Virtual_button_function_codes_COMPLETE.xlsx`
