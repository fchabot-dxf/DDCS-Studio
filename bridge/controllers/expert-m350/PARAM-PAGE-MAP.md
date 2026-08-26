# PARAM PAGE MAP — every pendant section and the parameters it holds

**Derived from `SYSDISK/eng` on the live Expert, 2026-08-25**, and checked against pendant
photographs. The `-m` tag in each `eng` entry IS the Param List section id.

⛔ **Sections gather SCATTERED number ranges.** Manual ends at `#289` and Process begins at `#60`;
Home holds `#100-127` *and* `#235-239`. ⇒ never look for a parameter by scrolling to its number.

## ⭐ HOW TO USE THIS WHEN ASKING A HUMAN TO CHANGE A PARAMETER

⛔ **Never give a bare number.** Give the route: **Param page → *section* → `#nnn` *name***.

> ✅ "Param page → **Backlash** → `#400` H01 tool length offset → set 10.000"
> ❌ "set `#400` to 10.000"   ← this cost a real bench session; `#400` is nowhere near its numeric
>    neighbours on screen, and the owner could not find it.

The owner named the payoff directly: *"enormous help — when you ask me to change a param on the fly you can
point me to the section by name."* Look the section up here first; it is two seconds and it removes a hunt at
the machine, where the human is standing and the agent is not.

⚠ Also state the **edit permission** column when it says privileged — those need an elevated login, and
finding that out mid-hunt is its own delay.

---

| `-m` | section | count | ranges | source |
|---|---|---|---|---|
| `-m1` | **Machine** | 28 | `0-3 6-9 11-21 443-444 449-450 488-492` | by elimination |
| `-m2` | **Manual** | 30 | `35-59 285-289` | ⭐ photo |
| `-m3` | **Process** | 30 | `60-70 73-77 90-91 93 220-224 230 253 280-282 295` | ⭐ photo |
| `-m5` | **Spindle** | 9 | `79-85 88-89` | ⭐ photo |
| `-m6` | **IO** | 31 | `92 94-99 210-219 231-234 251-252 264-265 272-277` | ⭐ photo |
| `-m7` | **Home** | 30 | `100-118 122-127 235-239` | ⭐ photo |
| `-m8` | **Probe** | 12 | `128-132 135-141` | ⭐ photo |
| `-m9` | **Hard Limit** | 5 | `150-154` | by elimination |
| `-m10` | **Software limit** | 16 | `155-170` | by elimination |
| `-m11` | **MPG** | 15 | `171-185` | by elimination |
| `-m13` | **Backlash** | 43 | `190-200 400-415 420-435` | ⭐ photo |
| `-m14` | **Tools** | 144 | `800-803 805-827 830-845 850-865 870-885 890-905 910-925 930-945 973-992 999` | by elimination |
| `-m15` | **System** | 15 | `240-241 244-245 247-248 266-269 278-279 284 296-297` | by elimination |

**`-m0`** (52 params) — **NOT on the Param List.** Live state and per-screen values:
`#78` Current coordinate, `#133` Probe Tool block thickness (the Probe page shows `#128-132` and skips it).

**`-m16`, `-m17`, `-m18`, `-m20`, `-m21`, `-m22`, `-m23`, `-m24`, `-m25`, `-m26`, `-m30`, `-m31`** — ranges `500-1105`, beyond the 13-entry Param List: other screens.

⚠ `-m4` and `-m12` are unused. 13 sections, 13 ids.

---

## Every section, in full

### `-m1` — Machine

