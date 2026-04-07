# PNP to NPN Signal Converter for DDCS Expert

**Problem**: 3D touch probe has PNP output, DDCS Expert controller expects NPN input  
**Solution**: Add signal inversion circuit (relay or transistor)  
**Status**: Required for 3D probe on IN03

---

## Understanding the Problem

### **Your 3D Probe (PNP Output)**
```
Not triggered:
Yellow wire = 0V (LOW)
Controller sees IN03 as ON (backwards!)

Triggered:
Yellow wire = 24V (HIGH)
Controller sees IN03 as OFF (backwards!)
```

### **What DDCS Expects (NPN)**
```
Not triggered:
Signal should be HIGH
Controller should see OFF

Triggered:
Signal should be LOW (0V)
Controller should see ON
```

**Result**: Everything is inverted - probe won't work!

---

## Solution 1: Small Relay (Easiest)

**Parts needed:**
- 1x 24V DC relay (SPDT - Single Pole Double Throw)
- Common options: Omron G2R-1-E, Finder 40.52, or similar
- Rating: 5A minimum, 24V DC coil

**Wiring diagram:**
```
3D Probe:
├─ Red (VCC) ────────→ Wago Hub +24V
├─ Black (GND) ──────→ Wago Hub GND
└─ Yellow (PNP out) ─→ Relay COIL + (pin 2)

Relay:
├─ Coil - (pin 7) ───→ Wago Hub GND
├─ Common (pin 1) ───→ Wago Hub +24V
├─ NO (pin 4) ───────→ DDCS Expert IN03
└─ NC (pin 3) ───────→ Not used

Pull-down:
└─ 10kΩ resistor: IN03 to GND (keeps input LOW when relay off)
```

**How it works:**
```
Probe NOT triggered:
- Yellow = 0V
- Relay coil OFF
- Relay NO contact OPEN
- IN03 pulled to GND by 10kΩ
- Controller sees LOW (OFF) ✅

Probe triggered:
- Yellow = 24V
- Relay coil ON
- Relay NO contact CLOSED
- IN03 connected to +24V
- Controller sees HIGH... wait, still wrong!
```

**Actually, we need to invert the relay logic:**

```
Better wiring:
├─ Common (pin 1) ───→ Wago Hub GND
├─ NO (pin 4) ───────→ DDCS Expert IN03
└─ NC (pin 3) ───────→ Not used

Pull-up:
└─ 10kΩ resistor: IN03 to +24V (via controller or external)

Probe NOT triggered:
- Yellow = 0V
- Relay OFF
- NO contact OPEN
- IN03 pulled HIGH by resistor
- Controller sees HIGH (OFF) ✅

Probe triggered:
- Yellow = 24V  
- Relay ON
- NO contact CLOSED (connects IN03 to GND)
- Controller sees LOW (ON) ✅
```

---

## Solution 2: NPN Transistor (Compact)

**Parts needed:**
- 1x NPN transistor (2N2222, 2N3904, or similar)
- 1x 1kΩ resistor (base)
- 1x 10kΩ resistor (pull-up)

**Wiring diagram:**
```
3D Probe:
├─ Red (VCC) ────────→ Wago Hub +24V
├─ Black (GND) ──────→ Wago Hub GND
└─ Yellow (PNP out) ─→ 1kΩ resistor → Transistor BASE

Transistor (NPN):
├─ BASE ─────────────→ 1kΩ → Probe Yellow
├─ EMITTER ──────────→ Wago Hub GND
└─ COLLECTOR ────────→ DDCS Expert IN03

Pull-up:
└─ 10kΩ resistor: IN03 to +24V
```

**How it works:**
```
Probe NOT triggered:
- Yellow = 0V
- Transistor BASE = 0V
- Transistor OFF
- COLLECTOR open (high impedance)
- IN03 pulled HIGH by 10kΩ
- Controller sees HIGH (OFF) ✅

Probe triggered:
- Yellow = 24V
- Transistor BASE = ~23V (through 1kΩ)
- Transistor ON
- COLLECTOR pulls IN03 to GND
- Controller sees LOW (ON) ✅
```

**Perfect inversion with no moving parts!**

---

## Solution 3: Opto-Isolator (Best Isolation)

**Parts needed:**
- 1x PC817 opto-isolator (or similar 4-pin DIP)
- 1x 1kΩ resistor (LED current limit)
- 1x 10kΩ resistor (pull-up)

**Wiring diagram:**
```
3D Probe:
├─ Red (VCC) ────────→ Wago Hub +24V
├─ Black (GND) ──────→ Wago Hub GND
└─ Yellow (PNP out) ─→ 1kΩ resistor → Opto LED+

Opto-isolator PC817:
├─ Pin 1 (LED+) ─────→ 1kΩ → Probe Yellow
├─ Pin 2 (LED-) ─────→ Wago Hub GND
├─ Pin 3 (C) ────────→ DDCS Expert IN03
└─ Pin 4 (E) ────────→ Wago Hub GND

Pull-up:
└─ 10kΩ resistor: IN03 to +24V
```

