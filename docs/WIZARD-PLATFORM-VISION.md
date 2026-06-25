# Wizard Platform — Vision / North Star

> The destination the roadmap ladders up to. Use it to judge a feature: **does this move toward
> wizards-as-data and total user control, without breaching the safety floor?** This is the *why*, not a
> task list. (Tasks: [`NEXT-TASKS.md`](../NEXT-TASKS.md). Binding-rebuild handoff: [`NEXT-SESSION.md`](../NEXT-SESSION.md).)

## North star: total wizard control by the user
Every wizard becomes **data, interpreted** — not hand-coded JS. The moment a user can edit *any* wizard, the
built-ins lose their privilege: the ops we ship become the **default library** — definitions a user can open,
fork, override, or delete, exactly like their own. The app **self-hosts in its own wizard format**; nothing is
privileged code. "Reset to factory" = reload the shipped definitions.

## Why — the value is one floor up from the primitives
A *single* op is a small, solved space — there's one good way to probe an edge, and no user out-designs the
built-in by dragging atoms. So the value is **not** in re-authoring primitives. It's in:
- **Composition** — stringing ops into jobs with a shop's own logic (≈6 probes, a *million* jobs).
- **Specialization** — collapsing a general built-in into one shop's one-click recurring case (novel
  *ergonomics*, not physics).
- **The long tail** — the weird machine / material / controller you can't *ship* a wizard for.
- **Distribution** — one expert authors, thousands run; the long tail becomes a community library.

**Implication — build the maker top-down.** Compose-existing-ops + fork-the-5%-delta + name/save/share is the
useful 90%. Atom-level "build a probe from scratch" is the *floor that makes it possible*, not the headline.

## What it unlocks
- **The wizard bar becomes an editable space** — a rendered view of the user's library (CRUD, reorder, pin,
  group). `+` opens the maker; right-click → Edit opens any wizard (built-in or yours). The last fixed authoring
  surface goes data-driven, like the editor / blocks / form / op before it.
- **Attachment automation** — via the I/O atoms (`setOutput`/`waitInput`/`dwell`/`jump`). Almost every bolt-on
  collapses to five patterns: *actuate+confirm*, *on/off around a job*, *index/step*, *fire-on-path*,
  *measure+react*. The on/off ones are **wrappers** — same C-block shape as `PlaceOnStock`: "run this op *with*
  the dust shoe / coolant / vise."
- **Whole modalities.** The geometry engine was never milling-specific; contours/paths are just **motion**, and
  milling was the first *head*. **Laser/plasma = the same paths with a fired head** + process atoms (beam/arc on,
  pierce, power) + a param table. A community plasma suite makes the DDCS viable in a market the vendor never
  built for.
- **The unknown, by construction.** A feature list supports only the *known*; a primitive system **spans the
  interface** every attachment speaks (I/O + motion + timing + logic), so it reaches hardware that doesn't exist
  yet. It works by **relocating authorship to where the knowledge lives** — the user who wired it, not the dev
  who can't anticipate it. The Arduino move, made safe / visual / round-trippable.

## The staged path (incremental, each gated by output-equivalence)
One data format; a *template* is its trivial case, a full *wizard* its rich case. Grow the interpreter from one
to the other — each stage ships value:
1. **Templates** — frozen stack + scalar blanks (rides on the serialization that already exists). *Stage 1 of
   the engine, not a side feature.*
2. **Expressions** in the blanks (`depth*2`) — a small evaluator.
3. **One loop** (the pattern primitive) — the first structural re-derivation.
4. **Express ONE built-in as a definition** and assert the interpreter's output is *identical* to the hand-coded
   builder. ← proof the format is expressive enough.
5. **Port the rest**, one at a time, each gated by "interpreter output == old output" (the binding-rebuild
   discipline).
6. **Expose the maker UI** — now just an editor for the format the engine already runs.

**Discipline:** don't design the builder mini-language up front — *grow it from porting real builders*. Stage
4/5 tells you exactly which constructs you need (and which you don't). Mini-languages love to balloon into
"we accidentally reinvented JavaScript"; porting real wizards is the brake.

## The honest boundaries (the part that prevents over-promising)
- **Complete over the *interface*, not over physics.** Reaches any unknown thing that fits the controller's
  *actual* envelope — its digital/analog lines, timing, what its macros can switch. A fieldbus / hard-real-time
  servo / unsupported serial protocol / more I/O than it has → outside the envelope. The boundary is the
  hardware's reach, not imagination.
- **Open-world safety is a floor, not a ceiling.** The validator guarantees the **protocol** (won't break the
  controller, no illegal motion). It **cannot** know the *meaning* of a thing it's never seen ("output 7 is the
  vise; firing it mid-cut ruins the part"). That semantics belongs to the author. Genuine open-world power hands
  *some* safety back; the rails (declared I/O map, sim, dry-run) shrink the gap — they don't close it. Name the
  trade; don't pretend the system vetted something it's never met.
- **Real-time loops stay below the floor.** Plasma THC (arc-voltage height control) is hard-real-time —
  firmware / THC-module territory, not a macro. The user authors *around* it (pierce, lead-in, power,
  sequencing) and **delegates** the loop to the controller, like ATC delegates homing to native `M98`.
- **The physical safety envelope stays hardware.** Interlocks, enclosure, fume/extraction, the arc/beam itself —
  never software promises. The wizard owns the *program*, not the hazard. That boundary is a feature.
- **Scope today:** richest on the **Expert** dialect (where the I/O macro vocabulary lives); generalizing means
  teaching the dictionary each controller's I/O verbs, bounded by what it can physically switch. Digital on/off
  is easy everywhere; analog is where machines diverge.

## Foundation already laid
The dictionary (declared vocabulary), the validator (the guard that makes total control *offerable*), the
binding-unify (form generated from the dict — shipped), atoms-as-data + the `@DDCS` marker format
(serialize / round-trip) — none of this is incidental. It's the substrate the end-game stands on. The added
complexity is *foundation*, **because** this is the goal. If the goal were only "ship 21 fixed wizards," much of
it would be over-built; it isn't, because the goal is total control.
