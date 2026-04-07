# 3D Probe Radius Compensation Guide

**Critical concept for accurate probe-based work coordinate setup**

## The Physics

When a spherical probe touches a surface, the probe **center** is offset from the actual surface by the probe **radius**.

**Example with 2mm diameter probe (1mm radius):**
```
    Probe Center ●  ← Controller reads this position
         |
       1mm (radius)
         |
    ════════════  ← Actual surface you want to measure
```

## Inside vs Outside Probing

The direction you probe determines whether you ADD or SUBTRACT the radius.

### Inside Corner/Hole Probing (ADD radius)

When probing **from outside moving IN** (like finding an inside corner):

```
 Probe moving →   ●  
                 / \
               1mm  
              ════  ← Wall/edge
```

**Trigger position** = surface + radius  
**Actual surface** = trigger - radius  
**To set WCS zero AT surface:** `WCS = trigger - radius`  

**But wait!** For corner finding, we want zero at the CORNER (inside), not outside:
- Trigger happens when probe center is 1mm away from wall
- To put zero AT THE CORNER: `WCS = trigger + radius` ✅

**This is what corner_finder_FINAL.nc does:**
```gcode
#101=#1925      ;probe triggered (center is 1mm from edge)
#40=#1170       ;probe radius (1mm)
#102=#101+#40   ;ADD radius to move zero to the corner
#805=#102       ;set G54 X zero at corner
```

### Outside Fence Probing (SUBTRACT radius)

When probing **from inside moving OUT** (like finding a fence reference):

```
                    ● ← Probe moving out
                   / \
                 1mm  
  ════════════════    ← Fence/reference edge
```

**Trigger position** = fence edge - radius  
**Actual fence edge** = trigger + radius  
**To set WCS zero AT edge:** `WCS = trigger + radius`

**But for fence reference**, we're measuring the fence position itself:
- Trigger happens when probe center is 1mm before the edge
- The actual edge is 1mm further: `Fence = trigger + radius`
- But we want to SET the WCS to the edge position: `WCS = trigger - radius` ✅

**This is what xy_fence_finder_FINAL.nc does:**
```gcode
#101=#1925      ;probe triggered (center is 1mm from fence)
#40=#1170       ;probe radius (1mm)
#102=#101-#40   ;SUBTRACT radius to position WCS at fence
#805=#102       ;set G54 X offset to fence position
```

## The Persistent Storage Pattern

Both macros read the probe radius from **#1170** (persistent variable):

```gcode
#40=#1170  ;read probe radius from persistent storage
```

### Why Persistent Storage?

**Problem:** Hardcoded radius values like `#102=#101+2` create maintenance nightmares:
- Different probes = edit every macro
- Easy to forget which macros need updating
- Copy/paste errors propagate

**Solution:** Store radius ONCE in persistent variable #1170:
1. **One-time setup:** Run `set_probe_radius.nc` to store your probe radius
2. **All macros read #1170:** Every probe macro gets the correct radius automatically
3. **Change probes?** Just run `set_probe_radius.nc` again - all macros update instantly
4. **Survives reboot:** #1170 persists through power cycles

### Setup Workflow

**Initial setup (once per probe):**
```gcode
;In set_probe_radius.nc
#1170=1    ;2mm diameter probe = 1mm radius
```

**Every probe macro reads it:**
```gcode
#40=#1170  ;corner_finder_FINAL.nc
#40=#1170  ;xy_fence_finder_FINAL.nc
#40=#1170  ;any future probe macro you create
```

**Change probes?** Just update one number in `set_probe_radius.nc` and run it. Every macro automatically uses the new value.

## Quick Reference

| Probe Type | Compensation | Reason |
|------------|--------------|---------|
| **Inside corner/hole** | ADD radius | Zero point is INSIDE the probed surfaces |
| **Outside fence/edge** | SUBTRACT radius | Zero point is AT the probed surface |
| **Z surface (top)** | No compensation* | Measuring from above, zero at contact point |

*For Z probing, if using a probe puck, you subtract the puck thickness, not the probe radius.

## Verification Test

**How to verify your compensation is correct:**

1. **For corner finder:**
   - Probe a known corner (e.g., machined block)
   - Move to G54 X0 Y0
   - Visual check: Probe center should be AT the corner intersection
   - If probe center is 2mm off, your sign is backwards!

2. **For fence finder:**
   - Probe your fence reference
   - Move to G54 X0 Y0
   - Measure actual position with known reference
   - Should match your fence position exactly

## Common Mistakes

❌ **Wrong:** `#102=#101+#40` in fence finder (double-compensates!)  
✅ **Right:** `#102=#101-#40` in fence finder

❌ **Wrong:** `#102=#101-#40` in corner finder (zero ends up outside workpiece!)  
✅ **Right:** `#102=#101+#40` in corner finder

❌ **Wrong:** Hardcoding radius as `+2` or `-2` in the macro  
✅ **Right:** Reading from persistent variable `#40=#1170`

## Summary

**Think of it this way:**
- **Corner finder:** You're measuring BETWEEN two walls → ADD radius to get zero at the intersection
- **Fence finder:** You're measuring TO one wall → SUBTRACT radius to get the wall position
- **Persistent storage:** Set radius ONCE in #1170, use EVERYWHERE via #40=#1170

**Files:**
- `set_probe_radius.nc` - Configure probe radius (run first!)
- `corner_finder_FINAL.nc` - Inside corner probing (adds radius)
- `xy_fence_finder_FINAL.nc` - Outside fence probing (subtracts radius)