| param | name | unit | edit |
|---|---|---|---|
| `#0` | Motor starting speed | mm/min | operator |
| `#1` | X-axis pulses per mm |  pulse/mm | operator |
| `#2` | Y-axis pulses per mm |  pulse/mm | operator |
| `#3` | Z-axis pulses per mm |  pulse/mm | operator |
| `#6` | 4th-axis pulses per unit |  | operator |
| `#7` | 4th-axis unit |  | operator |
| `#8` | 5th-axis pulses per unit |  | operator |
| `#9` | 5th-axis unit |  | operator |
| `#11` | Delay between direction and pulse | ns | operator |
| `#12` | X-axis direction port electric level |  | operator |
| `#13` | Y-axis direction port electric level |  | operator |
| `#14` | Z-axis direction port electric level |  | operator |
| `#15` | 4th-axis direction port electric level |  | operator |
| `#16` | 5th-axis direction port electric level |  | operator |
| `#17` | X-axis pulse port electric level |  | operator |
| `#18` | Y-axis pulse port electric level |  | operator |
| `#19` | Z-axis pulse port electric level |  | operator |
| `#20` | 4th-axis pulse port electric level |  | operator |
| `#21` | 5th-axis pulse port electric level |  | operator |
| `#443` | 4th-axis name |  | ⚠ privileged |
| `#444` | 5th-axis name |  | ⚠ privileged |
| `#449` | 4th-axis Type |  | ⚠ privileged |
| `#450` | 5th-axis Type |  | ⚠ privileged |
| `#488` | Programming axis of physical axis 1 |  | ⚠ privileged |
| `#489` | Programming axis of physical axis 2 |  | ⚠ privileged |
| `#490` | Programming axis of physical axis 3 |  | ⚠ privileged |
| `#491` | Programming axis of physical axis 4 |  | ⚠ privileged |
| `#492` | Programming axis of physical axis 5 |  | ⚠ privileged |

### `-m2` — Manual

| param | name | unit | edit |
|---|---|---|---|
| `#35` | X-axis max. speed in manual mode | mm/min | operator |
| `#36` | Y-axis max. speed in manual mode | mm/min | operator |
| `#37` | Z-axis max. speed in manual mode | mm/min | operator |
| `#38` | 4th-axis max. speed in manual mode | deg/min | operator |
| `#39` | 5th-axis max. speed in manual mode | deg/min | operator |
| `#40` | X-axis manual control HIGH speed | mm/min | operator |
| `#41` | Y-axis manual control HIGH speed | mm/min | operator |
| `#42` | Z-axis manual control HIGH speed | mm/min | operator |
| `#43` | 4th-axis manual control HIGH speed | deg/min | operator |
| `#44` | 5th-axis manual control HIGH speed | deg/min | operator |
| `#45` | X-axis manual control LOW speed | mm/min | operator |
| `#46` | Y-axis manual control LOW speed | mm/min | operator |
| `#47` | Z-axis manual control LOW speed | mm/min | operator |
| `#48` | 4th-axis manual control LOW speed | deg/min | operator |
| `#49` | 5th-axis manual control LOW speed | deg/min | operator |
| `#50` | X-axis start acceleration in manual mode | mm/s2 | operator |
| `#51` | Y-axis start acceleration in manual mode | mm/s2 | operator |
| `#52` | Z-axis start acceleration in manual mode | mm/s2 | operator |
| `#53` | 4th-axis start acceleration in manual mode | deg/s2 | operator |
| `#54` | 5th-axis start acceleration in manual mode | deg/s2 | operator |
| `#55` | X-axis stop acceleration in manual mode | mm/s2 | operator |
| `#56` | Y-axis stop acceleration in manual mode | mm/s2 | operator |
| `#57` | Z-axis stop acceleration in manual mode | mm/s2 | operator |
| `#58` | 4th-axis stop acceleration in manual mode | deg/s2 | operator |
| `#59` | 5th-axis stop acceleration in manual mode | deg/s2 | operator |
| `#285` | X-axis max. ACC G00 | mm/s2 | operator |
| `#286` | Y-axis max. ACC G00 | mm/s2 | operator |
| `#287` | Z-axis max. ACC G00 | mm/s2 | operator |
| `#288` | 4th-axis max. ACC G00 | deg/s2 | operator |
| `#289` | 5th-axis max. ACC G00 | deg/s2 | operator |

### `-m3` — Process

