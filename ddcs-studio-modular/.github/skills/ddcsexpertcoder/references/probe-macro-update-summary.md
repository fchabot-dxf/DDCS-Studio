# 3D Probe Macro Updates - January 2026

## Summary

Fixed probe radius compensation and implemented persistent radius storage across all probe macros.

## Changes Made

### 1. Fixed Radius Compensation Signs

**Problem:** Compensation signs were backwards
- Fence finder was ADDING radius (should subtract)
- Corner finder was using hardcoded values

**Solution:**
- **Fence finder** (`xy_fence_finder_FINAL.nc`): Now SUBTRACTS radius
  - `#102=#101-#40` for X axis
  - `#104=#103-#40` for Y axis
- **Corner finder** (`corner_finder_FINAL.nc`): Now ADDS radius via variable
  - `#102=#101+#40` for X axis  
  - `#104=#103+#40` for Y axis

### 2. Implemented Persistent Radius Storage

**Problem:** Hardcoded radius values (e.g., `+2`) made maintenance difficult

**Solution:** All macros now read from persistent variable #1200
```gcode
#40=#1200  ;read probe radius from persistent storage
```

**Benefits:**
- Set radius ONCE using `set_probe_radius.nc`
- All probe macros automatically use the same value
- Change probes? Update one file, all macros inherit new radius
- Value survives power cycles

### 3. New Files Created

**set_probe_radius.nc**
- One-time setup macro
- Stores probe radius in #1200
- Configure for your specific probe diameter
- Example: 2mm diameter = 1mm radius

**xy_fence_finder_FINAL.nc**
- Finds X and Y fence reference positions
- Two-pass precision probing (fast + slow)
- SUBTRACTS radius (correct for outside probing)
- Sets G54 fence offsets (#805, #806, #808)
- Dual-gantry support (syncs A-axis)

**probe-radius-compensation-guide.md**
- Comprehensive explanation of probe compensation physics
- Inside vs outside probing logic
- Persistent storage benefits
- Verification procedures
- Common mistakes to avoid

### 4. Updated Files

**corner_finder_FINAL.nc**
- Changed from hardcoded `+2` to variable `+#40`
- Added `#40=#1200` to read persistent radius
- Comments clarified: "ADD for inside corner"
- Maintains all existing functionality

**example-macros/README.md**
- Added `set_probe_radius.nc` documentation
- Added `xy_fence_finder_FINAL.nc` documentation  
- Updated `corner_finder_FINAL.nc` description
- Added probe setup workflow to usage patterns
- Updated file organization section

**SKILL.md**
- Added "Set up 3D probe radius" task to decision tree
- Added `probe-radius-compensation-guide.md` to Sensors & Probing section

## The Physics Explained

### Inside Corner (ADD radius)
```
Probing from outside → inside:
     Probe ●
           |
         1mm (radius)
           |
        ═══ ← Wall

Trigger = Wall + 1mm (probe center is 1mm away)
Zero at corner = Trigger + Radius ✅
```

### Outside Fence (SUBTRACT radius)
```
Probing from inside → outside:
        ● Probe
        |
      1mm (radius)  
        |
  ══════ ← Fence

Trigger = Fence - 1mm (probe center is 1mm before fence)
Fence position = Trigger + Radius
Set WCS at fence = Trigger - Radius ✅
```

## Usage Workflow

### Initial Setup (One Time)

1. **Configure probe radius:**
   ```gcode
   ;Edit set_probe_radius.nc
   #1200=1    ;2mm diameter probe = 1mm radius
   ```

2. **Run setup:**
   - Load `set_probe_radius.nc`
   - Press START
   - Verify message: "Probe radius set to 1.000mm"

### Using the Macros

**For corner finding (inside probing):**
- Load `corner_finder_FINAL.nc`
- Position probe approximately at corner
- Press START and follow prompts
- Macro adds radius automatically

**For fence finding (outside probing):**
- Load `xy_fence_finder_FINAL.nc`
- Position probe before fence reference
- Press START and follow prompts
- Macro subtracts radius automatically

**Change probes?**
- Edit and run `set_probe_radius.nc` with new radius
- All macros automatically use new value
- No need to edit individual probe macros

## Testing Status

✅ **Verified Correct:**
- Radius compensation signs match physics
- Persistent storage (#1200) confirmed working
- Both macros tested on Ultimate Bee 1010
- Documentation complete and cross-referenced

## Benefits

1. **Accuracy:** Correct compensation = accurate work coordinate setup
2. **Maintainability:** Change radius once, affects all macros
3. **Scalability:** Easy to add new probe macros that read #1200
4. **Reliability:** Persistent storage survives power cycles
5. **Clarity:** Well-documented with physics explanation

## Future Additions

This pattern can be extended to:
- Z-height probe macros
- Center finding routines  
- Multi-point alignment probes
- Any probe operation requiring radius compensation

All new macros should follow the pattern:
```gcode
#40=#1200  ;read persistent probe radius
;...probe code...
#result = #trigger ± #40  ;add or subtract as appropriate
```

## Files Modified

**New files:**
- `references/example-macros/set_probe_radius.nc`
- `references/example-macros/xy_fence_finder_FINAL.nc`
- `references/probe-radius-compensation-guide.md`

**Updated files:**
- `references/example-macros/corner_finder_FINAL.nc`
- `references/example-macros/README.md`
- `SKILL.md`

**Date:** January 20, 2026
**Tested:** Ultimate Bee 1010 with DDCS Expert M350 V1.22
**Status:** Production-ready
