# VENDOR-PACK-FIXES-PLAN — t2117

**Origin.** The human downloaded foinnc's own development pack (112 files) to
`~/APPS/fred-skills/ddcs-expert/references/M350-main`. A 10-reader sweep read all of it against Studio's
source; 127 high-priority claims were adversarially re-verified, 5 killed. Full report:
[`bridge/controllers/expert-m350/VENDOR-PACK-SWEEP.md`](bridge/controllers/expert-m350/VENDOR-PACK-SWEEP.md).

**What this document is.** The advisor's task spec for the WORKER. Every task below carries the exact vendor
quote, the exact file:line, and the exact code. ⛔ **The advisor reverted its own three in-flight edits so the
worker owns a clean tree** — do not expect to find them; the code blocks here ARE those edits, reproduced so
nothing is lost.

**Role note.** `DDCS-Studio/web/` is normally advisor-owned. For this batch the WORKER writes it and the
ADVISOR reviews the diff with fresh eyes. ⛔ **Advisor: do not `git add` these files while the worker holds
them** — that is exactly how a previous handoff swallowed the worker's edits.

---

## Sequencing

| Stage | Tasks | Gate |
|---|---|---|
| **A — emit correctness** | T1, T2 | Ship together. Contained, vendor-quoted, high confidence. |
| **B — CAM pack artefacts** | T3, T4, T5, T6 | Ship together (they are one feature). ⚠ Untested end-to-end by definition. |
| **C — small truths** | T7, T8 | Any time. |
| **D — THE HEADLINE, gated** | T9 | ⛔ Do NOT start without an explicit human go. See its own gate. |
| **HELD** | H1, H2 | Not dispatched. Reasons below. |

---

## STAGE A — emitted G-code is wrong today

### T1 — Rigid tapping emits no `M180` and no `M29`

**File:** `DDCS-Studio/web/wizards/ops/tap.js`, the `rigidOk` branch in `tapCycle()`.

**Evidence.** `Docs/G83_G84钻孔攻丝指令说明/G84测试.txt`, the vendor's complete file:

```
M180  //切换到伺服主轴
M29 S2000  //刚性攻丝模式
G00 X10 Y0 Z2
G98 G84 X10 Y0 Z-10 R2  F2000  //G84攻丝 螺距1mm=S2000/F2000
M30
```

Corroborated by the G/M list: `M29 | ... Synchronizes the rotation of the servo spindle with the movement of
the Z axis`; `M180 Enables servo spindle mode`; `M181 Enables analog spindle mode`; G74/G84's rows say
*"Works in conjunction with M29."* Grep confirms **zero** hits for `M29`/`M180`/`M181` in `DDCS-Studio/web`.

⛔ **Why it matters:** we emit `M3 S<rpm>` + `G84` — a tapping cycle against a free-running analog spindle.
The failure mode is a snapped tap, not a poor finish.

✅ **Already correct, do not change:** `feed = rpm * pitch` is exactly the vendor's `S2000/F2000` at 1 mm pitch.

**Replace the `rigidOk` return block with:**

```js
        return [
            `( rigid tap ${pitch}mm pitch - vendor G84 sequence; VERIFY the servo-spindle build on your controller )`,
            `M180   ( switch to the SERVO spindle - rigid tapping needs it )`,
            `M29 S${rpm}   ( rigid-tapping mode: synchronise the spindle to Z. WITHOUT THIS THE TAP IS NOT SYNCED )`,
            `G0 X${r3(pt.x)} Y${r3(pt.y)}`,
            `G0 Z${r3(clr)}`,
            // ⚠ X/Y ride IN the G84 block, as the vendor writes it. G98 is explicit: the retract plane must not be
            //    inherited from whatever modal happens to be live when this fragment is composed after another op.
            `G98 G84 X${r3(pt.x)} Y${r3(pt.y)} Z${r3(-depth)} R${r3(clr)} F${feed}   ( rigid tap to depth, pitch-synced )`,
            // ⚠ WE KEEP G80; the vendor's sample does not have it because it ends at M30, which resets modals for it.
            //    This is a FRAGMENT that gets composed with following ops, so leaving G84 modal would re-trigger the
            //    cycle on the next Z move. Deliberate divergence, not an oversight.
            `G80   ( cancel cycle )`,
            `M5   ( spindle off )`,
            `M181   ( back to the analog spindle - leave the machine as we found it )`,
        ];
```

