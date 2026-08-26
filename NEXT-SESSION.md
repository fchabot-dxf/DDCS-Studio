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

## WHERE THINGS STAND — 2026-08-26

**Branch `wizards-as-data-blocks`. Released V2026.08.26.1.**

The live arc is **wizards-as-data**: every built-in becomes a `{template, bindings}` definition, so a wizard
can be reproduced from declared data alone. `drill` is the pilot.

```
DONE   usage_text + path_anchor declared · guard/whenOk already covered structural forks
       drill's holeDia + clearance bound (clearance's fan-out via postInstantiate)
IN     t2297 — method as a STRUCTURAL binding (a translation of corner's shipped pattern, not new design)
NEXT   ⭐ reproduce drill's form ENTIRELY from declared uiChildren + the reproduction test
       — the arc's first end-to-end proof, and what the owner actually asked for
```

- **Corner is the gated pilot** — no wizard ports until corner is right.

⚠ **The two known leftovers after `method`:** the `d_tool` library picker (a fire-once convenience, not a
stored field — may be out of scope entirely) and a cosmetic section-chrome difference (bare `<span>` headers
vs the collapsible `.form-sec` the `section` node always renders).

---

## OPEN — blocked on the owner, nothing else

1. **The 3 NEVER-STARTED docs** — delete or keep: the `wizard manager and entry points` plan,
   `SLAVE-CHANNEL-TESTS.md`, `parse-out-ghidra-guide.md`. *(Abandoned and not-started-yet look identical from
   inside the repo.)*
2. **The WCS-zero tool-offset term** (`BACKLOG.md`) — ⛔ **not a go/no-go yet.** Its next action is a
   READ-ONLY reproduce-or-refute, because a 68 mm Z error cannot hide and nobody has seen one.
3. **Roles: the override's SHAPE.** Roles are automatic and derived from configuration; changing one must
   never destroy config. The override stays — its UI is undecided. (`ROLES-PLAN.md`)
4. **The offline shop.** LAN serving is the only phone→machine path with no internet. Cloud cannot cover it;
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
