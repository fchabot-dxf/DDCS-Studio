# THE TAB SYSTEMS — declared by NESTING DEPTH

**Why this file exists.** Human, 2026-08-24: *"lets classify the tabs ui system by how much nesting they have
so we keep track and can declare them."* Every tab defect this project has met was fixed one strip at a time —
the settings tab at 1.04:1, the app-header tabs carrying the same defect unreported, four themes with no band
behind their tabs. Fixing them individually is why they keep coming back. **A tab system's depth determines
its whole tone ladder, so declaring the depth declares the fix.**

---

## THE RULE — one sentence, and it does not grow with depth

> **Every ACTIVE tab, at every level, IS the content surface. Only INACTIVE tabs and the outer strip differ.**

Human, 2026-08-24, after challenging an earlier three-tone draft of this file: *"would they be different in
the way we said or would adding subtabs wouldnt need colors changed?"* — then, on being shown both: *"ok 2
tones."*

⭐ **TWO TONES, WHATEVER THE DEPTH.** A tab is a *hole punched in its strip* showing the page behind it. The
selected thing is flush and unstyled; the UNSELECTED ones are what carry a chip. Adding a sub-level therefore
costs nothing — no new tone, no new token, no new rule.

```
DEPTH 1                              DEPTH 2
  ░░░░┌──────┐░░░░░░░  C strip         ░░░░┌──────┐░░░░░░░  C strip
  ┌───┘      └──────┐                  ┌───┘      └──────┐
  │    content      │  B               │  (sub)(sub)     │  B   ← everything below
  └─────────────────┘                  │    content      │  B     the strip is ONE
                                       └─────────────────┘        continuous surface
   2 tones                              2 tones — unchanged
```

⛔ **AN EARLIER DRAFT OF THIS FILE CLAIMED DEPTH N NEEDS N+1 TONES. THAT WAS WRONG** — a middle tone for the
L1 tab and the interstice band is a *stylistic choice* (the sub-tab row reading as its own plane, like a
toolbar under a tab bar), not a structural requirement. It was presented as a necessity and it is not one.
The human caught it. Do not reintroduce it.

**The two ways it breaks, and they are independent:**

- **BEHIND** — the strip is too close to the active tab, so nothing distinguishes the selection.
  Measured 2026-08-24: steampunk 1.22:1, studio 1.12:1, organic 1.36:1, futuristic 1.09:1, normal 1.10:1.
  Only organic has a real band, and only because t2213 gave it one.
- **BELOW** — a surface of a *different* tone sits between the active tab and what it opens, so the tab never
  touches the thing it is supposed to be continuous with. Found by walking `elementFromPoint` down the screen
  from inside the tab; a comparison of tab-vs-content alone reports "merged" and misses it entirely.

⛔ **Both must be checked. Neither implies the other.** Organic passed the first and failed the second.

---

## THE DECLARATION — `data-tabs="1"` / `data-tabs="2"`

Human, 2026-08-24: *"the idea is to declare a 2 level tab vs 1 level."* Not a prose register — **a property
the markup carries, that the stylesheet reads.**

```html
<div class="settings-modal" data-tabs="2">   <!-- L1 + L2 -->
<div class="gateway-app"    data-tabs="1">   <!-- one strip -->
```

```css
--tab-strip: …;   /* C — behind the OUTERMOST tabs. MUST differ from the active tab. */
--tab-body:  …;   /* B — every active tab at every level, AND the content. */

.tab-strip                        { background: var(--tab-strip); }
.tab-l1.active, .tab-l2.active,
.tab-interstice                   { background: var(--tab-body); }   /* one surface, all depths */
```

⭐ **THE TONES DO NOT READ THE DEPTH AT ALL.** That is the test that the rule is right: if the colour ladder
needed the depth, the depth would be load-bearing styling data and every new level would be a new special case.
It does not, so it is not.

⭐ **What the declaration actually buys is the INACTIVE registers**, which is smaller than the first draft
claimed and is the honest answer:

```
depth 1    inactive L1 tabs sit on C
depth 2    inactive L1 tabs sit on C   ← two different grounds,
           inactive L2 tabs sit on B   ← so possibly two different treatments
```

A system needs to know that about itself. It does not need to know it to pick a fill for its active tab.

### ⚠ The consequence that WILL ship this broken

