# Bench checklist — live controller (V4.1 / Expert M350)

Everything that needs the **physical controller** in front of you. Accumulated from the build; the
offline-confirmable parts are already done + pushed. Bench V4.1 @ `10.0.0.50`; Expert M350 = the real target.

## Ground rules (safety)
- **Reads are read-only. Studio never *writes* a variable/value to the controller.** The Watch tab and
  all value reads only *read* `uservar`/`setting`/`coord1` over SMB — a monitor, never an editor.
- **Probe / ATC wizard macros MOVE the machine.** Dry-run / air-probe first, hand on E-stop.
- Read-only file access (fingerprint, `uservar`/`setting`/`coord1`) is safe anytime, attended or not.
- **Never assume a V4.1 fact on the Expert or vice-versa** — variable maps differ. Log results per controller.

---

## 1. Gateway connect + controller detect
- [ ] Setup tab → set `dest` to the controller share: `\\10.0.0.50\cncdisk` (V4.1) / `\\192.168.0.99\CNCDISK` (Expert).
- [ ] `GET /api/descriptor` → `controller_family` = `v4.1` / `expert-m350` (the read-only fingerprint).
- [ ] `GET /api/profile` serves the matching profile (V4.1 baseline; Expert baseline + live `setting` refine).
- [ ] Restart the gateway onto the current build so `/api/vars` (Watch) is live.

## 2. Variable value mappings — turns Watch `#500+` from "pending" to real
- [ ] **`#100–499` (uservar):** add `#200` in Watch, set a known value, confirm it shows. `[CONFIRMED in findings — re-verify in the UI]`
- [x] **`#500–1499` (setting): macro# → setting-index offset — Expert SOLVED.** **macro = param + 500 `[CONFIRMED 2026-06-17]`** (active WCS param #78 ↔ macro #578; WCS table param #305+ ↔ macro #805+, decoded from the live dump). V4.1 offset still unconfirmed (bench). Extend `ops._var_value` (the `500..1499` branch) via the +500 rule.
- [ ] **WCS (`coord1`, 432 B): map the byte layout.** Read `coord1`, set **G54 X** to a known value on the panel, re-read → the moved 8-byte slot = G54 X. Establish axis order (X/Y/Z/A) + WCS order (G54–G59, G52). → unlocks the **WCS grid tab**.
- [ ] **Positions `#1500–1503`:** find the live current-position source (`.pos` format / status / descriptor); confirm a known position reads right.
- [ ] Confirm **snapshot timing**: values flush at run start/end (not mid-run) — Watch shows last-run state.

## 3. Variable-list enrichment (the controller's `eng` labels)
- [ ] **Confirm the V4.1 parameter-page# → macro-address offset.** Does `eng #001` (Pr1) = macro `#500`? `#501`? Method: a macro reads a known param value; compare to the parameter page. (Expert uses Pr+500 `[CONFIRMED]`; the V4.1 is unconfirmed.)
- [ ] If confirmed, attach the `eng` `-s1` labels to the var list at the correct macro numbers (regenerate `default_vars_v41.js` for the `#500–1499` area instead of the generic range text).

## 4. Probe / ATC wizard macros — validate (⚠️ these move the machine)
- [ ] **Circular bore/boss:** run on a test bore + boss; confirm centre + diameter; verify the `G53 X#53` re-centre lands right.
- [ ] **Rotary centreline — known diameter:** probe a cylinder; confirm Yc/Zc + the WCS write.
- [ ] **Rotary centreline — 3-point fit:** verify the circle-fit math (flagged advanced) against the known-diameter result.
- [ ] **Rotary clock:** verify the **A-axis direction** — does "set A0" datum the flat level the *right* way? If reversed, flip the span sign. Test all 3 actions (set / report / rotate).
- [ ] **Tool check:** run with a known tool → OK; break/shorten the tool → confirm the abort + deviation report.

## 5. CAM menu — dynamic deployment probes (Expert only; ⚠️ manual SYSDISK writes)
Context: `CAM-MENU-RESEARCH.md` §5c. These are **attended, manual** file writes over SMB —
outside the "Studio never writes" rule, so: **snapshot every file before replacing it**, and
keep the firmware backup current (malformed `eng` could plausibly break boot).
- [ ] **Macro hot-reload:** edit a comment/message in an installed `macro_camN.nc` over SMB → press Start (no reboot) → confirm the change ran. Expected: works (read-at-launch).
- [ ] **BMP reload:** replace a `camN.bmp` over SMB → exit + re-enter the CAM page → icon updated? If not, reboot and re-check (boot cache).
- [ ] **eng reload:** edit one `-s1` label over SMB → (a) re-enter CAM form, (b) toggle language eng↔chs↔eng, (c) reboot — note which step picks it up.
- [ ] Log results in `CAM-MENU-RESEARCH.md` §5c table.

## 6. Optional
- [ ] Surface `controller_family` in the gateway Setup tab UI (data is already in the descriptor).

---

## Per-controller mapping notes
| | DDCS V4.1 (bench, `10.0.0.50`) | DDCS Expert M350 |
|---|---|---|
| `uservar` | SYSDISK, **400 slots** → `#100–499` `[CONFIRMED]` | CNCDISK, **450 slots** → `#100–549` `[CONFIRMED]` |
| `setting` | ~1500 params (offset TBD) | 1000 params; `#575` setter, `#578` probe `[CONFIRMED]` |
| WCS store | `coord1` (432 B, layout TBD) | TBD |
| Live var read | SMB snapshot only (flush at run start/end) | + Modbus `MGETDATA` live — **Expert-only, risky (wedged once → reboot)** |
| `slot = #var − 100` | ✅ | ✅ |

See `bridge/controllers/README.md` + each controller's `FINDINGS.md` for the full matrix.
