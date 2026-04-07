# Fusion 360 Post-Processor Integration for DDCS M350

This document covers integration patterns for Fusion 360 post-processors running on DDCS M350/Expert controllers, focusing on the non-standard variable addressing and WCS offset calculations required.

**Current Post-Processor File**: `Fusion360_DDCS_post-processor.cps` (included in references)
- Based on: Autodesk FANUC generic post (V44207)
- Customized for: DDCS M350 Ultimate Bee 1010
- Features: Victory dance, dynamic WCS parking, manual tool changing
- Last updated: January 2026

## Core Challenge

**Problem**: DDCS M350 uses non-standard WCS offset addresses with stride of 5, not FANUC standard.

**FANUC Standard**: G54 X offset = `#5221`, Y offset = `#5222`, etc.

**DDCS M350 Reality**: G54 X offset = `#805`, Y offset = `#806`, etc. with stride of 5 between coordinate systems.

**Impact**: Standard Fusion post-processors that output G53 or hardcoded positions won't work. We need dynamic WCS-aware positioning.

## WCS Offset Address Calculation

### The Formula

To move to a **machine coordinate** while respecting the active WCS:

```javascript
// Target machine position in work coordinates:
// Work_Coordinate = Machine_Position - WCS_Offset

// In G-code macro math:
"X[#1153 - #[800 + #578 * 5]]"
```

**Breakdown:**
- `#1153` = Target machine X position (stored in persistent variable)
- `#578` = Active WCS index (1=G54, 2=G55, 3=G56, etc.)
- `800` = Base X offset address for G54
- `5` = Stride between coordinate systems
- `#[800 + #578 * 5]` = Indirect addressing - reads the X offset of active WCS

**Result**: Machine position converted to work coordinate in active WCS

### WCS Offset Base Addresses

| Axis | Base (G54) | Formula for Active WCS |
|------|------------|----------------------|
| X | 805 | `#[800 + #578 * 5]` |
| Y | 806 | `#[801 + #578 * 5]` |
| Z | 807 | `#[802 + #578 * 5]` |
| A | 808 | `#[803 + #578 * 5]` |
| B | 809 | `#[804 + #578 * 5]` |

**Why `800 + #578 * 5` instead of `805 + ...`?**
The formula uses base 800 because:
- G54 (index 1): `800 + 1*5 = 805` ✓
- G55 (index 2): `800 + 2*5 = 810` ✓
- G56 (index 3): `800 + 3*5 = 815` ✓

This is the actual addressing used in the tested post-processor.

## Tested Post-Processor Pattern

### File: `fanuc_with_victory_dance_with_ARCS.cps`

Based on Autodesk's generic FANUC post with DDCS M350-specific modifications.

### User-Configurable Properties

```javascript
properties = {
  homePositionEnd: {
    title      : "End of Job Parking",
    description: "Select where the machine parks.",
    type       : "enum",
    values     : [
      {title:"Safe Park", id:"safePark"},
      {title:"Tool Change", id:"tool"},
      {title:"Machine Home (X0 Y0)", id:"home"}
    ],
    value: "safePark"
  },
  
  victoryDance: {
    title      : "Victory Dance Routine",
    description: "Performs a celebratory shimmy at the end of the job.",
    type       : "boolean",
    value      : true
  },
  
  askForDance: {
    title      : "Confirm Dance (M00)",
    description: "Pauses machine before dancing. Press START to dance.",
    type       : "boolean",
    value      : true
  },
  
  useM6: {
    title      : "Output Tool Change (M6)",
    description: "Enable for ATC.",
    type       : "boolean",
    value      : false  // OFF for manual tool changing
  },
  
  useG43: {
    title      : "Output Length Comp (G43)",
    description: "Enable if using Tool Table.",
    type       : "boolean",
    value      : false  // OFF for manual workflow
  }
};
```

### onClose() Function - End of Job Parking

