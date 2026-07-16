# Controller Parameters — the read/write strategy

*Designed in a live brainstorm 2026-07-16 (advisor t892). Status: design settled in shape; the build is gated on
three at-the-machine experiments (below). This document is the canonical detail; ROADMAP carries the summary.*

---

## The two rooms

| | **Settings (the record)** | **Gateway → Params (the operating room)** |
|---|---|---|
| shows | what the **profile declares** — the pulled snapshot | what the **controller says live** |
| available | always, offline included | only with the wire up |
| persists | with the profile ("never just a notification") | n/a — it *is* the live view |
| can edit | **never grows a pen** | all change ceremonies live here |

The **pull** bridges them: it refreshes the Settings record from live truth. **Drift** = the diff between the rooms.

## The Params sub-tab (Gateway)

- **The controller's own parameter tree** — generated from the **eng dictionary** (the schema is declared by the
  machine itself: label, type, min/max, enum labels, and the controller's own menu grouping). No hand-rolled lists.
- **Search** filters the tree live (label, number, or value).
- **★ Favorites** — per-controller-profile pinned group at the top of the tree.
- **"Show only drift"** — a filter, not a separate screen: live vs profile, differences inline on the row.
- First concrete resident: the **soft-limits block** (#234 enable + #235-237/#240-242 the six positions —
  grounded in the rig's own eng). The Settings room shows the persisted snapshot of the same facts.

## Ownership rules (ruled during the #520 arc — standing law)

1. **Programs never write controller state.** The safe-Z guard uses the scratch-var read-with-fallback form
   (`#30=#520 / IF #30<0 → #30=baked / G53 Z#30`); the corpus guard asserts no emitted line ever assigns a
   persistent register. Wizards read; they do not write.
2. **The boot macro (sysstart) is the USER'S file.** Studio pushes it verbatim when asked; it never injects
   config into it. (The t824 auto-seeding is removed.)
3. **Deliberate writes get a deliberate door** — the explicit channels below, always user-confirmed, always
   visible in job history. The machine's own screen is always authoritative.
4. **Settings-class values are display-only until a write path is dump-grounded.**

## The change ceremony

Editing (whatever the entry style — inline pencil vs session mode, still open) accumulates into a **staged
basket**; nothing writes as you type; the wire sees **one push at the end**; a **re-pull verifies** the diff
landed. The ceremony ends with an explicit **strategy picker**:

> **✅ PROVEN ON HARDWARE 2026-07-16 (V4.1 bench, live).** The whole write mechanism was validated end-to-end,
> agent-driven, no Export/Import button: the controller's `SYSDISK/setting` file is a **flat little-endian f64
> array — param #N sits at byte offset N×8** (confirmed by matching X−−/Y−−/Z−− against the on-screen values).
> Direct SMB read → patch exactly 3 fields (X++/Y++/Z++ = −0.2) → diff-prove (24 bytes changed, 0 stray) → write
> back over the same share Studio already reads → **the controller ADOPTED the values on REBOOT.** Live pickup does
> NOT happen (params are RAM-cached while running — expected). Shutdown did NOT overwrite the file. So **Strategy A
> is real, and its refresh behavior is answered: file-swap adopts on reboot.** The gateway gains a `writeSetting`
> beside its `readSetting`, same share, same format. (The agent write was gated by the safety classifier until the
> user added a `Bash(powershell:*)` allow-rule + explicitly authorized the bench write — Studio's own gateway code
> has no such gate; it just writes a file.)

### ⚠ SHIPPING TO USERS — the mechanism is proven, so the CEREMONY must be bulletproof
This is a PLATFORM, not one bench. A user's real machine has a real spindle and real travels; a wrong soft-limit /
homing / steps-per-unit write is a genuine crash-or-damage risk. The proven write path therefore ships ONLY behind
a ceremony that makes it safe for someone who isn't the developer:
1. **Mandatory auto-backup before every write** — the pristine `setting` is copied to a timestamped restore file
   FIRST, always; one-click rollback is never more than a click away (today's bench write did this by hand — the
   feature does it by construction).
2. **Read-modify-WRITE the whole file, never a blind offset poke** — pull the current `setting`, patch in memory,
   push the whole file; the diff is computed and **shown to the user** ("3 fields change: Z++ 0 → −0.2 …") and
   **confirmed** before anything is written. No silent field a user didn't see.
3. **Per-controller format grounding** — the f64 / byte-N×8 layout is PROVEN for the V4.1; Expert & DM500 get the
   SAME empirical validation (match known on-screen values to decoded bytes) before their write is enabled — never
   assumed from the V4.1.
4. **Reboot-to-apply is stated, not surprising** — the ceremony ends with "reboot the controller to apply" because
   that's the proven behavior; the re-pull-verify closes the loop after the reboot.
5. **The values stay the USER's responsibility** ([[dont-declare-away-user-responsibility]]) — Studio suggests
   where it honestly can (stock-top for a clearance plane) but never auto-writes a safety value; the human owns
   every number and confirms the diff.
6. **Risk-aware confirmation copy** — writing soft-limits/homing/steps-per-unit shows a plain-language "this changes
   how your machine physically moves — back up taken, reboot needed" before the write; low-risk params (UI, MPG
   speed) get a lighter touch. (The advisor's earlier risk-tier idea, now load-bearing.)

### Strategy A — the native file swap
Studio stages a modified copy of the controller's **own export format** (proven readable — the system-backup is
exactly this), pushes it, and the **controller's own import** applies it under its own rules. Studio adds what the
native flow lacks: the diff, the review, the backup-before (free rollback), the verify-after.
- Coverage: **everything** in the dictionary, by construction.
- Refresh behavior: **unknown — Experiment 2 decides** (silent apply vs reboot-required).
- If reboot is required, routine editing via this road loses its point (the user's ruling: "if we need reboot I
  don't see the advantage") — the road then serves **provisioning and recovery** (board swap, cloning, fresh
  machine: one restore beats five hundred screen-pokes).

