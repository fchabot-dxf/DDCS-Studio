# t2118 — advisor review of 21080973 (vendor-pack Stage A-C)

Fresh-eyes adversarial review: 6 dimensions, every finding re-checked by an independent agent told to
REFUTE it. 34 raised, 27 survived, **7 refuted** — it cut both ways rather than only piling on.

⚠ The blocker below is the ADVISOR's fault, not the worker's: the worker implemented
`VENDOR-PACK-FIXES-PLAN.md` faithfully and the plan specified the defect.

⭐ Independently re-verified by the advisor before dispatch: `Pr079 = 0` (Analog) decoded from
`SYSDISK/setting` (1000 LE doubles, index 79) on **both** captures, and `grep tapCapable` confirming it
appears only in `settingsPanel.js` / `dumpImport.js` / `userOpView.js` — all form-time, never in an emit path.

# Release verdict — commit 21080973 (vendor-pack Stage A/B)

## 1. HOLD — one blocker

Everything else is shippable. One emitted-G-code path can drive a stationary tap into the hole on *your own machine's* configuration, and it is reachable from the Blocks tab with no gate.

## 2. Blocks release

**`DDCS-Studio/web/wizards/ops/tap.js:33` — the rigid branch has no emit-time spindle gate, and the new sequence no longer starts the spindle at all.**

```js
const rigidOk = !!p.rigid && !!dialect && String(dialect.id||'').startsWith('ddcs-expert');
```

That is the whole gate — `spindle.tapCapable` appears nowhere in any emit path (`grep tapCapable` → settingsPanel.js, dumpImport.js, `userOpView.js:502`, `tapData.js:58`, all form-time). `tapBlock` (tap.js:66-73) declares no `gate:` key, unlike its siblings (`cnc.js:34`), and `blocksApp.js:63-77` builds `{id, name, caps}` — `settings.spindle` is not even in scope there, so the gate is currently *inexpressible* at the palette layer. Tick `rigid` on a Tap block and emit fires.

What emits (verified by running it, dialect `ddcs-expert`):
`M180 / M29 S400 / G0 X.. Y.. / G0 Z.. / G98 G84 ... / G80 / M5 / M181`

Pre-commit that branch emitted `M3 S<rpm>` before the G84. **Post-commit there is no M3 anywhere** — the only speed word is `M29 S400`, which per the vendor sheet syncs *the servo spindle*. On a machine with no servo spindle, nothing spins.

Your machine is that machine. `capture/20260731T181343Z/SYSDISK/setting` index 79 = `0.0`, and `SYSDISK/eng:286` reads `#79 … -i0"Analog" -i1"Plu/dir" -i2"Multi-speed"`. And G84's body on this controller is plain feed moves — `SYSDISK/slib-g.nc:101-114`: `G91G00X#0Y#1… / G90G00Z#10 / G90G01Z#11 / G90G01Z#10`. Result: tap fed 10 mm into the hole at F = rpm × pitch with a dead spindle.

Note the reviewer's `#1295` output-toggle argument is **weaker than claimed** and does not carry the blocker: `slib-m.nc:1774-1785` shows `O10180` is `IF #2==0 GOTO30` on the port-enable `#1296`, so on an unconfigured machine M180 writes nothing at all. The no-M3 mechanism is unconditional and is what blocks.

Fix direction: make the attestation an emit-time condition (plumb `settings.spindle` into the dialect/caps object so `tapBlock` can carry a real `gate:`), and fold `rigid` back to the floating-holder cycle when it is absent. The form-time grey also never clears the stored param, so a saved `rigid:true` survives a machine swap un-editable — clear the value the way the data-option gate at `userOpView.js:530-534` already does.

## 3. Should fix, not blocking