And replace the RIGID paragraph of the file's header docstring with:

```js
 * RIGID (G84-style, opt-in): a canned cycle — gated UPSTREAM on a declared encoder/servo spindle (spindle.tapCapable) AND
 * the Expert post (the only dump-evidenced firmware).
 *
 * ⭐ t2117 — THE RIGID SURFACE IS NO LONGER GUESSWORK. foinnc's own `G83_G84钻孔攻丝指令说明/G84测试.txt` is five lines
 * and we differed on four of them:
 *     M180            切换到伺服主轴   - switch to the SERVO spindle
 *     M29 S2000       刚性攻丝模式     - enter rigid-tapping mode (this, not M3, carries the speed)
 *     G00 X10 Y0 Z2
 *     G98 G84 X10 Y0 Z-10 R2 F2000    - 螺距1mm = S2000/F2000
 *     M30
 * ⛔ WITHOUT `M29` THE SPINDLE IS NOT SYNCHRONISED TO Z. We were emitting `M3 S<rpm>` + `G84`, i.e. a tapping cycle
 *    against a free-running analog spindle — the failure mode is a snapped tap, not a bad finish.
 * ⚠ The FEED was already right: `F = rpm x pitch` is exactly the vendor's `S2000/F2000` for a 1 mm pitch.
 * ⚠ M180/M181 switch spindle MODE and need an output port assigned for it (vendor setup doc, alongside Pr080 spindle
 *   mapping axis and Pr006/Pr007 pulses-per-rev). That is machine-side; the upstream tapCapable gate is what attests it.
```

⚠ **Do NOT add a gate on `Pr080 != 0`.** The eng declares `#80 -s1"Spindle mapping axis" -min=0 -max=5
-i0"X-axis"`, so `0` means X-axis, not "unset". The readable signal is `#79 "Spindle interface type"
-i0"Analog" -i1"Plu/dir" -i2"Multi-speed"`, and `data/dumpImport.js mapSpindle()` already reads both into
`spindle.interface` / `spindle.mappingAxis`. The existing `spindle.tapCapable` gate stands as-is.

**Verify:** a wizard test asserting the rigid branch emits `M180`, `M29 S<rpm>`, `G98 G84`, `M181` in that
order, and that the floating-holder branch is untouched.

### T2 — No canned cycle emits `G98`/`G99`

**File:** `DDCS-Studio/web/wizards/ops/cnc.js`, `drillCycleBlock.emit`.

**Evidence.** Both vendor examples write `G98 G83 …` / `G98 G84 …`. Grep: `G98|G99` has **zero** hits in
`DDCS-Studio/web`. The retract plane is MODAL and the power-on default is documented nowhere, so today it is
whatever the previously-composed op left live — between holes that is whether the tool clears a clamp.

**Change** the `let s = ...` line to prefix `G98 ` and add the rationale comment:

```js
        // ⭐ t2117 — G98 IS EXPLICIT, and was missing entirely (zero G98/G99 in the whole web tree before this).
        // The retract plane is MODAL, and the vendor never documents the power-on default, so without it the plane
        // was whatever the previously-composed op happened to leave live. Between holes that is the difference
        // between clearing a clamp and driving through it. Both of foinnc's own examples write `G98 G83 ...` /
        // `G98 G84 ...`.
        // ⚠ G98 = retract to the INITIAL plane (safe, clears fixtures); G99 = retract to R only (faster, does not).
        //   G98 is the deliberate default. G99 is NOT offered as a field - nobody asked for the choice, and the
        //   fast one is the one that hits clamps.
        let s = `G98 ${G}${at('X', p.x)}${at('Y', p.y)} Z${r3(num(p.z, -5))} R${r3(num(p.r, 2))}`;
```

⛔ **Do not add a G98/G99 field.** Nobody asked for the choice and the fast option is the one that hits clamps.

**Verify:** assert every canned-cycle emit starts `G98 G8x`, and that `noFlow` dialects (grbl) still fold to
the comment path unchanged.

---

## STAGE B — the CAM pack writes a filename the controller does not look for