```javascript
function onClose() {
  // Stop coolant and spindle
  onCommand(COMMAND_COOLANT_OFF);
  onCommand(COMMAND_STOP_SPINDLE);

  // --- VICTORY DANCE (optional) ---
  if (getProperty("victoryDance")) {
    writeComment("-----------------------------------");
    writeComment("   JOB COMPLETE - DIAMOND DANCE    ");
    writeComment("-----------------------------------");
    
    writeBlock(gAbsIncModal.format(91));  // Switch to incremental
    
    // Safety lift
    var safeLift = 5;
    writeBlock(gMotionModal.format(0), "Z" + xyzFormat.format(safeLift));

    // Optional pause for confirmation
    if (getProperty("askForDance")) {
      writeComment(" READY TO DIAMOND? (Total Rise: 35mm)");
      writeBlock(mFormat.format(0));  // M0 pause
    }

    // Dance routine (spiral up & out, then in, then down)
    // ... [dance code omitted for brevity] ...
    
    writeBlock(gAbsIncModal.format(90));  // Back to absolute
    gMotionModal.reset();  // Critical: reset modal state
  }

  // --- VERTICAL SAFETY RETRACT ---
  // Move to Machine Z-10 by subtracting active WCS Z offset
  // Formula: -10 - #[Z_offset_of_active_WCS]
  writeBlock(
    gMotionModal.format(0), 
    "Z[-10 - #[802 + #578 * 5]]"
  );

  state.retractedZ = true;
  zOutput.reset();

  // --- HORIZONTAL PARK MOVE ---
  var endPos = getProperty("homePositionEnd");

  if (endPos == "safePark") {
    // Safe Park using User Vars #1153 (X) and #1154 (Y)
    // Formula: [Machine Position] - [Active WCS Offset]
    writeBlock(
      gMotionModal.format(0), 
      "X[#1153 - #[800 + #578 * 5]]",  // Machine X → Work X
      "Y[#1154 - #[801 + #578 * 5]]"   // Machine Y → Work Y
    );
    
  } else if (endPos == "tool") {
    // Tool Change Park using User Vars #1155 (X) and #1156 (Y)
    writeBlock(
      gMotionModal.format(0), 
      "X[#1155 - #[800 + #578 * 5]]", 
      "Y[#1156 - #[801 + #578 * 5]]"
    );
    
  } else if (endPos == "home") {
    // G28 home (standard behavior)
    writeBlock(
      gAbsIncModal.format(91), 
      gFormat.format(28), 
      "X" + xyzFormat.format(0), 
      "Y" + xyzFormat.format(0)
    );
    writeBlock(gAbsIncModal.format(90));
  }

  // Program end
  onCommand(COMMAND_STOP_SPINDLE);
  writeBlock(mFormat.format(30));
}
```

## Key Implementation Details

### 1. Why Not Use G53?

**Problem**: `G53 X500 Y300` with hardcoded values is unreliable on M350

**Solution**: Convert machine coordinates to work coordinates dynamically

```javascript
// Instead of:
writeBlock("G53 X500 Y300");  // UNRELIABLE!

// Do this:
writeBlock(
  "X[#1153 - #[800 + #578 * 5]]",  // Machine → Work coordinate
  "Y[#1154 - #[801 + #578 * 5]]"
);
```

### 2. Persistent Variable Usage

**Storage allocation** (set by user macros):
- `#1153` = Safe park X (machine coordinate)
- `#1154` = Safe park Y (machine coordinate)
- `#1155` = Tool change X (machine coordinate)
- `#1156` = Tool change Y (machine coordinate)

**User workflow:**
1. Jog machine to desired park position
2. Run `SAVE_safe_park_position.nc` or `SAVE_tool_change_position.nc`
3. Positions stored in persistent variables
4. Post-processor references these in generated G-code

### 3. Modal State Management

**Critical after victory dance:**
```javascript
gMotionModal.reset();  // Reset motion modal
```

