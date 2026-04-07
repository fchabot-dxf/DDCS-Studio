# Work in Progress: Auto-Squaring Macro Development

## Project Goal

Develop a reliable auto-squaring macro for Ultimate Bee 1010 dual Y-axis gantry using DDCS M350 controller.

**Machine**: Ultimate Bee 1010
**Dual Axis**: Y-axis (Y1/Y2 synchronized)
**Sensors**: NPN proximity switches on IN20 (Y1/master) and IN21 (Y2/slave)
**Current Status**: ⚠️ Not working - debugging in progress

---

## Current Issues

### Issue #1: [Describe your main problem]

**Symptom**:
- What happens when you run the macro?
- Error messages displayed?
- Unexpected behavior?

**Expected Behavior**:
- What should happen?

**Code Snippet**:
```gcode
; Paste relevant section of your macro here
```

**Attempted Solutions**:
1. [What you tried]
2. [Result of attempt]
3. [Next thing to try]

---

### Issue #2: [Another problem]

**Symptom**:


**Expected Behavior**:


**Code Snippet**:
```gcode
```

**Attempted Solutions**:
1. 
2. 
3. 

---

## Development Log

### 2025-01-19 - Project Started

**What I did**:
- Uploaded DA_without_relay_advanced.nc for reference
- Added comprehensive documentation
- Created this WIP log

**Current macro version**:
- [Save your current macro version here or note the filename]

**Notes**:
- Using advanced dual-gantry macro as reference
- Need to adapt for Ultimate Bee configuration
- Key differences from reference macro: [list any]

**Next steps**:
1. 
2. 
3. 

---

### [DATE] - [Session Title]

**What I tried**:


**Results**:


**Observations**:


**Next steps**:
1. 
2. 
3. 

---

## Configuration Tracking

### Current Macro Settings

```gcode
// Variable assignments (update as you test)
#91 = 1      ; Master axis (1=Y)
#2  = 1      ; Slave axis
#41 = 20     ; Master sensor port (IN20)
#43 = 21     ; Slave sensor port (IN21)
#62 = 15     ; Free port (IN15)

#31 = 3      ; Max alignment distance
#106 = 3     ; Homing cycles
#108 = 800   ; Y fast speed
#118 = 80    ; Slow speed

// Add other settings being tested
```

### Controller Parameters

```gcode
// External parameters that affect homing
#236 = ?     ; Y-axis homing offset
#549 = ?     ; Y-axis homing enabled
#488-#492    ; Axis combination settings

// Record current values
```

---

## Test Results

### Test #1 - [Date/Description]

**Configuration**:
```gcode
; Settings used for this test
```

**Procedure**:
1. 
2. 
3. 

**Results**:
- ✅ What worked
- ❌ What failed
- ⚠️ Unexpected behavior

**Data Collected**:
```
; Sensor positions found
; Error values
; Machine coordinates
```

**Conclusions**:


---

### Test #2 - [Date/Description]

**Configuration**:
```gcode
```

**Procedure**:


**Results**:


**Conclusions**:


---

## Known Working Elements

### What Works ✅

1. **[Feature that works]**
   - Description
   - Code snippet
   ```gcode
   ```

2. **[Another working feature]**


---

## Known Problem Areas

### What Doesn't Work ❌

1. **[Specific issue]**
   - Why it fails
   - What happens instead
   - Theories on cause

2. **[Another issue]**


---

## Reference Comparisons

### Advanced Macro vs My Macro

**Advanced macro does this:**
```gcode
; Code from DA_without_relay_advanced.nc
```

**My macro does this:**
```gcode
; My version
```

**Differences noted**:
- 
- 

**Why different**:
- 

---

## Questions & Hypotheses

### Current Questions

1. **[Question about behavior]**
   - Observations that led to question
   - Possible explanations
   - How to test

2. **[Another question]**


### Hypotheses to Test