⭐ **Premise confirmed by the human, 2026-08-20: "never loaded a cam".** No Studio-built pack has ever been
deployed, so there is **no working behaviour to regress** — we are replacing a naming documented nowhere with
the vendor's. ⚠ Equally, none of Stage B can be verified end-to-end until a pack is actually loaded. Say so
in the release note; do not claim it works.

**Evidence.** `Docs/自定义CAM/Custom CAM.pdf` is the only vendor spec, and puts the three artefacts in three
places:

| Artefact | Vendor path | Vendor name |
|---|---|---|
| icon | `install\CAM` | `cam10.bmp` … `cam19.bmp` |
| parameters | `Install\eng`, `Install\chs` | merged into eng/chs |
| slot macro | `/local` (root) | `cam10.nc` … `cam19.nc` |

Studio writes `CAM/macro_cam22.nc` and its README says to copy the whole `CAM/` folder to local — so the file
lands at `/local/CAM/macro_cam22.nc`, **wrong on both name and folder**. The name is corroborated four ways:
the dispatcher parameter `#968 -p0 -a3 -t0 -s1"NC file index No." -s2"camxx.nc" -m18 -min=0 -max=9999` with
`-s3"0-9999:cam0-cam9999.nc"` — **present in this machine's own live `SYSDISK/eng`, not just the vendor
sample**; the controller screenshot title bar (`cam10.nc`); the vendor's Notepad shot (`cam10.nc - 记事本`);
and the community packs' own eng comments, which read `cam14` even though their files say `macro_cam14`.

⚠ `install/` is the USB **staging** folder the controller installs FROM. The vendor puts icons in
`install\CAM`; the 2026-07-31 SYSDISK dump has them flat at the root (`cam0…cam8, cam10…cam12, cam39 .bmp`).
Those reconcile once `install/` is read as source and the root as destination.

### T3 — Emit the vendor filenames, and a `chs` twin

**File:** `DDCS-Studio/web/ui/macrosApp.js`, the `_camExport` click handler (~line 1935).

Replace the `_camPack.slots.forEach(...)` block and the `eng-additions.txt` push with:

```js
        _camPack.slots.forEach((slot) => {
            files.push({ name: `cam${slot.slot}.nc`, data: slotPack.slotMacro(slot) });
            if (slot.icon && slot.icon.data) files.push({ name: `install/CAM/cam${slot.slot}.bmp`, data: packBytes(slot.icon.data) });
            // ⚠ `;` not `( )`: the eng format has NO comment syntax (line-start census of the real file: # 585,
            //   - 390, blank 199, & 2 — zero `(`). `mergeEng` filters to `^#nnnn` lines anyway, so these only
            //   matter if a human hand-pastes the file; `;` is what the community packs use.
            eng.push(`; ===== cam${slot.slot} — ${slot.name || ''} =====`, slotPack.slotEng(slot), '');
        });
        const engHead = '; MERGE these lines into the controller eng language file — do NOT replace it.\n\n';
        files.push({ name: 'eng-additions.txt', data: engHead + eng.join('\n') });
        // C3 — the `chs` TWIN. The vendor installs eng AND chs; a Chinese-language controller reads `chs`, so
        // without this every Studio field renders as a blank label on it. Same bytes: the labels stay English,
        // but the FIELDS exist, which is the difference between a usable form and an empty one.
        files.push({ name: 'chs-additions.txt', data: engHead.replace('eng language', 'chs language') + eng.join('\n') });
```

Carry the full rationale comment above the loop (vendor paths, the `#968` dispatcher line, the `install/`
reconciliation, and the ⛔ UNTESTED note).

### T4 — The macro's own stamp and the module docstring

**File:** `DDCS-Studio/web/data/slotPack.js`.
- line 77, `slotMacro()`: `( macro_cam${n}.nc — ... )` → `( cam${n}.nc — ... )`.
- line 6 and line 73: the `macro_cam<slot>.nc` prose → `cam<slot>.nc`.

### T5 — `mergeEng` appends after the file's terminator, in the wrong line ending, with illegal comments

**File:** `DDCS-Studio/web/data/slotPack.js:150-163`.

Three defects in `const merged = base + '\n\n( ===== ... )\n' + addLines.join('\n') + '\n'`:
1. **Appends after the closing `&&`.** The real eng ends `…-s3"…"CRLF` + six blank CRLFs + `&&CRLF`
   (both `&&` lines confirmed present). ⚠ That `&&` is an end marker is **INFERRED** — the vendor format doc
   never mentions it. Inserting before it is the conservative reading; appending after a terminator is
   strictly worse under either reading.
