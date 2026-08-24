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

### The OUTLINE half of the same rule

Human, 2026-08-24, on a gateway screenshot: *"in theme where the tab has an outline it should continue around
the panel too, just make sure the selected tab body is offset to hide the outline exactly below it and connects
with the panel outline."*

⇒ The rule above governs the FILL. This is the same rule governing the EDGE: **the active tab and its panel are
ONE SHAPE, so one outline traces both.** It runs up the tab's left side, across its top, down its right side,
then along the panel's top edge and around the panel — and the segment of panel edge *directly beneath the
active tab* is not drawn, because the tab's own body covers it.

```
        ┌────────┐
   ─────┘        └──────────      the outline is CONTINUOUS,
   │                       │      and BROKEN only under the active tab
   │        panel          │
   └───────────────────────┘
```

The mechanism is an overlap: the active tab sits one border-width lower than the strip and paints an opaque
fill over that border. `.app-header .tab.active` and `.deck-tab.active` already do this with
`margin-bottom: -1px`. `.settings-main-tab.active` does NOT, and `.settings-content` carries no border at all —
so Settings and Gateway have neither half.

⭐ **This needs no exemption for borderless themes.** Organic's `--border` is transparent, so the same
continuous outline is traced and is simply invisible. One declaration, both cases — no per-theme branch, which
is the kind of special case this file exists to avoid.

⚠ **Two things that break it:**
- **A translucent tab fill.** The overlap works by COVERING the panel's border. If the active tab's fill is not
  fully opaque, that border shows through and the joint reads as a seam with a line across it.
- **A hardcoded `-1px`.** The offset must equal the border WIDTH. A theme setting a 2px edge needs a 2px
  offset, so derive it from the same token the border reads rather than restating `1px` — otherwise the two
  drift and the joint gains or loses a hairline in exactly one theme.

---

## THE DECLARATION — a CONTRACT, not a component

Human, 2026-08-24: *"the idea is to declare a 2 level tab vs 1 level"*, then *"are these tabs reusing a declared
tab, should they?"* — the second question is the sharper one, and it has **two different answers that must not
be conflated**:

| | share it? | why |
|---|---|---|
| **The RULES** — tone ladder, outline continuity, overlap offset, inactive registers | **YES** | they are true of every tab regardless of how it is built |
| **The COMPONENT** — markup, layout, behaviour | **NO** | a dock key, a header tab with curved feet and an inline settings pill are different controls; one component serving all three serves none of them well |

⇒ **Share a CONTRACT.** A strip applies the contract classes *alongside* whatever it already calls its parts.
Additive, never a rename:

```html
<div  class="settings-modal"    data-tabs="2">      <!-- depth, declared once -->
  <div    class="settings-head       tab-strip">
    <button class="settings-main-tab tab-l1 active">
  <div    class="settings-sidebar    tab-interstice">
    <button class="settings-tab      tab-l2 active">
  <div    class="settings-content    tab-panel">
```

```css
--tab-strip: …;   /* C — behind the OUTERMOST tabs. MUST differ from the active tab. */
--tab-body:  …;   /* B — every active tab at every level, AND the panel. */

.tab-strip                                   { background: var(--tab-strip); }
.tab-l1.active, .tab-l2.active,
.tab-interstice, .tab-panel                  { background: var(--tab-body); }
.tab-panel                                   { border: var(--tab-edge-w) solid var(--tab-edge); }
.tab-l1.active, .tab-l2.active               { margin-bottom: calc(-1 * var(--tab-edge-w)); }
```

⭐ **ONE CSS block then styles every tab in the app.** `.ie-tabs` becomes themeable by *adding a class*, not by
rewriting the icon editor. A new strip gets the tone rule, the continuous outline and the overlap the moment it
declares itself — nobody has to remember any of it.

⭐ **And the tones still do not read the depth.** `data-tabs` buys only the INACTIVE registers, because at depth
2 the two levels sit on different grounds (L1 inactive on the strip, L2 inactive on the body) and may want
different treatments. That is the honest, narrow thing the depth is for.

### ⚠ Why the earlier "select through whatever it already calls its parts" hedge was wrong

An earlier draft said the attribute could select through each system's existing class names. That leaves FIVE
selector lists to keep in step — the exact divergence this file exists to end, rebuilt inside the fix for it.
**The contract classes ARE the seam.** Without them the declaration reaches nothing.

### ⛔ What this still does NOT do