**Why**: Dance uses incremental mode (G91) and specific feed rates. Must reset state so subsequent moves don't inherit these settings.

### 4. Z-Axis Safety Retract

**Pattern**: Move to machine Z-10 while respecting WCS

```javascript
writeBlock(
  gMotionModal.format(0), 
  "Z[-10 - #[802 + #578 * 5]]"
);
```

**What this does:**
- Target: Machine Z = -10mm
- `#[802 + #578 * 5]` = Active WCS Z offset
- Result: Moves to Z=-10 in machine coordinates, displayed as work coordinate

**Why -10 instead of safe positive height?**
This appears to be for a specific machine setup where Z machine coordinates increase downward (table drops). Adjust for your machine.

## Victory Dance Pattern

### The Diamond Tornado

**Concept**: Celebratory 3D spiral movement after successful job completion

**Features:**
- Two-phase spiral: out & up, then in & up
- Configurable radius, height, turns
- Optional M0 pause for operator confirmation
- Incremental moves (G91) for portability
- Total Z rise: ~35mm (configurable)

**Parameters:**
```javascript
var maxRadius      = 20;   // Widest point (mm)
var phaseHeight    = 15;   // Height of each phase (mm)
var turnsPerPhase  = 4;    // Rotations per phase
var feedRate       = 6000; // Fast non-cutting move
var stepsPerTurn   = 36;   // Smoothness (higher = smoother)
```

**Pattern:**
1. Safety lift (+5mm)
2. Optional M0 pause
3. Phase 1: Spiral OUT and UP (4 turns, 0→20mm radius, 0→15mm Z)
4. Phase 2: Spiral IN and UP (4 turns, 20→0mm radius, 15→30mm Z)
5. Drop straight down to starting Z
6. Return to absolute mode (G90)

**Math:**
```javascript
// Phase 1: Expanding spiral
var fraction = i / stepsPhase;
var angle = fraction * turnsPerPhase * 2 * PI;
var r = fraction * maxRadius;
var x = r * cos(angle);
var y = r * sin(angle);
var z = fraction * phaseHeight;

// Phase 2: Contracting spiral
var r = maxRadius * (1 - fraction);
// ... continue from phase 1 angle & Z height
```

### Why Include Victory Dance?

**Practical benefits:**
1. **Visual confirmation** - Easy to see from across shop that job finished
2. **Prevents accidental restart** - Machine is obviously "done"
3. **Morale boost** - Makes long production runs more enjoyable
4. **Spindle cooldown** - Extra time for spindle to cool before next job

**Optional features:**
- `askForDance: true` - Operator can skip dance (M0 pause with choice)
- `victoryDance: false` - Disable entirely for production environments

## Common Modifications

### 1. Change Park Height

```javascript
// Original: Machine Z = -10
writeBlock("Z[-10 - #[802 + #578 * 5]]");

// Higher clearance: Machine Z = +50
writeBlock("Z[50 - #[802 + #578 * 5]]");

// Use positive if your Z increases upward
```

### 2. Add Additional Park Positions

```javascript
// Add to properties:
values: [
  {title:"Safe Park", id:"safePark"},
  {title:"Tool Change", id:"tool"},
  {title:"Material Load", id:"load"},  // NEW
  {title:"Machine Home", id:"home"}
]

// Add to onClose():
} else if (endPos == "load") {
  // Material Load Park using #1157 (X) and #1158 (Y)
  writeBlock(
    gMotionModal.format(0), 
    "X[#1157 - #[800 + #578 * 5]]", 
    "Y[#1158 - #[801 + #578 * 5]]"
  );
```

### 3. Disable M6/G43 for Manual Tool Changing

**Already configured in tested post:**
```javascript
useM6: {
  value: false  // No tool changer
},
useG43: {
  value: false  // No tool length compensation
}
```

**Impact**: Post-processor will NOT output:
- `M6` (tool change command)
- `G43 H##` (tool length compensation)

