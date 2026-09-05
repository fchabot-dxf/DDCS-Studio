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
- **~~Still open: COS / SIN / SQRT~~ — CLOSED 2026-09-05 over Modbus, see the trig section at the end of this file.**
  All three work, and **arguments are in DEGREES**.

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

### `M350-LiveG`'s OWN SOURCE, inspected directly (2026-09-02) — four registers our map didn't have,
one contradiction, and a same-author caveat that matters  `[EVIDENCE, NOT independent corroboration]`
*(owner asked the advisor to inspect `github.com/foinnc/M350-LiveG` — the same exe already named above as
the independent-oracle TEST tool — for its own register declarations, not just as a black-box connectivity
test. Filed by the worker, 2026-09-02, having fetched and read `m350_liveg.py` (731 lines, main + only
source file) and `README.md` directly via `gh api` rather than relaying the claim unchecked.)*

⚠ **NOT independent corroboration, and this matters.** `M350-LiveG` and `M3X-M350-IoT-Bridge` (the source of
`master.py`'s own existing register map — `7080`/`7260`/`10002`, [[m350-modbus-register-map]]) share the
same author, `foinnc`. Two register maps agreeing because the same person wrote both down twice is not two
sources; it is one source, asked twice. Any error in the original carries forward undetected. This does NOT
make the new registers below worthless — GitHub user activity across separate repos is still evidence a
person built two DIFFERENT working tools against the SAME real firmware, which is worth something — it
means "confirmed by a second source" is the wrong description, and "confirmed by the same source, twice" is
the right one.

**FOUR REGISTERS our map did not have, all read directly from `m350_liveg.py`'s own UI labels** (lines 93,
106-107, 148, 161 — both the zh and en language tables, identical registers in both):
- **`3000` — a live G-code DISPATCH buffer, 246-byte limit, that the controller EXECUTES.** The tool's own
  label: *"实时代码下发与在线执行区 (地址 3000 / 246字节上限)"* / *"Live G-Code Dispatch Area (Addr 3000 /
  246-Byte Limit)"*. ⛔ **This is a WRITE that runs G-code on a live machine the instant it lands** — filed
  here, GATED, no test plan below. Per [[live-cnc-readonly-when-away]]: not even a read-only probe of this
  one, because the tool's own default example value (`"G01 X50 F3000"`, line 266) shows it is meant to be
  sent, not merely inspected.
- **`15000` — macro variables.**
- **`6500` — user parameters.** (Also the tool's OWN default register-address field value, line 304 — the
  author's own most-common-use register.)
- **`10000` — status.**

These are GENERIC registers in the tool's own manual read/write panel (address + count + one of
16-bit/32-bit-int/32-bit-float/64-bit-double, freely chosen per read — confirmed by reading the format
selector's own code, lines 10-26 and 511/561) — the source carries NO per-address type declaration for any
of the four (unlike our existing `master.py` map, which hard-types each register it reads). That is
structural, not a gap in my own reading: this tool is built to let a HUMAN probe an address and pick a
format, not to declare one per register.

**THE CONTRADICTION, reported by the dispatch, NOT independently confirmed by this worker in the repo's own
content.** The dispatch states `10002` (our map: 32-bit int, "state") is `float32` in LiveG's own source.
Searched `m350_liveg.py` (all 731 lines) and `README.md` for `10002` directly — **zero occurrences in
either.** Given the tool's own generic, per-read format selector (no hardcoded per-address typing exists
anywhere in this source), a `10002`-is-float32 finding could only have come from someone actually RUNNING
the tool against a real M350 and comparing which format decoded to a sensible value — real, valuable
evidence if that is what happened, but not something the static source substantiates on its own, and not
something this worker turn ran (no live machine touched). Recorded as a live, actionable disagreement
between our map and a same-author second tool — worth resolving on the bench — not as a confirmed fact.

**READ-ONLY TEST PLAN — `15000` and `6500` ONLY, per the dispatch's own explicit scope (`10000`/`3000`
excluded — see below):**
1. Confirm P279=Slave, P267=115200 (same preconditions [[m350-modbus-register-map]] already requires).
2. Function 0x03 (Read Holding Registers), address `15000`, a small count (2-4 registers) — record the raw
   bytes returned, unconverted. Do NOT assume a length or type; the source gives none for this address.
3. Same for `6500`.
4. Whatever comes back, log it VERBATIM (hex + each of the four format interpretations the LiveG tool itself
   offers) rather than picking one representation — exactly the caution the `10002` contradiction above
   argues for: guessing the type from one read has already produced one disagreement in this same map.
5. `10000` (status) is named as a new register but NOT included in the dispatch's own test-plan scope —
   filed for the record, not queued to test this pass.

⛔ **`3000` is excluded from this test plan on purpose, per the dispatch's own explicit instruction — it is a
WRITE that executes G-code on a live machine.** No read-only probe exists for a dispatch buffer; even a
"read" of it is not the safe operation the other three are. File it, gate it, do not test it without a
separate, explicit, owner-present ruling the same way any other live-write capability on this controller
needs one ([[live-cnc-readonly-when-away]]).

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

## ⭐⭐ [VENDOR-STATED] REGISTER `16062` IS THE CURRENT EXECUTING G-CODE LINE NUMBER

*(2026-09-02. **Q.G. Zhang — the vendor — messaged the owner an annotated screenshot unprompted**, captioned
in his own words: **"Modbus read method for current executing G-code line number"**, with the M350-LiveG repo
link. This is a vendor statement, not a community inference and not read off someone's source.)*

```
  Start Addr  16062      Reg Count  2      Format  Float CD AB
  three reads during a running G01 X0 / G01 X100 loop:
    488.0   (raw 000043F4)  →  502.0  (raw 000043FB)  →  543.0  (raw C0004407)
```

⇒ **This is the answer to the question recorded above** — *"there must be a way to decipher the line number
while running code"* (2026-08-20, after the Modbus probe returned `0x00`). It was asked before slave mode
and the newer firmware existed; the negative result was true at the time and is now superseded.

⚠ **The advisor argued AGAINST this reading and was wrong.** The objection was that 488–543 is too large to
be a line number for the ~10-line payload on screen. The owner's counter was contextual and correct: the
vendor sent it unprompted, with an arrow pointing at the value, knowing exactly what was being asked for.
⭐ **Recorded because the failure mode generalises** — arithmetic plausibility was allowed to outweigh direct
conversational evidence from the one person who actually knows.

### ⛔ WHAT IS NOT ESTABLISHED

1. ~~**Reset behaviour.**~~ ⭐ **ANSWERED by the vendor, same conversation: IT RESETS at program start.**
   ⇒ Read it directly; `line / total_lines` is the progress fraction. No baseline capture, no subtraction.
   ⛔ **The 488–543 readings in the screenshot are NOT evidence of anything and were never a puzzle.** It is
   a vendor demonstrating a tool, not a controlled run — prior activity, a loaded file, repeated clicks, any
   of it explains the magnitude and none of it needs explaining. ⚠ The advisor spent three exchanges deriving
   line counts and byte counts from it and manufactured a bench task out of the result. **The meaning was
   DECLARED by the person who wrote the firmware; re-deriving it from output is exactly what principle 3
   forbids.** Recorded because the advisor had been citing that principle at the worker all session.
2. ~~**Firmware floor.**~~ ⭐ **ANSWERED, same conversation: `2026.09.02`.** Vendor's own words: *"the system
   needs to be updated to the 2026.09.02 version"* + *"I will package and upload the new version shortly."*
   ⇒ ⛔ **`16062` is a BRAND-NEW capability, not something we had been failing to find.** The earlier
   reasoning in this entry was backwards.
   ⭐ **RELEASED same day** — `foinnc/M350` tag `2026-09-02-00`, 6 assets. Its ENTIRE changelog is one line:
   *"扩展 Modbus 寄存器地址映射"* / *"Expanded Modbus register address mapping."* **No enumeration of what was
   added.** `16062` is presumably part of it; nothing in the release says so.
   ⇒ ⭐ **THIS IS THE MOMENT TO ASK FOR THE REGISTER MAP.** The vendor has just stated he expanded the
   mapping and not said to what. Everything we know about `6500`/`10000`/`15000`/`16062` has been
   reverse-engineered from a screenshot, a PC tool's source, and one message. A map ends that permanently
   and is a natural follow-up to his own release note rather than a fresh request.
3. ⛔ **THE V4.1 WILL NOT GET THIS — owner-stated, 2026-09-02.** Not "unknown", not "unverified": it is not
   coming. ⇒ **The `SYSDISK` byte-offset route above is NOT a fallback, it is the ONLY route for the V4.1**,
   and per [[v41-and-v3-outnumber-expert]] the V4.1 and V3 outnumber the Expert in the field. Anything built
   on `16062` alone leaves the larger population with no progress tracking at all. Design for two sources
   from the start, not one with a patch later.
4. Not bench-verified on the owner's own machine — see `bench/04-modbus-slave-test-plan.md`.

### WHAT IT REPLACES, if it holds

`instrument.js` today injects beacons on **Z-up retracts** and infers progress from them, so a program with no
retract reports nothing. A declared line number read straight off the controller is the same claim without the
inference, on **any** program, with no injection and no cost to the machine.

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


## Comment characters — what the vendor's own macros actually contain `[CONFIRMED 2026-08-25]`
Full audit, cross-dialect and with its method: [`../COMMENT-CHARACTERS.md`](../COMMENT-CHARACTERS.md).
The Expert-specific results, in one paragraph so this file is not a second copy that can drift:

* **2,201 vendor comments** across SYSDISK system macros, the OEM firmware install payload and the OEM
  CAM packs. **Zero of them nest `(`.** Every nested comment in this repo is in a file we wrote.
* Attested and safe as replacement characters: **`-` `.` `:` `=` `!` `,`** (and `/` mid-line only,
  never at line start). Attested but MISLEADING: `[` `]` (expressions) and `#` (variable sigil).
* ⭐ **`%` is context-dependent.** `#1505=<n>(message)` is the operator-message mechanism and `%` is a
  live printf specifier inside it (`X=%.3f` prints a number); in an ordinary comment it is a literal
  percent sign. 36 of 335 vendor uses are message-attached. Do not offer it as a blind replacement.
* ⭐ **Comment bodies are not ASCII-restricted** — the vendor ships 6,664 high bytes of GBK Chinese
  inside SYSDISK comments alone. ⚠ GBK, not UTF-8: a UTF-8 round-trip corrupts vendor macros.


## SYSDISK run-state + the WCS table, read live off the Expert `[MEASURED 2026-08-25]`
*(CNC-FAIRY, controller powered and reachable at 192.168.0.99. **Read-only throughout** — `os.listdir` and
file reads over SMB. Nothing was written to the controller; no G-code ran; no axis moved.)*

### ⭐ RESULTS — read this, not the trail below
*(The numbered sections that follow are the investigation in the order it happened, corrections included:
§5 was refuted, §12 amended, §17 withdrawn, §18 superseded. **Nothing below is needed to use the results.**
It is kept for provenance — so a claim can be traced to the measurement that produced it, and so the wrong
turns stay visible. This block is what is TRUE as of 2026-08-25.)*

#### 1. The Z offset is three terms, added
```
work Z = machine Z − ( WCS Z + tool-table Z + H offset )
```
| term | macro | file slot | when it applies |
|---|---|---|---|
| WCS | `#[800 + n*5]`, n = 1..7 | `setting[300 + n*5]` | always |
| tool-table Z | `#1430` (active tool) | `setting[930]` | **always** — written by the probe, cannot be switched off |
| H offset | `#900` | `setting[400]` | only after `G43 H01`; cleared by `G49` or `M30` |

Measured: `−104.844` with no H selected, `−94.844` with `G43 H01` and H01 = 10, back to `−104.844` after
`G49`. `[§15, §21]`

#### 2. Rules for writing G-code for this controller
* ⛔ **The `H` word needs TWO digits.** `H1` is accepted, does nothing, and reports nothing. `[§16]`
* ⛔ **A bare `H01` does not bind** — `G43` is required to arm it. `[§22]`
* ⛔ **Do not MIX the two mechanisms on an Expert.** Its tool-table offset is already applied, so a program
  that also carries `G43 H<n>` with a populated H table applies the tool length **twice**. The H table stays
  at zero because the native table is the one in use — an Expert configured the other way round would be
  consistent too; what breaks is having both live. `[§25]`
* ⚠ The V4.1 is the opposite: its factory ATC *does* use `G43 H`, because it has no native tool table. `[§24]`
* ⭐ Use the vendor's own WCS form `#[800 + n*5]`, not `#[805 + (n−1)*5]` — identical, but it carries the
  firmware's own guard and cannot be "simplified" into an off-by-one. `[§13]`
* ⛔ `_WCS_BASE = 305` in the app is **CORRECT**. Panel-verified on all six systems. Do not change it. `[§10]`

#### 3. Addressing — one rule
```
macro #N   →   setting f64 index (N − 500)   →   eng entry #(N − 500)
```
`eng` is the 1:1 name table for `setting`, so **any slot can be named rather than guessed**. `[§11]`

#### 4. Finding a parameter on the pendant
`eng`'s `-m` tag is the Param List **section**; `-p` is the **edit permission** (everything is readable).
⛔ Sections gather **scattered** number ranges — Backlash holds `#190-200` *and* `#400-415`. Never look for a
parameter by its number. Full map: [`PARAM-PAGE-MAP.md`](PARAM-PAGE-MAP.md). `[§20]`

#### 5. ⚠ Two traps for anything reading the controller
* ⭐ **`SYSDISK/setting` is NOT stale — it is trustworthy.** Both a pendant edit and a macro register write
  reach the disk immediately (measured on `#131`, V19). ⛔ An earlier claim that it was stale is **WITHDRAWN**;
  it came from comparing two different moments. `[§19]`
* ⛔ **`SYSDISK/cmdstr` holds a shell command.** Read only, never write. `[§6]`
* The Expert has `.break0`/`.break1`, **not** the V4.1's `.file`/`.break0-0`. `[§1]`

#### 6. How to measure an offset here — do not use the screen
The message dialog covers the Z row for exactly the window in which a modal offset is live, and `M30` clears
the selection before the dialog closes. Have the macro read and print it instead: `[§23]`
```gcode
#111 = [#882 - #792]      ( machine Z minus workpiece Z = the applied offset )
<the instruction under test>
#112 = [#882 - #792]
#1510 = #111
#1511 = #112
#1505 = -5000(before=%.3f after=%.3f)
```

#### 7. ⚠ STILL OPEN — with what each one needs
| question | needs |
|---|---|
| Does `H01` **attached to a Z move** bind without `G43`? (the exact posted form) | a real Z move, human present |
| ~~What triggers the parameter flush?~~ | ⭐ **ANSWERED: writes flush immediately, from pendant AND macro. Not an open question.** |
| Modbus position poll answers `0x00` | **a controller reboot**, then re-probe |
| Do `.break*` / `processing` update DURING a run? | a program running, human present |

---

### 1. ⛔ THE V4.1 SMB PROGRESS FINDING DOES NOT TRANSFER — the Expert's layout is different
The 2026-08-20 note (`.file` + `.break0-0`, read on a V4.1) named "the Expert" as unverified. Now verified,
and it is **not the same**:

| V4.1 had | Expert actually has |
|---|---|
| `.file` (332 B) — current program path | ⛔ **absent** |
| `.break0-0` (860 B), path field FIRST | `.break0` (400 B) **and** `.break1` (440 B), path/text LAST |
| 44 × `<prog>.pos` | **142** × `<prog>.pos` |

⇒ Any progress reader must branch per controller. `[CONFIRMED]`

### 2. ⭐ THE BREAK RECORD IS A MODAL-STATE SNAPSHOT — decoded
Both `.break0`/`.break1` open with the same i32 vector, and it decodes cleanly as **modal G-codes**:
`17, 90, 94, 21, 40, 49, 99, 54` = **G17 / G90 / G94 / G21 / G40 / G49 / G99 / G54** (`-1` = slot unset).
Then f64s (feed `1000.0` / `5080.0`, spindle `12000.0`), three i32 counters at `[232] [236] [240]`
(`10, 351, 8` and `101, 1569, 116`), positions as f64 near offset 320, and **the source text at the break**
as a trailing string (`.break0` → `/local/A9b_MGETDATA_PULL.nc`; `.break1` → `G53G00Z#150`). `[CONFIRMED]`

⚠ **The counters are NOT decoded.** `[236]` is the right magnitude for a byte offset or a line number, but
both records are **stale historical breaks** — `.break0`'s program no longer exists on CNCDISK — so there is
nothing to check them against. ⛔ Do not assume `[232]`=line / `[236]`=offset; it is unproven.

⚠ **And the load-bearing question is still open**: whether ANY of this updates DURING a run, or only at stop.
That needs a program running with a person at the machine. A baseline of sha256s for a before/after
comparison is committed at `bench/sysdisk-baseline-2026-08-25.json`.

### 3. ⭐ `eng` INDEXES `setting` DIRECTLY — 1:1, no offset `[CONFIRMED]`
Verified on six anchors read live: `#78`="Current coordinate"→`setting[78]`=1 · `#267`="Serial 2 baud
rate"→4 (B115200) · `#279`="Modbus RTU"→**2** · `#295`="Feed rate maximum value"→300 · `#296`/`#297`
parity/stop→0/0. ⇒ For the `setting` file, **eng index == f64 index**. No `−500` anywhere in this relation.

### 4. ⭐⭐ THE WCS TABLE IS AT `setting[300]`, AND THERE ARE SEVEN OF THEM
A previously unexamined SYSDISK file, **`coordinate` (360 B = 45 × f64 = 9 rows × 5 axes)**, holds the work
offsets — and it is a byte-exact mirror of `setting[300..339]`:

```
coordinate row 0..7  ==  setting[300 + row*5]   ALL MATCH   (row 8 is padding)
row 0 = 47.650  -666.186  -69.484  -666.186    0.000
row 1 = 50.130  -665.704  -36.508  -665.944    0.000
row 2 = 50.670   -34.642  -35.163   -34.642    0.000
```

⭐ **`eng` says `#78 "Current coordinate" -min=1.000 -max=7.000`** — **seven** coordinate systems, not six —
and rows 0..6 are exactly seven. `setting[78]` currently reads **1**.

⇒ **Measured relation: WCS n (1..7) lives at `setting[300 + (n−1)*5]`, so WCS 1 → `setting[300]`.**

### 5. ~~THIS DISAGREES WITH THE APP...~~ ⛔ **REFUTED AT THE PANEL — see §8 below.** The app was right.
Both the profile mapper (`_WCS_BASE = 305`) and the owner's own `COPY_WCS.nc`
(*"Calculate source base address: 805 + [WCS-1]*5"*) put **G54 at `setting[305]`** — which is **row 1**, the
SECOND row of the measured table. The measurement puts WCS 1 at row 0 / `setting[300]`.

⚠ **This is the shape of the symptom the owner already reported** — *"it pulled the wrong coord"* (t2067).

⛔ **NOT yet a confirmed bug, and must not be "fixed" on this evidence alone.** Two readings survive:
* **(a) The app is off by one system** — row 0 is WCS 1 and every pull returns its neighbour.
* **(b) `coordinate` row 0 is a spare/extra row** the table happens to begin with, and `setting[305]` really
  is WCS 1 — in which case the app is right and only this note is wrong.

⇒ **ONE LOOK AT THE PANEL DECIDES IT.** `setting[78]` = 1, so the active system is WCS 1. Read the current
work-offset **X** on the pendant:
* panel shows **47.650** ⇒ reading (a): row 0 is the active system, and the app is off by one. Real bug.
* panel shows **50.130** ⇒ reading (b): the app is correct, and row 0 is a leading spare.

⚠ Until that look happens this stays `[HYPOTHESIS]`. ⛔ Do not change `_WCS_BASE` on the strength of a file
comparison — the whole t2067 episode was an address changed on inference.

### 6. ⚠ `cmdstr` IS A SHELL-COMMAND FILE, AND IT CONTAINS A DELETE
`SYSDISK/cmdstr` (45 B) currently reads, in plain text:

```
find . -type f | grep ".*\pos$" | xargs rm -f
```

⇒ SYSDISK carries a **shell command string**, and the one sitting there is a recursive delete of the `.pos`
files. ⛔ **Read-only. Do not write to `cmdstr` and do not experiment with it** — if the controller executes
what it finds there, a write is arbitrary command execution on the controller, with no undo. Recorded because
anything walking SYSDISK will meet this file. `[CONFIRMED present; execution behaviour NOT tested and must
not be]`

### 7. Smaller reads, for the record
* `mdiblock` (720 B) = **MDI history** — past hand-typed lines (`#571=1`, `G90 G0 B360`, `#3000=#880`).
* `processing` (4800 B) = a **recent-programs list**: 96-byte records of name + four i32 counters.
* `processing1` (4 B) = `5c 5f 52 5b`, not a plausible counter. Undecoded.

### 8. ⭐⭐ RESOLVED AT THE PANEL — §5 was WRONG, and a SECOND offset row exists `[CONFIRMED 2026-08-25]`
The owner read the pendant with **G54 active** and the machine idle:

```
           Mach            Abs (G54 work)
X          5.000          -45.130
Y         -5.000          660.704
Z         -5.000           99.844
A         -5.000          660.944

(label correction: the 5/-5/-5 column is the MACHINE DRO -- it matches #122-124
 "Mach position after go home" and the #880 machine-X reading of 5.000 recorded
 at line 446. The offset is the DIFFERENCE between the columns either way, so
 every number and conclusion below is unaffected.)
```

**⇒ §5's reading (a) is REFUTED. The app is correct: G54 IS `setting[305]` = `coordinate` row 1.**
`coordinate` row 0 / `setting[300]` is a leading row that is **not** G54, so `_WCS_BASE = 305` and the owner's
`805 + [WCS-1]*5` both stand. ⛔ **Do not "fix" the WCS base** — the off-by-one was my inference and the
machine says no. Every row was tested against the panel; row 1 is the only one that fits, on 4 of 5 axes.

⭐⭐ **BUT THE FIFTH AXIS EXPOSED SOMETHING REAL: the effective offset is TWO rows added together.**
Row 1 alone predicts Z = `31.508`; the panel says `99.844` — out by exactly **68.336**, which is
`setting[342]`, the Z slot of **row 8** (`setting[340..344]`). Adding them reproduces the panel **exactly on
all five axes**:

```
row 1  (G54)     50.130  -665.704   -36.508  -665.944   0.000
row 8  (extra)    0.000     0.000   -68.336     0.000   0.000
combined         50.130  -665.704  -104.844  -665.944   0.000
work - combined -45.130   660.704    99.844   660.944   0.000   == the panel, to 3 decimals
```

⇒ **MEASURED: `effective offset = WCS row (setting[300+n*5]) + row 8 (setting[340..344])`.** Row 8 is applied
on top of whichever WCS is active. `[CONFIRMED — all five axes, one reading]`

⚠ **WHAT ROW 8 *IS* remains unidentified.** G92 is the obvious candidate (a global offset stacked on the WCS)
but it is NOT proven — `eng` has no entry for `#340..#344`, and the panel showed `G49`/`H00` (tool-length
compensation OFF), so it is not a tool offset being applied through G43. ⛔ Do not name it G92 in code until
a second reading with a deliberately changed G92 confirms it.

⛔⛔ **THE CONSEQUENCE, AND IT IS LOAD-BEARING: any consumer that reads only the WCS row gets Z wrong.**
Right now that error is **68.336 mm**, silently — the number looks perfectly plausible. On a controller where
**G54 Z0 = the spoilboard is SACRED**, a Z offset that is wrong by 68 mm and looks fine is exactly the class
of defect that ends in a tool through the table.

⇒ **This is a far better candidate for the owner's "it pulled the wrong coord" (t2067) than the off-by-one
ever was** — it is real, it is measured, and it is Z-only, which is why X/Y always looked right.

⚠ **Not yet checked:** whether the app's pull actually ignores row 8 (that is an app question, for the
RENDERRANCHY seat), and whether row 8 is nonzero on the V4.1 / DM500 at all. The reading here is one snapshot
of one machine in one state.

