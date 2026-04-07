# Community Patterns from DDCS M350 Users
## Part 5: Advanced Syntax Part 2

**📚 This is part of a 6-part series:**
- Part 1: [Core Patterns](community-patterns-1-core.md)
- Part 2: [Boolean & Dynamic G-code](community-patterns-2-boolean-dynamic.md)
- Part 3: [Multi-Tool Workflows](community-patterns-3-multi-tool.md)
- Part 4: [Advanced Syntax Part 1](community-patterns-4-syntax-1.md)
- **Part 5: Advanced Syntax Part 2** ← You are here
- Index: [Complete Series Guide](community-patterns.md)

---


**Pattern**: Convert binary direction flag to signed multiplier

**Source**: Multiple lines in macro_DA_without_relay_advanced.nc

```gcode
#[71+#191] = [#32*2-1] * #53
```

**How it works:**

```gcode
; #32 is direction: 0 or 1
; #53 is distance: 3 (unsigned)

; Formula: [#32*2-1]
; If #32 = 0: [0*2-1] = -1 (negative direction)
; If #32 = 1: [1*2-1] = +1 (positive direction)

; Result:
; If #32 = 0: -1 * 3 = -3mm (backward)
; If #32 = 1: +1 * 3 = +3mm (forward)
```

**Alternative formulas for same pattern:**

**Version A: [dir*2-1]** (macro uses this)
```gcode
#signed_dist = [#dir * 2 - 1] * #dist
; dir=0: [0*2-1] = -1 → negative
; dir=1: [1*2-1] = +1 → positive
```

**Version B: [1-dir*2]** (from macro_Adaptive_Pocket.nc)
```gcode
#signed_dist = [1 - #dir * 2] * #dist
; dir=0: [1-0*2] = +1 → positive
; dir=1: [1-1*2] = -1 → negative
; (Note: opposite polarity!)
```

**Choose based on your direction convention:**
- If 0=negative, 1=positive → Use `[dir*2-1]`
- If 0=positive, 1=negative → Use `[1-dir*2]`

**Practical examples:**

**Simple axis movement with direction:**
```gcode
#direction = 1    ; 0=back, 1=forward
#distance = 10    ; Always positive

G91 G01 Y[#direction*2-1]*#distance F200
; If direction=0: Y-10 (backward)
; If direction=1: Y+10 (forward)
```

**Probing with configurable direction:**
```gcode
#probe_dir = 0    ; 0=toward negative, 1=toward positive
#probe_dist = 50  ; Maximum probe distance

G91 G31 Z[#probe_dir*2-1]*#probe_dist F100 P3 L0 Q1
; If probe_dir=0: Probe Z-50 (downward)
; If probe_dir=1: Probe Z+50 (upward)
```

**Offset application with side selection:**
```gcode
#side = 1         ; 0=left, 1=right
#offset = 5.0     ; Offset magnitude

#x_position = #center + [#side*2-1] * #offset
; If side=0: center + (-1)*5 = center - 5 (left)
; If side=1: center + (+1)*5 = center + 5 (right)

G0 X#x_position
```

**Comparison to IF statement approach:**

**Without formula (verbose):**
```gcode
IF #direction == 0 THEN #signed = -#distance
IF #direction == 1 THEN #signed = #distance
G91 G01 Y#signed F200
```

**With formula (compact):**
```gcode
G91 G01 Y[#direction*2-1]*#distance F200
```

**Why this matters:**
- Eliminates IF statements for direction logic
- More compact and readable
- Faster execution (no branching)
- Common pattern in professional macros
- Essential for generic axis code

---

### 5. Mathematical Ternary Expression

**Pattern**: Use math to implement conditional assignment without IF statement

**Source**: Line 73 of macro_DA_without_relay_advanced.nc

```gcode
#20 = #618 + #500 * [1 - ROUND[#618/[#618+0.1]]]
```

**What this does:**
```
If #618 != 0: #20 = #618
If #618 == 0: #20 = #500
```