Not a merge into one component. Not a rename of existing classes — they stay, and keep owning layout, spacing
and behaviour. Not a flattening of per-theme character: `--tab-strip` is brass in steampunk and cyan-black in
futuristic. **The contract is shared; the values are not.**

### Adoption — pilot, then on contact

⛔ Do NOT convert seven systems in one turn. Settings is being fixed anyway and is the only CONFIRMED depth-2
system, so it is the pilot: add the classes, wire the two tones, prove the `elementFromPoint` scan shows exactly
two contiguous tones and the outline runs unbroken except under the active tab.

Everything else adopts **when it is next touched**, and its row below earns a real depth only once someone has
counted it **on screen** rather than inferred it from a grep. The honest cost is one class at roughly six render
sites — small, but each needs its depth established first.

---

## THE REGISTER — to be completed by survey, not by guess

⚠ Depths below are the ADVISOR'S READ from grepping renderers, **not measured**. The worker fills this in from
the running app. Where a row says UNVERIFIED, it has not been counted on screen.

| system | class | rendered by | depth | tones needed | status |
|---|---|---|---|---|---|
| App header | `.app-header .tab` | `index.html` | 1 ? | 2 | UNVERIFIED — same `--tab-*` tokens as Settings; carried the 1.36:1 defect unreported until t2213 |
| Settings | `.settings-main-tab` + `.settings-tab` | `ui/settingsPanel.js` | **2** | 2 | **DONE.** t2249 landed the contract (classes/tokens/overlap); t2251 (amendment 4) flattened `.settings-sidebar` to `--tab-body` — `elementFromPoint` now shows exactly 2 contiguous tones, tab through interstice into content, all 5 themes, no further CSS invention needed beyond the mechanism t2249 already proved. The interstice losing its own tone meant resting L2 sub-tabs lost their distinguishing ground too (they used to read against `--panel`, now they'd be invisible against the flattened `--bg`) — fixed by moving `--subtab-face`'s default off a `transparent` root literal onto a live `var(--panel)` fallback on the consuming rule, so RESTING sub-tabs carry a real chip and hover/active stay flush with the new ground, per THE RULE's own "inactive carries the chip" direction. Verified resting+hover+active together (not 3 crops) for all 5 themes; organic keeps its own `--panel2` chip (unaffected, still an explicit per-theme override), the other 4 now share the same `--panel` fallback |
| Gateway | `.settings-main-tab` + `.settings-tab` | `ui/gatewayPanel.js` | 2 ? | 2 | UNVERIFIED — shares the L1 rule with Settings, so a shared-rule change reaches it |
| Macros | `.settings-tab` only | `ui/macrosApp.js` | **1** | 2 | t2249 — **CONTRADICTION RESOLVED.** Grepped for an actual rendered element (not the word): `macrosApp.js` has NO `class="settings-main-tab"` anywhere — only a stale comment at line 58 ("`.settings-main-tab` styling is shared/global in styles.css") copy-pasted from Settings' own file, describing a class this file never emits. Macros renders `.settings-tab` (L2-styled pills) as its ONLY tier — a depth-1 system borrowing the L2 look, same situation as the Help/setup row below. t2217's original report was correct |
| Keyboard dock | `.deck-tab` | `ui/commandDeck.js` | 1 ? | 2 | UNVERIFIED — MOVE / G-M / MATH / LOGIC / VARIABLES |
| Icon editor | `.ie-tabs` | `ui/iconEditor.js` | 1 ? | 2 | ⚠ **NOT THEMED** — local CSS, `border-bottom: 2px solid #0ea5e9` hardcoded, no theme override anywhere. Not touched t2249 (Settings-only pilot) |
| Blocks topbar | `.blk-topbar` | `blocks/` | ? | ? | UNVERIFIED — may not be a tab system at all |
| Help / setup | `.settings-tab` | `ui/helpPanel.js`, `ui/setupChecklist.js` | ? | ? | UNVERIFIED — reuse the L2 class outside a two-level strip, which may be fine or may be a borrowed look |

---

## HOW TO FILL A ROW IN — the check, so nobody re-derives it

1. Open the surface. Count the strips between the tab bar and the content. That is the depth.
2. From inside the active tab, walk `elementFromPoint` straight down every 10px and record each painted
   colour. A correct system — **any depth** — shows **exactly 2 distinct tones** (strip C, body B), each held
   for a contiguous run, per THE RULE above. (t2249 — this step used to say "N+1 tones", a holdover from the
   retracted three-tone draft THE RULE section already disowns; a repeated or interposed THIRD value at any
   depth is the BELOW defect, not an expected extra tone.)
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
