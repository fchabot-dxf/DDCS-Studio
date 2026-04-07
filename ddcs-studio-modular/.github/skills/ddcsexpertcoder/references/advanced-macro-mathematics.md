# Advanced MacroB Mathematics - Quick Reference

**Author**: Nikolay Zvyagintsev (Николай Звягинцев)  
**Source**: Russian DDCS M350 community  
**Purpose**: Efficient math operations without IF statements

**Complete formulas**: See full version (630 lines) for all patterns and examples

---

## Overview

**Why use mathematical formulas?**
- ✅ No IF/GOTO statements (faster execution)
- ✅ More compact code
- ✅ Fewer lines to debug
- ❌ Less readable (trade-off)

**When to use**: Performance-critical loops, complex calculations

---

## Quick Formula Index

| Category | Formulas | Use Case |
|----------|----------|----------|
| **Sign Functions** | sgn(x), sign to 1/0 | Direction determination |
| **Equality** | x==y without IF | Comparison operations |
| **Axis Translation** | X→1, Y→2, Z→3 | Dynamic axis selection |
| **Binary Logic** | AND, OR, XOR | Boolean operations |
| **Min/Max** | Without IF | Range limiting |
| **Format Conversion** | Degrees↔radians | Unit conversion |
| **Value Inversion** | 1↔0, negate | Boolean flip |
| **Even/Odd** | Detect parity | Loop iteration logic |
| **Geometric** | Distance, angles | CNC path calculations |

**See**: Full document for complete formulas

---

## Top 10 Most Useful Formulas

### 1. Sign Function (sgn)

**Convert ± to 1/-1**:
```gcode
#sign = ABS[#x] / #x
; Positive → 1, Negative → -1, Zero → ERROR
```

**Safe version** (handles zero):
```gcode
#sign = ABS[#x + 0.1] / [#x + 0.1]
; Zero → 1
```

---

### 2. Apply Sign of One Variable to Another

```gcode
#distance = 50      ; Magnitude
#direction = -30    ; Direction (± indicates sign)

#result = #distance * [ABS[#direction] / #direction]
; Result: -50 (applies negative sign)
```

---

### 3. Convert Sign to 1/0

**Negative → 0, Positive → 1**:
```gcode
#result = [ABS[#x] + #x] / 2 / #x
```

---

### 4. Check Equality Without IF

```gcode
; Is #a equal to #b?
#equal = 1 - ABS[ABS[#a - #b] / [#a - #b + 0.001]]
; Result: 1 if equal, 0 if different
```

---

### 5. Axis Letter to Number

```gcode
; Convert X/Y/Z to 1/2/3
#x_code = 88   ; ASCII for 'X'
#axis_num = [#x_code - 87] MOD 5
; X=88 → 1, Y=89 → 2, Z=90 → 3
```

---

### 6. Min Value (Without IF)

```gcode
#min = [#a + #b - ABS[#a - #b]] / 2
```

---

### 7. Max Value (Without IF)

```gcode
#max = [#a + #b + ABS[#a - #b]] / 2
```

---

### 8. Limit Value to Range

```gcode
; Clamp #value between #min and #max
#clamped = [[#value + #min - ABS[#value - #min]] / 2 + #max + ABS[[#value + #min - ABS[#value - #min]] / 2 - #max]] / 2
```

---

### 9. Even/Odd Detection

```gcode
; Check if integer is even (result: 1=even, 0=odd)
#is_even = 1 - [#n MOD 2]
```

---

### 10. 2D Distance

```gcode
#distance = SQRT[#dx * #dx + #dy * #dy]
```

**3D Distance**:
```gcode
#distance = SQRT[#dx * #dx + #dy * #dy + #dz * #dz]
```

---

## Common Patterns by Use Case

### Direction Control

```gcode
; Reverse direction based on flag
#direction = 1    ; 1 or -1
#move = 50 * #direction
G91 G0 X#move
```

### Dynamic Axis Selection

```gcode
; Select axis based on variable
#axis = 2   ; 1=X, 2=Y, 3=Z
#value = 100

IF #axis == 1 THEN G0 X#value
IF #axis == 2 THEN G0 Y#value
IF #axis == 3 THEN G0 Z#value

; Or use G31 with dynamic axis:
G91 G31 X[#axis==1]*#value Y[#axis==2]*#value Z[#axis==3]*#value F100 P3
```

### Value Clamping

```gcode
; Keep value between 0 and 100
#value = 150
#min = 0
#max = 100
#clamped = [[#value + #min - ABS[#value - #min]] / 2 + #max + ABS[[#value + #min - ABS[#value - #min]] / 2 - #max]] / 2
; Result: 100
```

### Boolean Flags

```gcode
; Convert comparison to flag
#threshold = 50
#current = 75
#over_threshold = [#current + ABS[#current - #threshold]] / 2 / #current
; Result: 1 if over, 0 if under
```

---

## Performance Notes

### When to Use Mathematical Formulas

**Good for**:
- ✅ Tight loops (>100 iterations)
- ✅ Performance-critical sections
- ✅ Complex conditional logic

