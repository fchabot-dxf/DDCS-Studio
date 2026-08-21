# DDCS Expert (M350) — Findings (the real target)

**Machine:** DDCS Expert M350 on the Ultimate Bee 1010 (studio). **Not on the home LAN.**
Most knowledge here is from **documentation** (official Expert manual + Russian community Modbus
docs + a scope capture), so much is `[CONFIRMED via docs]` / `[VERIFY ON MACHINE]` rather than
bench-proven. **Do not assume V4.1 findings carry over** — see [`../README.md`](../README.md).

> Tags: `[CONFIRMED]` · `[CONFIRMED via docs]` · `[VERIFY ON MACHINE]` · `[TO TEST]` · `[HYPOTHESIS]`.

---

## ⛔ Macro-parser quirks — `[CONFIRMED on machine 2026-08-17]` (t2070, controlled A/B on CNC-FAIRY)

Two forms the **sim accepts but the real Expert REJECTS** — both surfaced because looped ops (surfacing / pocket /
contour / holecycle / slot / drill / bore) emit them, so those ops errored on hardware while passing in the sim.

1. **`N`-LABELS MUST START AT COLUMN 0.** A leading space before a label is a hard `syntax error`, even though
   indented *statements* are fine (this **refines V15**: indent tolerated for statements, NOT for labels). Proven by
   A/B: `N50` flush-left inside a `WHILE…DO` loop parses; the identical line as `  N50` (2 spaces) throws
   `syntax error L5`. This is why every looped op failed — the emit indents inside loops, so labels landed indented.
   **FIXED:** the DDCS dialects now carry `flushIndent: true`, so `emitMapped` forces the existing
   `applyIndentStyle('flush')` pass (column-0) for the whole family — Expert verified, V4.1/V3-DM500 applied
   unverified (only the Expert is hardware-testable). The `flush` style was literally built as this fallback
   (`data/indentStyle.js`: "if a controller turns out to balk at leading whitespace…").

2. **INLINE `IF <cond> THEN <assignment>` IS REJECTED** — the Expert does `IF <cond> GOTO <label>` only, never
   `IF x > y THEN x=y`. **Answers the open V12 question: NO.** The surfacing/holecycle depth/row clamps
   (`IF #z > #depth THEN #z=#depth`, `IF #n < 1 THEN #n=1`) emit this form → rejected. **FIXED (node-verified,
   ⚠ HARDWARE RE-CHECK PENDING):** `blockEmitter.applyInlineClampSkip` rewrites each clamp to the equivalent
   GOTO-skip (`IF #z <= #depth GOTO<L>` / `#z=#depth` / `N<L>`) for DDCS dialects (label above the base-91 pool,
   flushed per (1)). Provably logic-equivalent; **load a generated surfacing on the Expert and confirm it parses
   AND cuts before trusting a real job.**

The sim models neither column position nor the inline-THEN rejection, so both slipped through until a bench load.

---

## Serial = Modbus RTU ⭐ (the rich channel, Expert-only)
- RS232 port is **MAX3232, ±6V true RS-232** (scope-confirmed +8V=0/−8V=1) → the **SABRENT FTDI
  cable is the correct adapter.** `[CONFIRMED via docs + scope]`
- **Data is on port 2** (TXD2/RXD2). **Port 1 (TXD1/RXD1) = M3K keyboard** (reserved). 8N1, no parity.
  Controller is Modbus **MASTER** by default. `[CONFIRMED via docs]`
- Macros (run from G-code):
  - `MSETDATA[X1,X2,X3,X4,X5,X6]` — write controller vars #50–#499 → slave registers.
  - `MGETDATA[...]` — read slave registers → vars #50–#499.
  - Args: X1=start var, X2=slave#, X3=start **register address**, X4=length in **bytes** (reg=2 bytes),
    **X5 = Modbus function code** (16=write-multiple per the MSETDATA example; 1=read in the MGETDATA
    example), X6=var receiving the **exception code** (0=OK). Controller pauses ~16 s for a reply.
  - ⚠️⚠️⚠️ **`MGETDATA` = REFUTED on this firmware — it wedges the ANALYZER, not the serial link.
    `[CONFIRMED 2026-06-10, fw 2025-06-19-00 — A9-b]`** Re-tested with every excuse removed: pymodbus
    3.6.9 slave on COM6 **bench-validated answering fc 1/3/4/16**, registers seeded, **cable confirmed
    plugged**, motion-free macro. The controller froze at **"analysis10..."** and the slave received
    **ZERO frames** — the request is never sent; the hang is in the **analysis phase before any serial
    I/O**. ⇒ no slave configuration can ever fix it; **do not run `MGETDATA` on this firmware, period**
    (each attempt = a reboot). This corrects the 06-06 diagnosis ("slave didn't answer" — same zero-frame
    analysis-freeze, so the slave was never the variable). `MSETDATA` (outbound push) passes analysis and
    transacts fine — it remains the proven-safe direction. **Inbound-while-running has NO working channel
    on the Expert** (see A8/A9 in EXPERIMENTS): the dispatcher needs **one physical Start input (C1)**.
  - ⭐ **Each var #50–#499 carries exactly ONE byte (decimal 0–255)** — `MSETDATA` byte-packs them
    two-per-register. To move a value >255 (e.g. an error code), split/join with **`MDATA2BYTE`** /
    **`MBYTE2DATA`** across consecutive vars. `[CONFIRMED via RU manual `Инструкция.txt` 2026-06-06]`
  - Manual example: `#200=7 #201=8 #202=9 #203=10` → `MSETDATA[200,1,5,4,16,300]` (4 bytes → 2 regs @ addr 5).
  - Function codes: 01H coils, 02H discrete in, 03H holding, 04H input.
  - **PC slave ready:** `tools/modbus_slave.py` (pymodbus 3.13) logs every frame + the hi/lo byte split of
    each register; `tools/MODBUS_TEST.nc` is a motion-free push test. Run: `--port COM6 --baud 115200 --slave 1`.
- Scope capture confirmed `MSETDATA[200,1,6,12,15,300]` transmits #200…#203 as Modbus frames. `[CONFIRMED via scope]`
- ⭐⭐ **LIVE Modbus PC↔Expert CONFIRMED 2026-06-06** (CNC-FAIRY COM6 ↔ port 2, pymodbus 3.6.9 slave):
  `MSETDATA[200,1,0,4,16,300]` with `#200..#203 = 11,22,33,44` arrived as **WRITE HOLDING addr=0 =
  [5643, 11297]**. ⇒ confirmed: **115200 8N1, slave id 1; X5=16 → write-multiple HOLDING regs; X3 = register
  address; byte packing is LITTLE-ENDIAN within a register (first var = LOW byte, next = high).** So reg =
  `#(n+1)<<8 | #n`. The PC-slave readback channel is proven end-to-end. (pymodbus 3.13 broke the classic
  datastore — **pin `pymodbus==3.6.9`**.)
- ⭐⭐ **SABRENT FTDI cable CONFIRMED LIVE on the real port-2 link** (studio test) — the ferrule blocker is
  cleared; the SABRENT is the working PC↔Expert serial adapter on the physical machine, not just bench/scope.
  **Required to transact: `#279` Modbus-RTU = enable + a REBOOT** (with `#279`=NO the port is silent).
  `[CONFIRMED on machine]`