2. **Injects `( ===== merged CAM pack params (DDCS Studio) ===== )`** into a format with no comment syntax
   (census: zero `(` line-starts in 1176 lines). Drop the line entirely.
3. **Joins with bare `\n`** into a file that is **1176 CRLF, 0 bare LF**.

Fix: detect the dominant line ending from `existingEng` (do not hardcode), insert the additions immediately
**before** a trailing `&&` line when one exists (else append), and drop the comment line. Keep the existing
`paramCollisions` / `groupCollisions` / `added` return contract unchanged.

**Verify:** a unit test with a fixture ending in `&&` asserting the additions land above it, the output has
zero bare LF, and no `(` line-start is introduced.

### T6 — The install instructions now describe the wrong files

Update the copy in all three places to match T3:
- `DDCS-Studio/web/ui/macrosApp.js` `readmeText()` (~line 1918): steps 1/3 say "the CAM/ folder"; step 4 says
  merge into "eng (and chs)" — now there are two actual files to merge.
- `DDCS-Studio/web/ui/helpPanel.js:90`: "writes the whole `CAM/` tree — `macro_camN.nc`".
- `DDCS-Studio/web/data/controllerFiles.js:38`: `{ path: 'macro_camN.nc', title: 'macro_camN.nc', ... }`.
- `DDCS-Studio/web/data/deployFolder.js:40` and `grantedFolder.js:96` reference `"CAM/macro_cam22.nc"` in
  doc comments only — update for accuracy, no behaviour change.

---

## STAGE C — small, safe

### T7 — Name the probe result codes
`#1920`–`#1924` are the per-axis probe **result code**: `0 No detection, 1 Initial detection, 2 Signal
detected, 3 Negative limit touched, 4 Positive limit touched` (R/W FLOAT). Studio's `IF #1922!=2 GOTO<err>`
is **stricter** than the vendor's own `IF #[1920+#1]<=2` (which retries in reverse on a limit).
⛔ **No behaviour change** — name the codes in a comment so the next reader knows 3/4 mean "hit a limit",
not "missed". Related declared block: `#1895-#1899` detect speed, `#1900-#1904` signal number,
`#1905-#1909` stop mode, `#1910-#1914` level, `#1915-#1919` limit scheme, `#1925-#1929` trigger machine coord.

### T8 — `G20`/`G21` are MOVES on this controller, not unit modals
G/M list: `G20 | XYZAB F | Moving axes in the inch system. Works like G1.` So `G20 X1 Y1 F300` **moves to
X25.4 Y25.4**. ✅ Studio already never EMITS them (`data/latheTools.js:16` — "NEVER G20/G21"), so the emit
side is safe and deliberate. Two residual spots:
- `DDCS-Studio/web/ui/editorAutocomplete.js:13` offers `'G20 inch'` / `'G21 mm'` as if they were unit modals.
  Relabel to say they MOVE on DDCS.
- `DDCS-Studio/web/blocks/gcodeToStack.js:98` lists both in `MODAL_RE`, i.e. parses them as inert modal
  prefixes. ⚠ Round-trip only; assess before changing — the existing comment shows the choice was deliberate.

---

## STAGE D — GATED, do not start without an explicit human go

### T9 — The work↔machine frame equation uses 1 of 5 terms

**Evidence.** `Docs/最完整的M350坐标换算公式/Coordinate system offsets DDCSE.txt`, verbatim:

```
#852 = #882 - #807 - #1430 - #837 - #900
       mach   G54     T-off   G52    H-len
```

Studio uses one. `viz/sceneFrame.js:66 wcsOffsetAt()` returns only `{x,y,z}` from the WCS row;
`engine/envelopeCheck.js:113` is literally `const mach = (workPt[ax]||0) + (wo[ax]||0)` (advisor-verified).
Absent everywhere in engine code: **G52** (`#835–#839`), the **per-tool T offset**
(`#1390`/`#1410`/`#1430` + `[#1300-1]`), and the **H tool-length** table (`#900–#915`, settings `#400–#415`
— `default_vars.js` lists them, nothing reads them).