**Advantages:**
- Complete electrical isolation
- Protects controller from probe issues
- Professional solution

---

## Comparison Table

| Solution | Cost | Complexity | Isolation | Size |
|----------|------|------------|-----------|------|
| Relay | $3-5 | Easy | Yes (coil) | Large |
| Transistor | $0.50 | Medium | No | Tiny |
| Opto | $1-2 | Medium | Yes (optical) | Small |

---

## Recommended: NPN Transistor Solution

**Why:**
- ✅ Cheap ($0.50 in parts)
- ✅ Compact (fits in small project box)
- ✅ No moving parts
- ✅ Fast response
- ✅ Easy to build on perfboard
- ✅ Widely available parts

**Circuit on perfboard:**
```
     +24V (from Wago)
       |
      10kΩ (pull-up)
       |
       ├─────→ IN03 (to controller)
       |
    COLLECTOR
       |
   TRANSISTOR (2N2222)
       |
    EMITTER
       |
      GND

    BASE
       |
      1kΩ
       |
    Yellow wire (from probe)
```

---

## Step-by-Step Build (Transistor Method)

**Materials:**
1. 2N2222 NPN transistor (or 2N3904, BC547)
2. 1kΩ resistor (brown-black-red)
3. 10kΩ resistor (brown-black-orange)
4. Small perfboard or stripboard
5. 3-position terminal block
6. Wire, solder

**Steps:**

1. **Identify transistor pins:**
   ```
   2N2222 (flat side facing you):
   E - B - C
   (Emitter - Base - Collector)
   ```

2. **Solder on perfboard:**
   ```
   - Emitter to GND rail
   - Base through 1kΩ to input terminal
   - Collector to output terminal
   - 10kΩ between Collector and +24V rail
   ```

3. **Add terminal blocks:**
   ```
   INPUT:  Probe Yellow wire
   OUTPUT: Controller IN03 wire
   POWER:  +24V and GND from Wago
   ```

4. **Mount in small project box**

5. **Wire connections:**
   ```
   Probe Yellow → INPUT
   Controller IN03 → OUTPUT
   Wago +24V → POWER +
   Wago GND → POWER -
   ```

6. **Test before connecting to controller:**
   ```
   Multimeter on OUTPUT:
   - Probe not triggered → should read ~24V
   - Probe triggered → should read ~0V
   ```

---

## Testing the Converter

**Before connecting to IN03:**

1. **Power up circuit**
   - Connect +24V and GND only
   - Do NOT connect to IN03 yet

2. **Test with multimeter:**
   ```
   OUTPUT terminal to GND:
   
   Probe NOT triggered:
   - Should read ~20-24V (pulled high)
   
   Touch probe stylus:
   - Should drop to ~0V (transistor pulls low)
   ```

3. **Verify inversion:**
   ```
   Probe signal LOW → Output HIGH ✅
   Probe signal HIGH → Output LOW ✅
   ```

4. **Connect to controller:**
   ```
   OUTPUT → IN03
   Test in controller IO screen
   Should now trigger correctly!
   ```

---

## Active Level Setting

**After installing converter:**

The signal is now properly inverted (NPN-compatible), but you may still need to set the active level:

**Try:**
```
IN03 active level = 0 (active low)
```

**If that doesn't work:**
```
IN03 active level = 1 (active high)
```

**One of these will work with the converter installed.**

---

## Troubleshooting

**Output always HIGH, never goes LOW:**
- Transistor installed backwards (check E-B-C)
- 1kΩ resistor missing or wrong value
- Transistor damaged

**Output always LOW, never goes HIGH:**
- 10kΩ pull-up missing
- Pull-up to wrong voltage
- Short to ground somewhere

**Works in multimeter test but not in controller:**
- Active level setting wrong
- IN03 not enabled in controller
- Wire from OUTPUT to IN03 broken

**Probe LED works but converter doesn't respond:**
- Input wire (Yellow from probe) not connected
- Check probe is outputting 0V/24V correctly
- Verify PNP probe is actually working

---

## Alternative: Buy Pre-Made Converter

**Search for:**
- "PNP to NPN converter module"
- "Signal inverter board 24V"
- "Relay module SPDT 24V"

**Cost:** $5-15  
**Advantage:** No soldering, plug-and-play  
**Disadvantage:** Larger, more expensive

---

## Long-Term Solution

**Consider replacing probe:**
- Many 3D touch probes available in NPN version
- Would work directly without converter
- Check manufacturer for NPN option
- Might be cheaper than building converter

**But converter works perfectly if built correctly!**

---

## Summary

**Your situation:**
- 3D probe: PNP output (0V/24V)
- DDCS Expert: NPN input expected
- Solution: Signal inverter required

**Best option:**
- NPN transistor circuit (2N2222)
- $0.50 in parts
- 30 minutes to build
- Works perfectly

**Result:**
- Probe triggers correctly
- IN03 sees proper NPN signal
- No modification to probe or controller

---

**Document Status**: Ready for implementation  
**Next Step**: Build transistor converter circuit  
**Expected Result**: 3D probe fully functional on IN03
