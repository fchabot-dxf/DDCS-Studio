# Machine Primitives Map — the cross-controller HAL (do this BEFORE wizard translation)

> The DDCS Studio wizards don't really "do probing/ATC" — they compose a small set
> of **machine primitives** (probe a wall, read the trigger, check success, write a
> work offset, toggle an output pin, prompt the operator). Each target controller
> spells those primitives differently. **Map the primitives once per controller and
> every wizard becomes mechanical substitution.** This is the substrate; wizards ride
> on it. It is also what **distribution** needs: a user configures their machine's
> ports once, and the studio emits correct macros for their controller.
>
> Confidence tags: `[CODE]` proven from our DDCS source · `[DUMP]` read from a target's
> real macro/source in `*/assets/` · `[DOCS]` from the target's documentation ·
> `[TO CONFIRM]`. Cross-ref `../../PORTING-GRBL-MACH3.md` and each `*/FINDINGS.md`.

---

## 0. The abstraction surface (what a wizard is allowed to ask for)

A wizard targets these primitives, never a controller's raw syntax:

`probeMove · probeTrigger · probeOK · probePin · setWorkOffset · readMachinePos ·
feed · tool(current/target) · toolTable · outPin · inPin · operatorMsg ·
flow(branch) · units/mode`

Studio already has the seed of this: `controllerProfiles.js` (per-controller metadata),
`probeBlocks.js` (`AXIS_VARS`), and the `sources`/`ctrl` "read from controller" fields
(`PROBE-CONFIG-SOURCE.md`). The port generalizes that into a **controller HAL**: one
abstract machine model → a concrete binding table per controller (below).

## 1. Probing primitives

| primitive | DDCS `[CODE]` | grbl `[DOCS]` | Mach3 `[DUMP M901]` | Mach4 `[DUMP lua]` | UCCNC `[DUMP M6]`/`[DOCS]` |
|---|---|---|---|---|---|
| probe move | `G31 X#8 F#3 P#5 L0 Q1` | `G38.2 X.. F..` | `Code "G31 X"&d*Dmax` | `G31` via gcode + `mc.ISIG_PROBE` | `exec.Code("G31 X..")` |
| trigger position | `#1925/#1926/#1927` (machine) | `[PRB:x,y,z]` on serial → **host** | `GetVar(2000/2001/2002)` | `ProbeStrikePosition(axis)` | `exec.Getvar(5061/5062/5063)` `[TO CONFIRM]` |
| success / status | `#1920/#1921/#1922 != 2` | `[PRB:..:1]` flag → **host** | probe LED `GetOemLED(825)` + contact test | `mc.ISIG_PROBE` state | `exec.GetLED(probe)` / contact test |
| probe input pin | `P#5` (port number param) | `$6` invert + fixed probe pin (hw) | Ports&Pins → input → `OEMLED 825` | `mc.ISIG_PROBE` signal mapping | I/O setup port/pin |
| no-contact = error | `IF #1920!=2 GOTO1` | `G38.2` ALARM (host catches) | VBScript `If Abs(Res-…)<.01` | Lua check on strike | C# check on `Getvar` |

**Key split:** DDCS/Mach3/Mach4/UCCNC read the trigger **in-program**; **classic grbl**
returns it **over serial to the host**, so its probe wizards compile to a host routine.
But **grblHAL and LinuxCNC read the trigger in-program** (`#5061-#5063`, LinuxCNC-style) —
the "grbl" column above is *classic* grbl only; the macro-capable family is **§8**.

## 2. Work coordinate / fixture offset

| primitive | DDCS | grbl | Mach3 | Mach4 | UCCNC |
|---|---|---|---|---|---|
| set work-zero (axis) | `#[#70+ax]=val` (stride-5 `#805+`) | `G10 L20 P1 X..` | `SetOEMDRO(800/801/802,..)` or `G10` | `SetFixtureOffsets(x,y,z)` / `G10` | `G10 L20` / fixture write |
| active-WCS base | `#70` from `#578` index | `G54–G59` | fixture `#5221+` | fixture API | `G54–G59` |
| radius comp | `#101=[#1926 ± #6]` (in macro) | host math | VBScript `XHit+ProbeD/2` | Lua math | C# math |

