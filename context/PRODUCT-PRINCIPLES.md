# PRODUCT PRINCIPLES — standing owner rulings on how DDCS Studio behaves

⭐ **Same reason the other `context/` files exist**: written to a LOCAL memory first, invisible across
seats. These are decisions the OWNER made about the product's own behavior and priorities — not
architecture (see `ROADMAP.md`'s own Conventions section), not loop mechanics, not tooling.

Migrated 2026-09-02 (t2519) from 86 local `feedback`-type memories; full triage record in `WORK-LOG.md`'s
own t2519 entry. Several of these are dated policy calls — treat the DATE as part of the fact, and
re-confirm with the owner before leaning hard on one that's gone quiet for a long stretch.

---

## 1. Priority order: user-friendliness and customization first, performance a reasonable second

Stated directly while designing a wizard refactor: the end users are machinists/macro-authors who hand-edit
macros, so readability and customizability beat tight or optimal code. Favor small, readable, editable
generated macros over one monolithic-but-optimal one; prefer declarative, reusable patterns over copy-paste,
but not at the cost of an obscure abstraction; verbose-but-clear G-code is acceptable when it aids the author
or sidesteps an unproven controller feature. A "reasonable" amount of optimization is fine — don't sacrifice
clarity or customization for speed or byte count.

## 2. Nothing in this app is irreplaceable — delete legacy paths by default, don't preserve out of caution

Ruled explicitly, in three corrections in one exchange, after the assistant tried to carve out exceptions:
machine config / WCS table / tool table all re-pull from the controller (the source of truth); programs are
remakeable from wizards; custom wizards themselves are "not important" to the owner and remakeable too. So for
this project the answer is total, not case-by-case: assume recoverable by default, don't run a
can-we-recover-this self-check before every deletion (that habit biases toward keeping). A back-compat shim
for something recoverable buys nothing and costs a permanent maintenance surface plus a second implementation
that agrees today and diverges silently later — this project's own most expensive recurring defect family.
Delete the old path; don't add the better shape beside it. Still apply real judgment about what SURVIVING code
runs through before cutting anything (a screen being dead doesn't mean the stack-builder underneath it is).

## 3. When adding a feature, default to a GUI/visual interaction over a dropdown or text field

Stated directly: "when making a new feature, think if it's possible to make a GUI UX instead of a dropdown or
field." The owner repeatedly converts raw form controls into visual pickers once they exist as an option — a
3D isometric cube picker became a 2D top-view grid because the iso projection was ambiguous to click; angle/
pivot number fields became a live 2D rotation preview. When a feature would default to a dropdown or a number
field, design a GUI alternative first — a click/drag on a 2D canvas, a corner/handle picker, a draggable
marker — and build that; fields and dropdowns are the fallback, not the default.

**Refined, later:** authoring a wizard means assembling a STACK; an author should never have to separately
pick, name, or configure a "preview" as a distinct thing from the stack they're building — the form, the
G-code, and the picture are all renderings of ONE stack. This splits by whether the visual layer is DERIVED
from the program (has real G-code behind it — never separately authorable; change the stack and the picture
follows automatically) or ADDITIVE (a reference marker, a datum dot, an annotation with no G-code behind it —
legitimately authorable, optional, and can never contradict the program because it says nothing the program
does). The test for any future preview feature: can an author build a complete, correct wizard WITHOUT ever
touching a preview thing directly? If no, the design is wrong regardless of how clean the mechanism looks.

## 4. Canvas/preview handles are INDEPENDENT — dragging one must never move another

Established across every wizard with multi-handle interaction (the corner/middle work explicitly froze
un-dragged handles for full independence), and it keeps needing to be re-removed whenever a value gets modeled
as a derived position (B = A + span, so dragging A silently carries B along too). A handle is the user's
direct grip on ONE point; a drag that moves something they didn't grab breaks that contract and silently
changes a position they already placed. Model a relative declared value (a span, an offset) as DERIVED from
the independent pair while dragging (drag A → the span field recomputes; B stays put) and AUTHORITATIVE only
when typed (typing the span moves the dependent point — the one deliberate coupling direction, for precision
entry). Acceptance test for any new multi-handle feature: drag each handle, assert every OTHER handle's screen
position is unchanged.

## 5. Declaring the SEMANTIC is not the same move as removing the user's own judgment or controls

Declare-not-infer exists for clarity (what a value MEANS, and in what frame) and one-source consistency (the
sim and the macro reading the same value) — not for auto-deriving or "guaranteeing away" values that are
legitimately the user's to set and own (a safe-Z clearance, a bar diameter). The owner corrected exactly this
overreach directly: diagnosing a probe-through-stock symptom, the assistant framed safe-Z as something the
system should guarantee so the user "wouldn't have to think about it" — the owner's actual point was that the
symptom was just the safe-Z VALUE being wrong (already fixed by adjusting it), and "some things are really the
user's to be responsible for, and that's fine." Before proposing to "declare X so the user doesn't have to
think about it," split it: is it a SYSTEM gap (the code inferring/guessing something ambiguous — fix by
reading one real source) or a USER value (their own judgment call) — give that a clean, well-named control and
let them own it. Never pitch a change as removing responsibility; the actual win is unambiguous-and-consistent,
not automated-away.

## 6. The owner manages their own machine configuration — Studio does not infer, correct, warn about, or overwrite it

Stated directly after three separate escalations in one evening, each of which turned out to be an ordinary,
deliberate setting misread as a lurking fault (a tool-length offset that looked suspiciously precise; an axis
missing a soft limit that was simply optional; a soft limit that looked oddly tight and was exactly correct
for that axis's travel direction). Every measurement in each case was accurate; every framing was wrong. A
machine setting that looks odd is a QUESTION, not a finding — ask what it's for before deciding it's wrong,
and prefer not raising it at all unless something in the app's OWN code visibly misbehaves because of it. The
underlying model: a SOFT LIMIT is a policy (what the controller will refuse); an ENVELOPE is a fact (how far
the machine actually goes) — they coincide only when limits happen to be set generously, and deriving the fact
from the policy is a category error. When a derivation like this turns out wrong, delete it rather than making
it smarter.

## 7. Never surface a hack or shortcut as if it were a legitimate option

The owner trusts that every option an assistant presents is sound, so a bad option doesn't read as "obviously
skip this" — it reads as "there must be a reason this is here," and they burn real effort hunting for merit
that was never there. Stated directly after repeated A/B choices where one side (sometimes both) was a
"make it look right for now" patch: eliminate the bad options yourself before ever presenting a choice; if
there's a correct answer, give it decisively rather than dressing it as a fake fork; only bring an actual
choice to the owner when BOTH sides are genuinely legitimate tradeoffs worth weighing. Build correct from the
start — no interim hand-rolled patch "to make it look right for now," since that pattern usually means
patching something the eventual real fix will just erase.

## 8. Wizard fields a post can't use are GREYED, never hidden — and the reason is a tooltip only

Decided explicitly: when the active post lacks a capability, the fields tied to it get disabled and greyed
(opacity change, `.cap-off`) rather than removed from the layout, because hiding shifts and breaks the form's
shape while greying keeps it stable. The explanation for WHY a field is greyed lives in the field's own
tooltip only — no inline badge or explanatory text. Implemented in `web/ui/postGating.js` as a declared
`capability → [field ids]` map, applied at init and on a settings-changed event; every wizard panel already
lives in the DOM, so no per-wizard wiring is needed when a new capability gate is added.

## 9. Two-sided machining is explicitly out of scope — the owner does that work in Fusion

Stated directly, twice: two-sided parts are made in a CAM tool, not hand-programmed in Studio. The existing
`Setup`/`flip` block pair (a real, tested feature — a setup boundary plus a sibling flip marker that mirrors
that setup's own emitted line range) was ruled HIDE from the palette, not removed — it round-trips cleanly,
costs nothing while hidden (emit is byte-identical with no setup/flip declared), and "for now" is doing real
work: hiding is reversible, deleting the emit path and setup-sheet integration is not. The owner's own read
on the broader userbase (explicitly marked as their own guess, not established fact) is that a part complex
enough to need two sides is usually already being built in CAM anyway — Studio's value is the conversational/
wizard path for work that would otherwise be hand-written, which two-sided setup generally isn't. Don't
propose two-sided features, workflows, or wizard-authoring work; don't invest turns beyond keeping the hidden
path from rotting. Revisit only if the owner raises it again.

## 10. The one-box deployment (Studio + gateway on the same PC) is permanent; LAN serving is provisional

Ruled directly when offered a three-way split: ONE-BOX (Studio and the gateway on the same machine, pure
localhost, no network/account/addressing at all) is permanent and must never be removed or gated behind a
login — someone standing at the machine must always be able to run Studio and send a file with zero
prerequisites. LAN SERVING (a second device on the same network reaching the gateway by IP/hostname) is
provisionally condemned, to be deleted once CLOUD (the "anywhere" path, via the owner's own Drive account) is
proven end to end — a real job going out through Drive and landing on a real controller, not just an OAuth
visibility check. Don't delete LAN before that gate is met. The reasoning behind one-box surviving: it's the
SIMPLEST deployment, not the messy one — nothing to explain, nothing to configure. A related standing
constraint from the same conversation: whatever the shop's own network topology needs must remain an OPTION,
never the one blessed path — a single-PC owner with the machine right there must never be shown an address
box to reach it.

## 11. Sound is justified only when the state it reports is not already visible on screen

Ruled directly: remove UI chirps (click, toggle, wizard-opened/closed) that duplicate something the screen
already shows plainly — a click sound conveys nothing a visible state change didn't already convey. Keep or
add a sound only for something genuinely ambiguous or easy to miss (block-snapping was named as borderline-
keep). The test sharpened further, later, into a single declarable property: **was the surface USER-initiated?**
If the user clicked it, they're already looking at it — silent. If it opened by itself (a health-check result,
a "what's new" panel, an unsolicited modal, a gateway losing its connection mid-session) their attention was
somewhere else — it needs a sound. This subsumes the visible/invisible framing rather than replacing it: a
self-opening surface is effectively invisible, because being on screen only helps someone already looking.
Declare "unsolicited" as a property at the seam where a surface opens, rather than hand-maintaining a list of
which modals chirp — a hand-rolled list is wrong the moment someone adds a new modal. Watch for two unsolicited
things firing at once (they must not stack into a chord).

## 12. Custom-op (`user_*`) preview/sim intent is fully DECLARED, never inferred from the stack's own motion — no exceptions

For a user-authored op's preview/sim behavior (`web/viz/opSimContext.js`), nothing gets guessed from what
motion the stack happens to contain — the intent comes only from an explicit `def.sim` declaration, carried
the same way a panel-layout choice is declared. The rule holds with no carve-outs, not even for something as
suggestive as an A-axis move implying a rotary setup: a built-in's own A-move is safe to read as "rotary"
only because this project authored it and knows its real intent — an open-world custom op, authored by an
unknown user on an unknown machine, could have A wired to anything. Reserve motion-reading for things this
project itself authored (built-ins); for any user-op preview/sim/behavior signal, declare it explicitly rather
than reading it off the emitted G-code.

## 13. A declaring GUI (drag → sets a value) must write to an already-DECLARED seam, never an inferred one

A feature-canvas-style drag handle is a declaring tool by nature. If it's meant to drive a value that the sim
side currently only INFERS on a separate code path (rather than reading from one shared declared source), the
two mechanisms will fight — the handle says a marker is HERE, the sim independently computes it THERE — and a
draggable handle makes the wrong value look more authoritative than a plain inferred one ever did, because it
LOOKS like ground truth. Before building GUI handles that drive a sim-only value, make sure the sim already
reads that value from the declared registry, not from a separate inference — build the declared seam first,
then the GUI that writes to it. Exception: a handle whose value flows into the actual G-code (through the form
→ the macro → the sim running that macro) is coherent by construction and doesn't need this ordering; the
hazard is specific to values that exist ONLY in the preview/sim layer.

## 14. When a live, powered controller is reachable but the owner is not physically at it, stay read-only

If a real DDCS controller is reachable over the network but the owner says they're away from the machine,
restrict to read-only operations (fingerprint, list files, read settings/variables) — never anything that can
move an axis or run a program (jog, probe, home, run, spindle, drawbar, executing a `.nc` file), regardless of
how safe it seems. Unattended motion on a real CNC can crash the machine or injure, with nobody there to hit
E-stop. Wait for the owner to explicitly confirm they're at the machine before sending anything that commands
it; a hosted/cloud instance of Studio never commands a controller directly either way — control stays 100%
local to whoever's hands are on it.

## 15. Split a module out proactively once a file or concern has genuinely grown enough to benefit

Stated directly: "don't hesitate to modularize any module when it becomes apparent it would benefit." When a
file accrues multiple distinct concerns or simply grows large, extract cohesive pieces into their own modules
rather than piling further onto it — as part of the same work, without asking permission for an obviously
beneficial extraction, matching the existing style and import conventions around it.

## 16. Ship no unrequested affordances, and prove every feature's wiring end to end

Two-sided feedback from the same review: unrequested additions (a popup nobody asked for, an oversized UI
element, a silent auto-download, buttons the owner later had to notice and ask to be removed) got built while
genuinely-needed connections went unverified — a saved profile that didn't apply on load, a legend row nobody
wired up, a whole class of checklist items nobody could dismiss. Both are the same root cause: effort spent on
unasked extras is effort not spent verifying the actual feature's own consumer chain. New buttons, popups,
auto-behaviors, or generated files ship only if explicitly requested or approved — when a task seems to need
one, the pass-back SURFACES it as a question with the need stated, never ships it "flagged" as a done deal.
Every dispatched feature names its own consumer chain (the declared value → who reads it → what actually shows
on screen), and the pass-back demonstrates that chain live, at the END of the chain, not the middle.