| param | name | unit | edit |
|---|---|---|---|
| `#60` | Speed selection |  | operator |
| `#61` | Default operating speed | mm/min | operator |
| `#62` | G01 ACC | mm/s2 | operator |
| `#63` | G00 speed | mm/min | operator |
| `#64` | Maximum speed | mm/min | operator |
| `#65` | Z-axis lifting protection speed | mm/min | operator |
| `#66` | Z-axis dropping protection speed | mm/min | operator |
| `#67` | X-axis protection speed | mm/min | operator |
| `#68` | Y-axis protection speed | mm/min | operator |
| `#69` | Z-axis safe height | mm | operator |
| `#70` | Z lift distance. when paused | mm | operator |
| `#73` | Arc-interpolation algorithm |  | operator |
| `#74` | Soft-arc algorithm linear error | mm | operator |
| `#75` | Circular centrifugal acceleration | mm/s2 | operator |
| `#76` | Macro scan switch |  | operator |
| `#77` | Macro program file main program No. |  | operator |
| `#90` | Action selection before starting |  | operator |
| `#91` | Z-axis movement mode during pause |  | operator |
| `#93` | Pause and Resume Mode |  | operator |
| `#220` | Go to home before processing? |  | operator |
| `#221` | Ref speed of arc with radius 5mm | mm/min | operator |
| `#222` | 4th-axis protection speed | mm/min | operator |
| `#223` | 5th-axis protection speed | mm/min | operator |
| `#224` | G73/G83 drilling retraction | mm | operator |
| `#230` | Execute action after Finished |  | operator |
| `#253` | Is FRO valid for G0? |  | operator |
| `#280` | Line corner acceleration | mm/s2 | operator |
| `#281` | J parameter of S-type acceleration curve | mm/s3 | operator |
| `#282` | G00 ACC | mm/s2 | operator |
| `#295` | Feed rate maximum value | % | operator |

### `-m5` — Spindle

| param | name | unit | edit |
|---|---|---|---|
| `#79` | Spindle interface type |  | operator |
| `#80` | Spindle mapping axis |  | operator |
| `#81` | Spindle start delay | S | operator |
| `#82` | Maximum spindle speed | rpm | operator |
| `#83` | Ignore the S command |  | operator |
| `#84` | Stop spindle when program is paused? |  | operator |
| `#85` | Default spindle speed | rpm | operator |
| `#88` | Multi-speed section counts |  | operator |
| `#89` | Spindle stop delay | S | operator |

### `-m6` — IO

| param | name | unit | edit |
|---|---|---|---|
| `#92` | Duration of M8/M9 commands | S | operator |
| `#94` | Duration of M10/M11 commands | S | operator |
| `#95` | IO input filter time width | ms | operator |
| `#96` | Reset IO Configuration bit01-16 |  | operator |
| `#97` | Reset IO Configuration bit17-21 |  | operator |
| `#98` | Alarm output status configuration bit 01-16 |  | operator |
| `#99` | Alarm output status configuration bit 17-21 |  | operator |
| `#210` | K1 key Function | OUT | operator |
| `#211` | K2 key Function | OUT | operator |
| `#212` | K3 key Function | OUT | operator |
| `#213` | K4 key Function | OUT | operator |
| `#214` | K5 key Function | OUT | operator |
| `#215` | K6 key Function | OUT | operator |
| `#216` | K7 key Function | OUT | operator |
| `#217` | K8 key Function | OUT | operator |
| `#218` | K9 key Function | OUT | operator |
| `#219` | K10 key Function | OUT | operator |
| `#231` | K11 key Function | OUT | operator |
| `#232` | K12 key Function | OUT | operator |
| `#233` | K13 key Function | OUT | operator |
| `#234` | K14 key Function | OUT | operator |
| `#251` | K15 key Function | OUT | operator |
| `#252` | K16 key Function | OUT | operator |
| `#264` | Alarm output enable configuration bit 01-16 |  | operator |
| `#265` | Alarm output enable configuration bit 17-21 |  | operator |
| `#272` | extern key 1 Function |   | operator |
| `#273` | extern key 2 Function |   | operator |
| `#274` | extern key 3 Function |   | operator |
| `#275` | extern key 4 Function |   | operator |
| `#276` | extern key 5 Function |   | operator |
| `#277` | extern key 6 Function |   | operator |

### `-m7` — Home

