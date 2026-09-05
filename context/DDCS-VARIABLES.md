# ⛔ DDCS VARIABLE WRITING — LOOK IT UP BEFORE YOU WRITE IT

⭐ **Shared across seats. Also installed as the `ddcs-variables` skill** at
`Apps/fred-skills/ddcs-variables/SKILL.md` (needs a per-skill symlink in `~/.claude/skills/` to auto-load;
that folder does not exist on CNC-FAIRY).

⛔ **This exists because it already happened.** On 2026-09-05 `#915`-`#918` were used as scratch variables
for several hours across dozens of writes. They are **H16-H19 tool length offsets**. They were left holding
`111.0` and `222.0`. The owner caught it, not any check of ours: *"the variables you're writing — are they
good? they look like syst var."*

⇒ `tools/macro_probe.py` now **refuses** writes to named-dangerous slots outright, and saves/restores the
one parameter it does use (`#1060` = `Pr560`, chosen because it is unnamed in the parameter table AND in no
Param-page section).

# DDCS variable writing — look it up first

## ⭐⭐ THE WHOLE RULE, IN ONE LINE

```
#N   N <  500   ->  SCRATCH.  locals #0-49, globals #50-499.  Nothing here is a machine setting.
#N   N >= 500   ->  Pr(N-500).  A REAL MACHINE PARAMETER.  Look it up before you write it.
```

⭐ Owner, 2026-09-05: *"any parameter below five hundred is for sure not a system parameter."* **Correct**,
and it matches the vendor's own address map. `#916` is `Pr416` — a tool length offset. `#100` is just scratch.

## ⭐ FIRST — WRITING A MACRO? THE SCRATCH IS `#0`-`#499`. USE IT.

| range | what |
|---|---|
| `#0`-`#49` | **subprogram local variables** |
| `#50`-`#499` | **global variables** |

⭐ **These are real scratch. Nothing here is a machine parameter, and none of the warnings below apply.**
⇒ **In macros and injected G-code, compute in `#100`, `#101`, … and the whole problem disappears.**
Owner, 2026-09-05: *"isn't the real scratch simply 001 to 99?"* — **yes, and that is the right instinct.**

⚠ **THE ONE CATCH, and it is the only reason parameters ever come into it:** `#0`-`#499` have **no Modbus
address** (the vendor map lists them `NULL`). A PC reading over Modbus **cannot see them**. So to *observe* a
value from the PC you must land it in a parameter — and that is when everything below starts to matter.
⇒ ⭐ **Keep the parameter footprint to ONE designated, saved-and-restored slot; do the actual work in `#100`+.**

⭐ **THE CATCH IS MEASURED, NOT ASSUMED `[CONFIRMED on machine 2026-09-05]`.** `#100` was set to `12345`
and the register space `0`–`20000` scanned for that value: **65 blocks answered, zero hits.** The value was
definitely there — `#1060 = #100` read back `12345`. ⇒ globals really are invisible to Modbus.
⚠ Only ~1/3 of the scanned range responds at all, so unmapped space could not be searched.

### ✅ THE PROVEN PATTERN — one parameter, one line
```gcode
#100 = [ <whatever you are computing> ]    (scratch: free, safe, invisible to Modbus)
#1060 = #100                                (ONE parameter, only to make it readable from the PC)
```
Demonstrated on the machine: `#1060` (`Pr560`) read `12345.0`. Save its original first and put it back.

## ⛔ THE ONE RULE

**Never write a `#variable` you have not looked up.** Not "probably unused". Not "it read zero".
**Looked up, by name, in a table, this session.**

## ⛔⛔ WHY: THERE IS NO SCRATCH SPACE

Every Modbus-writable macro address on an M350 is a **real machine parameter** or a **system global**:

| macro | Modbus | what it actually is |
|---|---|---|
| `#0`–`#49` | *(none)* | subprogram locals — **not Modbus-visible** |
| `#50`–`#499` | *(none)* | global variables — **not Modbus-visible**, but the ONLY true scratch |
| `#500`–`#1499` | `6500`+ | ⛔ **`Pr0`–`Pr999` — REAL PARAMETERS** |
| `#1500`–`#2499` | `15000`+ | system globals (`#2037` keys, `#2031` line no.) |
| `#2500`–`#2999` | `8500`+ | ⛔ **`Pr1000`–`Pr1499` — REAL PARAMETERS** |

**`macro #N = Pr(N−500)` for the first block.** So `#916` is `Pr416`, and `Pr416` is a **tool length offset**.

⚠ **A value of `0` does not mean unused.** An unset tool offset, an unset backlash, an unused WCS axis and a
free slot all read `0`. Reading zero tells you nothing.

## ⛔ SLOTS THAT LOOK LIKE SCRATCH AND ARE NOT

| range | what it is |
|---|---|
| ⛔ `#900`–`#919` | **H01–H20 tool length offsets.** ⚠ *This is the trap that was actually hit:* `#915`–`#918` were used as scratch for hours; they are H16–H19. A stray `222.0` there is a 222 mm tool offset. |
| ⛔ `#920`–`#939` | D01–D20 cutter comp offsets |
| ⛔ `#800`–`#844` | **the WCS table, G54–G59.** `G54 Z0` is the spoilboard |
| ⛔ `#655`–`#670` | software limits |
| ⛔ `#622`–`#626` · `#735`–`#739` | home / machine zero |
| ⛔ `#575`–`#577` | probe input port and level |
| ⛔ `#766` `#767` `#779` `#796` `#797` | serial baud / Modbus mode / parity / stop bits — **break these and you lose the link** |

## ✅ HOW TO LOOK ONE UP — before every write

1. **`DDCS-Studio/web/data/default_vars.js`** — the parameter table, in **macro** addressing (`916,B,Possibly
   H17 offset mm`). Grep the exact number.
2. **`bridge/controllers/expert-m350/PARAM-PAGE-MAP.md`** — which Param-page **section** owns it. ⭐ Tell the
   owner the section name, not just a number.
3. **`bridge/controllers/expert-m350/assets/vendor-spec/M3xx_Modbus_Address_Map_V1_0.xlsx`** — the vendor's
   own block map and endianness (`CDAB`).

## ✅ THE SAFE PATTERN

- **Compute in `#50`–`#499`** (true globals) inside injected/macro code. Nothing there is a parameter.
- To *observe* a value over Modbus you must land it in a parameter, because globals are not mirrored.
  ⇒ **Pick ONE slot, verify it by name, write it down, and SAVE/RESTORE:** read the original, use it,
  put the original back.
- **Announce** any write to a protected range and get the owner's agreement first.
- Prefer **reads**. Almost every question can be answered by reading.

## ⚠ ALSO

- The value encoding is **word-swapped float32 (`CDAB`)** everywhere, including integers-in-floats.
- ⛔ **Virtual keys (`#2037`) only fire when the assignment is EXECUTED as G-code.** Writing the mirror
  register does nothing.
- ⛔ Injected G-code takes **no trailing newline** — the vendor's own tool sends none, and adding one makes
  lines silently fail to execute.
