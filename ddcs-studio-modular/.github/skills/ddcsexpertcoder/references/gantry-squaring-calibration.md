# Simple Gantry Squaring Calibration Guide

## Overview

This macro uses a single Y1 home switch and applies a manual calibration offset to square the gantry. No complex math, no second switch needed - just iterative test cuts until perfect.

---

## How It Works

1. **Home Y1** (left side) - both motors move together, Y1 switch triggers
2. **Zero at Y1**
3. **Break slave** - make motors independent
4. **Move Y1 only** by calibration offset (#121)
5. **Re-enable slave** - motors move together again
6. **Result:** Y1 has been shifted relative to Y2, squaring the gantry

---

## Initial Setup

**Line 6 in macro:**
```gcode
#121 = 0.0    (Start at zero)
```

---

## Calibration Process

### Step 1: Cut Test Square

With #121 = 0, cut a test square:
- Recommended size: 14" × 18" (355.6mm × 457.2mm)
- Or any rectangle where you can measure diagonals accurately

### Step 2: Measure Diagonals

Measure both diagonals with calipers or tape measure:
- Front-left to back-right
- Back-left to front-right

**Perfect square:** Both diagonals equal  
**Racked gantry:** Diagonals differ

### Step 3: Determine Sign

**Which diagonal is LONGER?**

**Front-left to back-right longer:**
- Y1 (left) needs to move **back** (toward home)
- **#121 = POSITIVE**

**Back-left to front-right longer:**
- Y1 (left) needs to move **forward** (away from home)
- **#121 = NEGATIVE**

### Step 4: Calculate Correction

**Formula:**
```
Diagonal_error = |Diagonal1 - Diagonal2|
Error_ratio = Diagonal_error / Rectangle_length
Correction = Error_ratio × Gantry_width
```

**Example:**
- Rectangle: 14" × 18" (355.6mm × 457.2mm)
- Diagonal difference: 2mm
- Gantry width: 1000mm

```
Error_ratio = 2mm / 457.2mm = 0.00437
Correction = 0.00437 × 1000mm = 4.37mm
Round to: 4.5mm
```

**Quick Reference Table:**

| Diagonal Error | Correction (1000mm gantry) |
|----------------|---------------------------|
| 0.5mm | ~1.1mm |
| 1.0mm | ~2.2mm |
| 1.5mm | ~3.3mm |
| 2.0mm | ~4.4mm |
| 2.5mm | ~5.5mm |
| 3.0mm | ~6.6mm |

### Step 5: Set and Test

**Edit macro line 6:**
```gcode
#121 = 4.5    (or -4.5 depending on which diagonal was longer)
```

**Re-home and cut another test square.**

### Step 6: Fine-Tune

If diagonals still off:
- Adjust #121 by ±0.5mm increments
- Re-test

**Goal:** Diagonal difference < 0.5mm

---

## Understanding the Physics

**Your gantry has:**
- Y motor (left side) 
- A motor (right side)
- Both slaved together normally

**When racked:**
- Left side might be 2mm ahead of right side
- Creates parallelogram instead of rectangle

**The correction:**
- Breaks slave temporarily
- Moves left side back (or forward) relative to right
- Forces both sides to be parallel
- Re-enables slave

**Physical result:** Gantry is now square to table!

---

## Troubleshooting

**"I adjusted #121 but got worse"**
- You have the sign wrong
- Flip: positive → negative or vice versa

**"Correction seems too large"**
- Double-check your diagonal measurements
- Make sure you're measuring corner-to-corner accurately
- Verify your gantry width (might not be exactly 1000mm)

**"Diagonals perfect but cuts still off"**
- Check if your table/bed is square
- Verify rails are parallel
- Check for mechanical binding

**"Different correction needed each day"**
- Something is loose (belts, couplings, screws)
- Fix mechanical issue first before calibrating

---

## Maintenance

**Re-calibrate when:**
- After any mechanical work on gantry
- If test cuts show diagonals drifting
- After loosening/tightening belts or couplings
- Seasonally (temperature changes can affect frame)

**Stable calibration indicates:**
- Good mechanical rigidity
- Proper maintenance
- Quality machine setup

---

## Advanced: Per-Material Calibration

Some users keep different #121 values for different materials if cutting forces affect squareness:

```gcode
(Soft materials - light forces)
#121 = 4.5

(Hardwoods - heavy forces)  
#121 = 4.8
```

This is optional and only needed if you notice material-dependent variation.

---

## Summary

**Simple approach:**
1. Set #121 = 0
2. Cut test square
3. Measure diagonals
4. Calculate correction
5. Adjust #121
6. Repeat until perfect

**No second switch, no complex math, just iterative refinement until diagonals match!**