| param | name | unit | edit |
|---|---|---|---|
| `#100` | Home mode |  | ⚠ privileged |
| `#101` | Servo absolute laps at the X-axis Home | r | operator |
| `#102` | Servo absolute laps at the Y-axis Home | r | operator |
| `#103` | Servo absolute laps at the Z-axis Home | r | operator |
| `#104` | Servo absolute laps at the 4th-axis Home | r | operator |
| `#105` | Servo absolute laps at the 5th-axis Home | r | operator |
| `#106` | Homing cycle count |  | operator |
| `#107` | X-axis homing speed | mm/min | operator |
| `#108` | Y-axis homing speed | mm/min | operator |
| `#109` | Z-axis homing speed | mm/min | operator |
| `#110` | 4th-axis homing speed | deg/min | operator |
| `#111` | 5th-axis homing speed | deg/min | operator |
| `#112` | X-axis homing direction |  | operator |
| `#113` | Y-axis homing direction |  | operator |
| `#114` | Z-axis homing direction |  | operator |
| `#115` | 4th-axis homing direction |  | operator |
| `#116` | 5th-axis homing direction |  | operator |
| `#117` | Maximum error of home  switch | mm | operator |
| `#118` | Second precision positioning speed | mm/min | operator |
| `#122` | Mach position after X go home | mm | operator |
| `#123` | Mach position after Y go home | mm | operator |
| `#124` | Mach position after Z go home | mm | operator |
| `#125` | Mach position after 4th go home | deg | operator |
| `#126` | Mach position after 5th go home | deg | operator |
| `#127` | Home after booting |  | operator |
| `#235` | X-axis Mach zero offset | mm | operator |
| `#236` | Y-axis Mach zero offset | mm | operator |
| `#237` | Z-axis Mach zero offset | mm | operator |
| `#238` | 4th-axis Mach zero offset | mm | operator |
| `#239` | 5th-axis Mach zero offset | mm | operator |

### `-m8` — Probe

| param | name | unit | edit |
|---|---|---|---|
| `#128` | Is the Floating tool set valid? |  | operator |
| `#129` | Floating tool set thickness | mm | operator |
| `#130` | Is the fixed tool set valid? |  | operator |
| `#131` | Probing cycle count |  | operator |
| `#132` | Initial speed of Probing |  | operator |
| `#135` | Fixed probe X mach pos | mm | operator |
| `#136` | Fixed probe Y mach pos | mm | operator |
| `#137` | Fixed probe Z mach pos | mm | operator |
| `#138` | Fixed probe 4th mach pos | deg | operator |
| `#139` | Fixed probe 5th mach pos | deg | operator |
| `#140` | Retraction distance after the end of probe | mm | operator |
| `#141` | Z safety height before tool setting(mach) | mm | operator |

### `-m9` — Hard Limit

| param | name | unit | edit |
|---|---|---|---|
| `#150` | Stop mode when X-axis hard limit trigger |  | operator |
| `#151` | Stop mode when Y-axis hard limit trigger |  | operator |
| `#152` | Stop mode when Z-axis hard limit trigger |  | operator |
| `#153` | Stop mode when 4th-axis hard limit trigger |  | operator |
| `#154` | Stop mode when 5th-axis hard limit trigger |  | operator |

### `-m10` — Software limit

| param | name | unit | edit |
|---|---|---|---|
| `#155` | Enable software limits |  | ⚠ privileged |
| `#156` | Stop mode when X-axis software limit trigger |  | operator |
| `#157` | Stop mode when Y-axis software limit trigger |  | operator |
| `#158` | Stop mode when Z-axis software limit trigger |  | operator |
| `#159` | Stop mode when 4th-axis software limit trigger |  | operator |
| `#160` | Stop mode when 5th-axis software limit trigger |  | operator |
| `#161` | Negative X-axis software limit | mm | operator |
| `#162` | Negative Y-axis software limit | mm | operator |
| `#163` | Negative Z-axis software limit | mm | operator |
| `#164` | Negative 4th-axis software limit | deg | operator |
| `#165` | Negative 5th-axis software limit | deg | operator |
| `#166` | Positive X-axis soft limit | mm | operator |
| `#167` | Positive Y-axis soft limit | mm | operator |
| `#168` | Positive Z-axis soft limit | mm | operator |
| `#169` | Positive 4th-axis soft limit | deg | operator |
| `#170` | Positive 5th-axis soft limit | deg | operator |

### `-m11` — MPG

