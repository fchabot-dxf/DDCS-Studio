# Dual-Gantry Auto-Squaring with Dual Limit Switches

**Status**: ⚠️ **REFERENCE ONLY - NOT USED ON THIS MACHINE**

This document describes a dual-switch auto-squaring system used by some DDCS users. 

**Your machine uses the simpler single-switch calibration approach instead.**

**See `gantry-squaring-calibration.md` for the actual calibration method used on this machine.**

---

## Why This Isn't Used Here

The dual-switch approach requires:
- Installing a second limit switch (Y2) on the right side
- Complex switch offset calculations
- Automatic measurement routines
- Additional wiring and configuration

**Your approach is simpler:**
- Single Y1 home switch (already installed)
- Manual calibration offset (#121)
- Iterative test cuts for verification
- Direct, reliable, easy to adjust

---

## When Dual-Switch Makes Sense

Some users prefer dual-switch auto-squaring when:
- Machine experiences frequent racking
- Automatic correction desired every home cycle
- Willing to install and calibrate second switch
- Need to compensate for wear/drift automatically

**Your machine:** Uses stable mechanical setup with periodic manual calibration instead.

---

**For your actual calibration procedure, see:**
- `gantry-squaring-calibration.md` - Simple test-cut based calibration
- `hardware-config.md` Section 11 - Your single-switch configuration