### 4. Force Coolant On with Spindle

```javascript
useCoolant: {
  title: "Spindle Water Pump (M8)",
  description: "Forces M8 when spindle starts",
  value: true
}
```

**Behavior**: M8 (pump on) output automatically when spindle starts

## Troubleshooting

### Park Move Goes to Wrong Position

**Symptom**: Machine moves to unexpected location at end of job

**Likely causes:**
1. Variables #1153-#1156 not set (run SAVE macros first)
2. Wrong WCS active (post assumes G54, but G55 is active)
3. Base address typo (800 vs 805)

**Solution**: Verify stored positions with `READ_VAR.nc` macro:
```gcode
#2070 = 100(Enter variable # to read:)
; Enter 1153, check value matches expected machine position
```

### Victory Dance Crashes into Fixture

**Symptom**: Dance movement collides with workholding

**Causes:**
1. Not enough Z clearance before dance starts
2. Dance radius too large for workspace

**Solutions:**
```javascript
// Increase safety lift:
var safeLift = 10;  // Was 5mm

// Reduce dance radius:
var maxRadius = 10;  // Was 20mm
```

### Post-Processor Ignores WCS Changes

**Symptom**: Code outputs positions for wrong WCS

**Cause**: Fusion setup uses multiple WCS, but post references #578 (active at START)

**Limitation**: This dynamic approach only works if the same WCS is active throughout the job. For multi-WCS jobs, you need different logic.

**Workaround**: Generate separate programs for each WCS, or modify post to track WCS changes during job.

### Modal State Issues After Dance

**Symptom**: First move after dance has wrong feed rate or mode

**Cause**: Forgot to reset modal state

**Fix** (already in tested post):
```javascript
gMotionModal.reset();  // Critical after dance
```

## Best Practices

1. **Always test on scrap** - Dynamic coordinate math can be tricky
2. **Verify park positions** - Run SAVE macros before first post-generated job
3. **Use askForDance: true** - Gives operator choice to skip dance
4. **Document your modifications** - Comment your changes in post-processor
5. **Keep base post backed up** - Before modifying, save copy of original
6. **Test all parking options** - Verify safePark, tool, and home all work
7. **Check Z direction** - Machine coordinate systems vary (up vs down)

## Template for Custom Park Position

```javascript
// In properties:
homePositionCustom: {
  title: "Custom Position Name",
  description: "Your description",
  type: "enum",
  values: [
    {title:"Position A", id:"posA"},
    {title:"Position B", id:"posB"}
  ],
  value: "posA"
}

// In onClose():
var customPos = getProperty("homePositionCustom");

if (customPos == "posA") {
  writeBlock(
    gMotionModal.format(0),
    "X[#1157 - #[800 + #578 * 5]]",  // Your variable
    "Y[#1158 - #[801 + #578 * 5]]"
  );
} else if (customPos == "posB") {
  writeBlock(
    gMotionModal.format(0),
    "X[#1159 - #[800 + #578 * 5]]",
    "Y[#1160 - #[801 + #578 * 5]]"
  );
}

// Don't forget to create SAVE macros for #1157-#1160!
```

## Summary

**Key formula**: `X[#stored_machine_pos - #[base_address + #578 * 5]]`

**Why it works**: Converts stored machine coordinate to work coordinate in currently active WCS

**Tested on**: DDCS M350 Expert controller with dual-gantry Ultimate Bee

**Proven features**:
- Dynamic WCS-aware positioning
- Multiple park position options
- Victory dance routine (optional)
- Manual tool change workflow
- No G53 hardcoded constants (avoids M350 bug)

**Current Post-Processor**: The complete working post-processor is included as `Fusion360_DDCS_post-processor.cps` in the same references directory. You can:
- Use it directly in Fusion 360
- Copy it as a starting point for customization
- Reference it for specific implementation details
- Compare your modifications against the working version

This approach is production-tested and handles the M350's non-standard addressing correctly.