| param | name | unit | edit |
|---|---|---|---|
| `#171` | Enable MPG control |  | operator |
| `#172` | MPG precision |  | operator |
| `#173` | Enable ESTOP signal on MPG |  | operator |
| `#174` | Electric level of ESTOP on MPG |  | operator |
| `#175` | MPG Dir |  | operator |
| `#176` | Handwheel X1 speed | mm/min | operator |
| `#177` | Handwheel X10 speed | mm/min | operator |
| `#178` | Handwheel X100 speed | mm/min | operator |
| `#179` | Handwheel stop adjustment increment value |  | operator |
| `#180` | Handwheel change adjustment increment value |  | operator |
| `#181` | X-axis hand wheel manual Acc | mm/s2 | operator |
| `#182` | Y-axis hand wheel manual Acc | mm/s2 | operator |
| `#183` | Z-axis hand wheel manual Acc | mm/s2 | operator |
| `#184` | 4th-axis hand wheel manual Acc | deg/s2 | operator |
| `#185` | 5th-axis hand wheel manual Acc | deg/s2 | operator |

### `-m13` — Backlash

| param | name | unit | edit |
|---|---|---|---|
| `#190` | Enable X-axis backlash |  | operator |
| `#191` | Enable Y-axis backlash |  | operator |
| `#192` | Enable Z-axis backlash |  | operator |
| `#193` | Enable 4th-axis backlash |  | operator |
| `#194` | Enable 5th-axis backlash |  | operator |
| `#195` | X-axis backlash distance | mm | operator |
| `#196` | Y-axis backlash distance | mm | operator |
| `#197` | Z-axis backlash distance | mm | operator |
| `#198` | 4th-axis backlash distance | deg | operator |
| `#199` | 5th-axis backlash distance | deg | operator |
| `#200` | Backlash speed | mm/min | operator |
| `#400` | H01 tool length offset | mm | operator |
| `#401` | H02 tool length offset | mm | operator |
| `#402` | H03 tool length offset | mm | operator |
| `#403` | H04 tool length offset | mm | operator |
| `#404` | H05 tool length offset | mm | operator |
| `#405` | H06 tool length offset | mm | operator |
| `#406` | H07 tool length offset | mm | operator |
| `#407` | H08 tool length offset | mm | operator |
| `#408` | H09 tool length offset | mm | operator |
| `#409` | H10 tool length offset | mm | operator |
| `#410` | H11 tool length offset | mm | operator |
| `#411` | H12 tool length offset | mm | operator |
| `#412` | H13 tool length offset | mm | operator |
| `#413` | H14 tool length offset | mm | operator |
| `#414` | H15 tool length offset | mm | operator |
| `#415` | H16 tool length offset | mm | operator |
| `#420` | D01 tool Radius offset | mm | operator |
| `#421` | D02 tool Radius offset | mm | operator |
| `#422` | D04 tool Radius offset | mm | operator |
| `#423` | D04 tool Radius offset | mm | operator |
| `#424` | D05 tool Radius offset | mm | operator |
| `#425` | D06 tool Radius offset | mm | operator |
| `#426` | D07 tool Radius offset | mm | operator |
| `#427` | D08 tool Radius offset | mm | operator |
| `#428` | D09 tool Radius offset | mm | operator |
| `#429` | D10 tool Radius offset | mm | operator |
| `#430` | D11 tool Radius offset | mm | operator |
| `#431` | D12 tool Radius offset | mm | operator |
| `#432` | D13 tool Radius offset | mm | operator |
| `#433` | D14 tool Radius offset | mm | operator |
| `#434` | D15 tool Radius offset | mm | operator |
| `#435` | D16 tool Radius offset | mm | operator |

### `-m14` — Tools