- **Which machine ran it:** the studio **`CNC-FAIRY`** Toughbook (SABRENT on **COM6**, the SMB/Modbus host).
  The other studio PC is the **ASUS A15 TUF** (hostname **`Fred-ASUS-TUF`** — this repo's dev box). **`renderranchy`
  is NOT a studio machine** — it is the **home/bench workstation** (V4.1 @ `10.0.0.x`); see
  [`../ENVIRONMENTS.md`](../ENVIRONMENTS.md). The Expert is **not** on the home LAN — re-confirm exact COM
  port + the macro/slave log next time on-site.
- **Homebrew architecture:** PC runs a **Modbus SLAVE**; the DDCS (master) pushes status vars (#200+,
  incl. error/exception) via `MSETDATA` and reads commands via `MGETDATA`. Bidirectional, documented.

### Params — read off the real machine `[CONFIRMED on machine 2026-06-06, fw 2025-06-19-00]`
Photographed the **System → param list** on the studio Expert (model **DDCSE-5T-standard**, panel
"DDCS Expert V1.1", **Software Ver 2025-06-19-00**, HW 2021-1213-23). Confirmed numbers on THIS firmware:

| # | Name (as shown) | Value seen | Notes |
|---|---|---|---|
| `#266` | **Serial 1 baud rate** | `B115200` | Serial 1 = M3K keyboard port |
| `#267` | **Serial 2 baud rate** | `B115200` | **Serial 2 = Modbus data port** |
| `#268` | **External keyboard type** | `other` | set to `M3K` to enable the M3K keypad (port 1) |
| `#278` | USB keyboard type | `keyboard` | |
| `#279` | **Modbus RTU** | `NO` | ⭐ **RESOLVED: #279 IS the Modbus-RTU enable** (not "Barcode file location" as the official manual claimed) — set to enable Modbus. **`#279`=enable + a REBOOT are REQUIRED for the live serial link** `[CONFIRMED on machine via SABRENT live test]` — with `#279`=NO the port does not transact. |
| `#284` | **Network boot mode** | `Close` | ⭐ set to **manu-IP** to bring the Ethernet up (Cable IP shows "Disconnect" while Close) |
| `#296` | **Serial 2 Parity method** | `None` | → Serial 2 = **8N1** |
| `#297` | **Serial 2 Stop bits** | `1` | → Serial 2 = **8N1** |

⇒ Modbus port-2 framing is confirmed **115200 8N1** straight off the panel. "Restart takes effect" for
network/serial params. The Param page has a **Search** soft-key and a **`#50-#499`** (uservar) viewer.

- **Reboot** after serial/network param changes. `[CONFIRMED via docs + panel note "Restart takes effect"]`

## Firmware internals (Expert NAND backup `nand1-1`, static analysis 2026-06-06)
From the `ddcs-expert` skill's `firmware-backup-2025-12-31/.../nand1-1/`. Expert SoC ≠ V4.1
(W55FA93/ARMv5): the Expert uses **i.MX-class UARTs** — `/dev/ttymxc1`, `/dev/ttymxc2` — plus
`/dev/ttySP0`, `/dev/ttySP1`. (Ghidra: ARM LE; confirm core from the ELF header — likely ARMv7.)
- **`parse.out`** (~2.9 MB, the Expert app/parser) — **handles Modbus serial in *userspace*** (unlike
  V4.1, whose app has no serial). Opens `ttymxc1`/`ttymxc2`, sets baud via `cfsetispeed`/`cfsetospeed`;
  strings: `OpenSERIAL01/02`, `SetupSerial`, `Enter Uart0/Uart1 modbus communication`,
  `Uart0/Uart1 modbus parameter address err`. ⇒ the documented `MSETDATA`/`MGETDATA` channel is here and
  **decompilable in Ghidra** to pin the exact **port↔Uart mapping, baud, and frame format**. `[lead]`
- **`pidMonitor.out`** (~0.6 MB) — process/watchdog monitor; not serial-relevant.
- **M3K keypad: NOT in userspace** — `parse.out` reads `/dev/input/event*` (no `M3K`/keypad strings),
  same as V4.1's `ddcsv4.out`. ⇒ the M3K serial→keystroke driver is **kernel-level on the Expert too**;
  its protocol is **not recoverable** from these binaries (would need the kernel/rootfs partition or a
  real M3K to sniff).
- ⇒ **Trigger reality:** M3K-serial is a dead end on both controllers (kernel-level). **Expert autonomy
  = `sysstart` (boot) + Modbus (`parse.out`, real & decompilable) + `#2037`.** V4.1 = **External Start
  input** (hardware).

## RS232 connector pinout + wiring `[CONFIRMED via manual]`
DB-9 **female** on the controller (manual §4.7, `assets/Modbus_RS232_DDCSE/Распиновка разъёма.pdf`):

| Pin | Signal | Pin | Signal |
|---|---|---|---|
| 1 | 5V | 6 | 5V |
| 2 | **RXD1** | 7 | **RXD2** |
| 3 | **TXD1** | 8 | **TXD2** |
| 4 | (not connected) | 9 | GND |
| 5 | GND | | |

- **Modbus (PC↔Expert) = port 2, 3 wires (bidirectional):** SABRENT **TX(3)→RXD2(pin 7)**,
  **RX(2)←TXD2(pin 8)**, **GND(5)↔GND(pin 9 or 5)**. MAX3232 ±6 V → SABRENT correct.
- **M3K keypad = port 1** (RXD1 pin 2 / TXD1 pin 3), enabled by **`#268 = M3K`** at **115200**
  (`#266`/`#267`). ⇒ **the M3K runs at 115200** — first hard number on the keypad (protocol still
  kernel-level, but baud is known now). `[CONFIRMED via manual]`
- Note: this pinout (RXD1=2, TXD1=3, RXD2=7, TXD2=8) is the authoritative one; the V4.1 send-tests
  used RXD1=3 (which is actually TXD1) — invalid pin — though V4.1's M3K is kernel-level anyway.

## Network (differs from V4.1)
- Expert supports **manual IP only**. Defaults: controller `192.168.0.99`, host `192.168.0.100`.
- `#284 "Network boot mode"` options are **`Close` / `auto` / `manu`** — set to **`manu`** (static),
  then System Set → "Set IP Addr" (Cable + Host). **Restart takes effect.** `[CONFIRMED on machine 2026-06-06]`
  - While `#284=Close` the cable NIC is **off** (System Info shows "Cable IP: Disconnect" and the
    Cable-IP field is uneditable). Setting `manu` + reboot brings it up. The PC NIC stays
    `Disconnected` (link-down) until the controller NIC powers on.
- `network.conf` (on SYSDISK) stores the manual IPs as plain text (line2=Cable IP, line3=Host IP).

## ⭐ SMB file access — CONFIRMED on the real machine `[CONFIRMED 2026-06-06, fw 2025-06-19-00]`
The **V4.1 SMB recipe works as-is on the Expert** (PC reads/writes the controller's disk). Setup that worked
on the studio Toughbook **CNC-FAIRY** (fresh Win11): static `192.168.0.100/24` on the wired NIC; enable SMB1
client + `EnableInsecureGuestLogons $true` + `BlockNTLM $false` (admin + reboot); then
`net use \\192.168.0.99\IPC$ /user:guest ""` and **map the shares to drive letters** (raw-UNC
`Test-Path \\ip\sysdisk` is flaky under SMB1-guest — `net use S: \\192.168.0.99\SYSDISK` works).
- Shares: **`CNCDISK`** + **`SYSDISK`** (same names as V4.1). Server = "Arm Linux Samba Server", netbios `CNC-PDA`.
- **`smb.conf`** (read off SYSDISK): `security = share`, **`guest account = root`** (guest = full root access),
  **`SYSDISK → /mnt/nand1-1/`** (the same `nand1-1` mount as the firmware backup — `parse.out` lives here),
  **`CNCDISK → /local/`**, both **`writeable = yes`**.
- **Read AND write CONFIRMED** end-to-end (round-trip write/read/delete on CNCDISK from the PC).
- ⇒ The PC↔Expert file channel is fully bidirectional — the V4.1 dispatcher trick (overwrite a loop file
  over SMB) should port directly. Net Disk (controller-mounts-PC) is a *separate* option, not needed for this.
- **`uservar` lives on CNCDISK** here (`/local/uservar`, **3601 B = 450×f64 + 1 trailing byte**), NOT on
  SYSDISK as on the V4.1 (3200 B). **Slot map `slot = #var − 100` CONFIRMED** by decoding live values over
  SMB (operator test writes 111/222/…/888 landed exactly on `#150,#151,#200,#250,#350,#450,#520,#521`).
  ⇒ **Expert `uservar` range = #100–#549** (450 slots; bigger than V4.1's #100–#499). The PC reads controller
  state by decoding this file as little-endian f64 — `[CONFIRMED readback 2026-06-06]`. Slot 0 = byte 0 (no header).
- **System params live in two more SYSDISK f64 files — the PC can read #0–#1499 over SMB, not just `uservar`:**
  - **`SYSDISK/setting`** (8000 B = **1000×f64, index == PARAM #**) → persisted system params. ⚠️ **THE SETTING FILE
    IS NOT THE MACRO ADDRESS SPACE:** a G-code macro reads the param **500 below** it. So the G54 offset table `#805 +
    [WCS−1]*5` (MACRO numbers, what you type) lives at **param #305+ = `setting[305]`**, and the active-WCS macro `#578`
    is param **#78 = `setting[78]`**. **Bench-confirmed (t2067):** the `20260731` dump has G54 at `setting[305..307]`
    = `50.13 / −665.70 / −47.28` while `setting[805]` = `0`. The param↔index mapping is `[CONFIRMED]` by
    `tools/diff_setting.py` differential toggles; `ops.py _map_geometry_to_profile` uses the correct base (`_WCS_BASE
    = 305`). ⚠️ **The trap that bit us:** `ops.py _var_value` used to read `setting[#var]` (= `setting[805]` = 0) →
    the "G54 pulls 000 but the machine has one" bug; fixed to `setting[#var − 500]` (t2067, `test_var_value_2067.py`).
    **`SYSDISK/default_setting`** is the factory baseline of the same layout → diff `setting` vs `default_setting` =
    **which params the operator actually changed** (160 differ on the studio rig).
  - **`SYSDISK/camsetting`** (4000 B = **500×f64, slot = #var − 1000**) → the ATC/CAM tables #1000–#1499:
    current tool `#1300`, capacity `#1301`, pocket X/Y/Z `#1330/#1350/#1370`, tool-length table `#1430+`.
    Slot map `[CONFIRMED]` by the captured boundary sentinels (`#1000`=222.111 · `#1050`=222.222 · `#1099`=222.333 ·
    `#1100`=333.111 · `#1300`=333.222 · `#1499`=333.333) in `assets/capture/20260610T163337Z/SYSDISK/camsetting`.
  - ⇒ `ops.py read_vars` decodes uservar (#100–549) + setting (#0–999, with `default_setting` → `userSet` flag) +
    camsetting (#1000–1499); #1500+ stays runtime/unreadable. Studio's "Pull from controller" import reads pockets,
    tool lengths and WCS from these. Same lazy-snapshot caveat as `uservar` (flush at run start/end — Save before pull).
- Run-state hidden files exist on SYSDISK: per-program **`.<name>.nc.pos`** (60 B each) and **`.break0/.break1`**
  (breakpoint-resume) — same family as the V4.1 run-state files. `[TO TEST what they track]`
- ⚠️ **`uservar` file ↔ RAM is TWO-WAY ISOLATED while running (A9-a `[CONFIRMED 2026-06-10]`):**
  (1) a PC SMB-write into `uservar` (e.g. `#150=88` mid-loop) **never reaches a running macro's RAM** —
  the macro keeps seeing the old value (loop + `IF [#150==88] GOTO` syntax independently proven via a
  self-priming check that flipped to MDI instantly); (2) a macro's own var write (`#151=1`) was **still
  absent from the file after `M30`** — the disk file is a **lazy snapshot** (flush trigger unknown,
  `[TO TEST]` reboot/shutdown/periodic). ⇒ qualifies the 06-06 readback finding: uservar-over-SMB is
  fine for *eventually-persisted* state but is **NOT live readback** (use `MSETDATA` checkpoints) and is
  **NOT an inbound command channel** (remaining inbound: `MGETDATA` with a proven slave, or a physical input).
- **MDI buffer is RAM, not the file (A8 `[CONFIRMED 2026-06-10]`):** the live MDI line is **`SYSDISK/mdi.nc`**
  (10 B, one block; `SYSDISK/mdiblock` = a 720 B fixed-slot MDI *history*). Overwriting `mdi.nc` over SMB does
  **not** change what the panel runs — navigating to the MDI page still shows the panel's RAM line, and it
  never auto-runs. ⇒ **`mdi.nc` is panel OUTPUT, not input** (on navigation); MDI-file injection is **not** a
  remote-trigger channel (same RAM-vs-disk lesson as the dispatcher note below). *Untested:* read-at-boot.

## ⚠️ Dispatcher: Expert `M47` ≠ V4.1 `M47` — the V4.1 loop trick does NOT port `[CONFIRMED 2026-06-06]`
The V4.1 software dispatcher relies on `M47` = **"restart program from top"** (firmware built-in) so an
`M47` self-loop re-reads the file each cycle. **On the Expert, `M47` is a different macro entirely** —
defined in the `slib-m.nc` M-code library as `O10047`, a **count-and-conditionally-pause** routine:
```
O10047  #701=#701+1  #702=#702+1  #1506=47
        IF #702==#703 GOTO1  / GOTO2
   N1   #702=0  #1505=1(msg)  #1620=1(pause/feed-hold)  G04 P500
   N2
```
### "M99 loop?" — RESOLVED by static analysis 2026-06-06: the file-overwrite dispatcher does NOT port
Question: is there an Expert construct that **re-reads the job file from disk each cycle** (the property the
V4.1 `M47` self-loop dispatcher depends on, so a PC SMB-overwrite injects new code)? Answer: **no confirmed one.**
- **DDCS loops = `IF/GOTO N<label>`** (CORE_TRUTH-confirmed) → these re-execute the **already-loaded** code
  in RAM; a PC file-overwrite is invisible to a running looped program. Same for an `M99` main-loop.
- **`M98 P<n>` resolves an `O<n>` label from the loaded libraries in RAM**, NOT a per-call disk read —
  proven: `sysstart`'s `M98 P501` → `O501` lives in `slib-g.nc` (a boot-loaded library), and `O501` is the
  per-axis homing/zero-search sub. So an `M98`-loop dispatcher also won't see overwrites (for library subs).
- **No `slib-m.nc` M-code restarts/re-selects the program** (all are plain `M99`-terminated subs); `M47` is
  the count/pause macro above, byte-identical in the factory backup.
⇒ **Do NOT port the V4.1 file-overwrite/self-loop dispatcher to the Expert.** The only file-based path that
re-reads disk is a **per-cycle Start trigger** (V4.1 confirms Start re-reads the file) — i.e. not zero-touch.
**For true autonomy on the Expert, use the documented design instead:** `sysstart.nc` boot-bootstrap +
**Modbus `MGETDATA`** (controller pulls commands from the PC slave — live inbound, no file hack) + SMB for
job-file delivery + `uservar`/`MSETDATA`/`error.nc` for readback. (Modbus blocked on the ferrule.)

## Macro / param internals over SMB `[CONFIRMED 2026-06-06]`
- **`setting` lives on `\\192.168.0.99\SYSDISK\setting`** (= `/mnt/nand1-1/setting`), **NOT on CNCDISK** —
  resolves the PROFILE_BUILD_TASK `[TO TEST]`. Size **8000 B = 1000×f64** (vs V4.1's 1500×f64), confirming
  the Expert prediction. `default_setting` (factory baseline, 8000 B) sits beside it — a ready diff anchor.
  `[CONFIRMED on machine 2026-06-10]` (`_read_setting_params()`'s `<expert_dest>/setting` must point at SYSDISK.)
- **Phase-1 unattended capture LANDED 2026-06-10** — read-only SMB mirror of both shares (193 files, 15 MB)
  in `assets/capture/20260610T163337Z/` (`SYSDISK/` + `CNCDISK/`, manifest with sha256). Re-decoding the
  captured `setting` reproduced every known anchor exactly: `#266/#267`=4 (B115200), `#279`=1 (Modbus on),
  `#284`=2 (manu net-boot), `#296/#297`=0/0 (8N1) ⇒ decode + indexing trustworthy for new indices.
- **`setting` file = 1000×f64, index = param #** (8000 B). Decodes over SMB and matches the panel:
  baud code **4 = B115200**; `#284` Net-boot **0=Close / 1=auto / 2=manu**; `#296`=0 (parity None),
  `#297`=0 (1 stop bit) → 8N1. WCS offsets live here too (`#805+[WCS−1]*5`). ⇒ PC can read **all persisted
  config + WCS**, not just `uservar`. (`#325`=garbage here — param numbering is controller-specific.)
- **`slib-m.nc` = M-code library:** each M-code → subprogram **`O(10000+code)`** (M0=O10000 … M30=O10030,
  M47=O10047, M50-M62=O10050-62). User-overridable. `M30` (O10030): `M5 M9 M11` + conditional return to
  `Z#569`/`X0Y0` per `#730`. **`slibuser.nc`**: user G-code `G199` = `G90 G01 X#6Y#7Z#8 F#15`.
- `parse.out` (live, 2.99 MB) references `sysstart.nc` + `M30` as strings (boot hook real). `MSETDATA`/
  `MGETDATA` are NOT plain-ASCII in it (wide-char/tokenized?) — revisit when wiring Modbus.

## ⭐⭐ Profile I/O map — the full param dictionary is on the controller (`cfg_utf8`) `[CONFIRMED 2026-06-10]`
The Phase-1 capture landed **`SYSDISK/cfg_utf8`** (73 KB) — the controller's **complete param schema**: one
line per param `#<n> -pN -aN -tN -s1"<label>" -s2"<unit>" -mN -min=.. -max=.. -i0".." -i1".."`. This is the
Rosetta Stone for `setting`: it labels every index, so the profile I/O map is **desk work off the capture,
no differential toggling needed.** (`chs`/`msg` are the localized string catalogs; `cfg_utf8` is the schema.)

**Input signals are the `-m16` group (range 0–24 = physical input port #, `0` = unassigned).** Each input
occupies a **triple of consecutive indices: `[port#, enable, active-level]`** — `enable` reads `1` on every
assigned input, `active-level` (at **port+2**) is the polarity; an unassigned input reads `[0,0,0]`. The
**+2 level offset was pinned by a live differential toggle 2026-06-10**: flipping the Fixed-Probe level on the
panel moved **`#577`** `0→1` (only boolean change; the float noise in that diff was position/WCS state flushed
to disk by the Save — `setting` is written wholesale). Output signals are the `-m17` group (range 0–20).

**Active-level encoding:** the panel field toggles **"N" / "P"** = **Negative / Positive electric level**
(active-low vs active-high — same sense as the `#12-21` "...port electric level" params). Value **`0` = "N"
(negative / active-low)**, **`1` = "P" (positive / active-high)** — confirmed on the Fixed Probe (restored
level `0` = "N"). `[CONFIRMED on machine 2026-06-10]`

### Confirmed I/O for the studio Expert (Ultimate Bee), decoded from the captured `setting`:
| Port param | Signal (cfg_utf8 label) | port | enable (`+1`) | level (`+2`) | Notes |
|---|---|---|---|---|---|
| `#575` | **Fixed Probe** (tool-setter) | **2** | 1 | `#577` | ⭐ **panel-confirmed = IN02**; level index toggle-confirmed |
| `#578` | **Floating Probe** (3D touch) | **10** | 1 | `#580` | ⭐ **panel-confirmed = port 10** |
| `#515` | X− hard limit | 20 | 1 | `#517` | shares pin 20 with X-zero |
| `#518` | Y− hard limit | 0 | 0 | — | unassigned |
| `#521` | Z− hard limit | 0 | 0 | — | unassigned |
| `#530` | X+ hard limit | 0 | 0 | — | unassigned |
| `#533` | Y+ hard limit | 23 | 1 | `#535` | shares pin 23 with Y-zero |
| `#536` | Z+ hard limit | 21 | 1 | `#538` | shares pin 21 with Z-zero |
| `#545` / `#548` / `#551` | X / Y / Z zero (home) | 20 / 23 / 21 | 1 | +2 each | |
| `#500` / `#503` / `#506` | X / Y / Z servo alarm | 0 | 0 | — | unassigned (steppers, no feedback) |
| `#623` `#626` `#629` `#697` | Tool release/lock/open/close in (M301-304) | 0 | 0 | — | **all unassigned → no ATC** |
| `#750` `#753` | Tool release-lock / launch-retract out | 0 | 0 | — | **all unassigned → no ATC** |

⇒ **`hardwareTabs` for this machine = `["probes","limits"]`, ATC OFF** — confirmed from real I/O, exactly as
PROFILE_BUILD_TASK predicted (Ultimate Bee = manual tool change). Other useful schema params for the future:
`#133` Probe Tool block thickness, `#135-139` Fixed-probe mach pos X/Y/Z/4/5, `#140` probe retract,
`#150-154` hard-limit stop mode, `#155` enable soft limits, `#161-168` soft-limit values, `#95` IO input
filter time. The decision logic is general (these param #s are firmware-defined; the *values* are per-machine
wiring) — so the gateway can map any same-firmware Expert, and the values here are this machine's truth.

### Macro I/O dialect — read input / set output / wait `[CONFIRMED from slib-m.nc factory M-code library 2026-06-18]`
The Expert exposes I/O to a **running program** directly — this is what the V4.1 lacks (HL-TNC told a customer "4.1 no, Expert yes", and a Facebook thread confirmed it). The `-m16` params above are the pin *assignment*; the live *state* is a separate variable range:
- **Read input N (live state):** `#[1520 + N − 1]`  (IN01=`#1520` … IN24=`#1543`). So `IF #1536==1 GOTO10` reads IN17 — exactly the "`IF #xxxx==1 GOTO`" people ask for.
- **Set output N:** `#[1551 + N] = 1` (on) / `= 0` (off) — proven by `O10050`(=M50)→`#1552=1`, `O10051`→`#1552=0`, … (OUT01=`#1552` … OUT20=`#1571`).
- **Wait-for-input idiom** (verbatim from the built-in sensor-waits `O10300`–`O10307`):
  ```
  WHILE [#[1520+N-1] != L] DO1
    G04 P10            ( poll )
  END1
  ```
  ⇒ the Expert has a real **`WHILE … DO1 … END1`** loop, not just `IF/GOTO`.
- **Named sensor-waits** (block until a *function* input matches, port/enable/level read from a param triple then the WHILE-poll above): `M300` spindle-stopped · `M301/2` drawbar released/clamped · `M303/4` magazine open/closed · `M305/6` **gripper open/closed** · `M307` servo in-pos.
⇒ This **supersedes the "inputs are config-only" framing above.** The forum gripper case (actuate output + wait IN17/IN18, no motion) IS doable on the Expert. Open item: `G04 P` units (`P10` poll vs `P1.0`=1 s elsewhere) — confirm on-machine. This dialect is the basis for Studio's planned **I/O atoms** (`setOutput`/`waitInput`/`dwell`/`jump`) → general automation builder, Expert-capability-gated.

> ⚠️ **Namespace caution:** these are **`setting`-file param indices**, a DIFFERENT address space from the
> runtime **macro `#` variables**. E.g. `setting#578` = *Floating Probe port*, but macro `#578` = *active WCS
> number* (below); `setting#576` = *Fixed-Probe level*, but panel Pr76/macro `#576` = *Macro Enable*. Don't
> cross-read them. The profile map is entirely in the `setting`/`cfg_utf8` (param) space.

## System / macro variables (read off the operator's live macros 2026-06-06) `[CONFIRMED on machine]`
From `READ_VAR.nc`, `COPY_WCS.nc`, `SAVE_WCS_XY_AUTO.nc`, `sysstart.nc` on this machine:
- `#578` = **active WCS number** (1=G54 … 6=G59). **WRITABLE — `#578=2` switches WCS** (V4, 2026-06-19).
- `#880` / `#881` = **current machine X / Y position**. (`sysstart` does `#883=#881` for gantry A←Y sync.)
- **WCS offset block:** base `= 805 + [WCS−1]*5`; within a block **X=base, Y=base+1, A=base+3**
  (G54 = #805–809, G55 = #810–814, …). `#1518` = "A homed" flag.
- **On-screen message:** `#1505 = -5000(text with %f)`, args in `#1510` / `#1511`.
- **Numeric input prompt:** `#2070 = <var>(prompt text)` — pauses for operator entry into that var.
- Indirect addressing works: `#[#100]` reads the var whose number is in `#100` (used for the var-reader).
- More vars from `slib-m.nc`: `#1506` = current M-code indicator, `#1620` = **feed-hold/pause flag**,
  `#701/#702/#703` = counter / counter / limit (M47 count macro), `#730` = end-of-program return mode
  (0/1/2 — **this machine = 0 ⇒ M30 does NOT move**, 2026-06-19), `#569` = safe-Z return height (**=5.0 here**),
  `#624` = G53 Z return. `IF/GOTO/Nlabel` + `G04 P<ms>` dwell.

## Control
- ⭐ `#2037` **virtual buttons** press any of 201 panel functions from a running macro
  (`#2037 = 65536 + [KeyValue − 1000]`). **`[CONFIRMED ON MACHINE 2026-06-10, fw 2025-06-19-00]`** — a
  PC-delivered macro (`A7b_BUTTON_ONEWAY.nc`) pressing **MDI page (KeyValue 1348)** switched the live screen
  to MDI and stayed; the macro ran (`.pos` written). Earlier round-trip (`1373`→`1348`→`1373`, Monitor↔MDI)
  hid the effect by ending on the start page — use a **one-way** press for an unambiguous test. Codes in the
  skill's `Virtual_button_function_codes_COMPLETE.xlsx` (1348 MDI, 1373 Monitor verified). Add `G04 P<s>`
  between presses. Subject to the one-program-at-a-time rule. ⇒ **navigation / file-select / start are now
  software-drivable on the Expert — no M3K, no ESP32** (the A7 experiment, archived).

## Autonomy outlook — the Expert is a superset of the V4.1
The V4.1 bench proved a **software dispatcher**: an `M47` self-loop re-reads its file from disk each
cycle, so the PC injects jobs by overwriting the loop file over SMB (one bootstrap Start needed).
**⚠️ That specific trick does NOT port — see "M99 loop? RESOLVED" above** (`M47` is redefined; `IF/GOTO`
and `M98` loop in RAM, not from disk). The Expert reaches autonomy a **different, documented way** — and
still with **zero added hardware**:
- **Zero-touch bootstrap:** `sysstart.nc` auto-runs at boot → it can launch the `M47` dispatcher with
  no manual/External Start at all. `[CONFIRMED via docs that sysstart auto-runs; dispatcher TO TEST]`
- **Second inbound channel:** Modbus **`MGETDATA`** (controller pulls commands from a PC slave) — a
  live bidirectional path independent of the file trick. `[CONFIRMED via docs]`
- **Real fault readback:** `error.nc` fires "when system abnormal working." `[CONFIRMED via docs]`
- **Panel control:** `#2037` virtual buttons. `[CONFIRMED]`

**Plan:** develop + harden the dispatcher and PC orchestrator on the V4.1 (safe, working), then deploy
to the Expert. **Verify on the actual machine `[TO TEST]`:** file-reload / `M47`-reread holds here;
`sysstart` sustains the loop; SMB disk access vs Net-Disk-only; which system var holds the alarm code.

## Macro hooks — official install-file description `[CONFIRMED via docs]`
From the DDCS-Expert "install file description". These auto-run / are invoked by the firmware:
- **`sysstart.nc`** — *"Boot initialization file — can modify it."* Auto-runs at **boot**. This is the
  Expert's hands-free entry point (the dispatcher-bootstrap candidate). **Absent on V4.1.** **Operator-
  customizable, and HAS been customized on this machine** — the live file read 2026-06-06 is *not* the
  factory default. Factory default (per docs) was `M115` (built-in homing) → `G04 P1.0` → sync. The
  **current live `sysstart.nc`** (operator-modified) homes each axis via a subprogram instead:
  ```
  (Start Homing Sequence)
  M98 P501 X2   (Home Z)
  M98 P501 X0   (Home X)
  M98 P501 X1   (Home Y)
  #883 = #881   (gantry sync A<-Y, after motion stops)
  #1518 = 1     (mark A homed)
  M30
  ```
  ⇒ confirms `sysstart.nc` auto-runs at boot AND is freely editable — **the place to bootstrap a
  PC-fed dispatcher**. `M115`/`M98 P501` are Expert homing; the **V4.1 has no `M115`** (`G128`/`M105-108` there).
- **`error.nc`** — *"When system abnormal working, system will execute this file."* A **system-fault /
  alarm** hook (NOT a G-code syntax-error hook — see V4.1 findings; program errors won't trigger it).
- **`pause.nc`** (pause), **`key-1.nc`…`key-7.nc`** (K1–K7), **`ext_button.nc`** + **`extnc0/1/2-N.nc`**
  (self-design buttons: release / short-press / long-press), **`probe.nc`**, **`fndX/Y/Z/A/B.nc`** +
  **`fndzero.nc`** (go home), **`gotozero.nc`** (go work zero), **`T.nc`/`ALL_T.nc`** (tool change),
  **`slib-g.nc`/`slib-m.nc`/`slibuser.nc`** (G / M / user libraries), **`absX..B.nc`**.
- `advstart.nc` is **not** in the Expert list (it's a V4.1 file — the "Advanced Start" feature).

## ⭐ Run-state / alarm system variables — the readback backbone `[CONFIRMED via variable-map xlsx 2026-06-06]`
From `DDCS_Variables_mapping_2025-01-04.xlsx` (skill), cross-checked against `slib-m.nc`/`slib-g.nc`:
- **`#1630`–`#1636` = Analyze channel 1–7 STATUS: `-1` Idle / `0` Working / `1` Pause** (the executor's
  run-state). **⚠️⚠️ DANGER: reading `#1630` from inside a running program WEDGES the analyzer** — froze
  "analysis" hard, Reset would not clear, **required a reboot** (observed 2026-06-06, `PUSH_RUNSTATE.nc`
  froze *before* its MSETDATA — slave got nothing). DO NOT read `#16xx` analyze-channel internals from a
  normal job. Reading one's *own* channel status is self-referential and locks the parser. A cross-channel
  watchdog *might* read another channel's status, but that's unproven and risky — **do not blind-test it
  live** (each wedge = a reboot). Treat `#1630` as write-only-by-firmware for now.
- **`#1620`–`#1626` = Analyze channel 1–7 EXECUTION method:** `0`=Start/Restart, `1`=Internal Pause,
  `2`=External Pause. Writing these *commands* a channel. ⇒ corrects the earlier note: `M47` (`O10047`)
  does `#1620=1` = "request internal pause on channel 1" (not a generic feed-hold flag).
- **Servo alarm signals:** `#1000`(X) `#1003`(Y) `#1006`(Z) `#1009`(4th) `#1012`(5th); system alarm out `#1236`.
- Per-axis analyzing-vs-manual mark: `#1800`–`#1804`. Error key-indicator: `#1931`.
- ⚠️ **The Expert has 7 parallel "analyze channels."** This is the architecture for a non-blocking watchdog:
  run the job in one channel, a status-pusher in another. **Single-channel readback is dangerous** — the
  `MGETDATA`/`MSETDATA` ~16 s blocking wait can **wedge the channel hard enough to require a reboot**
  (observed 2026-06-06: a bad test macro froze "analysis", Reset would not clear it). `[CONFIRMED]`
- **NOTE:** no single "last syntax-error code + line" variable was found in the map. The on-screen
  System Log shows `syntax error: Ln` but is **not** persisted to a readable file. ⭐ **Re-proven at the
  CONTENT level 2026-06-10** (not just mtimes, which this Samba reports as garbage 1969 dates): full
  **sha256 diff of ALL 193 files on both shares** before/after a live syntax error (`gg55q` via MDI) →
  the **only** changes were `mdi.nc` (the typed line) + `mdiblock` (its history echo) — i.e. the MDI
  *input* buffer, **zero error-record output anywhere**. ⇒ exact syntax-error text/line is **definitively
  not remotely readable via the filesystem**; the error lives only on `/dev/fb0`. Detect failure via
  checkpoint sentinels + `.pos` (did-it-run); to read the *text/line*, the only path is **D2 (HDMI
  capture + OCR)**.
- **`.<name>.nc.pos`** is created/updated only when a program actually RUNS (errored-at-parse programs
  leave none) → a pollable "did it execute" flag over SMB. `[CONFIRMED 2026-06-06]`

### ✅ The SAFE readback pattern — CHECKPOINT SENTINELS — PROVEN LIVE `[CONFIRMED 2026-06-06]`
`CHECKPOINT_TEST.nc` ran on the real machine: it set `#250 = 1/2/3` and `MSETDATA`'d at each step; the PC
slave received all three frames (`[28417],[28418],[28419]` = bytes `1,111 / 2,111 / 3,111`), **no wedge,
near-instant** (the ~16 s is a timeout, not a forced pause — it returns as soon as the slave replies). So
the bridge's core goal is demonstrated: **the PC tracks how far a job got; the last checkpoint received =
the last line reached before any stop/error.** This is the readback design — checkpoint sentinels, NOT
reading executor internals:
- The PC-pushed job sets `#250 = <checkpoint id>` then `MSETDATA[250,1,0,2,16,300]` at safe points
  (after header, after each phase, just before `M30`). The PC slave sees how far it got — last checkpoint
  received = last line reached before any stop/error. No system-var reads → no wedge.
- A **syntax error** means the job never runs → zero checkpoints arrive AND no `.pos` is written → PC
  infers "failed to parse." (Exact line still only on the System Log screen.)
- **Hardware/system alarms:** route through **`error.nc`** (fires on "system abnormal") — have it set a
  user var and `MSETDATA` it. `[TO TEST carefully — error.nc content + whether MSETDATA is safe there]`
- Reading plain I/O/alarm vars like `#1000` may or may not be safe — **untested in isolation** (the
  PUSH_RUNSTATE wedge read `#1630` first, so we can't blame `#1000` yet). Don't blind-test live.

## ⭐ Syntax-error PREVENTION (PC-side linter) — the practical answer to "see syntax errors" `[2026-06-06]`
The controller's `syntax error:L<n>` is **yacc-generated** (`parse.out` = Berkeley yacc 1.9; format `:L%d[%s]`;
tracks `Line %d` + `Col %d`) and rendered to **`/dev/fb0` (the screen)** — **NOT** written to any file we can
read over SMB (verified: nothing on SYSDISK/CNCDISK updates on a syntax error; the `msg`/`msg1`/`msg2` files
are the static *string catalog*, not a log). ⇒ the error text **cannot be read remotely**. So the practical
move is to **catch errors before they reach the machine**: `tools/ddcs_lint.py`, a PC-side linter grounded in
parse.out's real vocabulary + the `ddcs-expert` skill's CORE_TRUTH quirks + our live hazards. **Validated
against ~70 production + factory macros: clean except one genuine bug it caught.** Flags:
`E-NESTPAREN` (nested `()` in a comment — the bug that wedged `MGETDATA_TEST`), `E-BRACKET` (unbalanced `[]`),
`E-GOTOSPACE` (`GOTO 1`), `E-MARGS` (wrong `MSETDATA/MGETDATA` arg count), `E-CH1630` (reading `#1630-#1636`,
the analyzer wedge), + warnings (FANUC ops, G10, bare-const G53, `#2070`→persistent, priming).

### DDCS comment syntax — CONFIRMED 2026-06-06
- **Two comment styles:** `(...)` **and `;` to end-of-line** (`macrob-programming-rules.md`: "Style 3
  Semicolon (RECOMMENDED)"; 714 uses across the production corpus). Both valid.
- **`(...)` comments CANNOT NEST** — `(text (inner) more)` closes at the first `)`, leaving the rest as garbage
  → parser error on the NEXT line. **This is exactly what wedged `MGETDATA_TEST.nc`.**

### Pr76 / #0076 / #576 "Macro Enable" — REQUIRED to run macros `[CONFIRMED]`
Must be **Open**; machine reads **#576 = 1 (Open)** ✓. Numbering: panel **Pr76** = ENG **#0076** = macro-addr **#576**.

## ⚠️⚠️ V1 RESULT — `G10 L20` is BROKEN **and DANGEROUS** (axis word → motion) `[CONFIRMED on machine 2026-06-19, fw 2025-06-19-00]`
Ran `verify/V1_G10_WCS.nc` (motion-free by design, scratch G59 P6, save/restore `#830`). It **moved the
machine unexpectedly.** The on-screen numbers settle it:
- Pre-`G10`, machine X = **5.000** (message showed `expect = #880−25 = −20.0000`).
- The single line **`G10 L20 P6 X25`** drove Mach X **5.000 → 73.286**, Abs X → **25.000** on **G54**
  (G54 X offset ≈ 48.286, so the move went to *work* X25 = 48.286+25 = 73.286).
- `#495` read `#830 = 42.65` ≠ machine−25 ⇒ **G10 wrote NO offset to G59.**
⇒ **The Expert does not honor `G10 L20 P<n>` as a work-offset write.** It ignores `G10/L20/P`, and under
the active **G90/G01** modal the leftover **`X25` executes as a positioning move**. This is worse than a
no-op — **an emitted `G10 L20 … X..` MOVES the axis.** Confirms the skill's "G10 broken" and upgrades it to
**unsafe**. ⇒ **Dialect rule: NEVER emit `G10 L20`/`G10 L2` with axis words.** Set WCS offsets by **direct
register write** (`#[805+(WCS−1)*5] = #880 − target`), the COPY_WCS/SAVE_WCS_XY_AUTO house style.
- **Methodology note:** there is **no safe way to test G10's offset-write with an axis word** — the axis word
  always risks motion. The G59-scratch/save-restore guard protects the *offset registers* but **cannot
  prevent the motion** the stray axis word triggers. Future G10 probing must be done with the axis already
  parked AT the target (zero-distance move) or not at all.
- ⚠️ **Reconcile the dump's probe macros (`3D PROBE G55.nc`, `key-5/6.nc` use `G10 L20 P2 Z[..]`):** by this
  result those lines would *move Z*. Either they are latent-dangerous, or they run only when Z is already at
  the target (zero move), or L2-vs-L20/context differs. **Re-examine before trusting any on-controller G10.**
- ⚠️ **`M30` end-motion hazard re-noted:** aborted via Esc+Reset rather than Enter precisely because `M30`
  (`O10030`) can retract Z→`#569` and go X0/Y0 per `#730` — don't let a test program reach `M30` blind.

## ✅ V4 RESULT — `#578` (active WCS) is WRITABLE → software can switch WCS `[CONFIRMED on machine 2026-06-19, fw 2025-06-19-00]`
Ran `verify/V4_active_wcs.nc` (motion-free, save/restore `#578`). Original WCS = **1** (G54); after `#578 = 2`
the readback was **2**; after restore the readback was **1** (back on G54). ⇒ **`#578` accepts a direct write
and reports the written value** — the dialect can select a WCS by **variable write** (enables computed/indirect
selection, e.g. `#578 = #100`), not only the literal `G55` command. No motion, state restored cleanly.
- **Caveat (one optional follow-up):** confirmed the *variable* is writable + reads back; did NOT *visually*
  confirm the write re-applies offsets (header→G55, Abs recompute) because restore was immediate. To make it
  airtight: write `#578=2`, pause on a message, eyeball the header/Abs, then restore. `[strong but unobserved]`
- ⚠️⚠️ **`#578` does NOT track a G-code WCS command — case (b) CONFIRMED `[CONFIRMED on machine 2026-06-19,
  DIAG_g53setup.nc]`:** ran `G59` (the command); the screen **header switched to G59 and Abs == Mach
  (73.286 / −5.000)** — proving the **G-word DID switch the active runtime frame** — yet **`#578` still read 1**.
  So WCS-select-by-G-command works, but **`#578` only reflects the panel/variable selection, not the modal
  G-word frame.** Direct register write also re-confirmed (`#832=0` read back 0). ⚠️⚠️ **Dialect implications:**
  (1) `readActiveWcs: #578` is **STALE after an in-program `G54..G59`** — do NOT use `#578` to learn the frame a
  running program selected via G-word. (2) Conversely, V4 showed writing `#578` changes the variable, but it is
  now unclear whether a `#578` *write* moves the *modal* frame the G-word controls — **the G-word is the
  reliable way to switch the active frame; `#578` is a separate (panel) selector.** Prefer emitting `G54..G59`
  to switch, and treat `#578` as read-only-ish state that may disagree with the modal frame.
- **`M30` end-move RESOLVED `[CONFIRMED on machine 2026-06-19]`:** `READ_endmode.nc` reported **`#730 = 0`**
  (end-program return mode) and **`#569 = 5.0`** (safe-Z). ⇒ **`M30` does NOT move the machine on this setup** —
  with `#730=0` the `M30`/`O10030` conditional return to `Z#569`/`X0Y0` is skipped. Future test macros may run
  to completion without the Esc-before-M30 guard. (Re-check `#730` if the operator changes the end-program mode;
  `#730`=1/2 would re-enable the retract-to-`#569`-then-X0Y0 move.)

## V3 RESULT — accepted `G53` form (end-program footer / park) `[on machine 2026-06-19, fw 2025-06-19-00]`
Tested in a borrowed **zero-offset G59 scratch frame** (so the commanded Z = current Z under either G53
behavior → provably no motion; human-gated on header=G59 + Abs==Mach). Forms:
- **`G53 Z#var` (variable, no G0) → ✅ ACCEPTED** (V3a, ran clean). Matches the dump `snippets.nc` (`G53 Z#99`)
  and the dialect's `machineMove` emit. `[CONFIRMED]`
- **`G53 G0 Z#var` (variable, +G0) → ✅ ACCEPTED** (V3b, ran clean). So **`G0` is optional, not rejected** —
  the skill's `G53 G0 Z#var` and the dump's no-G0 `G53 Z#var` are BOTH valid. `[CONFIRMED]`
- `G53 Z-5` / `G53 G0 Z-5` (literals) → **INCONCLUSIVE** (V3c/V3d). Both safely **aborted at a guard** (no
  motion). Most likely the test's own **range guard** (`IF #487>-4.99` / `IF #487<-5.01`) — a comparison vs a
  **negative DECIMAL literal**, a form not in any confirmed IF example — evaluated always-true → always abort;
  alternatively Mach Z had drifted off −5. **Deprioritized:** the dialect emits `#var`, never a bare literal,
  so literal-G53 acceptance changes no generated code. `[NOT PURSUED]`
⇒ **Net V3 verdict:** `G53 <axis>#var` is accepted **with or without G0** — dialect emit form CONFIRMED. The
  linter's bare-const-G53 warning can stay (literals unverified, and `#var` is house style anyway).
- ✅ **Spin-off RESOLVED:** the "IF vs negative-decimal misbehaves" hypothesis was **REFUTED** on machine
  (2026-06-23, `IF_neg_test.nc`) — negative-decimal compares evaluate correctly. `ifGoto` may emit them. The
  V3c/V3d aborts were the guard/Z-position/Esc, not a parser bug. See CORE_TRUTH discrepancies below.

## V5 RESULT — soft-limit ±9999 = per-axis "no limit" sentinel `[CONFIRMED on machine 2026-06-23, fw 2025-06-19-00]`
Ran `verify/V5_read_softlimits.nc` (read-only, macro `+500` copies of the soft-limit params). Read:
**`#655 enable = 1`** (soft limits **globally ON**), yet **`#661 negX = −9999.0`, `#663 negZ = −9999.0`,
`#668 posZ = +9999.0`** — all the ±9999 sentinel. Matches the dump exactly. ⇒ **±9999 is a per-axis
"this end is unbounded" sentinel that holds EVEN when the global enable (`#655`) is 1** — the global flag
does not imply every axis end is bounded. **Phase-2 envelope rule: treat ±9999 as "no limit" (do NOT draw a
±9999 box); read each end's value, not just `#655`.** Also confirms the macro-space `+500` mapping
(`setting #155→macro #655`, `#161/#163/#168 → #661/#663/#668`). Real (non-sentinel) travel values, if any,
live on the *other* ends (e.g. profile-diff candidates `#162`/`#166`) — not read here. `[CONFIRMED]`

## V8 RESULT — dual-Y gantry: A column mirrors Y in the WCS table `[CONFIRMED on machine 2026-06-23, fw 2025-06-19-00]`
Ran `verify/V8_read_gantry.nc` (read-only). G54 **`#806 Yoff = −665.944`** and **`#808 Aoff = −665.944`** — equal.
⇒ the **A axis tracks Y through the WCS table** (base+3 mirrors base+1), consistent with `sysstart`'s `#883=#881`
gantry sync. **Sim can ignore A/B and treat the machine as X/Y/Z.** (−665.944 also matches the back-computed
G54 Y offset from earlier screenshots — cross-checks the `805+(wcs−1)*5` addressing.) `[CONFIRMED]`

## V6 RESULT (write half) — tool-length offsets are register-writable `[CONFIRMED on machine 2026-06-23, fw 2025-06-19-00]`
Ran `verify/V6_set.nc` (`#900 = 12.5`) and read it on the panel: **Param `#400` "H01 tool length offset" showed
12.5**. ⇒ **macro `#900` = param `#400` = H01 tool-length offset** (the `+500` rule, same family confirmed in V5).
Schema cross-check: `cfg_utf8` `#400 -s1"H01 tool length offset" -s3"G43\G44 Hxx."`; **H01–H16 = params
`#400-#415` = macro `#900-#915`.** ⇒ **the tool-length sim layer can read AND write H-offsets directly by
register** — no `G43` needed for the write; restored to 0 via `V6_restore.nc`. `[CONFIRMED]`
- ⚠️ **Don't confuse with the ATC tool table** (`#1430+`, camsetting / `toolTable:1430`) — that's the
  pocket/magazine length table; `#900-#915` is the **G43/G44 H-code** offset table. Different address space.
- `[TO TEST — needs motion]` **Is `G43 H1` actually HONORED** (applies the offset to subsequent Z), or is it
  ignored so depths must come from direct register math (house style)? The *write* works; whether `G43`
  *applies* it on a move is the deferred motion half of V6.

## DWELL RESULT — `G04` integer P = MILLISECONDS `[CONFIRMED on machine 2026-06-23, fw 2025-06-19-00]`
Ran `verify/DWELL_units.nc` (motion-free, timed two dwells). **`G04 P3000` produced a ~3-4 s pause** (user
hand-counted 4-5 s incl. popup latency) — a real few-second dwell, **NOT** a 3000-second hang. ⇒ **integer
`G04 P<n>` = `<n>` MILLISECONDS, CONFIRMED.** Resolves the `communicationWizard.js:223` "units unconfirmed"
flag and validates the dialect's `dwell: sec => G04 P${sec*1000}` (integer ms) AND the `waitInput` 10 ms poll
(`G04 P10`). No 1000x bug. **Decimal `G04 P3.0` = INSTANT `[CONFIRMED on machine 2026-06-23]`** (user: "p3 is instant").
⇒ **decimal P is NOT seconds — "decimal = seconds" is a MYTH on this firmware.** The Expert treats `P3.0` as
~3 ms (drops/ignores the `.0`), so it returns instantly. **`G04 P` is ALWAYS milliseconds**; the decimal point
does not switch units. **Footgun:** `G04 P1.0` (expecting 1 s) gives ~1 ms (instant), NOT 1 s — corrects the
slib-g.nc `P1.0`=1 s reading and the dialect's old "a decimal P would be seconds" comment.
⇒ **dialect:** keep emitting integer-ms (correct); **linter:** WARN on a decimal `G04 P<x.y>` — it is ~`x` ms
(near-instant), never `x` seconds. To dwell N seconds, emit `G04 P<N*1000>` (integer ms).

## ⚠️ V13 RESULT — two-operand ATAN uses the COMMA form; Studio's SLASH emit is REJECTED `[CONFIRMED on machine 2026-08-08, fw V1.1]`
Ran `verify/V13_trig.nc` → **aborted: `syntax error!:L53 [#605 = [ATAN[1] / [1] * 100]]`** on the ATAN line. Whole-file
reject (safety rule 3) blinded COS/SIN/SQRT — they remain UNTESTED. Then `verify/V13f_atan_comma.nc` (the V4.1 comma
form, unequal operands 1,2) → popup **`ATANC=2657`**. So:
- **Two-operand ATAN EXISTS and is quadrant-correct**, but the accepted syntax is the **COMMA form `ATAN[y, x]`**, NOT
  the Fanuc slash form `ATAN[y]/[x]`. `ATAN[1, 2] = 26.565°` ⇒ **argument order is dy-over-dx, CORRECT (not mirrored).**
- **DEFECT: Studio emits the SLASH form**, which this controller rejects — `data/probeToSlot.js:538` and
  `wizards/alignmentWizard.js:158` both emit `#54=ATAN[#52]/[#53]`. ⇒ **the alignment probe's angle macro has been
  UNPARSEABLE on the Expert** (`Unrecognized file format` on the ATAN line → the whole file never runs). This is the
  `onNo` branch of `trigEvidence.js` `alignment-atan`, and the *which* is now known: **unparseable, not wrong-angle.**
- **Fix (desk task — needs the Playwright suite + golden regen, do NOT half-apply):** switch both emit sites to
  `#54=ATAN[#52, #53]` (comma works on BOTH — V4.1 per S5o/t1583, Expert per V13f). Resolve `trigEvidence.js`
  `alignment-atan`, and flip the emit-asserting specs (`alignment-superset.spec.js`, `cam-slot-sim.spec.js`:
  `ATAN\[#52\]/\[#53\]` → comma). The engine already PARSES comma (`expression.js` t1583), so only the EMIT changes.
- **Still open:** COS / SIN / SQRT on the Expert (the `V13_trig` abort ate them) ⇒ run `V13c_sqrt`, `V13a_cos`, `V13b_sin`.

### CORE_TRUTH (skill) vs factory-firmware reality — discrepancies the linter exposed
- **G10:** skill says "G10 is broken." **V1 (above) CONFIRMS broken + dangerous on this fw** (`G10 L20 P6 X25`
  emitted motion, wrote no offset). Factory `key-5.nc`/`key-6.nc`/`3D PROBE G55.nc` *use* `G10 L20 P2` — so
  either context-guarded (zero-distance) or latent-buggy; **re-examine, do not assume safe.**
- **`#2070` range:** skill says "only #50–#499," but factory `key-4.nc` does `#2070=800` → silent-failure is specific to **persistent** targets, not all >499.
- **Priming bug:** skill says wash the RHS (`#1153=#880+0`); production `O_Save_Safe_Park.nc` instead **primes the target first** (`#1153=1` then `#1153=#880`). Two working approaches — linter accepts both.
- **Real bug found:** skill's `macro_Thread_milling.nc:72` has a bracket imbalance (`FUP[[[[…]/2-#71]/#57]` = 4 `[` vs 3 `]`).
- **FANUC word operator `EQ` WORKS `[CONFIRMED on machine 2026-06-23, V10_operators.nc]`:** `IF #100 EQ 5 GOTO1`
  branched correctly (`EQ_branched=1`). Contradicts the skill's "`EQ`/`NE` unreliable — use C-style only." At
  least `EQ` is valid here; `NE`/`LT`/`GT` untested. Dialect can keep emitting symbolic `==`/`!=` (also proven),
  but the linter should NOT flag `EQ` as an error on the Expert. (`NE` still worth a 1-line check before relying.)
- **`GOTO <space> <label>` is ACCEPTED `[CONFIRMED on machine 2026-06-23, V11_gotospace.nc]`:** `IF #100==5 GOTO 1`
  (space before the label) branched (`gotospace_ran=1`). Contradicts the linter's `E-GOTOSPACE` rule — the Expert
  parser tolerates the space. Keep emitting the no-space `GOTO1` house style for portability, but **`E-GOTOSPACE`
  should be a warning at most on the Expert, not an error.**
- **Negative-decimal `IF` compare WORKS — hypothesis REFUTED `[CONFIRMED on machine 2026-06-23, IF_neg_test.nc]`:**
  with `#100=-5`, both `IF #100>-4.99` and `IF #100<-5.01` evaluated correctly (FALSE → no branch; `Afired=0
  Bfired=0`). ⇒ the parser handles `IF … <op> -<decimal>` fine; **`ifGoto` may emit negative-decimal operands.**
  So the V3c/V3d literal-G53 aborts were the guard/Z-position/Esc, **not** a parser bug (and literal-G53 stays
  low-value since the dialect emits `#var`). (First run hit a nested-paren COMMENT bug — my error — now fixed.)

## Error-readback options (ranked)
1. **Serial Modbus (best):** a `sysstart`/dispatcher macro periodically `MSETDATA`s the alarm/status
   vars to the PC slave. `[VERIFY which system var holds the live alarm code.]`
2. **Net Disk flag file:** `error.nc` writes a status value to a file landing in the PC's `share`
   folder; PC polls it locally. `[VERIFY a macro can write to Net Disk.]`
3. Re-test the V4.1 findings here (syntax-error sentinel, `.env` line-number field) — `[TO TEST]`.

## Profile build — `setting` diff analysis  `[2026-06-10, desk]`

Off-site pass over the Phase-1 capture (`assets/capture/20260610T163337Z/`): diffed live `setting` vs
`default_setting` (**160 params changed from factory**) and cross-read the captured NC subprograms.

**Baseline profile CONFIRMED for this machine** → `hardwareTabs: [probes, limits]`, ATC **off**:
- `probes` — `3D PROBE G55.nc` (bare `G31`, so the probe input is a *configured `setting` param*, not in
  the G-code) + a fixed **tool setter** (`save_sensor_position.nc` jogs over it, saves `#101/#102`). `[CONFIRMED]`
- `limits` — travel / soft-limit params are configured (candidates below). `[CONFIRMED present]`
- **no `atc`** — `save_toolchange_position.nc` is a *manual* park position; no changer actuation in the
  M-code subprograms. Manual tool change. `[CONFIRMED]`

**`setting` diff structure** (index = param #; 1000×f64). The 160 changed params group as:
- `#0–#8`, `#50–#63`, `#85`, `#107–#109`, `#285–#288` — axis max vel / accel / jog & feed rates.
- `#162 / #166 / #167` — candidate **travel / soft-limit** values (#162=−776, #166=756). `[HYPOTHESIS]`
- `#290–#389` — coordinate blocks in groups of ~5: WCS (G54–G59) + fixture / tool-position tables.
- `#489–#492`, `#515–#579` — **candidate I-O assignment region**: small ints (1–4, 20–23) in `(value, 1)`
  pairs that look like `(port#, enable/polarity)`. The **probe / tool-setter / limit input pins** most
  likely live here. `[HYPOTHESIS — pin exact indices in Phase 2]`
- `#670–#676` = `1, 50, 5, 10, −5, 400, 20` — **candidate tool-setter / probe config block**
  (`#671=50` ≈ our default block height, `#675=400` ≈ a probe feed). `[HYPOTHESIS]`

**Machine-frame `geometry.homeDir` (travel sign) — DERIVATION** (gateway `Ops._map_geometry_to_profile`,
2026-06-21): Studio's sim needs a **signed** travel per axis (sign = which side of machine-zero / home the
working envelope sits on). The gateway emits `geometry.homeDir` = ±1 per axis, derived from the **sign of
the soft-limit machine coordinates** (`#161-168` neg/pos): the home end reads ~0 and the far end ~±span, so
the envelope-midpoint sign IS the travel direction — unambiguous, no homing-polarity guess (e.g. this
capture's `#166`=+756 → +X envelope, `#162`=−776 → −Y envelope). `[CONFIRMED logic; soft-limit addressing
CONFIRMED 2026-06-17]`. **Fallback** when an axis has soft limits disabled (±9999 sentinel → the travel span
is null, so Studio ignores the sign for that axis anyway): the homing-direction param `#112-114` (0 = home
toward the neg end → travel +, 1 = home toward the pos end → travel −). That polarity is `[TO TEST at
machine]`, but it only ever feeds an axis Studio doesn't use, so a wrong guess can't flip a real envelope.
The raw `homingDir` (0/1) is still emitted alongside for debugging.

**`uservar` probe/setter slots** (meaning fixed by the captured NC; range #100–#549, slot = #var−100):
`#101/#102` = saved Sensor X/Y · `#110–#113` = 3D-probe ball-R(Z) / ball-R(XY) / max-search / clearance ·
`#120–#122` = last-probed Z/X/Y machine pos. **All 0 in this capture** (no sensor pos saved / probe
unconfigured yet) — so they confirm the *slots*, not live values. `[CONFIRMED slots]`

**Why `Ops.profile()` stays at the baseline (no data-driven pins yet):** mapping a specific `setting`
index → "probe input pin" can't be done confidently from the capture alone — the candidate regions above
need the **Phase-2 differential** (operator nudges one I-O param on the panel → re-capture → diff to see
which index moved). The on-disk DDCS PDF is *network* config only, not the full param list. Baking guessed
indices into the gateway would mis-detect tabs/pins on other machines, so it's deferred.

`[TO TEST — Phase 2]` differential-confirm the probe-input + one limit-input index in `#489–#579`, then add
a `pins` block to `GET /api/profile`. Params are **writable** over SMB (edit `setting` + reboot, see SMB
section) — so once indices are known, "push config to the controller" becomes feasible (attended).

## Assets in this folder
- `assets/Modbus_RS232_DDCSE/` — `M350 modbus manual RU.docx`, `Инструкция.txt`, connector pinout
  (`Распиновка разъёма.pdf`), bundled **Termite** terminal (`Termite_1.0.0.6/`, has a Modbus scanner).
- `assets/Modbus_RS232_DDCSE.rar` — original archive. `assets/RS232-DDCSE осциллограмма.pdf` — scope capture.

## Open actions
- [x] ~~Confirm SMB read of `uservar`/`error.nc`~~ — **DONE 2026-06-06**: full SMB **read+write** confirmed
      (V4.1 recipe works; CNCDISK=/local/, SYSDISK=/mnt/nand1-1/, guest=root, writeable). See SMB section above.
- [x] ~~Identify real param numbers for Modbus-RTU enable + port-2 baud~~ — **DONE**: `#279`=Modbus RTU,
      `#267`=Serial-2 baud (115200), `#296`/`#297`=Serial-2 parity/stop (8N1). See param table above.
- [x] ~~Confirm `uservar` slot layout~~ — **DONE 2026-06-06**: `slot=#var−100`, range **#100–#549** (450×f64). See SMB section.
- [x] ~~**Serial BLOCKED — needs a proper ferrule**~~ — **CLEARED**: SABRENT wired to port 2 is **live on the real machine** (studio test). Recipe confirmed: `#279`=Modbus enable **+ reboot** required. Still TODO on-site: capture exact COM port + which laptop (`CNC-FAIRY`/`renderranchy`) + the macro/slave log.
- [x] ~~**Phase-1 capture (PROFILE_BUILD_TASK)**~~ — **DONE 2026-06-10**: read-only mirror of SYSDISK+CNCDISK
      committed under `assets/capture/`; real Expert `setting`/`uservar`/`default_setting`/CNCDISK landed.
      `setting` confirmed on **SYSDISK** (8000 B/1000×f64), anchors re-validated. **Next (desk, no machine):**
      label the probe / tool-setter / limit `setting` indices from the manual, then fill `Ops.profile()`.
- [ ] Stand up a PC Modbus slave (`pymodbus`); confirm `MSETDATA` pushes #200+ to it.
- [x] ~~**`G10 L20 P2` — really broken?**~~ — **ANSWERED 2026-06-19 (V1): BROKEN + DANGEROUS.** `G10 L20 P6 X25`
      wrote no offset and **moved the axis** (X 5.000→73.286). Do NOT narrow `W-G10` — **harden it: forbid
      `G10 L20/L2` with axis words.** Still open: re-examine why `key-5/6.nc` & `3D PROBE G55.nc` use it (latent
      bug vs zero-distance context). See the "V1 RESULT" section above.
- [x] ~~**[TO TEST] Can a macro read the live WORKPIECE-coordinate position?**~~ — **ANSWERED 2026-07-29 by CORPUS,
      ahead of the machine visit.** `#790`-`#794` = live WORK positions X/Y/Z/A/B, **[COMMUNITY-ATTESTED]** (real
      `.tap` save/restores, the spec table, the user's own live monitoring); the factory `gotozero.nc` independently
      proves `#792`=Z (`IF #569<#792 GOTO1`). Canonical: `#790`=X, `#791`=Y. `verify/V14_wcs_pos.nc` is now a
      machine-visit CONFIRMATION rather than a gate.
      **CORRECTION (t1355): `#880`-`#882` is NOT "V7-proven".** V7 is still listed under *Left to do* in
      [`verify/HANDOFF.md`](verify/HANDOFF.md) — never run; its values are recorded only as "seen incidentally
      (Mach 5/−5/−5)". Studio's skim frame therefore uses the **WCS** trio, and the reasoning is not
      attested-vs-proven but WHERE the unproven part sits: a machine-frame origin would force every cutting move into
      `G53`, which is demonstrated here only as `G53 <axis>#var` — one axis, a variable, a rapid, in a footer
      (V3a/V3b). Literal-coordinate `G53` is **INCONCLUSIVE** (V3c/V3d aborted at a guard, then deliberately not
      pursued because "the dialect emits `#var`, never bare literals") — and a raster is full of literal coordinates
      and `G1` feed moves. A bad register read happens before any motion and a sentinel refuses it; a mis-executed
      cutting form happens with the tool down. See `wizards/ops/surfaceraster.js` (SKIM_FRAME) for the recorded sieve.

### Comparator + control-flow forms — the FACTORY MACRO CORPUS, swept 2026-07-29 (t1355)

Swept: v4.1 `macroMillCylinder.nc` / `macroMillRect.nc`, dm500 `slib.nc`, Expert `slib-g.nc` / `slib-m.nc`, the
Expert SYSDISK capture and the CAM-menu install set. Counts are occurrences in factory-authored code only (our own
`verify/*.nc` deliberately excluded — probes we wrote are not evidence about the firmware).

| Form | Factory count | Tier |
|---|---|---|
| `==` | 190 | **[DEMONSTRATED]** |
| `>` | 50 | **[DEMONSTRATED]** |
| `<` | 20 | **[DEMONSTRATED]** |
| `<=` | 12 | **[DEMONSTRATED]** |
| `>=` | 6 | **[DEMONSTRATED]** |
| `NE` | 25 | **[DEMONSTRATED]** |
| `LT` / `GT` / `LE` / `GE` / `EQ` | **0** | not in factory code |

- **`WHILE … DOn` / `ENDn` is factory-demonstrated**, in BOTH spacings: `WHILE #1<=#108 DO2` and
  `WHILE [#2 <= #1301] DO1`. The bracketed, spaced form Studio emits needs no compromise to sit on the evidence.
- **`IF … THEN` is NOT in the factory corpus** — but it is **[LIVE-SHIPPED]**: `data/camMacroKit.js:50` `wcsBase()`
  emits `IF #71 EQ 0 THEN #71=#578` at the head of **every probe CAM slot** (`probeToSlot.js` lines 156/226/285/344/426
  — corner, edge, middle/inside, boss, alignment), shipped in `1c69fa65` on **2026-06-20** and run live on the machine
  by the user since. Same tier for the word `EQ` and for `LE` (`millToSlot.js` `IF #22 LE 0 GOTO`).
- **ACTION TAKEN (t1355):** the *pre-consumer* parametric emitter (`wizards/ops/surfaceraster.js`) moved all four of
  its word comparators onto the demonstrated symbols. The flag named two (`LT`/`GT`); the sweep showed `LE`/`GE` sat
  in the same zero-evidence class, so all four moved — leaving two would have kept the risk while looking handled.
  The **live-shipped** CAM slots were deliberately NOT rewritten: they are proven by use, and churning working
  macros to chase a stronger tier is risk taken for tidiness.

- [ ] **[TO TEST · superseded above, kept for the machine visit] `#790` X / `#791` Y / `#792` Z**
      `#792` is **[CONFIRMED]** by the factory's own `gotozero.nc` (`IF #569<#792 GOTO1`) — macro usage, not just a
      variable-list name. `#790`/`#791` appear in **no** captured factory macro: same documented family, contiguous
      numbering, Z proven, X/Y still inference. Note `V7_read_dro.nc` does **not** answer this — it reads `#880-#882`,
      the *machine* DRO; `#790-#792` are the position in the *active WCS*, which is the frame a jog-referenced
      (skim) op needs. Run `verify/V14_wcs_pos.nc` (motion-free) and record the result here.
      **Why it matters:** if X/Y read true, a parametric op can carry a runtime frame in registers and reuse its
      ordinary absolute body for skim, instead of needing a second G91-relative emitter.
- [ ] **[TO TEST · t1450] LEADING WHITESPACE — does the parser tolerate an INDENTED line?**
      Studio's parametric bodies have shipped **indented** since the first one (a loop body stepped in by two spaces,
      so a macro reads like the structure it is), and nothing has ever tested whether this parser accepts it. The
      corpus cannot answer it either, and that was **measured rather than assumed**: **285 captured `.nc` files, ZERO
      lines with leading whitespace before a code token.** Every factory macro is flush-left — which is the *absence*
      of evidence, not evidence against.
      Run `verify/V15_indent.nc` (motion-free): it exercises an indented assignment, an indented two-level `WHILE`
      body and an indented `IF`/`GOTO` + label, then reports a loop count and two guard values.
      **Why it matters:** it decides whether Studio's default output shape is a preference or a requirement. The
      fallback already exists and is one switch — *Settings → G-CODE OUTPUT → Indentation → Flush left* — which emits
      the identical program with leading spaces stripped (whitespace-only; no coordinate, feed or word moves). The
      outcome to watch for is **not** a syntax error but a clean run with the WRONG count: that would mean indented
      lines parsed and were silently skipped, which no error message would have reported.
- [ ] Find the system var holding the live alarm code → log *which* error.
- [ ] Port the V4.1 `M47` dispatcher to `sysstart.nc` here (file-reload trick over SMB) — **safety first** (E-stop).

## Live position polling — FIRST REAL ATTEMPT, and it did NOT work `[MEASURED on machine 2026-08-20]`
Ran `PositionPoller` (pymodbus 3.6.9) and then a RAW FC03 probe against the studio Expert over the SABRENT
adapter, COM6 @ 115200 8N1, slave id 1. **Read-only throughout — plain FC03 reads, never `MGETDATA`.**

**The symptom, and it is precise:** the controller replies with **exactly one byte, `0x00`, to every
request** — `work_position` (7080), `machine_position` (7260) and `state` (10002) alike.
```
sent 01031ba8000a42c9  ->  recv 1 byte: 00      (work_position, 7080)
sent 01031c5c000a024f  ->  recv 1 byte: 00      (machine_position, 7260)
sent 0103271200026eba  ->  recv 1 byte: 00      (state, 10002)
```
pymodbus reports it as *"Incomplete message received, expected at least 4 bytes (1 received)"* on the first
read and *"No Response received"* thereafter. ⇒ **The port opens and something is on the wire, but the
Expert is not answering as a Modbus slave.** A single constant `0x00` is what an idle/floating RX yields when
nothing is transmitting — it is not a malformed Modbus frame, it is silence with a line artifact.

⚠ **This does NOT yet prove the register map is wrong.** All three addresses fail identically, which is the
signature of "no slave answering at all", not "wrong address" (a live slave answers a bad address with a
Modbus EXCEPTION frame, not one byte). ⇒ Do not go re-deriving registers until a slave actually answers.

### What PREFLIGHT established (so these are already ruled out)
`#279 = Slave` and `#267/#296/#297 = 115200 / None / 1` read **out of the SYSDISK `setting` file**;
COM6 present in Device Manager (FTDI); controller reachable at 192.168.0.99.

### ⭐ `#279` IS THE MODE SELECT, AND ITS NAMING IS INVERTED — read this before suspecting the mode
`P279` is a **three-way**: `NO / Poll / Slave` (OEM parameter table, quoted in
`assets/community/modbus-slave-2025-12-11/FLASH-DAY.md`; introduced by the 2026-04-10 firmware). The trap is
that the modes are named for what the **CONTROLLER** does, which is the opposite of what the PC does:

| `#279` | Who initiates | Which of our two features it feeds |
|---|---|---|
| `Poll` | the **controller** is MASTER — *it* polls | `MSETDATA` checkpoint push ⇒ **beacons** (`slave.py`, PC is the SLAVE) |
| `Slave` | the **controller ANSWERS** our FC03 | **position polling** (`master.py`, PC is the MASTER) |

⇒ Position polling needs **`Slave`**, NOT `Poll` — "Poll" is the renamed *master* mode, the one MGETDATA
needs. Mutually exclusive: one mode, one serial port, so beacons **or** position polling, never both.

**The stored value corroborates the ordering** `0=NO / 1=Poll / 2=Slave`, decoded straight out of our own
two captures — it moved exactly across flash day:
```
assets/capture/20260610T163337Z/SYSDISK/setting   #279 = 1   -> Poll  (the beacon-era setting)
assets/capture/20260731T181343Z/SYSDISK/setting   #279 = 2   -> Slave (after the 2026-04-10 flash)
```
⚠ Still an INFERENCE from label order, not a panel reading — which is why check 3 below stands. But it makes
mode selection the **least** likely cause of the `0x00`, not the most. Reboot and wiring move ahead of it.
⛔ Do NOT read `assets/community/.../setting` as a working-slave reference: it is the **factory default**
shipped inside the firmware bundle (`read.me.txt`: *"Factory parameter file"*), and its `#279 = 0` means
only "off". Flashing it would wipe the machine's entire setup.

### ⇒ THE THREE THINGS TO CHECK AT THE MACHINE, in order
1. **REBOOT the controller.** This file already says `#279` + **a reboot** are required for the live serial
   link. The value was read from the STORED setting file — that is not proof the RUNNING firmware applied it.
   The OEM manual says it too, in as many words: *"Please restart the system after setting the parameters!"*
2. **Confirm the SABRENT is on DB9 PORT 2.** Modbus is **Serial 2** (`#267`); port 1 is the M3K keyboard
   port and would present exactly this symptom. (Weakest of the three — port 2 was already proven live once
   in the studio test recorded above — but it costs one look.) The OEM wiring page adds: **Modbus uses DB9
   pins 7, 8 and 9.**
3. **Confirm `#279` reads `Slave` ON THE PANEL** (not just in the file), and the slave id the panel expects.

### ⇒ THE BETTER TEST: an INDEPENDENT ORACLE, before any of the three
`FLASH-DAY.md` step 7 names the OEM's own **`M350_LiveG_v1.7.exe`** (github.com/foinnc/M350-LiveG), which
talks to the controller in slave mode over this same COM cable. It splits the fault in ONE test instead of
three blind checks:
* **LiveG also fails** ⇒ the fault is machine-side (reboot / wiring / mode not applied). Nothing of ours is
  implicated, and the register map stays untouched.
* **LiveG connects and we do not** ⇒ the fault is OURS, and only *then* does the unattested register map
  become a legitimate suspect.

### ⛔ THE OEM MODBUS MANUAL CANNOT UPGRADE OUR REGISTER MAP — checked, all 17 pages
`assets/community/modbus-slave-2025-12-11/M350-Modbus Manual_V1_1.pdf` looks like the answer to "where is the
real slave register map" and **is not**. Its entire body is the controller-as-MASTER direction — §4 is
`MGETDATA[]`/`MSETDATA[]` macro syntax end to end (its "(03H) Read Holding Register" section is the
controller reading *from* someone else's slave, i.e. the ⛔ forbidden path). Its own intro states
*"Master-slave mode: **Default master mode**"*, and §2 still describes `279` as a two-state *"Modbus RTU
Enable"* — this is a **V1.1 document predating the 2026-04-10 firmware that introduced `Slave`**.
⇒ **No OEM documentation of slave-mode registers exists in this corpus.** `master.py`'s map (7080 / 7260 /
10002, from foinnc/M3X-M350-IoT-Bridge) remains the ONLY source and remains unattested. Do not re-open this
PDF looking for it.

### ⛔ A SEPARATE, SHIPPED-BLOCKING FINDING — the exe cannot enable polling at all
`enable_position_poll` is CLI-only (`--position-poll`). It is **absent from `Config._PERSIST_KEYS`**, so the
Setup UI cannot set it and `config.json` cannot carry it ⇒ **a double-clicked exe can never turn position
polling on.** Same shape as the boto3/R2 problem: built (t2059-t2063), unreachable in the shipped product.
Testing it today requires running the gateway from source. **Fix before the feature can be called usable.**

---

## SYSDISK exposes LIVE-ISH RUN STATE OVER SMB — a possible progress route with NO Modbus  `[EVIDENCE, live-behaviour UNVERIFIED]`
*(advisor, 2026-08-20, read-only listing + reads against the studio V4.1 at `\10.0.0.50`. Prompted by the
human: "there must be a way to decipher the line number while running code", after the Modbus probe returned
0x00. ⚠ Read on a **V4.1**, so the Expert must be re-checked before any of this is relied on there.)*

⭐ **`SYSDISK` holds far more than `setting`/`uservar`.** 170 entries, including two that are not per-program:

| file | size | contents (decoded read-only) |
|---|---|---|
| **`.file`** | 332 B | `/local/VARPROBE.nc` — **the currently loaded program path**, NUL-padded plain text |
| **`.break0-0`** | 860 B | `/udisk-sda1/1001 bbbbbb.tap` in a 256-byte path field, then a numeric body |
| `<prog>.pos` (×44) | 60 B | 7 × f64 + i32. **Program EXTENTS, not a resume point** — `.1001.nc.pos` = `[200,200,3, 100,100,3, 2.5]`; an unscanned file reads the `-200000` sentinel |
| `<prog>.env` (×44) | 888 B | mostly zeros in the sample read; not yet decoded |

⭐⭐ **`.break0-0`'s body carries `40932` at offset 320** (i32), with small ints following (`17, 91, 15, 94,
20, 40, 49, 99, 54`). For a `.tap` program, 40932 reads as a **BYTE OFFSET into the file**, which is how
controllers usually store a resume point. ⇒ **A byte offset answers the human's question better than a line
number does:** `offset / filesize` is a percentage directly, and Studio can count newlines up to that offset
to get the LINE, because it already has the file it sent.

### ⛔ WHAT IS NOT ESTABLISHED — do not build on this yet
1. **Whether ANY of it updates DURING a run.** `.break0-0` is named for a BREAKPOINT, which suggests it is
   written when you STOP, not continuously. `ops.py` already warns the disk snapshot is *"flushed at run
   start/end"*. **This is the one thing that decides whether it is a progress source or just a resume record.**
2. **Whether 40932 is really an offset** — it is an inference from magnitude and file type, not decoded.
3. **The Expert.** Everything above is a V4.1 reading.

### ⚠ THE BENCH TEST, and one trap in it
Run a program and poll `.file` and `.break0-0`, **comparing CONTENT, never mtime.**
⛔ **mtimes on this controller are meaningless** — the samples read `1969-12-31` and `2011-10-04`, so its
clock is unset. Any freshness check built on timestamps would silently always-or-never fire.
⚠ Read-only throughout: `os.listdir` + file reads. ⛔ Never `MGETDATA` (wedges the controller).
⭐ If content changes mid-run, this is progress tracking on **EVERY controller including the V4.1** — no
Modbus, no instrumentation, no cost to the machine. If it only changes at stop, it is still the honest
answer to "where did it stop", which beacons cannot give either.

---

## [CONFIRMED] The vendor Modbus manual (V1.1) — read in full, 17 pages

Source: `M350-main/Docs/Modbus开发资料/M350-Modbus Manual_V1_1.pdf`, from foinnc's own development pack.
Extracted with `pypdf`. This settles several things we had been guessing at.

### ⛔ THE NEGATIVE RESULT, stated plainly: there is NO slave register map, because there is no slave.
> *"Master-slave mode: **Default master mode**"* — §1, Introduction.

The entire manual documents the M350 **initiating** transactions (`MGETDATA` / `MSETDATA`) against
**other** devices. Every one of the 15 occurrences of "slave" in the document is the M350 addressing a
slave; none is the M350 **being** one. `Parameter 279` is named **"Modbus RTU Enable"**, not a mode
selector. **Supported function codes: 01H, 02H, 03H, 04H, 0FH, 10H.**

⇒ **This explains the dead poll.** Polling the controller returned `0x00` because nothing is listening —
not because we had the wrong register. **There is no register to find.** ⛔ Stop looking for a line-number
register in this firmware; the search space is empty, not unexplored.

⚠ The word *"Default"* is the one crack: a later firmware (≥2025-12-11) reportedly adds a **P279 SLAVE**
setting. That is **NOT** in this manual, so if slave mode exists, **its register map is undocumented** and
only foinnc can supply it. That, precisely, is what a question to the vendor should ask for.

### ⭐ SIGNATURE CORRECTION — we had the last parameter wrong
Both calls are `M[GET|SET]DATA[X1,X2,X3,X4,X5,X6]`:

| | meaning |
|---|---|
| X1 | macro var 50-499; **one macro address holds ONE BYTE** |
| X2 | slave station number |
| X3 | starting register address |
| X4 | length **in BYTES** (a Modbus register is 2 bytes) |
| X5 | function-code selector — read `01H`=1 `02H`=2 `03H`=3 `04H`=4 / write `0FH`=15 `10H`=16 |
| X6 | macro var 50-499 **receiving the EXCEPTION CODE** |

⚠ **X6 is NOT a timeout.** We had recorded it as one. In our beacon `MSETDATA[250,1,0,2,16,300]` the `300`
is **`#300`, the slot the outcome lands in** — there is no tunable timeout anywhere in the API.

**Exception codes:** `0x00` normal · `0x01` bad function · `0x02` bad address · `0x03` bad data ·
`0x04` failed · `0x05` in progress · `0x06` busy · `0x0B` **target device unresponsive** · `0xE0` bad frame ·
`0xFF` **timeout**.

### ⭐⭐ THE BEACON LAG NOW HAS A TESTABLE CAUSE — and `#300` is the instrument
The human measured *"a good 1-2 second"* per beacon. `MSETDATA` is **synchronous**, and our frame targets
**slave 1 — which is not connected on this machine.** A write to an absent slave cannot return early; it can
only run out its internal timeout, and retries multiply that. **1-2 s is what an unanswered transaction
costs.**

⇒ **HYPOTHESIS, cheap to falsify:** after any beacon, `#300` reads `0xFF` (timeout) or `0x0B`
(unresponsive). If so, the lag is **absence of a listener, not cost of the mechanism** — and the same beacon
against a live slave should complete in milliseconds.

⚠ **THE TEST IS FREE AND READ-ONLY:** run one instrumented program, then **read `#300` off the controller**.
Studio already reads macro vars. No Modbus poll, no `MGETDATA`, nothing written.
⛔ Do not conclude "beacons are slow" until `#300` has been read — we would be retiring a mechanism over a
missing cable.

### ⭐ `#300` is unclaimed — the clobber is harmless, the slot is useful
Nothing in `DDCS-Studio/web/` reserves `#300`; the only references are the beacon's own. So every beacon
already writes its own success/failure into a variable **we can read back**, and always has. That makes
per-beacon delivery **observable for free** — worth surfacing rather than leaving as an accident.

### On `RECORD[]` (`M350宏函数说明.docx`, read)
`RECORD[x1,x2,x3,x4,x5,x6,x7]` — `x1` `-1` clears / `0` appends; `x2` file index (`RecordData<N>.txt`);
`x3`-`x6` up to four values, space-separated, one line per call; path is `local`.
⇒ **A second, Modbus-free beacon channel:** the controller can append progress to a file on its own disk,
which the gateway already reads over the share. ⚠ Same synchronous-cost question applies, but with **no
network transaction** — a local file append should be far cheaper than an unanswered serial write.

---

## [CONFIRMED — FROM THE VENDOR] There is no line-number register. One is being ADDED (~2026-08-27)

**Source: Q.G. Zhang (foinnc) directly, 2026-08-20, in reply to the human's question.** This is the
strongest evidence class available to us — the author of the firmware, answering the exact question — and it
**supersedes every inference** recorded above from the manual, the macro table, and the dead poll.

> *"Currently, there is no register that exposes the current G-code line number or file progress.*
> *However, I'm planning to allocate an address for this register once I get back from my business trip —*
> *roughly in about a week."*

### ⛔ THE SEARCH IS CLOSED — stop spending turns on it
Everything we found independently was right, and now has an authoritative cause:
- the Modbus poll returning `0x00` — nothing to find, not the wrong register;
- the manual documenting master mode only;
- the macro address table containing no run-state variable;
- `.break0-0` being a resume record rather than a live position.
⇒ **None of these were dead ends to re-examine. There was nothing there.** Any future turn that starts
"maybe the line number is in..." should stop and read this section.

### ⭐⭐ WHAT CHANGES: this stops being a reverse-engineering problem and becomes an INTEGRATION one
A register is coming. That converts the question from *"can we discover progress?"* to *"is Studio shaped to
accept a progress source when one appears?"* — and those want opposite reflexes. We should NOT build the
machinery now. We SHOULD make sure the beacon is not the only thing Studio can imagine.

⚠ **Beacons remain the only mechanism today — but ONLY on the Expert.** ⛔ **The V4.1 CANNOT run beacons at
all**, and `send.js:464` already disables the control for it (`noModbus`, a positive capability test for
`expert-m350`): Modbus RTU is an Expert feature, and the DM500/V3 lacks it too — grepping its whole
311-param eng for `modbus|master|slave|serial.*mode` gives zero hits. So beacons are not superseded by the
coming register; they become one source among several **on one controller family**.

⛔⛔ **THE 1-2 s MEASUREMENT WAS TAKEN ON A V4.1** — a controller with no Modbus subsystem whatsoever. That
number therefore says nothing about what a beacon costs on an **Expert**, which is the only machine that can
run one. **We have never measured beacon cost on the hardware that supports it.**
⇒ The `#300` exception-code test (above) must be run **on the Expert**, and it is the Expert's timeout — not
the V4.1's — that decides whether the cost is intrinsic or just a missing listener.

### ⛔ THE V4.1 HAS NO PROGRESS PATH AT ALL — and the new register will not give it one
No Modbus ⇒ no beacons, no `MSETDATA`, and nothing to read a future register with. A new address in new
**M350** firmware does not reach a V4.1 ever. ⇒ **The disk-file route (`.file` / `.break0-0` on SYSDISK) is
the ONLY candidate that could ever report progress on a V4.1** — and that finding was already a V4.1
reading. Its one open question, *"does it update DURING a run or only at stop?"*, stops being a curiosity
and becomes **the deciding test for a whole controller family.**

### ⚠ WHAT WE STILL DO NOT KNOW — the questions worth asking when he is back
These decide the shape of the integration, and none is answered yet:
1. **Line number or BYTE OFFSET?** An offset divides straight into a percentage and survives comments and
   blank lines; a line number needs Studio to count lines the same way the controller does. We have said we
   want the LINE, so if it is an offset we must map offset → line ourselves.
2. **Readable HOW?** A Modbus register implies the controller acting as a **slave** — but the V1.1 manual
   documents master mode only. Does this arrive with the `P279 SLAVE` mode, and which function code
   (`03H` holding vs `04H` input)?
3. **Is there a RUN STATE companion?** idle / running / paused / alarm. Progress without state cannot tell
   "finished" from "stopped at line 400", which is the distinction an operator actually cares about.
4. **Which firmware version**, so Studio can gate the feature on something checkable.

### ⭐ THE ONE THING TO DO NOW, and only this
Keep the progress SOURCE a named, declared concept rather than "the beacon path". Beacons, a future
register, and `RECORD[]`-to-file are three implementations of one idea: *something reports how far along the
job is*. Declaring that seam is inert data and costs nothing; building a polling engine for a register whose
shape, transport, and units are all still unknown would be building on four guesses. ⛔ Do not build the
reader until questions 1-4 are answered.