- **`tap.js:37/49` — M180/M29/M181 emitted per hole.** A 3×2 array emits M180 ×6, M29 ×6, M181 ×6 (reproduced). Both vendor programs bracket the mode once per operation group (`M350刚性攻丝设置简易说明.txt` §3; V4.1 manual p.88 runs G74+G84 under one M29, one M5). Hoist the bracket above the pattern — and move the `M5` with it, since the G/M sheet's M29 row says "M5 is cancelled". *(A second reviewer's framing of this as a sync/relay-wear hazard was refuted: re-issuing M29 per hole is the conservative arrangement, and the commit actually removes 6 analog spin-ups. Cost is program shape and cycle time, not safety.)*
- **`tap.js:49` — nothing restores analog mode if the program aborts between M180 and M181.** Worse than a latched pin: `slib-m.nc:1774-1797` shows M180 writes `#579 = 1`, and `M350 Macro Address TableV1_1(EN).xlsx` row 579 is "Spindle interface type 0: Analog; 1: Pul/Dir" — a **stored parameter** (Pr079), the same one `dumpImport.js:207` reads as machine truth. `O10030` (M30) never touches it. A stop/E-stop mid-tap leaves the controller in servo mode permanently; the next program's `M3 S12000` commands pulse/dir and the following G1 plunges dead. `envelopeCheck.js:41` cannot see it. Assert M181 in the footer, or in the header the way the vendor's own test program does.
- **`cnc.js:50` / `tests/node/vendor-pack-canned-cycle-retract-2117.test.mjs:18` — `bore` emits `G85`, which does not exist.** G/M list G85 row: *"No code. You can add the code to O9085 slib-g … "*, Subroutine Contents *"Empty"*. No `O9085` in any slib in the repo (Expert ×2 captures, V4.1, DM500). The dropdown offers it (`bridge.js:45`) and the only gate is grbl. The new test now certifies `G98 G85` as vendor-conformant, so an honest fix has to edit the test. Gate `bore` off the DDCS posts or drop it. *(The "silent no-op → tap into solid stock" chain is inference — the corpus never says what an absent hook does. Demonstrable consequence: the feature is never machined.)*
- **`cnc.js:50` — G98 without establishing the plane it returns to.** The block emits exactly one line and no lead-in. After a `contour` at z −6 (which ends on a G1 at depth) the emit is `G1 X0 Y0` → `G98 G81 X10 Y10 Z-5 R2 F200`, so the "initial plane" is −6. `slib-g.nc` O9081 confirms the XY rapid runs at the *current* Z before moving to R. Both vendor samples pair the cycle with a positioning move (`G00 X0 Y0 Z2` / `G1 Z1 F1000`); `tap.js:39-40` got this right in the same commit, `cnc.js` did not. Pre-existing hazard — the commit's added comment claims to have removed an inheritance that is still there. *(The Pocket→drill scenario in one write-up is wrong: `pocketfill` retracts to clearance. Contour/leaf ops reproduce it.)*
- **`slotPack.js:171` — the CRLF detection is inert on its only production path.** Measured in headed Chromium with a real OS-clipboard paste: clipboard delivers CRLF ×4, `textarea.value` returns LF ×4. So `macrosApp.js:1993` always hands mergeEng zero CR, `crlfCount >= lfOnlyCount` is false, and `eng-merged.txt` downloads bare-LF regardless. The real eng is 1176 CRLF / 0 bare LF (vendor's own `Docs/自定义CAM/eng`: 1172 CRLF / 0). Not a regression — the pre-commit code did the same — but fix (1) of three did not land. Re-apply the dominant ending at the caller, or default to CRLF when input has zero CR.
- **`macrosApp.js:1960` (and `1955`, `2003`, `zip.js:15`, `grantedFolder.js:114`) — every CAM-pack artefact is written UTF-8 into files the controller reads as ANSI cp936.** The vendor's own `Docs/自定义CAM/eng` is GBK-only (line 875: `-i2"Рус"` in GBK's A7 Cyrillic block); your repo's own `VENDOR-PACK-SWEEP.md:176` already says *"**Encoding: ANSI** for `eng/chs/rus/msg/msg1/msg2`"* — the plan never carried it forward. Ran it: `slotEng` → `-s1"Bolt-circle Ø"` reads as `脴` on the machine, and `slotMacro`'s `( cam22.nc — Drill … )` em-dash is not decodable GBK at all. Pre-existing, but this commit doubles the exposure (chs-additions.txt) on a premise ("the labels stay English") that is false for Studio's own labels. Damage is mojibake glyphs inside `-s1"…"` and `( … )`, never a motion change.
- **`tests/controller-file-tree.spec.js:39` — the V4.1 guard is dead.** The rename to `camN.nc` orphaned `not.toContain('macro_camN.nc')`. Mutation-tested: push the CAM entry into `CONTROLLER_FILES['ddcs-v41'].tree` and the guard still passes; `not.toContain('camN.nc')` fails correctly. One-word fix in a line the commit walked past.
- **`macrosApp.js:171` — the Deploy-pack tooltip still promises `macro_camN.nc` and "the CAM/ tree lands on it".** The export writes `cam<N>.nc` at the root plus `install/CAM/*.bmp`, and never mentions the new chs-additions.txt. T6's plan enumerated five copy sites and fixed all five; the tooltip was not on the list. Same string stale at `README.md:79`, `macrosApp.js:176/1916/1964` (the last quotes a README step this commit deleted). *No G-code impact* — the README.txt that physically travels on the stick was corrected.

## 4. Worth noting