| param | name | unit | edit |
|---|---|---|---|
| `#800` | Current tool No. |  | operator |
| `#801` | Total number of tools |  | operator |
| `#802` | Tool magazine type |  | operator |
| `#803` | The virtual Tool function turned on? |  | ⚠ privileged |
| `#805` | Automatic tool setting after tool change? |  | operator |
| `#806` | The highest pos when chang Tool | mm | operator |
| `#807` | The low pos when chang Tool | mm | operator |
| `#808` | X-axis tool change front Mach position | mm | operator |
| `#809` | Y-axis tool change front Mach position | mm | operator |
| `#810` | Z-axis tool change front Mach position | mm | operator |
| `#811` | Spindle move speed when changing the tool | mm/min | operator |
| `#812` | Z-axis lifting speed when changing the tool | mm/min | operator |
| `#813` | Move the magazine speed horizontally | mm/min | operator |
| `#814` | Spindle lock output delay | ms | operator |
| `#815` | Go to the  position before the tool change |  | operator |
| `#816` | X mach pos when manually changing the tool | mm | operator |
| `#817` | Y mach pos when manually changing the tool | mm | operator |
| `#818` | Z mach pos when manually changing the tool | mm | operator |
| `#819` | Z axis downward movement speed | mm/min | operator |
| `#820` | Pushing start X mach pos | mm | operator |
| `#821` | Pushing start Y mach pos | mm | operator |
| `#822` | Push delay | ms | operator |
| `#823` | Pushing end X mach pos | mm | operator |
| `#824` | Pushing end Y mach pos | mm | operator |
| `#825` | Pushing completed X mach pos | mm | operator |
| `#826` | Pushing completed Y mach pos | mm | operator |
| `#827` | Push speed | mm/min | operator |
| `#830` | T01 X mach pos | mm | operator |
| `#831` | T02 X mach pos | mm | operator |
| `#832` | T03 X mach pos | mm | operator |
| `#833` | T04 X mach pos | mm | operator |
| `#834` | T05 X mach pos | mm | operator |
| `#835` | T06 X mach pos | mm | operator |
| `#836` | T07 X mach pos | mm | operator |
| `#837` | T08 X mach pos | mm | operator |
| `#838` | T09 X mach pos | mm | operator |
| `#839` | T10 X mach pos | mm | operator |
| `#840` | T11 X mach pos | mm | operator |
| `#841` | T12 X mach pos | mm | operator |
| `#842` | T13 X mach pos | mm | operator |
| `#843` | T14 X mach pos | mm | operator |
| `#844` | T15 X mach pos | mm | operator |
| `#845` | T16 X mach pos | mm | operator |
| `#850` | T01 Y mach pos | mm | operator |
| `#851` | T02 Y mach pos | mm | operator |
| `#852` | T03 Y mach pos | mm | operator |
| `#853` | T04 Y mach pos | mm | operator |
| `#854` | T05 Y mach pos | mm | operator |
| `#855` | T06 Y mach pos | mm | operator |
| `#856` | T07 Y mach pos | mm | operator |
| `#857` | T08 Y mach pos | mm | operator |
| `#858` | T09 Y mach pos | mm | operator |
| `#859` | T10 Y mach pos | mm | operator |
| `#860` | T11 Y mach pos | mm | operator |
| `#861` | T12 Y mach pos | mm | operator |
| `#862` | T13 Y mach pos | mm | operator |
| `#863` | T14 Y mach pos | mm | operator |
| `#864` | T15 Y mach pos | mm | operator |
| `#865` | T16 Y mach pos | mm | operator |
| `#870` | T01 Z mach pos | mm | operator |
| `#871` | T02 Z mach pos | mm | operator |
| `#872` | T03 Z mach pos | mm | operator |
| `#873` | T04 Z mach pos | mm | operator |
| `#874` | T05 Z mach pos | mm | operator |
| `#875` | T06 Z mach pos | mm | operator |
| `#876` | T07 Z mach pos | mm | operator |
| `#877` | T08 Z mach pos | mm | operator |
| `#878` | T09 Z mach pos | mm | operator |
| `#879` | T10 Z mach pos | mm | operator |
| `#880` | T11 Z mach pos | mm | operator |
| `#881` | T12 Z mach pos | mm | operator |
| `#882` | T13 Z mach pos | mm | operator |
| `#883` | T14 Z mach pos | mm | operator |
| `#884` | T15 Z mach pos | mm | operator |
| `#885` | T16 Z mach pos | mm | operator |
| `#890` | T01 X offset | mm | operator |
| `#891` | T02 X offset | mm | operator |
| `#892` | T03 X offset | mm | operator |
| `#893` | T04 X offset | mm | operator |
| `#894` | T05 X offset | mm | operator |
| `#895` | T06 X offset | mm | operator |
| `#896` | T07 X offset | mm | operator |
| `#897` | T08 X offset | mm | operator |
| `#898` | T09 X offset | mm | operator |
| `#899` | T10 X offset | mm | operator |
| `#900` | T11 X offset | mm | operator |
| `#901` | T12 X offset | mm | operator |
| `#902` | T13 X offset | mm | operator |
| `#903` | T14 X offset | mm | operator |
| `#904` | T15 X offset | mm | operator |
| `#905` | T16 X offset | mm | operator |
| `#910` | T01 Y offset | mm | operator |
| `#911` | T02 Y offset | mm | operator |
| `#912` | T03 Y offset | mm | operator |
| `#913` | T04 Y offset | mm | operator |
| `#914` | T05 Y offset | mm | operator |
| `#915` | T06 Y offset | mm | operator |
| `#916` | T07 Y offset | mm | operator |
| `#917` | T08 Y offset | mm | operator |
| `#918` | T09 Y offset | mm | operator |
| `#919` | T10 Y offset | mm | operator |
| `#920` | T11 Y offset | mm | operator |
| `#921` | T12 Y offset | mm | operator |
| `#922` | T13 Y offset | mm | operator |
| `#923` | T14 Y offset | mm | operator |
| `#924` | T15 Y offset | mm | operator |
| `#925` | T16 Y offset | mm | operator |
| `#930` | T01 Z offset | mm | operator |
| `#931` | T02 Z offset | mm | operator |
| `#932` | T03 Z offset | mm | operator |
| `#933` | T04 Z offset | mm | operator |
| `#934` | T05 Z offset | mm | operator |
| `#935` | T06 Z offset | mm | operator |
| `#936` | T07 Z offset | mm | operator |
| `#937` | T08 Z offset | mm | operator |
| `#938` | T09 Z offset | mm | operator |
| `#939` | T10 Z offset | mm | operator |
| `#940` | T11 Z offset | mm | operator |
| `#941` | T12 Z offset | mm | operator |
| `#942` | T13 Z offset | mm | operator |
| `#943` | T14 Z offset | mm | operator |
| `#944` | T15 Z offset | mm | operator |
| `#945` | T16 Z offset | mm | operator |
| `#973` | Virtual tool Z offset 01 | mm | operator |
| `#974` | Virtual tool Z offset 02 | mm | operator |
| `#975` | Virtual tool Z offset 03 | mm | operator |
| `#976` | Virtual tool Z offset 04 | mm | operator |
| `#977` | Virtual tool Z offset 05 | mm | operator |
| `#978` | Virtual tool Z offset 06 | mm | operator |
| `#979` | Virtual tool Z offset 07 | mm | operator |
| `#980` | Virtual tool Z offset 08 | mm | operator |
| `#981` | Virtual tool Z offset 09 | mm | operator |
| `#982` | Virtual tool Z offset 10 | mm | operator |
| `#983` | Virtual tool Z offset 11 | mm | operator |
| `#984` | Virtual tool Z offset 12 | mm | operator |
| `#985` | Virtual tool Z offset 13 | mm | operator |
| `#986` | Virtual tool Z offset 14 | mm | operator |
| `#987` | Virtual tool Z offset 15 | mm | operator |
| `#988` | Virtual tool Z offset 16 | mm | operator |
| `#989` | Virtual tool Z offset 17 | mm | operator |
| `#990` | Virtual tool Z offset 18 | mm | operator |
| `#991` | Virtual tool Z offset 19 | mm | operator |
| `#992` | Virtual tool Z offset 20 | mm | operator |
| `#999` | coordinate offset method |  | operator |

### `-m15` — System

| param | name | unit | edit |
|---|---|---|---|
| `#240` | Language |  | operator |
| `#241` | Enable buzzer feedback |  | operator |
| `#244` | Enable realtime toolpath |  | operator |
| `#245` | Toolpath mode |  | operator |
| `#247` | Interpolation period | S | operator |
| `#248` | LOGO display time | S | operator |
| `#266` | Serial 1 baud rate |  | ⚠ privileged |
| `#267` | Serial 2 baud rate |  | ⚠ privileged |
| `#268` | External keyboard type |  | ⚠ privileged |
| `#269` | Debug printing enable |  | operator |
| `#278` | USB keyboard type |  | ⚠ privileged |
| `#279` | Modbus RTU |  | ⚠ privileged |
| `#284` | Network boot mode |  | ⚠ privileged |
| `#296` | Serial 2 Parity method |  | ⚠ privileged |
| `#297` | Serial 2 Stop bits |  | ⚠ privileged |