### Strategy B — the param macro (an executed run-once job)
A tiny program (`#655=0` …) submitted via the existing `submitJob` channel — immediate, no file, no reboot
question. **Grounded precedent: the factory's own slib-g.nc writes the soft-limit enable (#655) live** — the
mechanism exists; the manufacturer uses it.
- Coverage: only params **proven macro-writable** (the usage standard — a name in the dictionary proves nothing).
- The user's hypothesis: *all* params are macro-writable → **Experiment 3 decides**; if it holds, B becomes the
  everyday road and A retires to provisioning.
- Two numbering worlds: the runtime param number (#655) ≠ the eng menu number (#234). The mapping is discovered
  **empirically by diff** (Experiment 3's method) — never assumed.

Not size tiers — **two strategies with different properties** (immediacy vs coverage/rollback); any changeset can
ride either; the picker greys a road honestly when a staged param falls outside its coverage.

### The #520 first citizen
The Settings → Machine safe-Z margin field gains **[Apply now]** — the first concrete Strategy-B write: a
confirmed one-line job, gateway-live, history-visible. The pattern generalizes from there.

## The three rig experiments (gate the build — on the user's checklist)

1. **Soft-limit enable ritual** — fill all six values *first* (a zeroed window may refuse all motion — #234 is one
   global switch), then enable, then the jog-wall + G0-past-limit two-minute test.
2. **Restore/reboot behavior** — restore an *unmodified* backup via the controller's own flow; observe: silent
   refresh, reboot prompt, or reboot-required. Decides Strategy A's role.
3. **Macro-writability + mapping discovery** — pull-snapshot → a tiny macro writes 3–4 innocent params (distinct
   values, different classes) → re-pull: **the diff reveals the runtime↔eng mapping for free** → reboot → pull:
   the persistence answer. Decides whether Strategy B is universal (the user's hypothesis) or partial.

## Build order (once the experiments report)

1. Read-only Params sub-tab (tree + search + favorites + drift) + the Settings soft-limits block — valuable
   regardless of any write outcome.
2. The #520 Apply-now (Strategy B's first citizen — already grounded).
3. The staged basket + strategy picker, shaped by Experiments 2–3.