Taking the interstice to `--tab-body` puts the L2 sub-tabs on the same ground as the active one. In organic
today the inactive sub-tabs carry `--panel2` (t2214, a *raised* fill) while the active one is `--bg`, so the
active reads only because it is darkest. Flatten the ground and **the row inverts: unselected looks selected
and selected disappears.**

⇒ **The rule already answers it: active is flush, INACTIVE carries the chip.** So the inactive sub-tabs are
what needs a register — and a *raised* fill on an unselected control was always saying the wrong thing.
⚠ t2214's `--panel2` rule was correct when the ground was `--panel`. It is not a regression in that work; it is
the same declaration meeting a changed ground. Change it deliberately and say so.

### ⛔ What this does NOT do

Not a merge of the systems into one component, not a restyle by itself, not a flattening of per-theme
character — `--tab-strip` is brass in steampunk and cyan-black in futuristic. **The declaration is shared, the
values are not.** And it does not license renaming every class at once; the attribute can select through
whatever a system already calls its parts.

### Adoption — pilot first, per this project's own habit

⛔ Do NOT convert seven systems in one turn. Settings is being fixed anyway and is the only CONFIRMED depth-2
system, so it is the pilot. Everything else adopts when next touched, and its row below earns a depth only once
someone has counted it **on screen** rather than inferred it from a grep.

---

## THE REGISTER — to be completed by survey, not by guess

⚠ Depths below are the ADVISOR'S READ from grepping renderers, **not measured**. The worker fills this in from
the running app. Where a row says UNVERIFIED, it has not been counted on screen.

| system | class | rendered by | depth | tones needed | status |
|---|---|---|---|---|---|
| App header | `.app-header .tab` | `index.html` | 1 ? | 2 | UNVERIFIED — same `--tab-*` tokens as Settings; carried the 1.36:1 defect unreported until t2213 |
| Settings | `.settings-main-tab` + `.settings-tab` | `ui/settingsPanel.js` | **2** | 3 | CONFIRMED depth 2. L2+content already merge; L1 sits on tone B when it should be A |
| Gateway | `.settings-main-tab` + `.settings-tab` | `ui/gatewayPanel.js` | 2 ? | 3 | UNVERIFIED — shares the L1 rule with Settings, so a shared-rule change reaches it |
| Macros | `.settings-main-tab` + `.settings-tab` | `ui/macrosApp.js` | ? | ? | ⚠ **CONTRADICTION TO RESOLVE** — t2217 reported only Settings and Gateway render `.settings-main-tab`; a grep finds `macrosApp.js` too. One of those is wrong |
| Keyboard dock | `.deck-tab` | `ui/commandDeck.js` | 1 ? | 2 | UNVERIFIED — MOVE / G-M / MATH / LOGIC / VARIABLES |
| Icon editor | `.ie-tabs` | `ui/iconEditor.js` | 1 ? | 2 | ⚠ **NOT THEMED** — local CSS, `border-bottom: 2px solid #0ea5e9` hardcoded, no theme override anywhere |
| Blocks topbar | `.blk-topbar` | `blocks/` | ? | ? | UNVERIFIED — may not be a tab system at all |
| Help / setup | `.settings-tab` | `ui/helpPanel.js`, `ui/setupChecklist.js` | ? | ? | UNVERIFIED — reuse the L2 class outside a two-level strip, which may be fine or may be a borrowed look |

---

## HOW TO FILL A ROW IN — the check, so nobody re-derives it

1. Open the surface. Count the strips between the tab bar and the content. That is the depth.
2. From inside the active tab, walk `elementFromPoint` straight down every 10px and record each painted
   colour. A correct depth-N system shows **exactly N+1 distinct tones**, each held for a contiguous run.
   A repeated or interposed extra value is the BELOW defect.
3. Measure the strip against the active tab. Under ~1.5:1 it is the BEHIND defect regardless of how it looks
   in a crop.
4. ⚠ **Then look at a screenshot of the seam.** Both defects found so far survived a numeric check that said
   everything was fine — the 1.04:1 tab was found by eye, and the interposed band was found by eye after a
   measurement reported "merges ✓".

---

## WHAT THIS FILE IS NOT

⛔ Not a plan to unify every tab system into one component. They have different jobs — a keyboard's tab strip
and a settings modal's are not the same control and should not be forced into one. **This declares the tone
RULE they all obey, and the depth each one has.** How they are built stays their own business.

⛔ Not a licence to add tone C to a depth-1 system that does not need it.