1. **Hypothesis**: [Your theory about what's wrong]
   - **Test**: How to verify
   - **Expected result if correct**:
   - **Expected result if wrong**:

2. **Hypothesis**: 


---

## Code Snippets to Try

### Snippet #1: [Purpose]

```gcode
; Code to test
```

**Source**: [Where this came from - advanced macro, community patterns, etc.]
**Why trying**: 
**Expected outcome**:

---

### Snippet #2: [Purpose]

```gcode
```

---

## Variable Monitoring

### Key Variables to Watch

During testing, monitor these variables:

```gcode
#880    ; Y machine position
#881    ; Y work position
#790    ; Y work coordinate
#882    ; Z position (for safety)

#1920   ; X probe hit flag
#1921   ; Y probe hit flag
#1925   ; X machine position when probe hit
#1926   ; Y machine position when probe hit

#2112   ; Last Y-axis homing error

// Add others being monitored
```

### Diagnostic Display Macro

```gcode
O9999 (Display Key Variables)

#1510 = #880
#1511 = #881
#1512 = #882
#1503 = 1(Positions: #880[%.3f] #881[%.3f] #882[%.3f])
G04 P2000

#1510 = #1920
#1511 = #1921
#1503 = 1(Probe flags: X[%.0f] Y[%.0f])
G04 P2000

#1510 = #1925
#1511 = #1926
#1503 = 1(Probe coords: X[%.3f] Y[%.3f])

M30
```

---

## Sensor Testing

### Individual Sensor Tests

**Master Sensor (IN20) Test:**
```gcode
O9001 (Test Master Sensor IN20)

; Manual jog to sensor
G4P-1
;Jog Y1 to trigger IN20, press START

; Check sensor status
#1510 = #1520    ; IN20 status
#1503 = 1(IN20 Status: %.0f)

; 0 = not triggered, 1 = triggered

M30
```

**Slave Sensor (IN21) Test:**
```gcode
O9002 (Test Slave Sensor IN21)

G4P-1
;Jog Y2 to trigger IN21, press START

#1510 = #1521    ; IN21 status
#1503 = 1(IN21 Status: %.0f)

M30
```

### G31 Probe Tests

**Test G31 on Master:**
```gcode
O9003 (G31 Test - Master)

; Start ~10mm from sensor
G91 G31 Y-50 F100 P20 L0 Q1

#1510 = #1921    ; Y hit flag
#1511 = #1926    ; Y position when hit
#1503 = 1(Hit: %.0f | Pos: %.3f)

M30
```

**Test G31 on Slave:**
```gcode
O9004 (G31 Test - Slave)

G91 G31 Y-50 F100 P21 L0 Q1

#1510 = #1921
#1511 = #1926
#1503 = 1(Hit: %.0f | Pos: %.3f)

M30
```

---

## Axis Combination Testing

### Verify Dual-Axis Setup

**Check which motors move:**
```gcode
O9005 (Test Axis Combination)

; Record starting position
#1510 = #880
#1503 = 1(Start Y: %.3f)
G04 P2000

; Move Y-axis
G91 G01 Y10 F200
G04 P1000

; Check end position
#1510 = #880
#1503 = 1(End Y: %.3f)
G04 P2000

; Both Y1 and Y2 should have moved together
; Measure actual movement on each side

M30
```

### Check Axis Combination Variables

```gcode
; Display combination settings
#1510 = #488
#1511 = #489
#1512 = #490
#1503 = 1(Combo: #488[%.0f] #489[%.0f] #490[%.0f])
```

---

## Safety Checks Before Each Test

### Pre-Test Checklist

- [ ] Gantry manually squared (visually)
- [ ] Both sensors verified working (manual trigger test)
- [ ] Soft limits disabled or set appropriately
- [ ] Machine homed on other axes (X, Z)
- [ ] Spindle OFF
- [ ] Work area clear
- [ ] Emergency stop accessible
- [ ] Variable monitoring macro ready
- [ ] Current macro version saved/backed up

### Post-Test Recording

After each test, record:
- [ ] Final gantry position (Y1 and Y2 physical measurement)
- [ ] Error messages (copy exactly)
- [ ] Last variable values (#880, #881, #2112, etc.)
- [ ] Sensor trigger behavior (which triggered when)
- [ ] Any unusual sounds or vibrations
- [ ] Controller display messages

---

## Useful Commands

### Emergency Recovery

```gcode
; If gantry gets badly racked during testing

; 1. STOP program
M05        ; Stop spindle
#655 = 0   ; Disable soft limits

; 2. Manually jog Y1 and Y2 independently
; Access via controller menu if available
; OR disconnect one motor temporarily

; 3. Square gantry manually before retrying
```

### Reset Statistics

```gcode
; Clear error statistics before testing
#2802 = 0    ; Y cumulative error
#2810 = 0    ; Y counter
#2112 = 0    ; Last Y error
```

---

## Resources

### Reference Documents in Skill

- `dual-gantry-advanced.md` - Advanced macro documentation
- `example-macros/macro_DA_without_relay_advanced.nc` - Full 348-line reference
- `example-macros/Double_Y_double_zero_switch.nc` - Basic reference
- `community-patterns.md` - Dual-gantry patterns
- `hardware-config.md` - Your machine sensor configuration

### External Resources

- DDCS M350 Manual (Chinese/Russian)
- [Add any forum posts or videos you're using]

---

## Breakthrough Moments 🎉

### [DATE] - [What worked!]

**Discovery**:


**Why it matters**:


**Code that works**:
```gcode
```

**Next to try based on this**:


---

## Dead Ends 🚫

### Things That Definitely Don't Work

1. **[Approach that failed]**
   - Why I tried it:
   - Why it doesn't work:
   - Don't waste time trying again unless: [condition]

2. **[Another dead end]**


---

## Success Criteria

### Definition of "Working"

The macro will be considered working when:

- [ ] Both sensors trigger correctly during approach
- [ ] Gantry squares to within 0.05mm consistently
- [ ] No crashes or unexpected movements
- [ ] Repeatable over 5+ test runs
- [ ] Error statistics show <0.03mm average
- [ ] Safe at all speeds and starting positions
- [ ] Integrates with controller homing menu

### Acceptance Tests

1. **Badly racked start** (5mm out of square)
   - Should square successfully
   - No gantry damage
   - Final error <0.05mm

2. **Well-squared start** (<1mm out)
   - Should maintain or improve squaring
   - Fast completion (<30 seconds)

3. **Multiple cycles** (10 consecutive runs)
   - Consistent results
   - No drift or accumulation

4. **Power cycle recovery**
   - Works after controller restart
   - Doesn't require manual intervention

---

## Notes & Observations

### General Observations

[Use this space for thoughts, patterns noticed, things to investigate]


### Ideas to Explore

- [ ] [Idea #1]
- [ ] [Idea #2]
- [ ] [Idea #3]

---

## Contact & Collaboration

If you figure something out or need help:
- Claude can help analyze the logs and suggest solutions
- Community forums: [add links if you find helpful ones]
- This log format: Keep updating it as you test!

---

**Last Updated**: 2025-01-19
**Current Status**: Initial setup, testing phase
**Next Session Goal**: [What you'll try next]
