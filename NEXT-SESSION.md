# TODAY — the running order (2026-08-26)

⚠ **This file was 7,421 lines of twenty stacked cycles**, going back to cycle 856 while the loop was at turn
2297 — every plan the loop had ever run, appended, newest on top. **A transcript, not a reference.** Rewritten
to what its name says: the CURRENT running order. Git holds the rest, and the owner's standing ruling is that
completed plans are not kept — *"we can always plan again."*

⛔ **Keep it short. If it starts growing a second "ACT 1", delete the first one.**

---

## ⛔ SAFETY — read before touching a machine or enabling anything

1. ⛔ **`G54 Z0` = the spoilboard. SACRED.** Anything that writes a WCS Z is in the highest-risk class.
2. ⛔ **No writes to a live controller when the owner is not at it** — and ⚠ **whether they are at it cannot
   be inferred from which seat is talking.** They are on a phone, in every conversation at once. **Ask.**
3. ⛔ **Never run `MGETDATA` on this Expert firmware.** It froze the controller with a bench-validated slave
   answering on COM6; no slave configuration fixes it (`FINDINGS.md` §17).
4. **ONE GATEWAY ON DRIVE AT A TIME** until the inbox is namespaced per controller — two gateways share one
   `DDCS Bridge/inbox/` and nothing knows which machine a job is for.
5. **A job sent while its controller is off is DESTROYED, not queued** — `poller._claim()` deletes on
   `OSError`. Worst on the cloud path: a phone is told "queued" and a sleeping gateway discards it.
6. **Switching `backend` local↔drive strands the queue** — the two inboxes are mutually invisible.

---

## WHERE THINGS STAND — 2026-08-28

**Branch `wizards-as-data-blocks`. Released V2026.08.28.4.**

The live arc is **wizards-as-data**: every built-in becomes a `{template, bindings}` definition, so a wizard
can be reproduced from declared data alone. `drill` is the pilot.

```
DONE  t2299 — drill's FORM is a declared uiChildren tree (the arc's first end-to-end proof)
      t2301 — pocket's form, exercising guard for LAYOUT
      t2365 — FORK-TO-CUSTOM. Both doors now work for an unguarded declared form.
```

⭐⭐ **THE HONEST NUMBER — CORRECTED 2026-08-28 by grepping, after the advisor wrote the wrong one here.**

⚠ The first version of this block said *"only 2 wizards have a declared form; the remaining work is the other
thirty FORMS."* **That was false**, taken from a hand-back phrase (*"the only two turned to data-twin form"*)
instead of from the code. It is the exact failure this file's own closing section warns about — *a document's
own frontier list is the least trustworthy line in it; grep for the capability, not the file's claim.*
**Measured:**

```
33  dataOps files declare uiChildren
32  of them declare a param_group  — i.e. essentially EVERY twin has a declared form
 4  use a split_horizontal/vertical → hasTreeLayout() drives the LIVE render from the
    declaration (drill t2341, centerDrill, edge, parting)
 2  are pinned by a form-REPRODUCTION ratchet spec (drill t2299, pocket t2301)
```

⭐ **And flat mode is not a lesser path.** `blocksApp.js:788-794` records the empirical check: a sectioned
twin takes its own flat path, and `formBindings()` + `renderOpForm()`'s section-grouping already produces the
**complete** form — Corner 23/23 fields, WCS 6/6, ATC Length 7/7, Surfacing 30/30, **zero exceptions**. A
different branch inside the same renderer, *not* a gap.

⇒ **The remaining distance is the PROOF, not the declaration.** The plan's done-condition (`:164-168`) is
*"the arc is done when the gap list is empty"*, and that list is maintained by the reproduction specs.

## ⭐⭐ THE ARC IS EIGHT WIZARDS FROM DONE — MEASURED 2026-08-28 (t2379/t2381)

⚠ **This block has now been wrong twice, in the same direction both times** — first *"only 2 have a declared
form, ~30 to port"*, then *"~26 to ratchet"*. **Both were taken from prose. The measurement is a grep.**

```
grep 'id="wiz_*"' index.html  →  FOURTEEN built-in shells still live
                                  SIX already ratcheted (the mill family)
                              ⇒  EIGHT remain: 6 ATC · comm · wcs
```

⭐⭐ **Everything else HAS NO LIVE SHELL** — all 6 probes (retired `cbe08b03` + t1730), all 7 lathe, plus
homing, bore, tap, io_step, pause_confirm. ⇒ **The done-condition does not apply to them, and that is not a
gap — it is completion.** The ratchet exists to prove a twin matches the incumbent shell *before* the twin
replaces it. Where the shell is already retired, **the replacement has happened and the incumbent is gone.**
Nothing is left to prove.

⛔ **DO NOT "reproduce" a retired shell.** t2379 recovered corner's dead shell from `cbe08b03^` and checked:
it used a 6-section design (FEATURE CONTEXT/WCS/GEOMETRY/FEED RATES/ADVANCED/OPTIONS) with entirely different
field ids. The twin's current 3-section design is a **deliberate shipped simplification**. Reproducing the
dead shell would REVERT it — an active regression dressed as arc work.