### 9. ⭐⭐ IDENTIFIED — the "extra row" is the ACTIVE TOOL'S Z OFFSET, written by the probe `[CONFIRMED 2026-08-25]`
The owner's instinct — *"it must have to do with the floating probe"* — is correct, and `eng` names it outright:

```
#930  setting[930] = -68.3360   "T01 Z offset"      <- the tool table, written by the probe
      setting[342] = -68.3364   <- the ACTIVE tool's offset, applied live
```

`68.336` appears in **exactly two** places in the whole 8000-byte file, and those are the two. Cur Tool is
**T1**. The tool block is `#890+n` = T(n+1) X offset, `#910+n` = Y, `#930+n` = Z; every other tool reads 0.

⇒ **`setting[340..344]` is not a mystery row and is not G92** — it is the **live copy of the current tool's
offset**, stacked on the WCS. §8's "unidentified extra row" is hereby identified. (The two values differ in
the 4th decimal — `-68.3364` vs `-68.3360` — so the live copy is a working value, not a byte-for-byte mirror.)

⚠⚠ **AND IT IS APPLIED WHILE THE PANEL SHOWS `G49` / `H00`.** Tool-length compensation reads as CANCELLED and
the offset is in force anyway. ⇒ On this controller the probe-set tool Z offset is **not** the G43/G49
mechanism — it is applied unconditionally as part of the work-coordinate computation. ⛔ Do not reason about
it from `G43`/`G49`/`H` modal state; that state says nothing about whether it is active.

### 10. ⭐⭐ THE WHOLE WCS TABLE, VERIFIED AGAINST THE PANEL — all six, exactly
The pendant's coordinate page was read directly and matches `coordinate` rows 1..6 / `setting[305..334]` on
**every axis of every system**:

```
          G54        G55        G56        G57        G58        G59     [Offset]
X      50.130     50.670     75.584     42.650    317.332     42.650      0.000
Y    -665.704    -34.642   -632.758   -661.186   -611.350   -661.186      0.000
Z     -36.508    -35.163    -96.424    -87.336     -6.329      0.000      0.000
A    -665.944    -34.642      0.000   -661.186   -611.350   -661.186      0.000
B       0.000      0.000    360.002      0.000      0.000      0.000      0.000
```

⇒ `setting[300 + n*5]`: **row 0 is NOT displayed on the panel at all**; rows 1..6 are **G54..G59**; row 7 is the
panel's trailing **"Offset"** column (all zeros); row 8 is the active tool's live Z offset (§9).
⭐ `_WCS_BASE = 305` is **correct and now panel-verified on all six systems.** ⛔ Do not change it.

### 11. ⭐⭐⭐ THE ADDRESS SYSTEMS UNIFY — one rule, three independent anchors `[CONFIRMED]`
The `var-read-address-systems` memory wanted the two address spaces reconciled into one declared map. The
machine says they already are, and the rule is a single subtraction:

```
macro #N   →   setting f64 index (N − 500)   →   eng entry #(N − 500)
```

| macro | setting index | what `eng` calls it | measured value |
|---|---|---|---|
| `#578` | `setting[78]` | "Current coordinate" (`min=1 max=7`) | `1` — G54 active ✓ |
| `#805` | `setting[305]` | *(no entry — the WCS table is not a UI param)* | `50.130` = panel G54 X ✓ |
| `#1430` | `setting[930]` | "T01 Z offset" | `-68.336` ✓ |

⇒ **The memory's `#1430` = Tool 1 Z-length was RIGHT** — it resolves through the same `−500` as everything
else. ⛔ It is **not** in `camsetting`: `camsetting[430]` reads `0.0`, and applying the camsetting `−1000` rule
to a `setting`-space address is the mistake that hides it. **`eng` is the name table for `setting`, 1:1**, so
any `setting` slot can now be *named* rather than guessed — which is the declared address map that memory
asked for, already shipped by the vendor.

### 12. ⚠ AMENDMENT TO §9 — how much of that is THIS MACHINE'S SETUP, not the firmware
*(Prompted by the owner, who was right to ask: "is that WCS mechanic might be a result of how I work? how I
wrote my probe macro". Answer: partly yes. §9 said the offset is applied "unconditionally" — that is stronger
than one reading of one machine in one configuration supports.)*

⭐ **There are TWO INDEPENDENT tool-offset systems on this controller, and `eng` names both:**

| block | `eng` name | gated by | value here |
|---|---|---|---|
| `#400..#415` | **"H01..H16 tool length offset"** | `G43`/`G49` + `H` word — the standard mechanism | **all 0.000** |
| `#930..#949` | **"T01..T20 Z offset"** | the tool table itself | **T01 = −68.336**, rest 0 |

⇒ The panel showing `G49`/`H00` is **entirely consistent** — the H table it refers to is empty. The `−68.336`
lives in the *other* system. ⇒ **§9's framing stands (they are different mechanisms), but the word
"unconditionally" is withdrawn**: what is measured is that the tool-table Z offset applies **independently of
`G43`/`G49`**, on a machine configured as below. It is NOT established that no parameter can turn it off.

**⇒ THE CONFIGURATION THAT PRODUCED THIS READING — all of it is the owner's own setup:**
```
#128  "Is the Floating tool set valid?"  = 1   (ON)
#130  "Is the fixed tool set valid?"     = 1   (ON)
#999  "coordinate offset method" [0..2]  = 0
#803  "The virtual Tool function on?"    = 0   (OFF — #973+ virtual tool Z offsets all 0)
#805  "Automatic tool setting after tool change?" = 0
```
⚠ **`#999 "coordinate offset method"` is a THREE-WAY MODE (0/1/2) and it almost certainly governs how these
offsets combine.** It reads `0` here and **the other two values have never been observed**. ⛔ Do not describe
the stacking behaviour as universal DDCS behaviour until `#999` = 1 and 2 have been seen.

⭐ **And the VALUE is unambiguously the owner's workflow.** `#1430`/`setting[930]` is written by their own
tool-setter recipe (`CALIBRATE.nc` / `TOOLSET.nc` store `#1430 = [touch] − #2500`), with `#128`/`#130` both
enabled. **A machine whose owner never probes has `#930` = 0 and would never see any of this.**

⇒ **WHAT THIS CHANGES FOR THE APP — it makes the hazard MORE relevant, not less.** The stacking is not exotic
firmware trivia; it is what happens to **anyone who uses the tool setter**, which is the normal workflow here.
But the fix must read the offset **from the machine**, never assume a mode: `#999`, `#128`, `#130` and the
active tool number are all in the same file and all readable.

`[CONFIRMED: the two blocks exist and hold these values]` ·
`[HYPOTHESIS: that #999 governs the combination — one value observed out of three]`