- `blockEmitter.js:787` `FEED_BARRIERS` folds F out of holes 2..N of every arrayed canned cycle (tap **and** drill) — pre-existing, and not caused by M29 (the "M29 is a feed-mode code" argument does not survive: the vendor runs `M29 S2000` with `F2000` mm/min). But the G73 row's stickiness note ("*When moving to another cycle … only the XY Z parameters are transferred. The rest must be specified again*") argues for never folding F out of a canned-cycle block. Cheap hardening, worth doing on its own ticket.
- `cnc.js:38` — `drillCycleBlock.emit(p, dx, dy, …)` never reads dx/dy, so an Array of Drill Cycles emits N cycles at one point. Real and pre-existing; `tap.js:70` and `holecycle.js:630` both handle it. Consequence is a wrong part (holes 2..N missing), not a collision — G90 means the repeats do not go deeper — and the block is palette-only, not on any wizard path. One-line `+ dx` / `+ dy`.
- `controllerFiles.js:37` — the fix renamed the leaf but left `{ group: 'CAM/' }`, so the Macros tree still renders `SYSDISK/ › CAM/ › camN.nc`. Inert label (no `data-file`, `flattenFiles` skips groups); the 2026-07-31 capture is entirely flat. Nit, pair it with the tooltip cleanup.
- `vendor-pack-canned-cycle-retract-2117.test.mjs:22` — named "*the retract-plane comment names WHY*" but asserts only `not.toContain('G99')` on the emitted line; passes on a full revert. Rename or delete; line 14 carries the real coverage.
- `deploy-folder-1249.spec.js:115` — logically dead: line 108 already asserts the literal `install/CAM/cam22.bmp`, and the spec's fake handle records a slashy write identically to a walked one. The rest of that spec's changes are a genuine strengthening.
- `vendor-pack-mergeeng-2117.test.mjs:27` — `not.toContain('(')` is stronger than the property the code earns. Real eng files carry 26-57 mid-line `(` inside `-s1"…"` labels, so this blocks the real-file fixture it should invite. Correct assertion: no line *starts with* `(`. Related: no test anywhere feeds mergeEng a real eng dump — I ran the shipped function against all seven real files and it is correct on every one, so adding one as a fixture is cheap.
- `macrosApp.js:1953` — eng-additions keeps `;` headers while mergeEng drops comments entirely. Not the inconsistency it looks like: `^(` = 0 in 13 of 13 real eng files, `^;` = 0 in 12 of 13 (the exception being the community CAM10-CAM21 pack). The commit moved from zero-precedent to one-precedent. Blank-line separation would close it entirely.
- Test-gate honesty: of the 11 new node tests, **5 fail on revert** (T1 order / no-bare-M3 / G84-carries-XY, T2 `^G98 G8x`, T5 merge placement) and 6 are pass-on-revert guards. The commit message's "all mutation-tested for non-vacuity" overstates it. **Coverage gap:** program-level ordering of M180/M29/G84/M181 is asserted nowhere — `tapping-776.spec.js:52-57` only regex-tests presence. I emitted the full program by hand and the order is correct, but a framing-layer reorder would not go red.

## 5. What I checked and found clean

Scope: the emitted G-code on all three DDCS families, the vendor pack (G/M list xlsx, `M3xx_M6xx手册`, `G84测试.txt`, `M350刚性攻丝设置简易说明.txt`, `Custom CAM.pdf`, the macro address table), your machine's own two SYSDISK captures including `slib-g.nc` / `slib-m.nc`, and the CAM-pack write/export path. Seven candidate findings were investigated and **refuted**:

- **G91 double-offset on the new G84 X/Y** — refuted twice over. The Expert's O9084 (`slib-g.nc:101-114`) is unconditionally `G90` for Z and R with no `#450` distance-mode branch (the cited branch is DM500's, and `ddcs-v3-dm500` can never reach the rigid path). Every wizard path opens with `G90` from `headerBlock`, and every probe stack closes in G90.
- **"V4.1 has no G81/G82/G83/G80"** — refuted from V4.1's own firmware: `ddcsv4/slib.nc` defines O9081/O9082/O9073/O9083/O9074/O9084. The manual's G-table is incomplete. `peck→G83` is correct (G73 and G83 are different cycles, both present).
- **"Canned cycles must emit K1 or a stale #13 repeats the cycle"** — refuted, and acting on it would have *introduced* a bug: on the Expert **K is #16 (retract distance), L is #13 (repeat count)** per the manual p.106 and the macro address table; the community Russian workbook row was misread. Emitting `K1` would set a 1 mm peck retract.
- **"G98 reaches posts with no evidence they parse it"** — refuted: V4.1 manual p.88 documents G98/G99 and the exact `G98/G99 G84 X_ Y_ Z_ R_ P_ F_` form; Centroid CNC12 §12.43; DM500 `slib.nc:35-39` implements the semantic on `#449`.
- **mergeEng "rewrites every line ending"** — refuted; on the only production path (textarea, LF-only) both branches are byte-preserving, and no real artefact has mixed endings.
- **"The README never installs the icons"** — refuted: steps 1+2 *are* the vendor's documented mechanism (`M3xx_M6xx手册` §5.8.4: copy `install` to the U-disk root, power-cycle, auto-upgrade). The old `CAM/` + F4 flow put the .bmp on the wrong disk; this commit is the first version that routes it correctly. (Residual doc nit: the README omits the vendor's warning to delete `install/` from the stick afterward.)
- The remaining rigid-tap modal-F "blocks-release" claim was downgraded to the hardening item in §4.

Not in scope / not re-verified: the 5 pre-existing test failures, and any hardware-in-the-loop behaviour — the CAM-pack deploy path is still flagged `⛔ UNTESTED END-TO-END` at `macrosApp.js:1945`, and no one has bench-run a rigid tap.