# TASK — Build the controller profile from the live Expert (`GET /api/profile`)

> ## ✅ COMPLETE — 2026-06-10 (commits `127d8d5` → `c7b9a60`)
> Both phases done. **Phase 1:** read-only capture of the live Expert landed in `assets/capture/` (193
> files; real `setting`/`uservar`/CNCDISK — first raw Expert data in the repo). **Phase 2:** the captured
> **`SYSDISK/cfg_utf8`** turned out to be the controller's **full param dictionary**, so the I/O map was
> decoded straight from it (no blind toggling) and cross-checked on the panel. `Ops.profile()` now returns
> a live profile — `hardwareTabs ["probes","limits"]`, ATC off, and a `pins` block — **verified end-to-end
> against `192.168.0.99`**. The full I/O map + level encoding (`N`/`P` = active-low/high) is in
> [`FINDINGS.md`](FINDINGS.md) → "Profile I/O map". Only one differential toggle was needed (to pin the
> active-level index `port+2`). The detail below is kept as the historical brief.

> **Read [`../../AGENTS.md`](../../AGENTS.md) first.** This task is **DDCS Expert / M350 only** — the
> real machine at the studio (`\\192.168.0.99\`, Modbus on COM6). Do **not** cross-apply V4.1 findings.
> Record everything you confirm in [`FINDINGS.md`](FINDINGS.md) with a confidence tag.

## Why this exists

DDCS Studio shows hardware Settings tabs (**Probes / ATC / Limits**) and the pins/locations the
**simulation** uses. Today those are hand-set by the user. The goal: when a machinist's Studio is
**bridged to their controller**, the gateway hands Studio a **controller profile** describing what that
machine actually has, so the right tabs + pins appear automatically. People with **no bridge** still
build the same profile by hand in Studio — so the format is **shared** and both sides must agree on it.

The plumbing is **done**; the **data mapping** is not. That mapping needs the live controller — your job.

## The two phases

Split by what needs a human or eyes on the machine:

| Phase | When | What | Needs |
|---|---|---|---|
| **1 — Capture** | **now, unattended** — power on, walk away | read-only SMB snapshot of the live Expert | just the machine on |
| *(desk)* | off-site, no machine | decode the capture; draft the param map from it + the DDCS manual | nothing |
| **2 — Confirm** | later, **attended** visit | differential param toggles, Modbus, anything that moves | a human at the panel + eyes on the machine |

**Do Phase 1 first** — it's the only thing that strictly needs the cabled machine, it's safe to leave
running, and it unblocks everything else.

## What already works (don't rebuild)

- **Gateway endpoint:** `GET /api/profile` → `bridge-app/fairy/ops.py` → `Ops.profile()`.
- **Decoder:** `Ops._read_setting_params()` reads the controller's **`setting`** file and decodes it as
  **little-endian f64, where array index = DDCS param #**. `[CONFIRMED]` against the captured dump
  (`controllers/v4.1/assets/setting`) and matches the panel per [`FINDINGS.md`](FINDINGS.md):
  > “`setting` file = 1000×f64, index = param # (8000 B). Decodes over SMB and matches the panel.”
- **Shared format (the contract):** `DDCS-Studio/web/shared/js/profiles/controllerProfiles.js` — see its
  `PROFILE SHAPE` header. A profile is:
  ```jsonc
  { "id": "ddcs-expert-m350", "name": "DDCS Expert M350",
    "source": "controller",                       // you're building the live one
    "hardwareTabs": ["probes", "limits"],         // which tabs Studio should show
    "atc": { "toolTableBaseVar": 1430, "defaultToolCount": 10 } }
  ```
- **Studio consumes it:** when `ddcs_api` is set, `ui/settingsPanel.js` fetches `/api/profile` and offers
  it in the profile selector as “… (from controller)”. So the moment `profile()` returns real data, Studio benefits.

Right now `profile()` returns the M350 **baseline** and only flags `source:"controller"` + `paramCount`
when a live `setting` was read. The `TODO(phase5)` block is where your mapping goes.

## Phase 1 — Unattended capture (do this first)

We have rich V4.1 dumps but **zero raw Expert data** (`expert-m350/assets/` is only PDFs). The Expert's
`setting` / `uservar` / CNCDISK were read off the panel but never saved — so capturing them is the whole
point of the unattended visit, and it unblocks all the desk work.

Run the **read-only** capture (`tools/capture_controller.py`) with the Expert powered on:

```bash
net view \\192.168.0.99                         # 1) list the controller's shares
python tools/capture_controller.py \             # 2) capture each share (repeat --src), into assets/
    --src "\\192.168.0.99\CNCDISK" --out assets/capture
```

Grab (mirror whole shares so you don't need exact paths up front):
- **`setting`** — the real Expert param array (we only have V4.1's; THE blocker for the map).
- **`uservar`** — live `#100–#549`.
- the whole **CNCDISK** — every `.nc`, `slib-m.nc` (M-code library), the identity file, any config.
- **firmware / `parse.out`** if any share exposes it (off-site Ghidra).

The script writes a `manifest.json` (size + sha256) and **never writes to the controller**. When it's done:
**commit** the real `setting` / `uservar` into `expert-m350/assets/`, and record the confirmed share +
path + size in [`FINDINGS.md`](FINDINGS.md) (that resolves the `[TO TEST]` below). Unattended phase complete.

## The task

Fill in `Ops.profile()` so `hardwareTabs` (and ideally a `pins`/`io` block) reflect the **live**
controller, by mapping specific **`setting` indices → meaning**. Concretely, find the param # for:

| Profile need            | What to find in `setting`                                  | Drives |
|-------------------------|------------------------------------------------------------|--------|
| 3D probe input          | probe input pin + active level                             | `probes` tab + Studio probe pin |
| Tool-setter input       | tool-setter input pin + level (IN02 on our rig)            | probe/ATC pin |
| Limit inputs            | X/Y/Z min/max limit pins + levels                          | `limits` tab |
| Tool changer / drawbar  | any ATC actuation I/O (likely **none** — manual machine)   | `atc` tab (off unless present) |
| Units / axis count      | metric/inch, number of axes                                | sanity / future |

**Decision logic for `hardwareTabs`:** include `"probes"` if a probe input is configured; `"limits"`
if any limit input is configured; `"atc"` only if a real tool-changer I/O exists (our Ultimate Bee is
manual tool change → expect ATC **off**).

## Building the map (desk work, then Phase 2 to confirm)

> **Status `[2026-06-10]`:** Phase 1 capture done; desk pass done (see FINDINGS *"Profile build — `setting`
> diff analysis"*). Baseline **confirmed** (`probes` + `limits`, no `atc`); I-O pins **localized** to
> `#489–579` / `#670–676`. `Ops.profile()` now reads `setting` from **SYSDISK**. **What's left = the
> Phase-2 differential below** to pin exact indices, then a `pins` block on `/api/profile`.

Once Phase 1 has landed `setting`, learning which index is which is mostly **desk work — no machine**:

1. **Decode + anchor (off-site).** Decode the captured `setting` and confirm the known-good anchors line
   up — if they do, your decode + indexing are right and new indices are trustworthy:
   ```bash
   python - <<'PY'
   import struct
   raw = open(r"assets/capture/<stamp>/CNCDISK/setting","rb").read()   # the captured file
   p = struct.unpack("<%dd"%(len(raw)//8), raw)
   print(len(p), "params")
   for i in (266,267,279,284,296,297):   # [CONFIRMED] anchors from FINDINGS
       print(i, p[i])                      # expect baud 4=B115200, #279 modbus, #284 0/1/2, #296/#297 0/0
   PY
   ```
   Anchors `[CONFIRMED]` in [`FINDINGS.md`](FINDINGS.md): `#266`/`#267` baud, `#279` Modbus-RTU,
   `#284` net-boot (0/1/2), `#296`/`#297` parity/stop, WCS at `#805+[WCS−1]*5`.
2. **Label the I-O indices (off-site).** Map the probe / tool-setter / limit indices using the **DDCS
   Expert manual** (`assets/M350 Network Configuration Instructions.pdf` + the Modbus manual) — the
   panel's param numbers equal `setting` indices.
3. **Phase 2 — confirm on-site (attended ONLY).** For any index you can't pin from the manual, the
   operator changes **one** param on the panel; you re-run the capture and **diff** the two `setting`
   files to see which index moved. The agent only reads/diffs — the **human** makes the panel change.
   Needs eyes on the machine, so it is **not** part of the unattended phase.

## Open questions to resolve on-site `[TO TEST]`

- **Exact `setting` path/share.** `_read_setting_params()` reads `<expert_dest>/setting`. Confirm the
  Expert exposes `setting` on `\\192.168.0.99\CNCDISK` (or note the real path) and its size
  (FINDINGS says **1000×f64 / 8000 B** for the Expert; the V4.1 dump was 1500×f64 — confirm the Expert’s).
- **I-O pin param numbers** for probe / tool-setter / limits — none are in FINDINGS yet. This is the core unknown.
- Whether any param encodes a tool changer (expected: none).

## Done when  — ✅ all met (2026-06-10)

- [x] `GET /api/profile` on the live machine returns `source:"controller"` with `hardwareTabs` derived from
  real I-O config, and a `pins` block (`{probe, probeLevel, setter, setterLevel, limits:{…}}`) Studio can
  pre-fill from. **Verified live against `192.168.0.99`** (returns `["probes","limits"]`, ATC off, pins
  probe=10/setter=2/limits{xMin:20,yMax:23,zMax:21}).
- [x] Values are **cross-checked against the panel** (Fixed Probe = IN02, Floating = port 10, level `N`)
  and the known anchors re-validated against the captured `setting`.
- [x] Every confirmed index is recorded in [`FINDINGS.md`](FINDINGS.md) → "Profile I/O map" as a table with
  `[CONFIRMED]` tags (param # → meaning → observed value + the `[port, enable, active-level]` triple layout).

> ⚠️ One correction for the next agent: `setting` is on **SYSDISK**, not CNCDISK as the old "Open questions"
> below assumed — `_read_setting_params()` derives the SYSDISK sibling. The I/O pin params (the "core unknown")
> are now all known, sourced from `SYSDISK/cfg_utf8` (the full param schema shipped on the controller).

## Safety (non-negotiable)

- **Read-only.** Reading `setting` over SMB is safe. **Never write** params or the `setting` file from
  code. Any param change is done **by the human on the panel**, then you re-read.
- Don’t blind-poll live runtime vars (`#1000` etc.) — see the cautions in [`FINDINGS.md`](FINDINGS.md).
- Keep the gateway change minimal: only `Ops.profile()` (+ a small `_map_setting_to_profile()` helper if
  you like). Don’t touch the transport or other endpoints.