### 13. ⭐⭐⭐ DOES IT APPLY UNIVERSALLY? — tested, and the manufacturer's own macro is the rule
*(The owner asked the two right questions: "verify if this finding applies universally", and "or the one
prescribed by manufacturer with native macro". Both answered below, by measurement.)*

#### a. On the Expert the layout is STABLE — same indices in four independent dumps
Every parameter resolved **by `eng` NAME** across the live machine, the factory `default_setting` beside it,
the 2025-12-11 OEM firmware bundle, and the 2026-06-10 capture:

| `eng` name | live | factory default | OEM firmware | 2026-06 capture |
|---|---|---|---|---|
| Current coordinate | `#78` = 1 | `#78` = 1 | `#78` = 1 | `#78` = 1 |
| **T01 Z offset** | `#930` = **−68.336** | `#930` = **0** | `#930` = **0** | `#930` = **0** |
| H01 tool length offset | `#400` = 0 | `#400` = 0 | `#400` = 0 | `#400` = 0 |
| coordinate offset method | `#999` = 0 | `#999` = 0 | `#999` = 0 | `#999` = 0 |
| Is the Floating tool set valid? | `#128` = **1** | `#128` = **1** | `#128` = **1** | `#128` = **1** |
| Is the fixed tool set valid? | `#130` = **1** | `#130` = **1** | `#130` = **1** | `#130` = **1** |

⭐⭐ **THIS OVERTURNS §12's hedge.** `#128`/`#130`/`#999` sit at their **FACTORY** values — the tool-set
mechanism is enabled out of the box, not by anything the owner did. **The only thing that is the owner's is
the VALUE in `#930`, written by their own probe macro.** ⇒ The stacking is **universal Expert behaviour**;
what varies between machines is merely whether anyone has probed yet. ⛔ §12's "this may be the owner's setup"
is withdrawn as to the MECHANISM; it stands only as to the value.

#### b. ⭐⭐ THE MANUFACTURER'S OWN FORMULA — `slib-g.nc`, subprogram `O500`
The vendor's own system macro library writes the WCS like this:

```gcode
O500
IF #578<1 GOTO1          (guard: coordinate number must be >= 1)
IF #578<7 GOTO2
#[800+#578*5]=#1         (X)
#[801+#578*5]=#2         (Y)
#[802+#578*5]=#3         (Z)
#[803+#578*5]=#4         (A)
```

⇒ **The manufacturer-prescribed address is `#[800 + (active coord) * 5 + axis]`**, with `#578` holding the
active coordinate number. For G54 (`#578`=1) that is `#805` — **algebraically identical** to the app's
`#805 + [WCS−1]*5` and to the owner's `COPY_WCS.nc`. `800 + n*5 ≡ 805 + (n−1)*5`.

⭐ **And it explains row 0 once and for all**: `setting[300]`/`#800` is the **n = 0 slot**, which the vendor's
OWN guard (`IF #578<1`) excludes — there is no coordinate system 0. That is exactly why the pendant does not
display it, and why my §5 off-by-one was wrong. `[CONFIRMED — vendor source]`

⛔ **Use the vendor's form, not ours.** `#[800 + n*5]` needs no `−1` correction and matches the firmware's own
guard, so an off-by-one cannot be reintroduced by someone "simplifying" the expression.

#### c. ⛔ ACROSS CONTROLLERS IT DOES **NOT** TRANSFER — the V4.1 has neither block
The V4.1's own `eng` has **314** entries against the Expert's 585, and resolving the same names finds:

| name | Expert | V4.1 |
|---|---|---|
| H01 tool length | `#400` | **`#264`** — different index, same concept |
| T01 Z offset | `#930` | ⛔ **ABSENT** |
| coordinate offset method | `#999` | ⛔ **ABSENT** |
| Current coordinate | `#78` | ⛔ **ABSENT** |

⇒ **The dual-offset system (H table *and* a separate tool-table Z) is Expert-only.** The V4.1 carries the
`H01..H15` length table and nothing equivalent to `T01 Z offset` ⇒ **the §9/§12 stacking hazard does not exist
on a V4.1**, and a fix written against Expert indices would read garbage there.

#### d. ⇒ THE UNIVERSAL RULE, then — it is a METHOD, not an address
Nothing numeric survives the crossing. What survives is:

1. ⭐ **Resolve every parameter by its `eng` NAME on THAT controller — never by a hardcoded index.**
   "H01 tool length" is `#400` on an Expert and `#264` on a V4.1. The number is per-firmware; the name is not.
   `eng` ships in the dump beside `setting`, so the map is always available at read time.
2. ⭐ **Prefer the vendor's own macro form** where one exists (`#[800 + n*5]`), because it encodes the
   firmware's own guards and indexing convention rather than a re-derivation of them.
3. ⚠ **Treat a name that is ABSENT as a capability the controller does not have** — not as a value of 0, and
   not as a reason to fall back to the other controller's index.
4. ⛔ **Never transfer a numeric finding between controllers.** The `controllers/README.md` rule already says
   this; §13c is the measurement that shows what it costs when ignored.

### 14. ⚠ A NEWER FIRMWARE EXISTS — `2026-08-03-00`. ⛔ NOT FLASHED, and deliberately not, yet
*(Owner pointed at github.com/foinnc/M350/releases. Read 2026-08-25; the machine was NOT touched.)*

**Running on this machine, read off the System Info page:**
```
System Name:   M350-standard [00]
Software Ver:  2026-04-10-00        <- current
Hardware Ver:  2021-1213-23
Cable IP:      192.168.0.99
```

**The newest release is `2026-08-03-00`**, four months newer, and its notes are short and squarely on top of
two open questions here:

> 1: Added **Modbus RTU real-time G-code injection** and testing interface.
> 2: **Optimized Modbus memory map (register address 3000)** to support seamless reception and safe parsing of
> ASCII code streams up to **246 bytes** per single payload.

⇒ **Both items matter to us.** "Real-time G-code injection" is a transport the gateway does not have and has
never modelled. And **"optimized Modbus memory map"** is a change to the very thing `master.py`'s register map
describes — a map that is already second-hand and unattested (§ the position-poll findings). ⚠ A firmware that
reorganises the Modbus memory map may move, or may already have moved, the addresses we are probing.

#### ⛔ WHY IT IS NOT FLASHED YET — the owner's call, and it is the right one
> *"finish the current test though before we update"*

The `0x00` diagnosis is **mid-measurement**. `#279` reads `2` in the file and the controller has not been
rebooted since it was set, so the outstanding test is *reboot, then re-probe*. **Flashing first would confound
the two**: if Modbus then answered, nothing would distinguish "the reboot applied `#279`" from "the new
firmware fixed it", and the unresolved case would be worse still. ⇒ **Reboot and re-probe on `2026-04-10-00`
FIRST. Flash second, as a separate change with its own before/after.**

⚠ Also note the ordering evidence: slave mode was added in **2025-12-11-00** and this machine runs
**2026-04-10-00**, which is later ⇒ **the running firmware already has slave mode.** A missing feature is
therefore NOT an explanation for the `0x00`, and an upgrade is not required to make polling possible.

#### WHEN IT IS FLASHED — the procedure already exists, and one trap in it
`assets/community/modbus-slave-2025-12-11/FLASH-DAY.md` documents the whole USB route (hardware **V1** ⇒ the
`install/` folder, not `psys/`). ⛔⛔ **Its central warning applies unchanged: never put the `setting` file in
the install folder** — the OEM read-me states that restores FACTORY parameters, which would wipe axes,
envelope, tool table and probe params. Back up at the pendant first.

⚠ **And re-run the §13 name-resolution sweep afterwards.** §13 proved the parameter indices are stable across
four dumps *of firmwares up to 2026-04-10*. A release that reorganises a memory map is exactly the event that
could break that, and `eng` ships inside the update — so the check costs one pass over the new `eng`.

### 14b. ⚠ THREE FIRMWARE DATES on record for related Modbus capabilities — recorded, deliberately NOT resolved to one

`M350-LiveG`'s own README states: *"Controller Firmware Version: Must be `2026-08-03-00` or higher."* That is
a THIRD date, on top of the two §14 already carries — worth laying out on one timeline rather than treating
as a single fact three sources disagree about, because read carefully they may not disagree at all:

```
2025-12-11-00   P279 SLAVE mode added ([[m350-v1-v2-and-modbus-slave]] / community FLASH-DAY.md)
2026-04-10-00   THIS MACHINE'S CURRENT firmware — later than 2025-12-11, so it already has Slave mode
                (§14's own "the running firmware already has slave mode" finding, unchanged by this note)
2026-08-03-00   M350-LiveG's own STATED MINIMUM — §14's "newest release" notes say THIS is the release that
                added register 3000 (G-code injection) + "optimized Modbus memory map"
```

**Likely reconciliation, not yet confirmed on-machine**: these read as three DIFFERENT milestones on one
timeline, not three conflicting claims about the same capability. P279 Slave (live DRO + virtual keypress,
registers 7080/7260/10002/6908) is the OLDER, 2025-12-11 capability — already present on this machine's
2026-04-10 firmware, per §14. Register 3000 (real-time G-code injection) is the NEWER capability, and
§14's own release notes for `2026-08-03-00` name it explicitly — which is consistent with M350-LiveG (a tool
built specifically to use register 3000) requiring that later firmware as its floor. **So the "bigger"
register set M350-LiveG uses may simply not exist yet on this machine's own currently-running 2026-04-10
firmware** — not a contradiction to resolve, but an UNTESTED boundary: whether register 3000 already answers
on `2026-04-10-00` (in which case M350-LiveG's own stated minimum is conservative) or genuinely does not (in
which case it is exact) is unconfirmed either way and reads directly off the machine — the memory map itself
may differ ("optimized memory map" is the release note's own phrase), so a register that exists on one
firmware existing at the SAME address on another is not something to assume from a README alone.

⚠ **This is recorded, not resolved.** At least two of the three dates could be doing double duty (documenting
vs. introducing a capability) or all three could be exactly what they say — settling it needs the owner's own
controller (confirm whether 3000 responds on the currently-running `2026-04-10-00` before or instead of
flashing `2026-08-03-00`), not a judgment call made here.

⚠ **CORRECTION (owner, 2026-09-02): `M350-LiveG` itself is NOT a firmware — it is the Windows EXE tool
(`M350_LiveG_v1.7.exe`, §14's own line 789), and `github.com/foinnc/M350-LiveG` is that TOOL's own source repo
(its own release/version history, unrelated to the CONTROLLER's firmware). This section's own heading/diagram
("THREE FIRMWARE DATES", listing `2026-08-03-00` as "M350-LiveG's own STATED MINIMUM") reads easily as if
LiveG carried a firmware of its own — it does not. `2026-08-03-00` is ONLY a claim made in that tool's own
README about what CONTROLLER firmware version it expects to find — not something verifiable from the LiveG
repo/release history itself, and not a firmware LiveG ships or is versioned against. Everything else in this
section's own reconciliation (the timeline, the unconfirmed register-3000 boundary) is unaffected — only the
framing of what "2026-08-03-00" IS (a controller-firmware claim IN a tool's README) needed correcting.

**Confirmed as a match, worth recording plainly**: M350-LiveG's own stated parameter block —
`P267`=B115200, `P279`=Slave, `P296`=None, `P297`=1 — matches this machine's own captured `setting` values
for the SAME four params exactly (§ this file's own SYSDISK dump readings, `#267`/`#279`/`#296`/`#297`).
Independent corroboration of the transport-level config, regardless of which firmware-date question above
turns out to matter.

### 15. ⭐⭐⭐ THE Z OFFSET IS THREE ADDITIVE TERMS — measured on the machine `[CONFIRMED 2026-08-25]`
*(Bench session with the owner at the pendant. Macros V18a-V18e, all motion-free; the only movement was a
0.01 mm jog. No WCS was written. §9's "unidentified extra row" and §12's hedge are both settled here.)*

```
work Z = machine Z − ( WCS Z  +  tool-table Z  +  H offset )
```

| term | macro addr | file | applied |
|---|---|---|---|
| **WCS Z** (active system) | `#[800+n*5+2]` | `setting[300+n*5+2]` | always |
| **tool-table Z** (active tool) | `#1430` | `setting[930]`, live copy at `setting[342]` | ⭐ **always** — written by the probe |
| **H offset** | `#900` | `setting[400]` | only while selected by `G43 H01`; **`M30` resets it** |

**The measurement.** With G54 active, tool T1, machine Z `−5.003`:
```
H not selected   work Z = 99.841   ⇒ offset −104.844  =  −36.508 + −68.336
G43 H01, H01=10  work Z = 89.841   ⇒ offset  −94.844  =  −36.508 + −68.336 + 10
M30              work Z = 99.841   ⇒ offset −104.844   (H reset to H00)
```
The 10.000 appears and disappears exactly. `[CONFIRMED — owner observed the DRO change and revert]`

### 16. ⛔⛔ THE H WORD NEEDS TWO DIGITS — `H1` IS SILENTLY IGNORED
`G43 H1` and `G43 H01` differ only in the digit count. The first leaves the modal H field at **`H00`**; the
second sets it to **`H01`**. **No error, no alarm, nothing in the system log** — the one-digit form is simply
discarded, and `G43` still latches, so it *looks* like it worked.

⇒ ⛔ **Always emit two digits.** This is the silent-failure class: a program asking for a tool offset and
receiving none, with every indication of success. It cost most of this bench session to find.

### 17. ~~EVERY POSTED PROGRAM CARRIES H01 AND IT BINDS~~ ⛔ **WITHDRAWN — see §22.** It does NOT bind without `G43`.
The Fusion post writes it on the first Z move, unprompted — the owner confirmed it is not a deliberate choice:
```
G00X405.724Y60.991
Z15.24H01        <- the post's own output; the file contains NO G43 at all
```
That form is the one that **works** (§16). ⇒ **The only thing keeping this harmless is that the H table has
always been zeros.** Put a value in `#400` and every posted program silently shifts Z by it, from its first Z
move until `M30`. On a machine where **G54 Z0 = the spoilboard is SACRED**, that is a tool through the table.

⚠ Note the asymmetry that makes it worse: the post emits `H01` but no `G43`, and `H01` alone was NOT observed
to bind — only `G43 H01` was tested. **Whether the bare `H01` on a Z move applies the offset is UNTESTED**,
and it is the case that actually matters for real programs. ⇒ Next bench item.

### 18. ⚠ `G49` DOES NOT CLEAR A LATCHED `G43` (display only) — ⛔ **SUPERSEDED by §21: G49 cancels a LIVE offset correctly.**
Running `G49` left the modal block reading `G43`. Both attested corpus forms exist (standalone ×4, and
`G90 G17 G80 G49 M05 M09` ×14), so this is not a syntax error.
⛔ **But this proves nothing about cancelling an offset**: every `G49` run had `H00` selected, so there was
never anything to cancel. `M30` is the only reset observed to work. `[G49 with a live offset: UNTESTED]`

### 19. ~~THE setting FILE IS STALE RELATIVE TO RAM~~ ⛔⛔ **WRONG — WITHDRAWN 2026-08-25. It is NOT stale.**
> **Retested properly and the claim is false.** A pendant edit of `#131` reached the disk immediately, and a
> MACRO write of the same parameter (`#631 = 4`, V19) reached it too — `setting[131]` read `4.0` while the
> value was live. **Both writers flush. The file is trustworthy.**
>
> ⚠ **How I got it wrong, because the mistake is the lesson:** the original reading compared `setting[400]`
> against "the macro read H01 back as 10.000" — but those were **not the same moment**. `V18b` had already
> restored H01 to `0` before the disk was read, so `0.0` was simply CORRECT. One uncontrolled observation,
> promoted to "an app-level hazard, bigger than the G43 question", and it propagated: RENDERRANCHY halted
> work behind it (*"I am not building against a pull I cannot date"*).
> ⛔ **The control that was missing cost nothing**: change ONE parameter, by ONE writer, and read it back
> while it is still live. That is V19, and it is four lines.

**The original claim, kept for the record:**
A macro wrote `#900 = 10.0` and read it back as `10.000`. **`setting[400]` on disk still read `0.0`**, and a
sha256 diff of **all 184 SYSDISK state files showed ZERO changes.** ⇒ the controller holds parameters in RAM
and the file is a snapshot from some earlier flush.

⇒ ⚠ **This is an app-level hazard, not a curiosity.** Everything the bridge pulls — WCS, tool table, geometry
— is decoded from this file. A value changed at the pendant or by a macro can be invisible to a pull until
whatever triggers a flush happens. **What triggers the flush is UNKNOWN and is the next thing to establish.**
Baselines for the diff: `bench/g49-before.json`, `bench/sysdisk-baseline-2026-08-25.json`.

### 20. ⭐ `eng` ENCODES THE PANEL LAYOUT — `-m` is the Param-page SECTION
Verified against photographs of the pendant:

| tag | section | evidence |
|---|---|---|
| `-m13` | **Backlash** | holds `#195-200` **and** `#400-415` — which is why "H01 tool length offset" is found under *Backlash*, a grouping no one would guess |
| `-m8` | **Probe** | `#128`/`#129` (the `THK Of Probe 5.000` on screen), `#135-137` fixed-probe positions |
| `-m15` | **System** | `#266`/`#267` baud, `#279` Modbus, `#284` net boot, `#296`/`#297` |

Panel section list, in order: Machine · Manual · Process · Spindle · IO · Home · Probe · Hard Limit ·
Software limit · MPG · Backlash · Tools · System.

⇒ **Any parameter can now be located on the pendant from `eng` alone** — section, name, range and units — with
no hunting. ⭐ Combined with §11 (`eng` index == `setting` index) and the `−500` macro rule, one file answers
*what a slot means*, *where it is on screen*, and *how a macro addresses it*.

⛔ **SECTIONS GATHER SCATTERED RANGES — the numbering has NOTHING to do with the grouping.** Confirmed on a
second section: **Home** (`-m7`) holds `#100-118`, `#122-127` **and** `#235-239`; **Probe** (`-m8`) holds
`#128-132` and `#135-141` — so `#127` and `#128` sit in different sections while `#127` and `#235` share one.
⇒ ⚠ **Never look for a parameter by scrolling to its number.** That is why `#400` could not be found: it is
numerically far from everything around it on screen, and only `-m13` locates it.

⇒ ⭐ **THE FULL MAP IS GENERATED AND COMMITTED: [`PARAM-PAGE-MAP.md`](PARAM-PAGE-MAP.md)** — all 13
sections, every parameter with its unit and edit permission. Read that rather than the summary below.

**The section map, straight out of `eng`** (`-m` ⇒ the ranges it gathers):
```
-m7  Home           100-118  122-127  235-239        [CONFIRMED against the pendant]
-m8  Probe          128-132  135-141                 [CONFIRMED]
-m13 Backlash       190-200  400-415  420-435        [CONFIRMED]
-m14 Tools          800-803 805-827 830-945 973-992 999   (144 params)
-m15 System         240-248 266-269 278-279 284 296-297
-m9  150-154   -m10 155-170   -m11 171-185           [Hard Limit / Software limit / MPG — inferred from
                                                      #155 "Enable software limits" landing in -m10]
-m0..-m6   the first five sections (Machine/Manual/Process/Spindle/IO), boundaries not yet read off screen
-m16..-m31 ranges 500-1105, beyond the 13-entry Param List — other screens
```

**`-p` gates EDITING, not visibility.** ⭐ Corrected by the owner: *"we can see all the param no matter our
privilege but edit may be gated."* So the pendant's footer `User:` field states the level required to CHANGE
that parameter, and every parameter is readable at any level. All 38 `-p1` entries are machine-definition
(machine type, RTCP, axis names/types/vectors, kinematics, comms, home mode); the other 539 are
operator-editable. 13 of the 38 also say *"Restart takes effect"*; **zero** `-p0` entries do.
⇒ ⛔ This also means a `-p1` parameter can be READ by anything at any time — the gate is on writes only.

### 21. ⭐⭐⭐ G43/G49 CLOSED — the mechanism is FULLY FUNCTIONAL, and §17's hazard is WITHDRAWN
*(V18f and V18g, 2026-08-25. Both macros compute the applied offset themselves as `#882 − #792` and print it,
so nothing depends on reading a DRO the message box covers. Motion-free; H01 saved and restored by the macro.)*

**Every measurement, one table:**

| step | applied Z offset | verdict |
|---|---|---|
| nothing selected | `−104.844` | WCS + tool-table only |
| `G43 H01` (H01 = 10) | **`−94.844`** | ⭐ applies, exactly 10 |
| `G49` | **`−104.844`** | ⭐ **cancels, exactly** |
| bare `H01`, no `G43` | `−104.844` | ⛔ **does NOT bind** |
| `G43 H1` (one digit) | `−104.844`, modal stays `H00` | ⛔ silently ignored (§16) |
| `M30` | `−104.844` | resets the selection |

⇒ **`G43`/`G49` are a correctly working pair.** Both the "G43 is cosmetic" and "G49 is ignored" hypotheses are
**REFUTED**. §18's observation that a latched `G43` survived a `G49` was real but proved nothing about
cancelling — nothing was selected, so there was nothing to cancel; with a live offset the modal block flipped
back to `G49` *and* the offset returned. ⛔ Do not cite §18 as evidence that `G49` is broken.

### 22. ⛔ `G43` IS REQUIRED TO ARM THE H OFFSET — a bare `H` word does nothing
`H01` on its own line **parses without error and has no effect**: the modal H field stayed `H00` and the offset
did not move. ⇒ the H word is not self-arming on this controller. `[CONFIRMED]`

⭐⭐ **THEREFORE §17'S HAZARD IS WITHDRAWN.** §17 claimed every posted program was carrying a live tool offset
because the Fusion post writes `Z15.24H01`. **It is not**, and the reason is the very thing that made the post
look dangerous: those files contain **no `G43` anywhere**, and without `G43` the `H01` does not bind. The two
facts cancel. ⇒ Posted programs are inert with respect to the H table, and putting a value in `#400` would
**not** silently shift them.

⚠ **ONE CASE REMAINS UNTESTED, and it is the exact posted form.** The corpus writes `H01` **attached to a
motion word** (`Z15.24H01`); what was tested is `H01` alone on its own line. Some controllers latch an H word
on any block, others only alongside motion. ⇒ `[H-word-on-a-Z-move without G43: UNTESTED]` — it needs a real Z
move, so it is a deliberate, human-present bench item, not something to slip into a macro.
⇒ Until that runs, treat §22's conclusion as **strongly supported but not total**: the safe reading is that the
H table should be left at zero regardless, which costs nothing since nothing on this machine uses it.

### 23. ⭐ THE SELF-READ MEASUREMENT METHOD IS VALIDATED
`#792` (workpiece Z) **does** track an offset change live, inside a running macro: V18g's own
`none → selected` step moved by exactly 10.000 with no motion and no screen involved.

⇒ ⭐ **This retroactively validates V18f's null result** — the bare-`H01` reading of "no change" is a real
measurement, not a blind instrument. And it establishes the pattern for every future offset question here:
```
#111 = [#882 - #792]      ( sample the applied offset      )
<the instruction under test>
#112 = [#882 - #792]      ( sample it again                )
#1510 = #111
#1511 = #112
#1505 = -5000(before=%.3f after=%.3f)
```
⛔ Worth preferring over reading the pendant: the message box sits over the Z row for exactly the window in
which a modal offset is live, and `M30` resets the selection before the dialog clears — which is why three
earlier attempts at this question came back ambiguous.

### 24. ⭐⭐ WHO USES THE H TABLE, THEN? — the V4.1's ATC does, the Expert's does not
*(Owner's question: "so other users might use it though right, its for atc?" Answered from the vendor's own
macros rather than reasoning, and the answer differs per controller — which is the whole point of this folder.)*

| | how a tool length offset is STORED | how it is APPLIED |
|---|---|---|
| **Expert M350** | native tool table `#1430+` = `setting[930+]`, written by the probe | ⭐ **unconditionally** — no `G43`, no `H` word (§15) |
| **V4.1** | ⭐ **the H table** `#764+` = `eng #264+` "H01 tool length" | ⭐ **`G43 H#17`** — the vendor's own factory M6 |

**The V4.1's factory `M6`, extracted from the manufacturer dump** (`FACTORY_MACROS['ddcs-v41']`):
```gcode
IF#1405==0GOTO3
G0G53Z#1302
G0G53X#1300Y#1301
MarcoDialog "M6.rc"
G43H#17                        <- applies the offset through G43/H
...
#[764+#1824-1]=#[1560+#1824]   <- writes the probed result INTO the H table
```
`#764` is the V4.1's H01: its `eng` names `#264` "H01 tool length", and `#264 + 500 = #764` by the same macro
rule as everywhere else (§11). ⇒ **On a V4.1 the probe result lands in the H table and is applied by `G43`.
On the Expert it lands in the native tool table and is applied always.** `[CONFIRMED — vendor macro + eng]`

⇒ **So yes, `G43`/`H` is a real, used mechanism** — just not this controller's. The Expert implements it
correctly (§21) and simply does not use it for its own ATC. Anyone posting Fanuc-style G-code, or coming from
a V4.1, will exercise it.

### 25. ⛔⛔ THE DOUBLE-OFFSET HAZARD — the one that IS real on the Expert
§17's posted-program alarm was withdrawn (§22). **This is the hazard that survives, and it is sharper:**

On the Expert the three terms **stack** (§15) — and the tool-table term is applied whether you ask for it or
not. So a program that ALSO carries `G43 H<n>`, with a value in the H table, applies the tool length **twice**:

```
work Z = machine Z − ( WCS Z  +  tool-table Z  +  H offset )
                                 ^ probe-written    ^ posted G43
                                 always on          added on top
```
That is exactly the `−104.844 → −94.844` measured in §21: the H term added to a tool-table term that was
already there. ⚠ **A V4.1 user's habits, or a Fanuc-style post, would produce precisely this** — and on a
machine where **G54 Z0 = the spoilboard is SACRED**, a doubled tool length is a tool into the table.

⇒ ⛔ **On an Expert, use ONE mechanism, never both.** The native tool table is the one the probe and the ATC
workflow already use, so the H table stays at zero. `[app-side: Studio must not emit G43/H for an Expert
profile — RENDERRANCHY's call, flagged not built]`
⭐ Note Studio does not emit `G43` today: the only occurrence in `web/` is inside the V4.1's *extracted vendor*
macro, never in an emit path.

### 26. ⭐⭐⭐ MODBUS POSITION POLLING WORKS — the reboot was the whole fix `[CONFIRMED 2026-08-26]`
**Captured immediately before flashing firmware `2026-09-02-00`, whose only release note is
*"Expanded Modbus register address mapping."*** ⇒ if the addresses move, this is the before-state.

**Baseline: firmware `2026-04-10-00`, `#279 = 2` (Slave), COM6 @ 115200 8N1, slave id 1, read-only FC03.**

```
7080   work position    01031ba8000a42c9  ->  01 03 14 851f c234 2d0e 4425 b021 42c7 3c6a 4425 0000 0000
7260   machine position 01031c5c000a024f  ->  01 03 14 0000 40a0 0000 c0a0 0000 c0a0 0000 c0a0 0000 0000
10002  state            0103271200026eba  ->  01 03 04 0000 0000
```

**Decoded — and it matches the pendant on every axis:**
```
              X          Y          Z          A        B
7080 work   -45.1300   660.7040    99.8440   660.9440   0.0000    == the pendant's "Abs"
7260 mach     5.0000    -5.0000    -5.0000    -5.0000   0.0000    == the pendant's "Mach"
10002 state       0
```

⭐ **ENCODING: word-swapped float32 — LOW WORD FIRST.** `0000 40a0` → `0x40a00000` → `5.0`. Two registers
per axis, five axes per block. ⛔ Not plain big-endian; a straight `>f` over the payload gives garbage.

⇒ **Three things settled at once:**
1. ⭐ **The reboot was the entire fix.** `#279` was set but serial parameters only apply at startup, and the
   machine had not restarted since. Every earlier probe answered a single `0x00` byte — *"no slave answering"*,
   exactly as diagnosed, and NOT a wrong register map.
2. ⭐ **The register map is CORRECT.** `7080` / `7260` / `10002` were second-hand from
   foinnc/M3X-M350-IoT-Bridge and carried as `[unattested]` for months. They are right.
   ⛔ Strike every note calling them suspect.
3. ⭐ `master.py`'s `ModbusMaster` needs no address change — only the word-swap decode, which it does not do
   yet (it returns raw registers by design).

⚠ **A live-slave caveat worth keeping:** the first bytes of each reply are line noise (`010000…`, `000000f2…`)
before the real `01 03 <len>` frame. A parser must **find the frame**, not assume it starts at byte 0 —
pymodbus reported *"Incomplete message received"* on exactly this.

⛔ **AFTER THE FLASH, RE-RUN THIS FIRST.** The new firmware expands the register mapping, so these three
addresses are the first thing to re-verify — before anything is built on them.

### 27. ⛔⛔ SYSTEM MACROS CANNOT BE EDITED OVER SMB — the controller restores its own at boot `[CONFIRMED 2026-08-26]`
Four files were written to SYSDISK over SMB and **read back byte-correct**. After the next power-cycle:

```
sysstart.nc   661B -> 6B   (factory stub)        ⛔ reverted
fndzero.nc    375B -> 59B                        ⛔ reverted
fndY.nc       288B -> 15B                        ⛔ reverted
slib-g.nc     patched (4 edits) -> factory       ⛔ reverted
SETPROBE.nc   455B -> 455B                       ✅ SURVIVED
```

⭐ **The rule is exact: a file whose name is in the FLASH PAYLOAD is restored at boot. A new file is not.**
`SETPROBE.nc` is not a firmware file, so nothing existed to put back. ⇒ **Any system macro shipped by the
firmware is effectively read-only over the network**, no matter what a write reports.

⚠ **A successful write and a correct read-back prove NOTHING here.** Both happened, and both were undone by
the reboot. ⛔ Verify persistence across a power-cycle, not at write time.

⇒ **This invalidated the documented restore procedure** in `RESTORE-CUSTOM-MACROS/README.md`, which said to
copy the files onto SYSDISK after a flash. It cannot work. The README now carries the corrected route.

### ⭐ THE ROUTE THAT WORKS — put the customisations IN the flash payload
Patch `install/slib-g.nc` **on the USB stick** and drop the custom `sysstart.nc` / `fndzero.nc` / `fndY.nc` /
`SETPROBE.nc` in beside it, then flash. The controller's own copy then IS the patched one, so there is
nothing for it to revert to. `[CONFIRMED — owner, 2026-08-26: "Works perfectly."]`

⚠ Two traps found while doing it:
* `patch-slib-g.py` leaves a **`slib-g.nc.prepatch`** next to its target — ⛔ delete it before flashing, it
  must not ship inside the payload.
* The release ships a bare **`setting`** as a separate asset. ⛔ It must never go in `install/`; the OEM
  read-me states that restores factory parameters, wiping axes, envelope, tool table and probe config.

⭐ **What this cost, and the tell:** a flash reverts `slib-g.nc`, which re-arms the factory tool-setter bug —
the rapid `G53 Z#637` descent **through** the setter before any `G31` runs. It also reverts `fndzero.nc` /
`fndY.nc`, so homing stops syncing A to Y and **racks the gantry** (observed: A `−5.178` vs Y `−5.000`).
⇒ ⛔ **After ANY flash, assume every system macro is factory until verified** — and verify by content, not by
file size or a hash against a stale capture.

### 28. ⭐⭐⭐ THE WHOLE PARAMETER TABLE IS READABLE OVER MODBUS — one formula `[CONFIRMED 2026-08-26]`
*(Firmware `2026-09-02-00`, read-only FC03, slave 1, COM6 @ 115200 8N1.)*

```
Modbus register = 6500 + 2 × (setting index)        word-swapped float32, LOW WORD FIRST
```

**Verified on 21 parameters, 21/21 exact**, spread across the whole table and checked against
`SYSDISK/setting` decoded independently:

| param | reg | value | | param | reg | value |
|---|---|---|---|---|---|---|
| `#64` Maximum speed | 6628 | 12000 | | `#166` X positive soft limit | 6832 | 756 |
| `#82` Max spindle speed | 6664 | 24000 | | `#279` Modbus RTU | 7058 | 2 |
| `#122-124` home positions | 6744-48 | 5 / −5 / −5 | | `#295` Feed rate max | 7090 | 300 |
| `#131/132` probe count/speed | 6762/64 | 2 / 800 | | `#305` **G54 X** | 7110 | 50.130 |
| `#135-137` fixed probe XYZ | 6770-74 | 682 / −775 / −3 | | `#400` H01 tool length | 7300 | 0 |
| `#155` soft limits enabled | 6810 | 1 | | `#930` **T01 Z offset** | 8360 | −68.336 |

⭐⭐ **THIS CLOSES THE ADDRESS CHAIN.** Every representation of a controller value is now one index:
```
macro #N   ↔   setting[N−500]   ↔   eng entry #(N−500)   ↔   Modbus reg 6500 + 2×(N−500)
```
⇒ The `7080` / `7260` / `10002` position registers were never special — `7080 = 6500 + 2×290` and
`7260 = 6500 + 2×380`. They are **the same flat space**, and `7100` is `setting[300]`, the WCS table's
row 0, which reads `47.650` over Modbus exactly as it does in the file.

⇒ ⭐ **The bridge can read the entire machine state live over serial** — WCS table, tool table, soft limits,
probe config, positions — with **no SMB, no file, no staleness question**. That is a materially better
instrument than the file for anything the app pulls.

⚠ **NOT yet established:** whether the position slots TRACK during motion or only reflect the last flush.
The machine was stationary, and the file happened to agree with Modbus on every slot, so the two cannot be
separated from this session. ⇒ **One jog while polling settles it** — a bench item, human present.

### The flash did NOT move anything `[CONFIRMED]`
`2026-09-02-00`'s only release note is *"Expanded Modbus register address mapping."* Re-probed after the
flash: `7080` / `7260` / `10002` return **identical values** to the pre-flash baseline (§26). ⇒ the release
**ADDED** reach, it did not relocate what existed. ⛔ Do not treat a Modbus firmware note as a reason to
re-derive addresses without measuring first.

⚠ **A discovery trap worth keeping:** the slave answers **every** address, returning zeros for unmapped
ones — no exception frames. So "does it answer?" maps nothing; only **non-zero content** does. The populated
region is roughly `6600`–`9101`.

### 29. ⭐⭐⭐ THE POSITION REGISTERS TRACK LIVE DURING MOTION `[CONFIRMED 2026-08-26]`
The open question from §28, settled by one continuous jog while polling `7260` (machine X/Y/Z):

```
t= 0.56s   X= 11.714   Y= -269.850
t= 2.23s   X= 11.714   Y= -287.328     <- mid-move
t= 8.31s   X= 11.714   Y= -359.446     <- mid-move
t=17.68s   X= 11.714   Y= -478.944     <- mid-move
t=18.24s   X= 15.134   Y= -480.962     <- Y stops, X starts
t=20.45s   X= 38.778   Y= -480.962
```
**35 distinct positions in 20 s**, sweeping smoothly across a 211 mm Y move and then an X move.
⇒ ⛔ **Not a flush and not a stop-value — the register follows the axis continuously.** `[CONFIRMED]`

⭐⭐ **THIS IS THE PROGRESS SOURCE THE PROJECT HAS BEEN APPROXIMATING.** Live machine position, read over
serial, with **no instrumentation of the G-code at all** — no beacons, no `MSETDATA` checkpoints, no
`checkpoint_insert.py` pass, nothing added to the emitted program. ⇒ The beacon architecture exists to answer
"how far along is this job", and this answers it directly and continuously.
⚠ It gives POSITION, not a line number. Turning position into progress still needs the cursor design
(`JOB-PROGRESS-PLAN.md`) — but the input to that cursor now exists and is free.

**Sample rate: 1.9 Hz as measured — and that is MY loop, not the link.** The poll used a fixed 45 ms sleep
plus a 0.5 s read timeout. A ~30-byte FC03 round trip at 115200 8N1 is well under 10 ms, so the ceiling is far
higher; treat 1.9 Hz as a floor to tune, not a property of the controller.

⚠ **Read-only throughout** — plain FC03, never `MGETDATA`. The machine was jogged by the owner, by hand, at
the pendant; nothing here commanded motion.

### 30. ⭐⭐⭐ G-CODE INJECTION OVER MODBUS WORKS — the PC can make the controller execute a line `[CONFIRMED 2026-08-26]`
The `2026-08-03-00` feature, proven on `2026-09-02-00`. `#1505=-5000(MODBUS OK)` was written over serial and
**`[0000]:MODBUS OK` appeared on the pendant.** ⇒ the controller **parses and EXECUTES** what is injected — it
is not a buffer someone else has to read.

**THE PROTOCOL, all of it:**
```
function   FC16 (write multiple registers)
register   3000
payload    ASCII G-code, one line, trailing \n, ≤ 246 bytes (firmware's own limit)
packing    ⭐ LITTLE-ENDIAN WITHIN EACH REGISTER — FIRST character in the LOW byte
buffer     drains after the controller consumes it (FC03 readback returns zeros)
```

⭐⭐ **THE BYTE ORDER IS THE WHOLE PROTOCOL, and the controller told us it.** Packed big-endian first, the
pendant answered:
```
sent:      # 1 5 0 5 = - 5 0 0 0 ( M O D B U S   O K )
error:     1 # 0 5 = 5 5 - 0 0 ( 0 O M B D S U O   ) K      <- every byte pair reversed
```
⇒ ⭐ **A syntax error that echoes your payload back is a gift** — it named the defect exactly. Same
convention as the word-swapped float32s (§28): **this controller is little-endian throughout.**

### ⛔⛔ WHAT THIS CHANGES, AND THE LINE IT CROSSES
This is the **first capability in this project that lets the PC command the machine.** Everything before it
was read-only by construction. It answers the ROADMAP's standing open experiment — *"remote start without the
panel — this is the gate for hands-free delivery→run"* — and it does so with **no G-code instrumentation and
no macro on the controller**.

⛔ **The standing rule still holds: delivery is automatic, RUNNING is operator-pressed.** A channel that can
send `#1505` can send `G1 Z-50 F1000`. Nothing about this finding relaxes that rule; it makes it load-bearing.

⇒ ⭐ **The guard lives in code, not in intent:**
`controllers/expert-m350/tools/modbus_inject.py` **refuses in code** any payload containing a G or M code, an
axis letter followed by a value, a feed/spindle word, or a tool change — checked before the port is opened,
and unit-tested against `G0 X10`, `G1 Z-5 F100`, `M3 S12000`, `X10.5`, `M30`, `T2`. ⛔ Removing that guard is
a deliberate act requiring the owner's ruling, not a convenience while debugging.

⚠ **Untested and deliberately so:** whether an injected line can START a loaded program, and what happens if
one is injected while a program is running. Both need the owner present and a reason.

### 31. ⭐⭐⭐ A UNIVERSAL VARIABLE READER — injection + a scratch register reaches ANY variable `[CONFIRMED 2026-08-26]`
Modbus maps `setting` indices 0..~1300 (§28) and nothing above. Injection (§30) closes the gap:

```
1. inject   #915 = #<target>          (#915 = H16 tool length offset -- unused, 0, range +/-9999)
2. read     register 7330             (= 6500 + 2*415, the same slot over Modbus)
3. inject   #915 = 0                  (restore)
```
**Proven on six variables the register map cannot reach:**

| variable | | value |
|---|---|---|
| `#2500` | tool-setter calibration reference | **−0.4612** |
| `#1927` | last probe touch Z | −5.000 |
| `#1300` | current tool number | 1 |
| `#578` | active coordinate system | 1 (G54) — matches `setting[78]` ✓ |
| `#792` | live workpiece Z | 99.844 — matches the DRO ✓ |

⇒ ⭐ **Every variable on the controller is now readable from the PC over one serial cable** — persistent
vars, probe results, live state, anything the macro language can name. Combined with §28 (the parameter
table) and §29 (live positions), the controller has no interior left that the bridge cannot see.

⚠ **Choose the scratch slot carefully.** `#915` works because H16 is unused here, holds 0, and has a
±9999.999 range — a narrow-range parameter would silently clamp or reject the value. ⛔ Restore it; leaving a
value in an H slot is exactly the latent hazard §17/§22 chased.

### ⭐ AND IT ANSWERS THE CALIBRATION QUESTION: `#2500` SURVIVED
`#2500 = −0.4612`, not zero — so the flash did not lose it, and the patched `slib-g` O502 will write
`#1430 = touch − #2500` against a real reference.

⚠ **That it EXISTS is confirmed. That it is CORRECT is not.** The expected relation is
`#2500 = [setter touch #1927] − [that tool's #1430]`, and with the current readings (`#1927 = −5.000`,
`#1430 = −68.336`) that would be `63.336`, not `−0.4612`. ⇒ `#1927` reads like a stale home position rather
than a real touch, so the mismatch is probably a stale input, not a bad reference — **but it is not proven.**
⇒ ⛔ The physical check is the only real one, and it is the documented one: **jog to `G54 Z0`; the tip should
sit on the spoilboard.** Off by ~2× means the sign is flipped. Do that before trusting a tool change.

### 32. ⛔⛔ A RUNNING OR PAUSED MACRO'S WRITES ARE NOT VISIBLE OVER MODBUS UNTIL IT COMPLETES `[CONFIRMED 2026-08-26]`
`CALIBRATE.nc` was run. It computes `#2500 = [#34 - #36]` and only THEN puts up a `#1505` dialog. While it
sat at that dialog, waiting for Enter:

```
#2500  read 0.0000        #1927  read 0.0000
```
After Enter — the macro completing, nothing else changing:
```
#2500  read -1.9204       #1927  read -70.2480
#1927 - #1430 = -70.2480 - (-68.3276) = -1.9204  == stored #2500   ✓ exact
```
⇒ The store had ALREADY executed, two lines before the dialog. **The values were simply not readable yet.**

⭐ **Contrast with a single INJECTED line, which commits immediately** — `#631 = 3` was readable at once (§30).
⇒ The rule is not "macro writes are slow"; it is **"an in-flight macro's state is not exported."**

⚠⚠ **THIS CONSTRAINS JOB TRACKING, and it is the useful half.** Live POSITION tracks continuously during
motion (§29) — that is unaffected. But **any variable a running program maintains reads STALE**, so a progress
design that polls a macro-kept counter or cursor will silently read the value from before the program started.
⇒ ⛔ Build progress on POSITION and the state register, not on variables the program writes.

### ⚠ AND THE PROCESS LESSON, because it recurred four times in one day
Read `#2500 = 0`, I declared the calibration had failed and asked the owner what had gone wrong. Nothing had.
The owner then said: *"the dialogue appeared but i didnt press enter before i said i ran calibrate."*

That is the **fourth** time on 2026-08-26 that a real measurement was read correctly and its SIGNIFICANCE was
called wrong: the probe-set tool offset being non-zero (that is what tool offsets are FOR), the unset Z−
soft limit (the one bound whose value changes per job), the "stale setting file" (two readings from different
moments), and this. ⇒ ⭐ **Every one dissolved when the owner supplied ordinary context the measurement could
not carry.** ⛔ Before calling a reading a fault, ask what was happening at the machine when it was taken.

### 33. ⭐⭐ MULTI-LINE SEQUENCES RUN OVER MODBUS — the PC can execute a test program unaided `[CONFIRMED 2026-08-26]`
`V20_read_2500.nc`'s whole body was injected line by line and executed — the `#1505` message appeared on the
pendant and the value read back correctly. **No pendant interaction, no loaded file, no macro on the disk.**

```
#915 = #2500                                        ok
#1510 = #2500                                       ok
#1511 = #1430                                       ok
#1505 = -5000(V20 via modbus ref=%.3f tool=%.3f)    ok   -> message appeared
read back #2500 via register 7330: -1.9204          ✓
```
⚠ ~0.9 s between lines. Faster was not tried; the controller must finish one line before the next arrives.

⇒ **What this seat can now do to the Expert, unaided:**
| | how |
|---|---|
| read any parameter | `6500 + 2×index` (§28) |
| read any variable | inject to a scratch slot, read back (§31) |
| read live position | tracks continuously during motion (§29) |
| execute any single line | injection (§30) |
| **execute a SEQUENCE** | ⭐ this section |
| ⛔ **start a loaded `.nc` file** | **NO PROVEN WAY** |

### ⛔ THE REMAINING GAP — starting a loaded program
Injected lines execute in what behaves like an MDI context. ⭐ **That is almost certainly why the state test
found nothing**: a full-region diff (2,400 registers) across an injected `G04 P25.0` dwell, and again across
four passes while a program was run from the pendant, showed **zero changed registers**. ⇒ Either run-state is
not exported at all, or injected lines never enter it. **Not distinguishable until a program can be started
and watched.**

⚠ This is the ROADMAP's own standing question — *"remote start without the panel: does `sysstart` re-Select
and run a PC-named file, or a `#2037` virtual Start button? This is the gate for hands-free delivery→run."*

Two candidate routes, neither tried:
* **`#2037` virtual buttons** — documented in the `ddcs-expert` skill as pressing panel buttons from G-code.
  ⛔ If a virtual Start exists, **the PC can press Start** — which is exactly the *"running is
  operator-pressed"* line. Needs the owner's ruling on that specific act, not a general permission.
* **`M98 P<O-number>`** — works today, no new capability. ⛔ But every O-number on this controller is a
  factory routine (`O501` homing, `O502` tool-setter) and they MOVE. Only safe with an O-number we wrote.

### 34. ⭐⭐ RUN STATE IS EXPORTED — as COMPLETION COUNTERS, not a running flag `[CONFIRMED 2026-08-26]`
Two registers increment by exactly 1 per program run, and they fire **when the program FINISHES**:

```
idx 201  (reg 6902)      idx 202  (reg 6904)
```
* **3 runs -> +3 on both** (owner ran `V21_dwell.nc` three times).
* **Timing, with a 30 s dwell:** both incremented together, and the owner confirmed from the pendant
  that the count moves **at the end of the run, not when Start is pressed.** ⇒ **COMPLETION signal.**
* `idx 202` also **resets to 0 when a file is (re)loaded**; `idx 201` keeps climbing (255 -> 259 over the
  session, 232 -> 248 across the four weeks before it).

⇒ ⭐ **With §29 this is a job tracker:** live position says WHERE continuously, and a counter increment
says DONE. Neither needs a beacon, an instrumented program, or a macro on the controller.
⚠ Still absent: a "currently running" flag. Nothing found that distinguishes busy from idle *while* a
program runs — 2,400 registers diffed mid-run showed only these two, and only at the end.

### ⛔⛔ `G04 P` IS MILLISECONDS ON THIS CONTROLLER — and it invalidated three of my own tests
`G04 P8.0` is **8 ms**, not 8 seconds. The vendor-pack sweep already recorded this (*"`G04 P1` is 1
millisecond, not 1 s"*) and I did not absorb it. Consequences, all mine:
* every verify macro written today used `P5.0`/`P8.0` and dwelled for **milliseconds** while I described
  them as holding for seconds. What actually held the screen was the `#1505` dialog waiting for Enter.
* the "inject a dwell and watch" test sent `G04 P25.0` and polled for 12 s — the dwell had ended in **25
  ms**. Its "zero registers changed" result was **void**, not evidence.
* ⚠ **In `CALIBRATE.nc` and every macro copying its shape, the `G04` sits AFTER the `#1505` line** — so it
  runs only once the operator has already pressed Enter. It is vestigial in all of them.
⇒ Use `P30000` for 30 s. ⭐ And the general lesson, since it cost most of an evening: **a documented fact
in this repo that I did not read cost more than any unknown did.**

## Evidence sources & verification method — where the ground truth actually lives `[method note, migrated from local memory 2026-09-02]`

Ground truth for a DDCS G-code FORM = the **dumps** under `bridge/controllers/`, never the wizard generator
code or `dialect.js` comments (the code itself marks those "least certain and most likely to change"). Best
references, ranked:

- `tools/appcode/snippets.nc` — curated **"DDCS Compliant"** op snippets (safe-Z retract is `#99=0` then
  `G53 Z#99` — variable, never a literal, and NO `G0`; the smart-probe form needs P/L/Q on `G31`).
- `tools/appcode/words.nc` — word spelling + probe-read (`#51=#1925`) + WCS-register write
  (`#[#70+1]=#53`/`#[#74]=#883`) idioms.
- `assets/capture/<ts>/{SYSDISK,CNCDISK}/*.nc` — raw captured macros + real CAM output.
- The **`eng` file** (each firmware dump ships one) is the param DICTIONARY — every setting-file slot named
  (`#<idx> -t<type> -s1"<name>" -m<group>…`). **Parse it, never reverse-engineer indices from values, and
  never trust a code comment claiming a mapping is "unknown" without checking the capture assets first** — a
  gateway comment once said a register was "not mapped yet" when the dictionary had it the whole time.
- **Skill vs. dump when they disagree:** the `~/.claude/skills/ddcs-expert/` community corpus (patterns from
  real user files, a named-author math reference using the same two-operand `ATAN[y]/[x]` form Studio ships)
  is COMMUNITY-ATTESTED — stronger than pure interpolation, still below a dump. Clean division: **dump = wins
  on config/addressing/state** (param values, soft limits, WCS/tool tables, and DDCS's numbering rule
  **Macro # = ENG/Pr param # + 500**); **skill = wins on runtime behavior** a static dump can't show (the
  variable-priming freeze bug, IF/GOTO syntax) — trust it but verify on-machine where it overlaps a dump.
  Confirmed variable namespace: probe status `#1920-1922`, probe trigger `#1925-1927`, machine DRO `#880-883`,
  WCS base `#805+` (stride 5), tool table `#1430+T-1`; HMI `#1505=1(msg)` blocking / `#1505=-5000(msg)` toast.

## How an operator opens the CAM page on the real controller `[CONFIRMED, from the community corpus, migrated 2026-09-02]`

Bind a panel **K-key (K1–K7) to function code 1399** (the K-key parameter sits in the `Pr210–252` range), then
press it — tap a slot icon → its parameter form → enter values → Start. (Documented path; an additional
touch/menu route may also exist, unconfirmed.) **A slot only appears after its `CAM/` folder is copied to
INTERNAL storage** — running a macro straight off the USB silently does nothing, the single most common
community failure report ("Start does nothing"). Install: FAT32 USB with a root `CAM/` folder → power off →
insert → power on → **F2 → Program → F1 (U-disk) → cursor on CAM → F4 (copy to local)**. Slot labels/defaults
come from the `eng`(+`chs`) language file; Studio's own pack ships `eng-additions.txt` to MERGE, never replace.
Studio-built packs use slots **cam22+** (cam0–9 = factory, cam10–21 = community).

## Rotary probing has NO dumped ground truth — the byte baseline is the wizard's own emit `[TO TEST on-machine]`

No confirmed rotary-probing macro exists anywhere in the DDCS evidence (community corpus, firmware backup,
example macros, `appcode/snippets.nc` all return zero rotary-probe hits — the only 4th-axis firmware content
is A-axis homing). So for the rotary port, "byte-identical to ground truth" resolves to **"byte-identical to
the current wizard emit"** — golden-snapshot the existing output as the baseline rather than chasing a dump
that doesn't exist. It is still SAFE because every primitive the rotary ops fold to (`G31 ..Q1`, status
`IF #192x!=2`, DRO `#88x`, stride-5 WCS, G53-with-#var, two-operand `ATAN`) is dump-confirmed elsewhere — what
is Studio-original / not machine-validated is the rotary SHAPE itself: the 3-point-fit centre solver and the
A-clock. The A-axis WCS column (`#808 = base+3`) is extrapolated, not directly dumped (only X#805/Y#806 appear
in the one capture that shows the pattern) — flag it as such if it ever needs re-deriving.

## `#1504` (requested tool) writability is UNCONFIRMED — do not build an inline preamble on it `[TO TEST]`

`#1504` = "requested tool [Tn M6]" and `#1300` = "tool in spindle" — the T.nc generators dispatch on both, but
**`#1504` appears ONLY in Studio's own generator + tests, never in a real M350 dump or the community-attested
corpus.** The controller populates it when a `Tn M6` fires; whether user-code can write it directly
(`#1504 = n`) is unconfirmed. By contrast `#1300` **is** confirmed directly writable (`#1300 = 1` appears in a
real community multi-tool pattern). Consequence: an inline tool-change fallback cannot reliably set the
requested tool without a real `Tn M6` — Studio's `atc_change` inline fallback greys the fixed-tool field
instead of emitting an unconfirmed `#1504=n` preamble. A register NAME appearing in the generator is not
confirmed usage — verify against a real dump before trusting it, the same caution `machine-facts-vs-macro`
names for Pr-value facts.

## M350-LiveG's own register 3000 (G-code inject) is already tracked above (§ line ~1466); its OWN keypress register is NOT yet `[EVIDENCE, unattested]`

The OEM's `M350-LiveG` app (github `foinnc/M350-LiveG`) ALSO writes **register 6908** (fn 0x10, 2 registers:
`keyCode` low 16 bits / `actionState` high 16) as a **virtual KEYPRESS** — X± `0x015e`/`0x015f`, Y±
`0x0160`/`0x0161`, Z± `0x0162`/`0x0163`, A± `0x0164`/`0x0165`, B± `0x0109`/`0x0166`, START `0x0148`, PAUSE
`0x0149`, RESET `0x0147`, HF/LF `0x0184`, F1–F6 `0x0600`–`0x0605`. Read off another project's own working
implementation (`foinnc/M3X-M350-IoT-Bridge`), never bench-verified on this controller — evidence, not
attestation, same caveat as everything else sourced from that repo. **One write to 6908 can start/pause/reset/
jog a real machine** — gate any use of it the same way `context/PRODUCT-PRINCIPLES.md` §14 (read-only when the
owner is not physically at the machine) already requires; do not fold it into the read-only live-DRO work
(register 7080/7260/10002, already tracked above) as though it were the same risk class.

## M350 hardware V1 vs V2 — a firmware-era split, not a capability split `[researched 2026-07-31, agent report, sources verified]`

This machine (CNC-FAIRY) is **hardware V1**. V1 and V2 run different embedded-OS builds (kernel 2.6.26 vs.
3.2.0 → a different SoC/board, inferred) and ship different firmware zip families (`V1_*` via `install/`,
`V2_*` via `psys/`) — a HARDWARE split, not a tier; V1 is not abandoned, every release including 2026-04-10
ships both. The macro/CAM layer is byte-identical between the two (measured) — Studio's CAM deploy route is
rev-agnostic, no defect there. **The Modbus SLAVE unlock (P279=Slave, live DRO + virtual keypress) needs
firmware ≥ 2025-12-11-00 and applies to BOTH V1 and V2 equally** — it was previously mis-suspected as V2-only;
that is refuted. Serial DB9 5V supply (powers an M3X-style accessory) is present on all V2 units but only SOME
V1 units — check with a multimeter before assuming it's there, or power any external device from USB-C
instead.

## ⭐ THE TRIG GAP IS CLOSED — SQRT/COS/SIN work, and arguments are in DEGREES `[CONFIRMED on machine 2026-09-05, fw 2026-08-03-00, over Modbus]`

Open since the `V13_trig` whole-file abort of 2026-08-08 ate them (safety rule 3: one bad line rejects the
whole file, so COS/SIN/SQRT were never *tested* — they were merely *unobservable*). Closed in one command
using the universal variable reader: inject `#915 = <expr>` at register `3000`, read register `7330`.

| expression | result | |
|---|---|---|
| `SQRT[16]` | `4.0` | |
| `SQRT[2]` | `1.4142135` | |
| `COS[0]` | `1.0` | |
| `SIN[0]` | `0.0` | |
| `TAN[45]` | `1.0` | ⇒ degrees |
| **`COS[90]`** | **`6.12e-17` (= 0)** | ⭐ **cos 90 in RADIANS is −0.448. This is DEGREES.** |
| **`SIN[90]`** | **`1.0`** | ⭐ sin 90 in radians is 0.894. **DEGREES.** |
| `ABS[-5]` | `5.0` | |
| `ROUND[2.6]` | `3.0` | rounds, not truncates |
| `FIX[2.9]` | `2.0` | truncates |

⭐ **DEGREES had never been established here**, and it silently changes every emitted arc. It now is.

### ~~`NE` returns 0 for a true inequality~~ — **REFUTED the same night. `NE` IS CORRECT.** `[CONFIRMED 2026-09-05]`
Re-tested on a scratch variable that was actually accepting writes, sentinel verified before each line:
`[1 NE 2]`→**1**, `[2 NE 1]`→**1**, `[1 NE 1]`→**0**, `[5 NE 5]`→**0**. All correct.
⇒ **`EQ` `NE` `LT` `GT` `LE` `GE` are ALL confirmed good on the Expert.** `NE` is safe to emit.
The original `0.0` was a **stale value left by the `[1 EQ 2]` line before it**, not a measurement. This
closes the `NE` half of the V13 "`NE`/`LT`/`GT` untested" note.

### ⛔⛔ WHY SOME INJECTED WRITES "DON'T TAKE" — **AN EARLIER LINE ERRORED AND LATCHED THE CHANNEL** `[CONFIRMED on machine 2026-09-05, photographed]`
Owner's question, and the right one: *"There must be a reason why some writes aren't effective. We need to
find why."* There is, and it is now proven with the camera:

1. A line with a genuine syntax error **latches** the controller (`ERROR`, red strip, top-left `MPG`→`MDI`).
2. **While latched, EVERY subsequent injection is silently dropped** — the FC16 write is still ACKed at the
   wire level, and the line is discarded. No error, no NAK, nothing observable from the PC.
3. A read-back then returns the variable's **previous** value, which looks exactly like a real answer.
4. Only **Reset at the pendant** clears it.

⇒ **"Some writes aren't effective" is almost always "an earlier line in the same batch errored."**
**Photographed twice:** `syntax error!:L1[#916 = ATAN[45]]` and `syntax error!:L1[#916 = [7 MOD 3]]`. In the
second case a batch reported "no assignment" for the *following* expression too — which had never executed
at all — and then six further numeric writes vanished for the same reason.

⭐ **`MOD` IS A SYNTAX ERROR ON THIS CONTROLLER.** Do not emit it. `[CONFIRMED, photographed]`
⚠ `**` (power) is **still untested** — it was queued behind `MOD` and never ran `[TO TEST]`.

### ⛔ RETRACTED — "WHITESPACE AROUND OPERATORS IS REQUIRED" IS FALSE `[REFUTED 2026-09-05, same session]`
An earlier entry here claimed `[3*3]` was a silent no-op while `[3 * 3]` worked, and generalised it into an
emit hazard. **Wrong.** Re-run with a *retrying* sentinel: `[9-3]`→**6**, `[9/3]`→**3**, `[2*3]`→**6**. Tight
packing is fine. ⚠ The original evidence was a clean alternating pass/fail pattern, and I argued explicitly
that it was "content-dependent, not noise, because the sentinel was verified each time" — but the sentinel
was verified with a **single unverified write**, which is the exact thing that is unreliable. ⇒ *A control is
worthless if it is measured by the instrument under suspicion.*

### ⚠ INJECTED WRITES ARE ALSO DROPPED INTERMITTENTLY, WITH NO ERROR AT ALL `[MEASURED 2026-09-05, cause unresolved]`
Separate from the latch, and it is the reason the latch went undiagnosed so long. Nine numeric writes in a
row to `#916`, pendant green and `READY` throughout: **the 1st and the 9th silently vanished, the middle
seven landed.** Value range is not the cause — `-77777` and `99999` both land, so the "±9999" range note
elsewhere in this file does not apply here.

⇒ **NEVER TRUST AN UNVERIFIED INJECTION.** `tools/macro_probe.py` now writes-reads-retries every numeric
write (`set_var`), and after any "no assignment" it fires a **canary write** to prove the channel is still
alive — without that, one bad expression turns every later result in the batch into a stale-value fiction.
⚠ Root cause of the intermittent drop is **still unknown**; a register-3000 handshake (the buffer reads back
all-zero when idle, so the controller appears to clear it after consuming) was hypothesised but could not be
tested — the controller was latched at the time and the buffer never went busy `[TO TEST]`.

### ⛔ AN ERROR *DOES* BLOCK FURTHER INJECTION — claimed, wrongly retracted, then PROVEN `[CONFIRMED on machine 2026-09-05]`
**Proof:** with `syntax error!:L1[#916 = ATAN[45]]` visibly on the pendant, `#917 = 3141` was injected and
**dropped** — `#917` stayed at `4321`. The FC16 write is still ACKed at the wire level; the line is discarded.

⚠ **This entry was retracted earlier the same night and the retraction was WRONG.** The "disproof" was that
an expression injected right after `[3*3]` worked — but `[3*3]` **never raised an error** (above), so nothing
was ever being tested. ⇒ *A refutation is only as good as the trigger it assumes fired.*

⭐ Consequence: **a read-back after a blocked injection returns the previous value**, which looks exactly like
a plausible answer. This produced nine consecutive false readings of `1.0` in the trig run. **THE SENTINEL
MUST BE WRITTEN AND READ BACK** — a dead channel drops the sentinel too, so "read-back differs from sentinel"
passes every time. `tools/macro_probe.py` does this and halts.

**Clearing:** the owner must press **Reset** `[CONFIRMED — owner, 2026-09-05: "Errors don't resolve on their
own. I need to press reset."]`. `#2037 = 65863` cannot do it, since that press uses the blocked channel.

### ⚠ SEPARATELY, `#915` REFUSES WRITES EVEN WITH NO ERROR ON SCREEN `[MEASURED 2026-09-05, cause unknown]`
With the pendant clear, `#916 = 1234` and `#917 = 4321` both landed while `#915 = 555` was dropped and `#915`
stayed at `1.0`. So this is **not** the latch — it is specific to `#915`. ⛔ **The "universal variable reader"
documented elsewhere in this file uses `#915` as its scratch slot; it is compromised until this is
understood. Use `#916` (reg `7332`).**

### ⭐⭐ THE ERROR STATE IS VISIBLE ONLY ON THE SCREEN — AND A USB CAMERA READS IT `[CONFIRMED on machine 2026-09-05]`
Owner: *"problem is you cant see if an error is blocking"* — the root cause of every wrong call that night.

- ⛔ **It is NOT in the registers.** A differential sweep of `6500`–`10600` (macro `#500`–`#2550`), taken
  before and after a deliberate syntax error, showed **ZERO changed registers.**
- ⭐ **It IS on the pendant, in two places:** the **second cell of the top bar** (`READY` → solid **red**),
  and the **bottom status strip** (green → **red, carrying the message text** `syntax error!:L1[<the exact
  line>]`). The strip quotes the offending line verbatim, so it identifies *which* injection failed.
- ⭐⭐ **A USB camera aimed at the pendant closes the loop.** `camera-vision` skill, **index 1 (`HD Camera`)**
  — index 0 (`USB HD Webcam`) faces the operator, index 2 is `World Facing`:
  `python <fred-skills>/camera-vision/capture.py --out <scratch>/pendant.jpg --index 1 --open`
  ⇒ **The PC can now confirm an injected line succeeded without asking the operator.** Verified end-to-end:
  injected a known-bad line, read `syntax error!` off the photograph unaided.
  ⚠ Aim it at the **bottom strip** — everything else on that screen is already readable over Modbus.
  ⚠ The per-seat skills folder did not exist on CNC-FAIRY, so `camera-vision` could not auto-load; it was
  reached via its canonical `Apps/fred-skills` path. Needs the per-skill symlink (see the skill's own header).

### ⚠ THE POSITION REGISTER LABELS ARE WRONG — `7080` AND `7260` ARE THE SAME AXIS `[CONFIRMED on machine 2026-09-05, camera cross-check]`
The pendant read `Mach X 5.000` / `Abs X −45.130` while `reg 7260` read `5.0` and `reg 7080` read `−45.130`.
⇒ **`7080` = WORK (Abs) X and `7260` = MACHINE (Mach) X — both X, not "X and Y"** as labelled elsewhere here.
`10002` read `0.0` against Abs Z `101.142`, so it is **not** Z either. ⛔ Re-derive the whole position map
before trusting it; the camera makes this cheap now, since the screen shows the true values next to the reads.

### The ATAN forms in that run measured NOTHING — §V13 already had the answer
`ATAN` takes **two operands in the comma form** (§V13, `[CONFIRMED 2026-08-08]`). So `ATAN[1]` and `ATAN[45]`
are one-operand calls that *should* error, `ATAN[1]/[1]` is the slash form already known-rejected, and
`ATAN[1, 1]` — the only valid form of the four — was dropped by the latch. **§V13 stands unchanged.**
⇒ Second time in two days a question was taken to the machine that this file already answered (the other:
`G04 P` is milliseconds). **Read the section before testing the thing the section is about.**

## ⭐ TWO WRITE PATHS, AND ONLY ONE SURVIVES A LATCH `[CONFIRMED on machine 2026-09-05]`
There are two independent ways to change a macro variable from the PC, and they behave differently:

| path | how | survives a latch? |
|---|---|---|
| **G-code injection** | FC16 → reg `3000`, ASCII `#916 = 5` | ⛔ **NO** — silently dropped |
| **direct register write** | FC16 → reg `6500 + 2×(N−500)`, word-swapped float32 | ⭐ **YES** |

**Proven with the channel latched:** a direct write of `1234.0` to reg `7332` landed and read back, at the
moment G-code injection was dropping every line. ⇒ **A latch blocks the G-code interpreter, not Modbus.**

### ⛔ BUT THE VIRTUAL BUTTONS ARE NOT REACHABLE THAT WAY — `#2037` IS OUTSIDE THE MIRROR
Writing `65863` (RESET) to reg `9574` = `6500 + 2×(2037−500)` was **ACKed and discarded**; the register still
read `0`, and the pendant kept its `ERROR`. A block sweep shows why:

* live data runs to roughly **`#1999`**; `#1650`–`#1999` is already nearly all zero
* **`#2000`–`#2599` is entirely zero** — `#2037` sits here

⇒ **The `6500 + 2×(N−500)` mapping has an UPPER BOUND near `#1999`**, which this file previously stated
without one. `#2037` responds only to a *running macro*, i.e. to the injection channel — **the exact thing a
latch blocks.**

⛔⛔ **THEREFORE THE PC CANNOT CLEAR A LATCH. Only the operator can, at the pendant.** This was claimed
earlier in this file as an assumption; it is now measured. ⚠ Lead, unattested: M350-LiveG is reported to have
its **own keypress register** at an address we do not know — if found, it may offer a second route `[TO TEST]`.

⭐ Corroboration: **`#2500` reads `0` over Modbus**, matching the existing note that the tool-setter
calibration reference is in neither `setting`, `camsetting` nor `uservar` and needs a macro to read.

## ⭐ THE OPERATOR / FUNCTION SET, SETTLED `[CONFIRMED on machine 2026-09-05, camera-verified]`

| works | value | | rejected | |
|---|---|---|---|---|
| `SQRT[16]` `SQRT[2]` | 4 · 1.41421 | | ⛔ `MOD` | **syntax error** (photographed) |
| `COS[0]` `COS[90]` | 1 · 0 | ⇒ **DEGREES** | ⛔ `^` | **syntax error** (photographed) |
| `SIN[0]` `SIN[90]` | 0 · 1 | ⇒ **DEGREES** | ⚠ `**` | silent no-op, canary passed |
| `TAN[45]` | 1 | | ⛔ one-operand `ATAN[x]` | **syntax error** |
| `ABS[-5]` `ROUND[2.6]` `FIX[2.9]` | 5 · 3 · 2 | rounds / truncates | ⛔ `ATAN[y]/[x]` (slash) | rejected — §V13 |
| `EQ` `NE` `LT` `GT` `LE` `GE` | all correct | | ⛔ `**` | **syntax error** (photographed) |
| ⭐ `ATAN[1, 2]` | **26.565** | ⭐ `ATAN[1, 1]` → **45.0** | | |

⭐ **`ATAN[1, 2]` = 26.565° independently reproduces §V13's `ATANC=2657`** by a completely different route
(Modbus injection vs. an on-screen popup), and pins the comma form *and* degrees in one measurement.

⛔⛔ **THERE IS NO POWER OPERATOR — BOTH FORMS ERROR.** `^` and `**` each raise `syntax error!`, both
photographed. Any emitted exponentiation must be rewritten as repeated multiplication.

### ⛔ THE LATCH IS NOT INSTANTANEOUS — A CANARY FIRED TOO EARLY GIVES A FALSE ALL-CLEAR `[CONFIRMED on machine 2026-09-05]`
`[2 ** 3]` was first recorded here as a *harmless silent no-op* because the canary write fired ~0.5 s after it
and **slipped through**. Repeating the same expression, with the canary later, caught the latch — and the
pendant read `syntax error!:L1[#916 = [2 ** 3]]`. ⇒ **The error takes time to register**, and a check that
races it reports the channel healthy when it is already dying.

⚠ **A false all-clear is worse than no check at all**, because it launders the next batch's stale reads into
"measurements". `tools/macro_probe.py` now waits **1.8 s** after the expression and a further **1.0 s** before
the canary. ⭐ Both verdicts it has produced since were then confirmed against a photograph of the pendant.

## ⭐⭐ WHY AN INJECTED WRITE "DOESN'T TAKE" — **TWO INDEPENDENT CAUSES** `[CONFIRMED on machine 2026-09-05]`

### CAUSE 1 — a latch, from an error earlier in the batch (100% loss until Reset)
Covered above. Total, persistent, and invisible from the PC. This is the big one.

### CAUSE 2 — ⭐ **BASELINE RANDOM LOSS OF ROUGHLY 10–25%, ON A PERFECTLY HEALTHY CHANNEL**
Measured with the pendant photographed **green and `READY` before and after**, using only plain numeric
assignments that cannot raise an error:

| test | result |
|---|---|
| 20 unverified writes | **17/20 landed, 3 lost** |
| 15 writes, polled until the value appeared | **11 arrived in ~440 ms; 4 NEVER arrived** (6 s cutoff) |

⭐ **The latency is bimodal: ~440 ms, or never.** There is no slow tail — a line either executes in well under
half a second or it is gone. ⇒ A "dropped" write leaves the variable at its **previous value**, which is what
makes it read as a plausible answer instead of a failure.

⛔ **PACING DOES NOT FIX IT.** Loss vs. the gap left before each line: `0 ms → 2/12`, `250 ms → 0/12`,
`500 ms → 1/12`, `1000 ms → 2/12`. No relationship. Waiting longer is not the answer, and neither is a
register-3000 handshake (the buffer was never observed non-zero even immediately after a write).
⚠ **Root cause remains UNKNOWN** `[TO TEST]`.

### ⇒ THE OPERATING RULE: **NEVER TRUST AN UNVERIFIED INJECTION**
Write → read back → retry. At ~15% loss, four attempts put the residual failure near **0.05%**. This is what
`tools/macro_probe.py::set_var` does, and it is not optional: **every wrong finding recorded in this file on
2026-09-05 traces back to a single unverified write whose stale read-back was taken as a measurement.**

⚠ **This applies to the whole G-code injection channel, not just probing** — anything built on register 3000
inherits a ~1-in-6 silent failure rate per line. A multi-line sequence sent blind will *usually* be missing a
line. ⛔ Any future use must verify each line landed, or be idempotent and re-sent.

## ⭐⭐⭐ ROOT CAUSE — **~25% OF WRITE FRAMES NEVER ARRIVE. CHECK THE FC16 ACK.** `[CONFIRMED on machine 2026-09-05]`

The correlation is perfect. 18 plain numeric writes, pendant photographed green and `READY` throughout:

| | valid FC16 ack | no valid ack |
|---|---|---|
| **landed** | **13** | 0 |
| **lost** | 0 | **5** |

⇒ **The controller never received the lost lines. It is a LINK problem, not the controller discarding them.**
Consistent with everything else measured: immune to pacing (`0/250/500/1000 ms` gaps → `2/0/1/2` lost per 12),
immune to bus quiet time (quiet wait `3/15`, polling `4/15`), and bimodal latency — a line executes in
**~440 ms or never**, with no slow tail.

⭐ **Every ack is preceded by 6–11 bytes of junk that is not ours** (`01 00 00 00 00 …`). This controller is a
Modbus **MASTER** by default, so the most likely mechanism is **its own polling frames colliding with ours**
on a half-duplex line. `[HYPOTHESIS — the junk is measured, the attribution is not]`

### ⇒ THE FIX: THE ACK IS THE CHEAP TRUTH
A valid FC16 echo (`01 10 <addr> <count> <crc>`) means the line arrived. **Check it and resend** — this is far
better than reading the variable back, because it needs no scratch slot, no sentinel, and works for lines that
assign nothing. `tools/macro_probe.py::inject` now retries up to 6× until acknowledged.
⭐ **Verified:** a 10-expression battery immediately afterwards ran **10/10 clean, no retries visible, no latch.**

### ⛔ RETRACTED — "`#915` REFUSES WRITES" `[REFUTED 2026-09-05]`
Pure lost-frame artifact. Re-tested with ack-confirmed injection: `#915` accepts `777`, `0`, `1`, `5`, `-3`,
every one landing first time. ⭐ **The "universal variable reader" that uses `#915` as its scratch slot is NOT
compromised** — that warning is withdrawn.

### ⚠ WHAT THIS DOES AND DOES NOT INVALIDATE
- ⭐ **POSITIVE results stand.** A lost frame cannot invent a correct answer for a specific expression —
  `SQRT[16]` reading `4` can only come from `SQRT[16]` executing. The whole function/operator table was
  re-run after the fix and reproduced exactly.
- ⛔ **NEGATIVE results were the vulnerable class** — "rejected", "no-op", "refuses writes" all look identical
  to a lost frame. Of the five recorded here, **four were photographed on the pendant** (`MOD`, `^`, `**`,
  one-operand `ATAN`, each with `syntax error!` quoting the offending line) and stand. The fifth was `#915`,
  never photographed, and it was wrong.
- ⭐ **THE RULE:** a negative result on this channel is worth nothing without either an acknowledged frame or
  a photograph of the pendant. That is the whole lesson of 2026-09-05, and it cost a day of false findings.

## ⛔⛔ CERTAIN EXACT LINES NEVER EXECUTE — DETERMINISTIC, SILENT, RULE UNKNOWN `[CONFIRMED on machine 2026-09-05]`

⭐ **This supersedes the "~25% random frame loss" section above, which was largely my own measurement bug.**

`#916 = [3+3]` **never** assigns. Not sometimes — never, across many attempts. And yet:

| line | result |
|---|---|
| `#916 = [3+3]` | ⛔ **never assigns** |
| `#917 = [3+3]` · `#918 = [3+3]` | ✅ 6 |
| `#916 =[3+3]` · `#916= [3+3]` · `#916=[3+3]` | ✅ 6 |
| `#916 = [3+3] ` *(one trailing space)* | ✅ 6 |
| `#916 = [3 + 3]` · `[3.0+3]` · `[03+3]` | ✅ 6 |

⇒ **Same expression, same semantics — only the bytes differ.** It is not the operator, not the operand
values, not the result, and not spacing as such (`[9-3]` and `[2*3]` work tight-packed). Other confirmed
members of the same class: `[4+4]`, `[0+7]`, `[4*4]`, `[4/4]`, `[3/3]`.

⛔ **A CRC THEORY WAS TESTED BY PREDICTION AND REFUTED.** Failures shared a high CRC low byte (`0xFB`,
`0xFF`), so 10 never-tested expressions were predicted from the CRC alone: **7/10 correct, and the three
misses are fatal** — `0xFB` and `0xFF` each appear in both a failure *and* a pass (`[3+3]` fails / `[3-3]`
passes; `[4+4]` fails / `[0*7]` passes). **The rule is genuinely UNKNOWN** `[TO TEST]`.

### ⇒ THE WORKAROUND THAT DOES NOT NEED THE RULE
**Retry with a trailing space.** Semantically identical, byte-different. `tools/macro_probe.py` does this
before concluding anything, and it fixes every known member of the class: `[3+3]`→6, `[4+4]`→8, `[0+7]`→7,
`[3/3]`→1, `[4/4]`→1, `[4*4]`→16, all first retry.
⛔ **Anything built on register 3000 must do the same** — otherwise a valid line silently does nothing.

### ⭐⭐ CONSEQUENCE: **THERE ARE NO SILENT NO-OPS IN THE ARITHMETIC**
Every expression previously filed here as a "silent no-op" was this artifact. ⇒ **An expression either
evaluates, or it raises `syntax error!` and latches. There is no third outcome.** The only genuine negatives
on this controller are the ones that show an error on the pendant: **`MOD`, `^`, `**`, one-operand `ATAN`,
and the slash form `ATAN[y]/[x]`** — all photographed, all re-confirmed.

### ⚠ AND HOW THIS WAS MISSED FOR SO LONG — MY OWN TOOL
`probe()` confirmed its sentinel with a **single read 0.5 s after the write**, while measured execution
latency is **~440 ms**. So the confirmation regularly beat the line, `set_var` concluded failure and
**re-injected**, and the duplicate landed *after the next expression* and overwrote its result. That made a
deterministic effect look random, which is why it was written off as noise twice.
⭐ Fixed by **polling** for the value instead of guessing a delay, and draining duplicates before the next
line. ⇒ *A measurement whose instrument retries silently will invent randomness that is not there.*

### ⭐⭐⭐ AND THE MECHANISM: THE LINE IS **NEVER DELIVERED**, NOT "SILENTLY IGNORED" `[CONFIRMED on machine 2026-09-05]`
Owner asked the right question — *"so no error appeared on the controller, that normal?"* — and checking it
directly settled the whole thing. Injecting `#916 = [3+3]` raw:

```
sentinel in place: #916 = -77777.0
injected '#916 = [3+3]'   FC16 acknowledged: FALSE      <- after SIX retries
#916 after 3 s          : -77777.0
pendant                 : READY, green strip, no error  <- photographed
```

⛔ **The FC16 is never acknowledged, so the controller never received the line.** It cannot assign it and it
cannot error on it. ⇒ The pendant staying green is not a mystery and not a parser quirk — **it is exactly what
non-delivery looks like.**

⭐ **THREE OUTCOMES, CLEANLY SEPARATED — and every confusing result this session was the third one:**

| | pendant | variable |
|---|---|---|
| delivered + valid | green | assigns |
| delivered + invalid | **red, `syntax error!`**, latches | unchanged |
| ⛔ **NOT DELIVERED** | **green, nothing at all** | unchanged |

⭐ **This VINDICATES the FC16-ack finding that was walked back earlier.** No ack = not delivered, and the ack
is the only cheap, reliable delivery signal. The apparent counter-evidence ("acked lines still didn't
execute") was the retry bug corrupting the *next* result, not an acked line failing.

⛔ **THE TOOL BUG THAT COST THE SESSION:** `probe()` **ignored `inject()`'s return value** and reported
"NO ASSIGNMENT" when the truth was "could not deliver". ⇒ *An undeliverable line looked like a rejected
expression for an entire evening.* Now reported distinctly, with the trailing-space variant tried first.
⭐ *When a tool can fail in two ways and only reports one, every diagnosis built on it is a coin flip.*

### ✅ THE RECORD WAS RE-VERIFIED AGAINST THE MACHINE — 20/20 `[CONFIRMED on machine 2026-09-05]`
Owner asked the obvious and necessary question: *"if it weren't received are you recording the result still?"*
⇒ Every value written into this file was re-measured with the fixed tool and **all 20 matched**: `SQRT[16]`
`SQRT[2]` `COS[0]` `COS[90]` `SIN[0]` `SIN[90]` `TAN[45]` `ABS[-5]` `ROUND[2.6]` `FIX[2.9]` `ATAN[1, 2]`
`ATAN[1, 1]`, and all six comparison words.

⭐ **AND THERE IS A STRUCTURAL REASON THE DAMAGE WAS CONTAINED: an undelivered line can only ever cause a
FALSE NEGATIVE.** Nothing executes, the variable keeps the sentinel, and the tool reports "no assignment".
It cannot invent `SQRT[16] = 4` — that value can only come from `SQRT[16]` actually running.

⇒ **The contamination went entirely into the NEGATIVE findings**, and every one has been retracted: `NE`
"broken", "whitespace required", `[3*3]` "syntax error", `**` "silent no-op", `#915` "refuses writes". The
negatives that survive are the ones with a **photograph of `syntax error!` on the pendant**, which
non-delivery cannot produce either.

⚠ **The one figure that WAS published wrongly: "~25% random frame loss."** It came from the broken tool and
should not be relied on. Superseded above; flagged here because it was pushed and the other seat may have
read it before the correction.

### ⭐ THE `[3+3]` MYSTERY, AS FAR AS IT GOES — **DELIVERY IS PROBABILISTIC AND CONTENT-DEPENDENT** `[MEASURED 2026-09-05, mechanism UNKNOWN]`
Scanned all 100 `#916 = [a+b]` lines for FC16 acknowledgement, then repeated the interesting ones 5× each.

⭐ **It is not deterministic-vs-random. It is a CONTINUUM of delivery probability, set by the line's bytes:**

| line | delivered | |
|---|---|---|
| `[3+3]` `[3/3]` `[3-3]` `[0+7]` `[4+4]` `[7+0]` `[8+1]` `[0/7]` | **0/5** | never |
| `[3*3]` `[4+1]` | 1/5 | almost never |
| `[8+4]` | 2/5 | |
| `[0+5]` `[4+8]` `[1-8]` `[1/8]` | 3–4/5 | |
| `[2+4]` `[4+7]` `[0+0]` `[1*8]` `[1+6]` | **5/5** | always |

⛔ **THREE CRC THEORIES WERE PROPOSED AND ALL THREE REFUTED BY PREDICTION** — each was tested on expressions
never previously run, which is the only way this is worth anything:
1. *CRC low byte ∈ {0xFB, 0xFF}* → 7/10, and `0xFB`/`0xFF` each appear in both a failure and a pass.
2. *CRC low byte has a nibble == 0xF* → 90/100 but **nine false alarms** (`[4+7]` `0x0F`, `[0+0]` `0x4F` both deliver).
3. *CRC low byte ≥ 0xFA* → 6/9; `[0-7]` `0xFE` and `[0*7]` `0xFF` deliver 4/5, `[3*3]` `0xFA` delivers 1/5.

⇒ Each rule carved a threshold through a gradient, so it fitted the sample it was built from and failed on
fresh data. ⭐ **The mechanism is genuinely unknown** and is left that way deliberately rather than fitted a
fourth time. It smells like signal integrity — some byte patterns survive the wire far worse than others —
but nothing here establishes that, and the earlier "~25% random loss" and "deterministic per line" framings
are BOTH wrong: it is one phenomenon with a per-line probability.

⚠ **Also corrected:** the single-shot scan's 11 "undelivered" included `[0+3]` and `[1+6]`, which are 5/5 on
repeat. **One observation cannot classify a line** — anything quoting a delivery rate needs repeats.

### ⇒ IT DOES NOT NEED TO BE SOLVED TO BE SAFE
The ACK **detects** it and retrying **defeats** it: retry the identical line, then a byte-different variant
(a trailing space). `tools/macro_probe.py` does both, and the full 20-value record re-verified 20/20 through
it. ⛔ **Any future user of register 3000 must do the same** — at these rates a blind multi-line sequence will
lose lines, and the lost ones produce no error anywhere.

### ⭐⭐⭐ THE FIX FOR THE NEVER-DELIVERED CLASS: **PAD THE PAYLOAD TO 64 BYTES** `[CONFIRMED on machine 2026-09-05]`
Came from the owner asking whether the docs specify a byte count. ⭐ **The vendor's 246 is a MAXIMUM**
(*"ASCII code streams up to 246 bytes per single payload"*), not a required size — but padding fixes it anyway:

| line | bare | pad 32 | pad 48 | **pad 64** |
|---|---|---|---|---|
| `[3+3]` | 0/5 | 0/5 | 3/5 | **5/5** |
| `[4+4]` | 0/5 | 5/5 | 4/5 | **5/5** |
| `[0+7]` | 0/5 | 5/5 | 5/5 | **5/5** |
| `[7+0]` | 0/5 | 0/5 | 4/5 | **5/5** |
| `[8+1]` | 0/5 | 4/5 | 5/5 | **5/5** |

⭐ **Monotonic in length**, which is what a wire/framing problem looks like — not anything about parsing.

**What the padding is:** trailing spaces before the newline, nothing more.
```
before: '#916 = [3+3]'                          ->  7 registers, 23-byte frame
after:  '#916 = [3+3]' + 52 spaces (64 chars)   -> 33 registers, 75-byte frame
```
G-code ignores trailing whitespace, so the line parses identically.

⛔ **IT FIXES THAT CLASS ONLY.** Background loss across 20 random lines moved just **82% → 87%**. ⇒ **Padding
and ack-retry are BOTH required**; neither alone is sufficient. With both, 25/25 and the five 0/5 lines run
5/5 (one at 4/5, ordinary background loss, covered by the retry).

⭐⭐ **AND THE DECISIVE STRUCTURAL POINT: the failure is at the ACK**, which is the Modbus protocol layer —
*before* the controller parses anything. ⇒ Buffer size, terminators, stale bytes and G-code semantics are all
**ruled out**; this is framing/signal integrity on the wire. That is also why three CRC theories failed: they
were modelling a parser that was never involved.

### ⭐⭐ THE LIKELY MECHANISM, FROM THE FIELD LITERATURE: **USB-SERIAL LATENCY SPLITS RTU FRAMES ABOVE 19200 BAUD** `[RESEARCHED 2026-09-05 — plausible, NOT yet tested]`
Searched for the symptom rather than guessing a fourth CRC rule. It is a **known, named problem**:

> *"At baud rates above 19,200 the inter-character timeout becomes very short, and USB-to-serial converters
> and software-based serial ports may introduce latency that exceeds these thresholds, **causing frames to be
> split erroneously**."* — and the standard first move is *"if you see CRC errors at higher baud rates, try
> reducing the baud rate before anything else."*

⭐ **A split frame fails CRC at the slave, and a Modbus slave answers a bad CRC with SILENCE — no exception,
no NAK.** ⇒ That is exactly our signature: no ack, no error on the pendant, nothing executed.

**The numbers for this link:** 115200 baud ⇒ one character ≈ **87 µs**, so RTU's 1.5-character inter-character
limit is ≈ **130 µs**. ⛔ **This machine's FTDI `LatencyTimer` is `16` — the default, and over 100× that gap.**
(`HKLM\SYSTEM\CurrentControlSet\Enum\FTDIBUS\VID_0403+PID_6001+BG01LT65A\0000\Device Parameters`.)

⚠ **Honest caveat:** FTDI's own app note (AN232B-04) describes the latency timer as governing the **receive**
path — the chip buffers device→PC data until the buffer fills or the timer expires. Our failure is in the
**transmit** direction (the line never executes), so the latency timer may not be the actual cause. It is
cheap and reversible, so it is worth eliminating first, but **the stronger candidate is the baud rate.**

### ⇒ TWO UNTESTED FIXES, IN ORDER OF COST `[TO TEST]`
1. **`LatencyTimer` 16 → 1** — PC-side only, no controller change, instantly reversible. Needs admin:
   *Device Manager → Ports → USB Serial Port (COM6) → Port Settings → Advanced → Latency Timer*.
   ⚠ Baseline to A/B against, measured today: `[3+3]` **0/5** bare, and **82%** delivery across 20 random lines.
2. ⭐ **DROP THE BAUD RATE** — the field-standard first move, and it addresses the transmit path the latency
   timer does not. ⛔ Needs the controller's serial parameter changed **and a reboot** (serial params apply
   only at startup — already established here), so it is a real bench step, not a keystroke.

⭐ If either works, the padding and ack-retry workarounds become belt-and-braces rather than load-bearing.

### ⛔ REFUTED — `LatencyTimer` 16 → 1 CHANGES NOTHING `[MEASURED on machine 2026-09-05]`
Owner set it via Device Manager and it was re-measured like-for-like (same expressions, same seed, padding
disabled):

| | LatencyTimer 16 | **LatencyTimer 1** |
|---|---|---|
| `[3+3]` `[4+4]` `[0+7]` `[7+0]` `[8+1]` bare | 0/5 each | **0/5 each — identical** |
| 20 random lines × 3, bare | 49/60 (82%) | **50/60 (83%)** — noise |

⇒ **Not the cause**, exactly as FTDI's AN232B-04 implied: the latency timer governs the **receive** path and
our failure is in **transmit**. ⛔ **Do NOT put this in any setup guide or tell users to change it** — it is
not a fix, and unverified tuning advice becomes permanent folklore. (Harmless either way; leave it or revert.)

⭐ **The baud rate remains the untested candidate**, and it is now the *only* one from the literature.

### ⭐ SCOPE — DOES ANY OF THIS AFFECT DDCS STUDIO? **NOT TODAY.** `[CONFIRMED by reading the app, 2026-09-05]`
Owner asked, and it is worth stating plainly because "Modbus" means two different things in this repo:

| | direction | used by |
|---|---|---|
| **register `3000` G-code injection** | **PC is master** → controller | ⛔ **the bridge only.** No app code opens a serial port |
| **`MSETDATA` / `MGETDATA`** | **controller is master** → PC slave | the app emits these as G-code (`GcodeExecutionEngine._handleModbus`) |
| **SMB** to `\192.168.0.99\CNCDISK` | PC → controller, files | how Studio actually delivers jobs today |

⇒ **Everything measured here about delivery loss applies to the injection channel only**, which nothing in
`DDCS-Studio/web/` uses. ⚠ **The one shared risk:** the beacon/instrument feature emits `MSETDATA`, a live
Modbus transaction **over this same cable**. Different direction, same wire — so a marginal link is a risk to
that feature too. Not a known fault, but worth watching if beacons ever behave oddly.
⇒ ⭐ **And it becomes load-bearing the day the app's pull moves from SMB to Modbus** — an open question
already recorded as RENDERRANCHY's call.

### ⛔⛔ REFUTED — LOWERING THE BAUD MAKES IT **MUCH WORSE** `[MEASURED on machine 2026-09-05]`
Param `267` ("Serial 2 baud rate", Param page → **System** section) set from `115200` to `19200`, controller
rebooted. Sync confirmed against ground truth (`reg 7080` = `-45.130001068115234`, matching the pendant).

| | 115200 | **19200** |
|---|---|---|
| correct READS of a known register | ~100% | ⛔ **2/20** |
| 20 random lines × 3, delivery | 82% | ⛔ **30%** |
| the five 0/5 lines | 0/5 | 1–2/5 |

⇒ **Reverted to 115200.** ⭐ Also note this incidentally **confirms our cable is on Serial 2** — the link
followed param `267`, so `266` (M3K keyboard) is correctly left alone.

### ⭐⭐ AND THE DIRECTION OF THE EFFECT IS THE REAL FINDING — IT POINTS AT CONTENTION, NOT LATENCY
⛔ **This refutes the USB-latency hypothesis**, not just the fix. If frames were being split because USB
latency exceeds the RTU inter-character timeout, **lowering the baud lengthens that timeout and should
IMPROVE things.** It made them ~6× worse — the opposite direction.

⭐ **What fits instead: bus contention.** The controller is a Modbus **MASTER** by default (`#279` = `2`, and
the vendor manual's §1 says *"Default master mode"*), and **6–11 bytes of foreign junk precede every FC16
ack** — traffic that is not ours. At 19200 every frame occupies the wire ~6× longer, so the window in which
the controller's own transmissions can collide with ours is ~6× wider. ⇒ **The magnitude matches the
degradation**, and this is the first hypothesis today whose *predicted direction* was confirmed by an
experiment run after it was formed, rather than fitted to data already in hand.

⇒ ⭐ **NEXT TEST: `#279`.** If the controller can be stopped from initiating transactions (or moved to a slave
mode), contention disappears. ⚠ The vendor manual documents `279` as **"Modbus RTU Enable"**, not a mode
selector — but a later firmware reportedly adds a **P279 SLAVE** setting, and this machine is now on that
newer firmware. ⛔ Untested, and it needs a reboot to apply `[TO TEST]`.

## ⭐⭐⭐ THE OFFICIAL SLAVE REGISTER MAP EXISTS — AND IT REFUTES SEVERAL FINDINGS ABOVE `[VENDOR SPEC, 2026-09-02]`
`M3xx_Modbus_Address_Map_V1_0.xlsx`, from **github.com/foinnc/M350** — cached at
[`assets/vendor-spec/`](assets/vendor-spec/), which also records **why that repo, not `ddcnc.com`, is the
source**. ⛔ This file has been telling readers *"there is no slave register map, because there is no
slave… only foinnc can supply it."* **He has. It was published three days before we looked.**

### ⛔ THERE ARE FOUR BLOCKS, NOT ONE — the `6500 + 2×(N−500)` formula covers only the first
| Modbus | macro | block |
|---|---|---|
| — | `#0`–`#49` | subprogram locals |
| — | `#50`–`#499` | global variables |
| `6500`–`8498` | `#500`–`#1499` | user parameters 1 (Pr0–Pr999) |
| ⭐ **`15000`–`16998`** | ⭐ **`#1500`–`#2499`** | **SYSTEM GLOBAL VARIABLES** |
| ⭐ **`8500`–`9498`** | ⭐ **`#2500`–`#2999`** | user parameters 2 (Pr1000–Pr1499) |
| `10000`–`10998` | — | system internal |

⭐ Endianness in the spec is **`CDAB`** for every entry — the word-swapped float32 we reverse-engineered. ✅

### ⛔⛔ WHAT THIS RETRACTS
1. **"The mapping has an upper bound near `#1999`"** — **FALSE.** `#1500`–`#2499` are simply at a *different
   base* (`15000`). I extrapolated one formula past its block and read zeros from unmapped space.
2. **"`#2037` is outside the mirror, therefore the PC cannot clear a latch"** — ⛔ **`#2037` is at reg
   `16074`, and the spec marks it `R/W`.** I wrote to `9574`, the wrong address. ⇒ **The virtual Reset may
   work after all** `[TO TEST]`. `#2038` = `16076`, `#2039` = `16078`.
3. **"`#2500` is not Modbus-readable"** — ⛔ **FALSE. `#2500` is at reg `8500`, `R/W`.** The tool-setter
   calibration reference can be read *and written* over Modbus; a macro is not required.

### ⚠ WHAT THE SPEC DOES **NOT** CONTAIN
- ⛔ **Register `3000` is absent.** The map covers `6500`–`16998` only. ⇒ The G-code injection buffer remains
  **undocumented by the vendor**, consistent with it being newer than this spec's scope. Our delivery
  troubles are in the one part of the surface with no official definition.
- ⛔ **No alarm/state/run category exists** — the entire 2,502-row table is only `用户参数变量` (1500),
  `系统全局变量` (1000), `系统内部变量` (2). ⭐ **This independently confirms the differential sweep:** there
  is no error-state register, which is why the camera is the only way to see one.

### ⛔ THE PROCESS FAILURE, RECORDED BECAUSE IT COST THE MOST
Owner: *"i thought you were looking at that — obviously if you're looking at outdated docs it's meant to go
bad."* Findings were being built on **this file's summary** of a **2025 manual**, describing a **2026
firmware**, while the vendor's live repo went unread. ⭐ **`Docs/` there holds ~40 more folders never opened
here**, including `虚拟按键` (virtual keys), `按键键值宏地址#2037`, the full G/M code list, the coordinate
transform formulas, and the current 4.7 MB system manual.

## ⭐⭐⭐ THE FIRMWARE IS `2026-09-02-00`, NOT `2026-08-03-00` — AND THE VENDOR DOCS SETTLE THREE THINGS `[CONFIRMED from the pendant + vendor spec, 2026-09-05]`
⛔ **This file has recorded the wrong firmware version.** The System Info page reads
**`Software Ver: 2026-09-02-00`** (photographed). That release's one change is *"Expanded Modbus register
address mapping"* — ⇒ **the official address map applies to this machine exactly.**
Releases live at **github.com/foinnc/M350/releases**, each with `read.me.txt` + `setting` + V1/V2 zips.

### ⛔ RETRACTED — "`#2500` is not Modbus-readable"
**`#2500` is at register `8500`** (user-parameter block 2), `R/W`, and it **reads `-1.9204`** — the live
tool-setter calibration reference. This file said a macro was the only way to read it. Wrong address, not
unreadable. Same for `#2037` (`16074`) and `#2038` (`16076`).

### ⭐⭐ `#2037` — THE OFFICIAL DOC, AND WHY A REGISTER WRITE CAN NEVER PRESS A KEY
`assets/vendor-spec/2037_Button_simulation_macro_variable_M350.pdf` (vendor `Docs/按键键值宏地址#2037`):
> *"Bit0-bit15: key value, actual key value = Table value − 1000; Bit16: press status; 0 loosen, 1 press.
> Reset: `#2037 = 1*2^16 + (1327−1000) = 65863`."* ⭐ *"**Assign the #2037 assignment statement, and placed
> in the executable code.**"*

⛔⛔ **THE KEY PRESS IS AN INTERPRETER ACTION, NOT A REGISTER VALUE.** Writing `65863` to reg `16074` lands
in the mirror and presses nothing — verified: the register write is accepted and the pendant's `ERROR`
stays. ⇒ **The PC therefore CANNOT clear a latch**, and the reason is now documented rather than inferred:
a latch halts the interpreter, and the press requires the interpreter. `[CONFIRMED — the original
conclusion was right, the earlier reasoning ("#2037 is outside the mirror") was wrong.]`

**Key values** (subtract 1000, add `65536` for a press): Reset `1327` · Start `1328` · Pause `1329` ·
Esc `1027` · Enter `1013` · Backspace `1008` · arrows `1016-1019` · Spindle on/off `1331` · M3/M4/M5
`1372/1371/1370` · jog `X± 1350/1351  Y± 1352/1353  Z± 1354/1355` · feed `100%/+10%/-10%` `1364/1365/1366` ·
spindle rate `1367/1368/1369` · Fast `1388` · Start1-3 `1392-1394` · screens: Monitor `1373` Program `1374`
Param `1375` IO `1376` System Log `1377` System Info `1378` MDI `1348` Manual `1326` Probe `1323`.
⭐ `#2038` reads the **current key value + press state** — the read side of the same mechanism.

### ⛔ CORRECTION — "THE FC16 ACK IS THE CHEAP TRUTH" IS ONLY HALF RIGHT
**ACK proves DELIVERY, not EXECUTION.** With an error displayed: **9/10 injections acknowledged, 0/10
executed.** ⇒ Two independent layers, and they fail independently:

| layer | what fails | how it looks |
|---|---|---|
| **transport** (Modbus) | frame lost on the wire | **no ack** |
| **interpreter** (G-code) | halted by an error | **ack OK, nothing happens** |

⇒ **A latch is an INTERPRETER halt while the transport stays healthy.** That is why an acked line can still
do nothing, and why "still alive?" checks based on the ack alone are worthless during an error.

## ⭐⭐⭐ RUN STATE **IS** EXPORTED — REGISTER `10002`. THE VENDOR'S OWN TOOL POLLS IT. `[VENDOR SOURCE + read on machine 2026-09-05]`
From `m350_liveg.py::poll_m350_state_with_strict_crc` (github.com/foinnc/M350-LiveG):
```python
read_cmd = calculate_crc(bytes([slave, 0x03, 0x27, 0x12, 0x00, 0x02]))   # 0x2712 = 10002, FC03, 2 regs
...
return int(struct.unpack('>f', bytes([res[5], res[6], res[3], res[4]]))[0])   # CDAB word-swap
```
⭐ **`0x2712` = register `10002`, float32 CDAB. `0` = idle.** Read live here: **`0.0`** with the machine idle.

**How the vendor uses it — a complete motion-completion protocol:**
1. send the line, confirm the 8-byte FC16 echo
2. poll `10002` up to 8× at 20 ms — **leaving `0` means motion STARTED**
3. then poll at 40 ms until it reads `0` **twice consecutively** — motion FINISHED
4. if it never left `0`, the move was a zero-stroke (already at target)

⛔⛔ **THIS ANSWERS A QUESTION THIS FILE HAS CARRIED AS OPEN FOR MONTHS** — *"no 'currently running' flag
found"*, after diffing 2,400 registers mid-run. ⚠ **I read `10002` earlier today, got `0.0`, and dismissed
it as "not Z either."** It was the answer, in a register I had already sampled. `10002` sits in the
`10000`–`10998` *system internal variables* block, which is why a macro-variable sweep never surfaced it.
⇒ ⭐ **Directly relevant to Studio**: this is a real progress/completion signal, not the end-of-run
counters. `[TO TEST: confirm it becomes non-zero during an actual move — needs the owner at the machine.]`

## ⭐ THE VENDOR'S REGISTER-3000 SEND PATH — AND WHAT IT DOES **NOT** EXPLAIN
`m350_liveg.py::send_gcode_process`, the reference implementation:
- ⛔ **NO trailing `\n`** — `gcode_str.encode('ascii')`, pad to even with `\x00`, byte-swap each pair. We
  append `\n`; the vendor does not.
- **`serial_conn.flush()`** immediately after `write()`; we never flushed.
- success = the reply is **exactly the 8-byte echo** `slave 10 <addr> <count> <crc>`.
- ⭐ **`res[1] == 0x90` is a BUSY exception** — the controller can explicitly answer "busy" (FC16 | 0x80).
- baud dropdown offers **`9600 / 38400 / 115200`** — ⭐ **`19200` is not offered at all**, which fits our
  measured collapse at that rate.

### ⛔ BOTH DIFFERENCES TESTED AND REFUTED AS A FIX
The five known-bad lines, 5 attempts each, unpadded: **`0/5` with our framing, `0/5` with no `\n`, `0/5`
with no `\n` + `flush`.** ⇒ Neither the terminator nor the flush affects delivery. **Payload LENGTH remains
the only lever that works** (pad to 64 ⇒ 5/5). The vendor's own tool would hit this too.

## ⭐⭐⭐ SOLVED — THE `[3+3]` MYSTERY WAS **OUR TRAILING NEWLINE** `[CONFIRMED on machine 2026-09-05]`

⛔ **The vendor's tool sends NO terminator.** `m350_liveg.py::send_gcode_process`:
```python
raw_bytes = gcode_str.encode('ascii')      # <- no "\n", ever
if len(raw_bytes) % 2 != 0: raw_bytes += b'\x00'
```
We appended `"\n"` in the very first injection experiment and never questioned it again.

| payload, 5 attempts, **executed** | with `\n` | **without `\n`** |
|---|---|---|
| `#916 = [3+3]` | **0/5** | ⭐ **5/5** |
| `#916 = [4+4]` | 0/5 | 3/5 |
| `#916 = [0+7]` | 0/5 | ⭐ 5/5 |
| `#916 = [7+0]` | 0/5 | ⭐ 5/5 |
| `#916 = [8+1]` | 0/5 | ⭐ 5/5 |

⇒ **Every "impossible" line executes once the newline is removed.** `tools/macro_probe.py` now sends the
payload raw, and a 10-expression battery ran **10/10 with no padding and no retries needed**.

### ⛔ WHAT THIS RETRACTS — MOST OF ONE DAY'S "FINDINGS"
1. **"Pad to 64 bytes"** — not a fix. It only changed the length enough to dodge the symptom. **Removed.**
2. **"Certain exact byte sequences are deterministically undeliverable"** — there is no such class. It was
   one bug with a length-dependent presentation.
3. **Three CRC hypotheses** — all were curve-fitting to an artifact of our own payload construction.
4. **"~25% random frame loss"** — inflated by the same cause. ⚠ Some background loss remains (`[4+4]` at
   3/5), so **the ack-retry stays**, but the headline figure was never a property of the link.

### ⛔⛔ AND THE PROCESS FAILURE, WHICH IS THE REAL LESSON
**The reference implementation was public the entire time.** `M350-LiveG` is the vendor's own PC tool for
this exact register, its source is one file in a public repo, and it answers the question in five lines.
⇒ **Hours went into scope-free hypothesis testing against a spec that could have been read.**
⭐ Owner, repeatedly, and correctly: *"did you read all the docs?"* · *"maybe it's another baud altogether"*
· *"obviously if you're looking at outdated docs it's meant to go bad."* **Read the reference
implementation before characterising a transport.**

## ⭐⭐⭐ RUN STATE CONFIRMED — REGISTER `10002` IS A **PROGRAM-RUNNING** FLAG `[CONFIRMED on machine 2026-09-05, owner pressed Start]`
Polled `10002` at 4 Hz while the owner ran `V21_dwell.nc` — **a 30 s `G04` dwell that moves NO axis:**

| t (s) | `10002` | counters `#701/#702` | |
|---|---|---|---|
| 11.9 | `0` | 251 / 4 | idle |
| **15.9** | ⭐ **`1`** | 251 / 4 | **Start pressed** |
| 36.1 | `1` | 251 / 4 | ⭐ **still 1 — through a pure dwell, nothing moving** |
| 56.3 | `0` | **252 / 5** | finished; completion counters increment here |

⇒ ⭐⭐ **`1` = a program is running, `0` = idle. It is NOT a motion flag** — it stayed `1` for 30 s with
every axis stationary. Values seen: `{0.0, 1.0}`.

⛔⛔ **THIS CLOSES A QUESTION OPEN FOR MONTHS.** This file records *"no 'currently running' flag found"*
after diffing 2,400 registers mid-run — that sweep covered the macro mirror, and `10002` is in the
`10000`–`10998` **system-internal** block, which the mirror sweep never touched. It was found by reading
`m350_liveg.py::poll_m350_state_with_strict_crc` (FC03 on `0x2712`).

⭐ **FOR THE APP:** this is a **live progress signal**, not a done/not-done counter. Poll `10002` to know a
job is running; the `#701`/`#702` completion counters remain the end-of-run edge. Together they give
start → running → finished without any file-share polling.
⚠ Only `0` and `1` have been observed. The vendor's tool treats *any* non-zero as running, so other values
may exist (feed hold? probing?) — see `CHANNELS.md` Q4 `[TO TEST]`.

## ⭐⭐ REMOTE KEY PRESS WORKS — INJECT `#2037`, DO NOT WRITE THE REGISTER `[CONFIRMED on machine 2026-09-05, photographed]`
Injecting `#2037 = 65914` (System Info = key `1378`) **switched the pendant to the System Info page** —
photographed. ⇒ The vendor doc is exact: the assignment must be **executed as code**. Writing reg `16074`
directly does nothing.

⛔ **This means the PC can press ANY panel key, `Start` (`65864`) included.** Encoding: `65536 + (keyvalue −
1000)`. Screen keys are safe and self-evident (Monitor `65909`, System Info `65914`); ⛔ motion, `Start`,
`Pause` and `Reset` are announced-class and must not be sent unattended.
⚠ Still true that this **cannot clear a latch** — an error halts the interpreter, and this needs the
interpreter.