It propagates into emit twice:
- `wizards/dialects/ddcs-expert-m350.js:119-134` `wcsZeroAtCurrent` emits what reduces to `#807=#882`. The
  vendor names this exact form as the wrong way to zero: *"Then the command #807=#882 will set not \"0\" for
  the Z axis in G54, but \"25\"."* (worked with a T1 Z offset of −25).
- `wizards/ops/wcsIndirect.js:36-42` `wcswrite`, shared by `cornerWizard.js:161`, `edgeWizard.js:50`,
  `middleWizard.js:125`, builds `[#1927-#6]` with no tool-offset term.

Documented correct forms:
```
X:   #[805+[#578-1]*5] = #880 - #[1390+[#1300-1]]
Y:   #[806+[#578-1]*5] = #881 - #[1410+[#1300-1]]
Z:   #[807+[#578-1]*5] = #882 - #[1430+[#1300-1]]
4th: #[808+[#578-1]*5] = #883        (no tool offset exists for 4th/5th)
5th: #[809+[#578-1]*5] = #884
```

⚠ **Honest caveat carried from verification:** the vendor's own "correct" formula still omits `#837` (G52)
and `#900` (H), so it is exact only when those are zero. Two independent sources confirm the common/G52
offset is silently operator-writable (system manual §6.4.1; the 加深/抬高 buttons write 公共偏置 in
0.01/0.10/0.50/1.00/5.00 mm steps).

⛔ **THE GATE.** This changes what gets written to a live WCS on machines using fixed-probe tool setting or
ATC auto-measure (`#1305=1`) — i.e. the power-user population. It is the single highest-value fix in the
sweep AND the one with the worst failure mode if wrong. **Requires: an explicit human go, a bench check on
the machine with a known non-zero tool offset, and its own turn.** Do not fold it into Stage A/B.

---

## HELD — not dispatched, with reasons

**H1 — `T.nc` overwrites the ATC dispatcher.** `atcGenerator.generateToolChangeNc` (declared in
`controllerFiles.js:33`) replaces the one-line dispatcher `T#1504`, bypassing `O20000`'s whole magazine state
machine: `#1302` dispatch, dust cover, magazine open/close, per-tool Z, auto tool-setting, position restore.
⛔ **Held because the blast radius is a real tool change on a real magazine**, and the right fix (write into
`slib-g.nc`/`O20000` vs warn loudly) is a design decision, not a patch. Needs a human ruling.

**H2 — CAM `baseSlot: 22` and the `POOL_MIN = 1100` collision.**
- The vendor PDF tables run CAM1→cam10/m30 … CAM10→cam19/m39. ⚠ **Weakened in verification:** the PDF never
  states 10 is the maximum, the vendor's own CAM picker screenshot has a scrollbar sized for ~22+ entries,
  community packs run CAM10–CAM21, and a stray `cam39.bmp` exists. So slot 22 is *undocumented*, **not proven
  impossible** — changing it on this evidence would be guessing.
- `slotPack.nextParam()` starts at `POOL_MIN = 1100`, and the live SYSDISK eng already ships `#1100`–`#1102
  -m30` and `#1103`–`#1105 -m31` as placeholders, so a new user's first slot collides. ⚠ `usedParams()` walks
  only the pack's own slots, never the controller's eng — but `mergeEng` **does** report `paramCollisions`
  against the real file, so this is surfaced at merge time, not silent. Fixing it properly means feeding the
  controller's eng into the allocator, which is an API change. Ruling needed: warn better, or plumb it.

✅ **Confirmed correct as built, do not touch:** `POOL_MIN=1100, POOL_MAX=1499, MIRROR=1500` (vendor:
*"Parameter number range 1100-1499; Macro address: #2600-#2999"*), `slotGroup = slot+20` (CAM1→m30,
CAM10→m39), and the icon format `360×180, 24bpp, BI_RGB, 54-byte header, bottom-up, no palette, xppm/yppm
3780` (parsed from the vendor's own `cam10.bmp`).

---

## Definition of done

1. Stages A–C applied, each with the test named in its task.
2. `cd DDCS-Studio && npm test` — check the FAILED COUNT, not just the tail; "N passed" can hide "N failed".
3. ⚠ Do not claim Stage B works. It is documentation-conformant and **unverified on hardware** — no pack has
   ever been loaded. Word the release note accordingly.
4. Hand back for the advisor's fresh-eyes diff review before any release bump.