⇒ **What replaces the ratchet for shell-less twins:** ONE registry-wide invariant over all 32 (every binding
sectioned · only the canonical `SECTION_RANK` vocabulary · zero orphans), with a declared exception list
asserting the known divergences **exactly** — e.g. text's unbound `rpm` frontier. Not 6 per-wizard specs: the
property belongs to the registry, so one table-driven test covers the mill family too and catches every future
twin with no new file.

## ⭐ THE VOCABULARY — use these five words, not `Phase 0/1/2` (owner-approved 2026-08-28)

Full definition + census: [`wizards_as_data_transition_plan.md`](wizards_as_data_transition_plan.md), section
**THE FIVE RUNGS**. A rung is a property of ONE WIZARD and is *checkable*; a "phase" was a property of the
project and is what let the remaining size be miscounted twice in one day.

```
DATA → FORM → MATCH → LOCKED → ONLY          ONLY 18 · LOCKED 6 · FORM 8
                                ⛔ MATCH and LOCKED are meaningless once
                                   the shell is retired — ONLY is DONE
```

⚠ **One consequence is already filed:** BACKLOG #39 — a *guarded* wizard forked from a **placed op** loses its
guard arms and refuses (loudly, correctly). Blast radius today is small precisely because only two forms are
declared; **it grows with every form ported**, so #39 wants closing early in the breadth run, not after it.

- **Corner is the gated pilot** — no wizard ports until corner is right.

⚠ **The two known leftovers after `method`:** the `d_tool` library picker (a fire-once convenience, not a
stored field — may be out of scope entirely) and a cosmetic section-chrome difference (bare `<span>` headers
vs the collapsible `.form-sec` the `section` node always renders).

---

## OPEN — blocked on the owner, nothing else

1. ✅ **The 3 NEVER-STARTED docs — RULED 2026-08-26.** The wizard-manager plan is DELETED (its subject
   cannot be found by name any more, so there was nothing to merge). `SLAVE-CHANNEL-TESTS.md` is KEPT — it is
   the test plan for the reboot below, not dead. `parse-out-ghidra-guide.md` is KEPT pending that reboot: if
   the slave channel answers, it is unnecessary; if it does not, it is the fallback.
2. ✅ **The WCS-zero tool-offset term — OWNER-REFUTED 2026-08-26.** A non-zero tool offset is what a
   tool-length offset IS. `BACKLOG.md` #27 is tagged; do not work it as written.
3. **#23 — should an op's AUTHOR be able to declare a child SWITCHABLE?** The mechanism exists (structural
   bindings + guards, shipped for corner). The question is whether a curated set of author-declared toggles
   is the right feature, or whether nested disable simply does not apply to parametric ops and should SAY so
   rather than forget silently.
4. **Roles: the override's SHAPE.** Roles are automatic and derived from configuration; changing one must
   never destroy config. The override stays — its UI is undecided. (`ROLES-PLAN.md`)
5. **The offline shop.** LAN serving is the only phone→machine path with no internet. Cloud cannot cover it;
   one-box cannot either. **Whether that case still matters decides whether LAN is ever deleted.**

---

## WAITING ON SOMEONE ELSE

- **Fairy: a controller REBOOT**, then re-probe Modbus read-only. `#279` reads Slave but serial parameters
  only apply at startup. ⛔ The reboot must come BEFORE any firmware flash, or a working Modbus cannot be
  attributed to either one.
- **The vendor (Q.G. Zhang): the G-code line-number register.** Promised ~2026-08-27, *"I'll keep you
  posted."* ⭐ Inbound — nothing to poll. ⇒ the SMB progress-file hunt stays closed.

---

## WHERE EVERYTHING ELSE LIVES

⛔ **Do not restate these here.** That duplication is what made this file 7,421 lines.

| file | what it holds |
|---|---|
| [`BACKLOG.md`](BACKLOG.md) | the diagnosed one-sitting items, each with a runnable `STILL REAL IF` |
| [`ROADMAP.md`](ROADMAP.md) | the canonical feature backlog + **Conventions / traps** |
| [`AGENTS.md`](AGENTS.md) | the rules — every one paid for by a real bug |
| [`context/`](context/) | seats, setup, channels — who reaches which controller, and the vendor thread |
| [`ROLES-PLAN.md`](ROLES-PLAN.md) | the roles feature: the two gating axes and slices S0–S5 |
| [`bridge/controllers/expert-m350/FINDINGS.md`](bridge/controllers/expert-m350/FINDINGS.md) | hardware truth, confidence-tagged. ⭐ **Its RESULTS block is the reference; the numbered trail below it is provenance.** |
| `wizards_as_data_transition_plan.md` | the live arc's own status doc |

---

## ⚠ A PATTERN WORTH INHERITING

Four times in one evening a capability limit was asserted without testing it, and it was wrong every time —
`drive.file` scope, release-note screenshots, CNCDISK on a client, and "clear the config to change role".
**Before hiding a tab, refusing a feature, or designing around a limit: read the code or call the API.**

⭐ The same failure recurred on 2026-08-25 in a new form: **a document's own "REMAINING FRONTIER" list is the
least trustworthy line in it.** Three separate "frontiers" turned out already solved elsewhere in the
codebase — one of them escalated to the owner as a design decision it never was. ⇒ **Grep for the capability,
not the file's claim.** And where a limit is real, ⭐ **pin it as a failing assertion, not prose** —
`drill-as-data.spec.js` asserts its own divergences, so when one closed the test failed and announced it.
