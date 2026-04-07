# Probe Sequence and Machine Position Variables

Below are the variables from the DDCS macro variable list that are useful for probe sequences (G31) and for obtaining the machine's current coordinate/position.

| Macro Address | Access | Description | Notes |
|---------------|--------|-------------|-------|
| 631           | B      | Probe detection times 1-5 | Probing cycle count |
| 632           | B      | Initial speed of Probing | Unit: mm/min |
| 633           | R/O    | Probe Tool block thickness | Useful floating tool |
| 634           | B      | Setting the tool to its original position | 对刀初始位置 |
| 635           | B      | Fixed probe X mach pos | Unit: mm |
| 636           | B      | Fixed probe Y mach pos | Unit: mm |
| 637           | B      | Fixed probe Z mach pos | Unit: mm |
| 638           | B      | Fixed probe 4th mach pos | Unit: mm |
| 622           | B      | Mach position after X go home |  |
| 623           | B      | Mach position after Y go home |  |
| 624           | B      | Mach position after Z go home |  |
| 625           | B      | Mach position after 4th go home |  |
| 626           | B      | Mach position after 5th go home |  |
| 600           | B      | Home mode 0: switch 1: Absolute | Determines absolute position of axes during loading |
| 601           | B      | Servo absolute laps at the X-axis Home | Absolute position of encoder at X home |
| 602           | B      | Servo absolute laps at the Y-axis Home | Absolute position of encoder at Y home |
| 603           | B      | Servo absolute laps at the Z-axis Home | Absolute position of encoder at Z home |
| 604           | B      | Servo absolute laps at the 4th-axis Home | Absolute position of encoder at A home |
| 605           | B      | Servo absolute laps at the 5th-axis Home | Absolute position of encoder at B home |

- **G31** is the probe command. The above variables are typically referenced in probe macros or for retrieving machine position after probing or homing.
- For real-time current position, refer to the controller's status reporting or dedicated position variables (not always stored in macro variables).