## 3. Machine state read

| primitive | DDCS | grbl | Mach3 | Mach4 | UCCNC |
|---|---|---|---|---|---|
| machine-coord read | `#1925-27` (probe), `#880-883` | `MPos:` via `?` → host | `GetDRO()` work / `LED16`=machine mode | `mc.mcAxisGetMachinePos` | `exec.GetXmachpos/Ymachpos/Zmachpos` |
| feed get/set | `#3`/`#4` (literal) | `F` word | `GetOEMDRO(818)`/`SetOEMDRO(818)` | `mc.mcCntlGetPoundVar`/gcode | `exec.Code("F..")` |
| units / mode | `G90/G91`, `G21` | `G90/91`, `G20/21` | `Code "G91"`, `GetOEMLED(49)` | gcode + state | `exec.Code("G91")` |

## 4. Tool

| primitive | DDCS | grbl | Mach3 | Mach4 | UCCNC |
|---|---|---|---|---|---|
| current / target tool | `#1300` / `#1504` | — (host) | `GetCurrentTool()` / selected | `mc.mcToolGetCurrent` | `exec.Getcurrenttool()` / `Getnewtool()` / `Setcurrenttool()` |
| tool table (len/dia/slot) | `#1430+` base | — | `GetToolParam(t,n)` | `mc.mcToolGetData` | `exec.Read/Writetooltablecell(t,col)` |

## 5. Digital I/O — the ports/inputs to model (distribution-critical)

| primitive | DDCS | grbl | Mach3 | Mach4 | UCCNC `[DUMP M6]` |
|---|---|---|---|---|---|
| output pin set/clear | M-code (`M154/M155` drawbar; `M162/163` cover) | `M62-65` (grblHAL aux) | `ActivateSignal(OUTPUTn)` / `DeActivateSignal` | `mc.mcSignalSetState(OSIG_OUTPUTn)` | `exec.Setoutpin(port,pin)` / `exec.Clroutpin(port,pin)` |
| input pin read | status `#19xx` / port | `M66` (grblHAL) / host | `IsActive(INPUTn)` / `GetOemLED` | `mc.mcSignalGetState(ISIG_INPUTn)` | `exec.GetLED(led)` / `Getinpin(port,pin)` |
| sensor wait | `M300-302` | host poll | `While`/`Sleep` loop | Lua poll | `CheckSlot()` LED-poll + debounce |

UCCNC's port↔LED arithmetic is explicit in `M6.txt` (`LEDnum(port,pin)`: P1→LED1-17,
P2→69-85, …). That kind of per-controller pin map is exactly what the HAL binding holds.

## 6. Operator interaction & flow

| primitive | DDCS | grbl | Mach3 | Mach4 | UCCNC |
|---|---|---|---|---|---|
| prompt / confirm | `#1505=1` (and result codes `-5000`) | host UI | `Message` / `Question` | `wx.wxMessageBox` | `exec.AddStatusmessage` / `MessageBox.Show` |
| **where branching lives** | **in-program** `IF/GOTO`,`N` labels | **host** | **VBScript** `Sub/Func/If/While` | **Lua** | **C#** |

This row is the architectural fault line: DDCS keeps logic *in the part program*;
Mach3/Mach4/UCCNC keep it in a *macro language*; grbl keeps it in the *host*. The
toolpath wizards (drill/pocket/slot/surfacing/text) touch **none** of rows 1–6 except
`feed`/`units` — which is why they port trivially everywhere.

## 7. The machine-configuration model (what the USER sets, per machine)