**How it works:**

```gcode
; If #618 = 100 (non-zero):
#618 / [#618 + 0.1] = 100 / 100.1 ≈ 0.999
ROUND[0.999] = 1
1 - 1 = 0
#618 + #500 * 0 = 100 ✅

; If #618 = 0 (zero):
#618 / [#618 + 0.1] = 0 / 0.1 = 0
ROUND[0] = 0
1 - 0 = 1
#618 + #500 * 1 = 500 ✅
```

**General pattern:**
```gcode
; result = default + fallback * [test]
; where [test] = 1 if should use fallback, 0 if should use default

#result = #default + #fallback * [1 - ROUND[#default / [#default + epsilon]]]
```

**Why epsilon (0.1)?**
- Prevents division by zero when #default = 0
- Small enough not to affect ROUND result when #default != 0
- Could be 0.01, 0.001, etc.

**Practical example - Speed with fallback:**
```gcode
; Use configured speed, or default if not set
#configured_speed = #118    ; 2nd homing speed (may be 0)
#default_speed = #500       ; Motor start speed

#actual_speed = #configured_speed + #default_speed * [1 - ROUND[#configured_speed / [#configured_speed + 0.1]]]

; If #118 = 0: Uses #500
; If #118 = 80: Uses 80
```

**Traditional IF approach (for comparison):**
```gcode
IF #618 == 0 THEN #20 = #500
IF #618 != 0 THEN #20 = #618

; OR:
#20 = #618
IF #20 == 0 THEN #20 = #500
```

**When to use this pattern:**
- ✅ When avoiding IF statements improves flow
- ✅ When building mathematical expressions
- ✅ Advanced optimization

**When NOT to use:**
- ❌ When IF statement is clearer
- ❌ For beginners (hard to read)
- ❌ When multiple conditions needed

**Note:** This is a **clever trick** but the IF statement approach is usually clearer. Include here to show what's possible, but don't overuse.

---

## Summary

These patterns represent battle-tested code from the DDCS M350 community. Key takeaways:

1. **G31 extended syntax** is powerful for precise probing
2. **G4P-1 interactive pause** enables operator interaction mid-macro
3. **G53 with variables** works reliably (avoid hardcoded constants)
4. **Dual-gantry sync** requires explicit A-axis coordination
5. **State preservation** prevents unexpected behavior
6. **Loop-based position memory** enables complex automation
7. **Error handling** uses consistent GOTO labels
8. **Dynamic WCS calculation** provides flexibility
9. **No universal priming** - community macros often skip it for local vars
10. **M30 is glitchy** - avoid in complex macros
11. **Boolean operators** - Use `+` for OR, `*` for AND ⭐
12. **Dynamic G-code** - Calculate G-code numbers at runtime ⭐
13. **Indirect addressing** - Variable numbers can be calculated ⭐
14. **Complex expressions** - Nest brackets for sophisticated math ⭐
15. **Computed GOTO** - Operation sequencing with resume capability ⭐
16. **Tool offset calculation** - Automatic tool length compensation ⭐
17. **Manual WCS setup** - Interactive jogging for reference ⭐
18. **Position saving** - Multi-tool return to same location ⭐
19. **Multi-condition validation** - Chain 10+ checks in single IF ⭐ NEW
20. **Nested indirect addressing** - Double indirection with math ⭐ NEW
21. **Axis-agnostic code** - Letter number mapping for generic axis code ⭐ NEW
22. **Direction flag conversion** - Binary to signed multiplier [dir*2-1] ⭐ NEW
23. **Mathematical ternary** - Conditional assignment without IF ⭐ NEW

These patterns should be preferred over theoretical approaches when building DDCS M350 macros.




---

**Navigation**: [← Part 4: Syntax 1](community-patterns-4-syntax-1.md) | [↑ Back to Index](community-patterns.md)

**Part 5 of 6** - Series Complete!
