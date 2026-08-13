# M350 Modbus — what the link makes possible

**Status of this file:** a reference and a scoping note. Nothing here is built. The register map below is
read off another project's working implementation; the *possibilities* section is reasoning, not evidence.

---

## 1. What is actually KNOWN (evidence, not attestation)

Source: `foinnc/M3X-M350-IoT-Bridge` (MIT), `Firmware/01_Web_Touch_Console/main.ino`.
⚠ **Read from that project's source, never bench-verified against this user's controller.** Provisional
until a real read succeeds on their machine — do not promote to attested corpus.
⚠ The RELEASES are irrelevant to us (V2.0 = WiFi TX power / modem-sleep / AP channel; V1.0 = the web UI).
The value is in the source and has been there since V1.0.

**Transport:** Modbus RTU · slave id `0x01` · 115200 · on the DB9.
Requires M350 firmware **≥ 2025-12-11-00**. Controller: **P279 = Slave**, **P267 = 115200**, P296/P297 default.

**READ — function `0x03` (read holding registers)**

| register | qty | meaning |
|---|---|---|
| `7080` | 10 | WORK coords X,Y,Z,A,B — 5 × 32-bit float |
| `7260` | 10 | MACHINE coords X,Y,Z,A,B — 5 × 32-bit float |
| `10002` | 2 | system state (IDLE / BUSY / RESET) — 32-bit int |

Each axis spans two consecutive registers, reassembled `((uint32_t)r2 << 16) | r1`, then cast to float.
The bridge polls every 100 ms.

**WRITE — function `0x10` (write multiple registers)**

| register | qty | meaning |
|---|---|---|
| `6908` | 2 | KEYPRESS — `keyCode` in the low 16 bits, `actionState` in the high 16 |

**Key codes:** X± `0x015e`/`0x015f` · Y± `0x0160`/`0x0161` · Z± `0x0162`/`0x0163` ·
A± `0x0164`/`0x0165` · B± `0x0109`/`0x0166` · START `0x0148` · PAUSE `0x0149` · RESET `0x0147` ·
HF/LF `0x0184` · F1–F6 `0x0600`–`0x0605`.

---

## 2. What this UNLOCKS — and the distinction that matters

The M3X uses this for a phone pendant (DRO + jog). **That is what one project built, not the limit of the
link.** The map is a door.

```
  READ  → Studio can KNOW the machine        ← the bigger half
  WRITE → Studio can DRIVE the machine       ← the gated half
```

### The reads change what Studio *is*, not just what it displays
Today Studio ASSUMES the machine (a saved config, values typed once). With reads it could ASK:

- **live position + state** — the obvious one; see §3 for where it belongs
- **the WCS table** — real offsets instead of a second copy maintained by hand. Directly attacks
  `[[datum-model-physical-derived-offset]]` and the "pull from controller" flow already designed
- **the tool table** — real lengths/diameters rather than a hand-kept mirror
- **controller parameters (Pr values)** — machine facts (motor polarity, signed travel, home direction)
  that `[[machine-facts-vs-macro]]` says belong to the controller, not to us
- **`#variables`** — probe RESULTS as numbers, and the user's own macro vars, instead of "go read the
  controller screen"
- **I/O state** — inputs, outputs, limits

⚠ **ALL OF THE ABOVE EXCEPT position/state IS UNVERIFIED.** Those would be the DDCS's OWN Modbus map, not
the bridge's — the M3X source only proves the three read blocks in §1. **Do not design against them until
their addresses are confirmed.** Establishing that map is its own scouting job.

**Why it matters beyond convenience:** it dissolves a whole class of problem this project keeps hitting —
a personal machine value baked in as a universal default (see NEXT-SESSION's "-120 silent fallback" and the
constraint-creep note). *If Studio can ask the machine, "what is your Z travel" stops being a config
question with a guessed answer.*
It also softens the two-PC topology question — a controller reachable over Modbus makes "which PC owns the
cable" less structural than it looks in `ROADMAP.md`'s two-PC test.

### The writes are a different category
`6908` can start, pause, reset or jog a real machine from a browser. **That is not a feature decision, it
is a safety one**, and it is exactly what `[[live-cnc-readonly-when-away]]` exists to gate. **Read-only
first is a rule here, not a phase.** No write work proceeds without an explicit user ruling on whether
Studio may command a powered controller at all.

---

## 3. WHERE IT GOES — the user's own answer (2026-08-13)

**The DRO belongs in the visualiser / preview panel** — user's call, and it needs no new home because the
readout already exists there:

```
        Work        Mach            ← today: the SIMULATED tool position
  X   17.500      37.500
  Y  -39.680    -789.680
  Z   -5.000    -105.000
```

Adding the live machine position to that same readout makes the pairing meaningful rather than decorative:
**is the machine where the sim says it should be**, in one frame. Two readouts in two places could not.
It also dissolves the "does this need a new tab" question for the status half entirely.

**⚠ OPEN, and a real fork the user has NOT ruled:** how the readout distinguishes them once live is
present. Up to four numbers per axis is where useful becomes confusing.
Does live REPLACE the simulated columns when connected · sit BESIDE them · or is it a mode you switch?

**The pendant (jog/start/pause) is a separate surface question** and was not settled. Candidates
considered: fold into GATEWAY (it owns the machine connection, but Gateway is about files/jobs — a jog pad
is a different activity in the same drawer) · a new PENDANT tab (control is genuinely its own posture, and
a phone is where it would earn its keep — but it is a permanent header slot for occasional use) ·
or split by kind (status in the preview, control in Gateway).
**Advisor's lean, not a decision: build the read-only DRO strip FIRST.** It is the safe half, and it tells
you whether the control half is wanted before a tab is spent on it.

---

## 4. Related, already recorded
`[[m350-modbus-register-map]]` (memory) · `[[m350-v1-v2-and-modbus-slave]]` · `[[gateway-tab]]` ·
`[[controller-import-remote-sim]]` · `[[machine-facts-vs-macro]]` · `[[live-cnc-readonly-when-away]]` ·
`ROADMAP.md`'s two-PC network test · `bridge/bridge-app/CONFIGS.md` (Local-network / Direct mode).