**Avoid for**:
- ❌ Simple IF statements (readability matters)
- ❌ One-time calculations
- ❌ Code that others will maintain

### Speed Comparison

```
IF statement:       ~0.5ms per evaluation
Math formula:       ~0.2ms per calculation
Savings:            ~0.3ms per operation
```

**Example impact**:
- 1000-iteration loop: ~300ms saved
- 10-iteration loop: ~3ms saved (not worth complexity)

---

## Geometric Calculations

### Circle/Arc Operations

**Point on circle**:
```gcode
#angle = 45   ; degrees
#radius = 50
#x = #radius * COS[#angle]
#y = #radius * SIN[#angle]
```

**Angle between points**:
```gcode
#angle = ATAN[#dy]/[#dx]
; Returns angle in degrees
```

**Distance between points**:
```gcode
#dist = SQRT[[#x2-#x1]*[#x2-#x1] + [#y2-#y1]*[#y2-#y1]]
```

---

## Unit Conversions

### Degrees ↔ Radians

```gcode
; Degrees to radians
#radians = #degrees * 3.14159 / 180

; Radians to degrees
#degrees = #radians * 180 / 3.14159
```

### Feed Rate Conversions

```gcode
; mm/min to mm/sec
#mm_sec = #mm_min / 60

; inch/min to mm/min
#mm_min = #inch_min * 25.4
```

---

## Practical Examples

### Example 1: Spiral Pattern

```gcode
O1000 (Spiral - Math-based)
#radius_start = 10
#radius_end = 50
#turns = 5
#segments = 100

#angle = 0
WHILE #angle < [360 * #turns] DO1
  #radius = #radius_start + [#radius_end - #radius_start] * #angle / [360 * #turns]
  #x = #radius * COS[#angle]
  #y = #radius * SIN[#angle]
  G1 X#x Y#y F500
  #angle = #angle + [360 * #turns / #segments]
END1
M30
```

### Example 2: Auto-Reverse Probing

```gcode
O2000 (Bi-directional Probe)
#direction = 1    ; 1 or -1
#distance = 50

; Probe in direction
G91 G31 X[#distance * #direction] F100 P3 L0 Q1

; Auto-reverse for next probe
#direction = 0 - #direction
```

### Example 3: Dynamic Feed Scaling

```gcode
O3000 (Feed Scale by Distance)
#distance = 200
#base_feed = 1000
#max_feed = 3000

; Scale feed based on distance (longer = faster)
#scaled_feed = #base_feed + [#max_feed - #base_feed] * [#distance / 500]
#scaled_feed = [[#scaled_feed + #base_feed - ABS[#scaled_feed - #base_feed]] / 2 + #max_feed + ABS[[#scaled_feed + #base_feed - ABS[#scaled_feed - #base_feed]] / 2 - #max_feed]] / 2

G1 X#distance F#scaled_feed
```

---

## Formula Quick Reference Table

| Operation | Formula | Notes |
|-----------|---------|-------|
| Sign (±1) | `ABS[x]/x` | Error if x=0 |
| Sign safe | `ABS[x+0.1]/[x+0.1]` | Returns 1 if x=0 |
| Equality | `1-ABS[ABS[a-b]/[a-b+0.001]]` | 1=equal, 0=not |
| Min | `[a+b-ABS[a-b]]/2` | Smaller value |
| Max | `[a+b+ABS[a-b]]/2` | Larger value |
| Even/odd | `1-[n MOD 2]` | 1=even, 0=odd |
| Distance 2D | `SQRT[dx*dx+dy*dy]` | Pythagorean |
| Distance 3D | `SQRT[dx*dx+dy*dy+dz*dz]` | 3D Euclidean |
| Point on circle | `x=r*COS[θ], y=r*SIN[θ]` | Degrees |

---

## When NOT to Use

**Avoid mathematical tricks for**:
1. Code that will be maintained by others
2. One-time calculations (not in loops)
3. Simple comparisons (IF is clearer)
4. Learning/training code (use IF for clarity)

**Readability matters!** Only optimize when:
- Performance testing shows bottleneck
- Loop iterations >100
- Time savings >10ms

---

## Related Documentation

**For complete formulas and examples** (630 lines):
- All sign determination variations
- Complete binary logic operations
- Extended geometric calculations
- 15+ practical examples
- Optimization benchmarks

**Other references**:
- `macrob-programming-rules.md` - Syntax fundamentals
- `community-patterns-1-core.md` - Practical patterns
- `software-technical-spec.md` - Performance considerations

---

## Credits

**Original Author**: Nikolay Zvyagintsev (Николай Звягинцев)  
**Source**: Russian DDCS M350 community forums  
**Translated/Adapted**: For English DDCS documentation

**These formulas are battle-tested** in production CNC environments.

---

## Document Status

**Type**: Quick reference + formula library  
**Authority**: [CONFIRMED] Community-proven patterns  
**Last Updated**: January 2026

**For complete formula library**, see full 630-line version with all variations and examples.
