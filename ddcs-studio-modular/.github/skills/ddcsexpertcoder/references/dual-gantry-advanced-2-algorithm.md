# Advanced Dual-Gantry Auto-Squaring System
## Part 2: Algorithm & Math

**📚 This is part of a 3-part series:**
- Part 1: [Overview & Configuration](dual-gantry-advanced-1-overview.md)
- **Part 2: Algorithm & Math** ← You are here
- Part 3: [Usage & Troubleshooting](dual-gantry-advanced-3-usage.md)

---

## Detailed Algorithm

### 85-Step Process Flow

**Phase 1: Initialization (Steps 1-11)**
1. Define control variables
2. Validate settings (axis numbers, ports, enables)
3. Calculate axis letter number (0=X, 1=Y, etc.)
4. Set #1618=0 (make rotary axes linear temporarily)
5. Combine alignment correctors (#34 = #34 - #33)
6. Transfer settings to working variables
7. Zero service variables
8. Check if sensors already triggered
9. If triggered + PA enabled → Jump to PA
10. If master triggered + PA disabled → Jump to FA
11. If slave triggered + PA disabled → Calculate distance, jump to FA

**Phase 2: Fast Feed (Steps 12-21)**
12. Start Fast Feed function
13. Check if FF enabled (if #27 != 0)
14. Determine FF direction and distance
15. Configure protection port (combined or master)
16. Execute G0 rapid approach
17. Check if limit reached (error if non-homing limit)
18. If sensor found → Jump to Pre-Alignment
19. If sensor not found → Continue to Pre-Alignment
20. End Fast Feed

**Phase 3: Pre-Alignment (Steps 22-45)**
21. Start Pre-Alignment function
22. Check if PA enabled (if #25 == 0, skip to FA)
23. Determine PA 1st approach direction/distance
24. Execute 1st PA approach (fast, combined port)
25. Check sensor found (error if not)
26. If single-homing (#57==0) → Jump to sensor check
27. Vibration settling pause (#65 delay)
28. Retract until sensor released (G0 soft stop)
29. Execute 2nd PA approach (slow, combined port)
30. Check sensor found (error if not)
31. Check which sensors triggered
32. If BOTH triggered → Gantry aligned, jump to FA
33. Determine one-sided PA direction (max distance)
34. If master triggered → Disconnect master, move slave
35. If slave triggered → Disconnect slave, move master
36. Check alignment distance not exceeded
37. If FA enabled → Jump to FA (don't count PA as productive)
38. If FA disabled → Verify PA distance, set machine zero
39. Apply main side corrector
40. Jump to MPAH (Machine Position After Homing)
41. End Pre-Alignment

**Phase 4: Fine Alignment (Steps 46-78)**
42. Start Fine Alignment function
43. Determine FA 1st approach direction/distance
44. Execute 1st FA approach (sharp stop, master sensor)
45. Check arrived at sensor
46. Determine FA subsequent approach direction/distance
47. Vibration settling pause
48. Start FA cycle loop
49. If cycles < 2 OR 1st counted → Contact check
50. Execute FA approach (sharp stop, master sensor)
51. Check sensor found (error if not)
52. Perform contact check (1st approach only)
53. Add found coordinate to accumulation variable
54. Save cycle coordinate to #2100-#2104 range
55. Increment productive cycle counter
56. Increment total cycle counter
57. Retract until sensor released (G0 soft stop)
58. If cycles not complete → Repeat FA loop
59. End FA cycle loop
60. Check max error among approaches (if >1 cycle)
61. Calculate max deviation, compare to threshold (#117)
62. Save max error to statistics (#2111-#2115)
63. Accumulate error for averaging (#2800-#2807)
64. Increment homing counter (#2808-#2816)
65. Check which side completed (master or slave)
66. If master completed:
    - Set machine zero using arithmetic mean
    - Switch variables to slave side
    - Reset cycle variables
    - Check slave sensor status
    - Jump back to FA approach
67. If slave completed:
    - Calculate alignment direction/distance
    - Verify gantry distance within limits
    - Disconnect slave driver
    - Move master side (aligns gantry)
68. End Fine Alignment

**Phase 5: Finalization (Steps 79-85)**
69. Start MPAH function
70. Set #1618=1 (restore rotary axes)
71. Check MPAH position safety
72. Verify won't collide with sensor
73. Determine MPAH direction/distance
74. Move dual-axis to final position (#122-#126)
75. Set axis occlusion indicator
76. End program

---

## Understanding the Alignment Math

### Example Scenario

**Gantry Configuration:**
```
Portal Width: 1000mm
Master sensor trigger: Response area 0-4mm
Slave sensor trigger:  Response area 0-4mm
Homing offset: 2mm (#236 = 2)
Master corrector: +0.1mm (#34 = 0.1)
Gantry racked: 5mm out of square
```

**Step-by-Step Calculation:**

**1. Master Side Homing:**
```
FA Cycle 1: Sensor triggers at -50.015mm (machine coords)
FA Cycle 2: Sensor triggers at -50.012mm
FA Cycle 3: Sensor triggers at -50.018mm

Arithmetic mean: (-50.015 + -50.012 + -50.018) / 3 = -50.015mm

Apply homing offset (+2mm):
Machine zero = -50.015 + 2.0 = -48.015mm

Set Y-axis machine coordinate:
#881 = -48.015mm (master side now at "zero" position)
```

**2. Slave Side Homing:**
```
Slave sensor is BEHIND master (gantry racked)

FA Cycle 1: Sensor triggers at -48.003mm
FA Cycle 2: Sensor triggers at -48.001mm  
FA Cycle 3: Sensor triggers at -48.004mm

Arithmetic mean: -48.003mm
```

**3. Alignment Calculation:**
```
Master position: 0.000mm (set to zero after homing offset)
Slave position:  -48.003mm (raw coordinate)
Homing offset:   2.000mm
Master corrector: 0.100mm

Formula (from algorithm):
Distance = (Slave - Offset) × -1 + Master + Corrector
Distance = (-48.003 - 2.0) × -1 + 0.0 + 0.1
Distance = -50.003 × -1 + 0.1
Distance = 50.003 + 0.1
Distance = 50.103mm

Direction: Positive (master moves forward)
```

**4. Physical Alignment:**
```
Action: Disconnect slave motor
        Move MASTER side +50.103mm
        (Slave pushed along by gantry beam)

Result: Master:  0.000mm (maintained)
        Slave:   0.000mm (pushed to same position)
        Gantry:  SQUARED
```

**5. Apply Corrector:**
```
Master corrector already in calculation: +0.1mm
This fine-tunes the final position

Final master position: 0.100mm
(Slightly off sensor, preventing wear)
```

**Visual Representation:**
```
BEFORE ALIGNMENT:
        ┌─────────────────────────────┐
SLAVE ──┤  Gantry Beam (racked 5mm)   │── MASTER
        └─────────────────────────────┘
        │                             │
        ▼ Sensor                      ▼ Sensor
    -48.003mm                     0.000mm
    (behind)                      (reference)

AFTER ALIGNMENT:
        ┌─────────────────────────────┐
SLAVE ──┤  Gantry Beam (squared)      │── MASTER
        └─────────────────────────────┘
        │                             │
        ▼ Sensor                      ▼ Sensor
    0.100mm                       0.100mm
    (aligned)                     (aligned)
```

---


---

## Next Steps

**Navigation:**
- **Previous**: [Part 1: Overview & Configuration](dual-gantry-advanced-1-overview.md)
- **Next**: [Part 3: Usage & Troubleshooting](dual-gantry-advanced-3-usage.md)

---

**Part 2 of 3** | [← Previous: Overview](dual-gantry-advanced-1-overview.md) | [Next: Usage →](dual-gantry-advanced-3-usage.md)