For distribution, these become a controller-agnostic config the user fills once; the HAL
binds each to the target's mechanism:

| config item | binds to (per controller) |
|---|---|
| probe input port/pin | DDCS `#5`/probe var · grbl probe pin+`$6` · Mach3 Ports&Pins · Mach4 `ISIG_PROBE` · UCCNC I/O |
| drawbar / air / dust-cover outputs | DDCS M-codes · grblHAL aux out · Mach3 OUTPUT# · Mach4 `OSIG_OUTPUT#` · UCCNC port/pin |
| slot / tool-setter sensors | input pins as above |
| tool-setter & fixed-plate position | machine coords + offsets |
| active WCS, rack axis/step (ATC) | WCS row + config fields |

Studio's existing `controllerProfiles.js` (`probeVars`, `atc.toolTableBaseVar`,
`hardwareTabs`) is where this config model already starts — extend it to carry the HAL
binding per `dialect`.

## 8. The RS274NGC family — grblHAL & LinuxCNC (closest to DDCS, best for distribution)

grblHAL and LinuxCNC share one G-code idiom (grblHAL's `#5061` is literally tagged
`// LinuxCNC` in `grblHAL-core-src/ngc_params.c`). They are **macro-capable, in-program** —
the opposite of classic grbl — and that idiom is the **closest of any target to DDCS's own**
(in-program `#vars` + flow + `G31`/`#19xx`). **One dialect binding covers both controllers.**

| primitive | RS274NGC family (LinuxCNC / grblHAL) | DDCS equivalent it replaces |
|---|---|---|
| probe move | `G38.2/.3/.4/.5` | `G31 … P L Q` |
| probe trigger (in-program) | `#5061-#5069` (X..W) | `#1925/#1926/#1927` |
| probe success | `#5070` (1/0) | `#1920/#1921/#1922 != 2` |
| set work offset | `G10 L2/L20`, `#5221+` (G54 base), `G92` | `#[#70+ax]=val` (`#805+`) |
| machine / abs pos read | current-pos params (`#5420+`, LinuxCNC) `[TO CONFIRM grblHAL]` | `#880-883` / `#1925-27` |
| digital output | `M62 P`(sync on)/`M63`(off)/`M64`(imm on)/`M65`(off) | `M154/M155`, `M162/163` |
| wait on input | `M66 P L Q` → result `#5399` | `M300-302` |
| tool change / table | `M6` (LinuxCNC: **remap**→Python/NGC; grblHAL: tool_change + toolsetter) + tool table | `#1504/#1300`, `#1430+` |
| flow control | **O-word** `o.. if / while / sub / call / return` | `IF .. GOTO`, `N` labels |
| named params | `#<name>`, `#<_global>` | (numbered only) |
| operator msg | `(MSG,..)`, `(DEBUG,..)` | `#1505` |

⇒ DDCS → RS274NGC-family is nearly a **1:1 idiom map** — the most mechanical port of all
targets, and **free/open** (best for distribution). Caveat: grblHAL's full O-word flow runs
only for **macros on SD/littlefs** (stream mode is limited) — which parallels DDCS shipping
`.nc` to SMB; LinuxCNC has no such limit. Confidence: LinuxCNC `[DOCS]`, grblHAL
`[DUMP grblHAL-core-src]` (`ngc_expr.c`/`ngc_flowctrl.c`/`ngc_params.c`, `gcode.c` M62-M68).

## Status / next

- ✅ Rows 1–6 grounded from real source for DDCS + Mach3 + Mach4 + UCCNC + grbl.
- ⏭ Confirm the `[TO CONFIRM]` cells (esp. UCCNC probe-result var `5061` vs a UCCNC-specific
  field; Mach4 machine-pos/fixture exact calls) against the dumps in `*/assets/`.
- ⏭ Encode this as the HAL binding the `dialect` descriptor carries, then translate the
  first wizard (corner probe) as pure substitution over these primitives.
