# THE TAB SYSTEMS — declared by NESTING DEPTH

**Why this file exists.** Human, 2026-08-24: *"lets classify the tabs ui system by how much nesting they have
so we keep track and can declare them."* Every tab defect this project has met was fixed one strip at a time —
the settings tab at 1.04:1, the app-header tabs carrying the same defect unreported, four themes with no band
behind their tabs. Fixing them individually is why they keep coming back. **A tab system's depth determines
its whole tone ladder, so declaring the depth declares the fix.**

---

## THE RULE — one sentence, applied N times

> **Every active tab merges into the surface DIRECTLY BELOW IT, and the strip it sits on must differ from it.**

That is not a rule plus special cases. It is the same rule applied once per level. A tab is a *hole punched in
its strip* showing the surface behind — that is what makes it read as a tab instead of a highlighted button.

**Depth determines the tone count: a depth-N system needs N+1 tones.**

```
DEPTH 1                          DEPTH 2
  ░░░░┌──────┐░░░░░  C             ░░░░┌──────┐░░░░░  C   strip
  ┌───┘      └────┐                ┌───┘      └────┐
  │   content     │  B             │ ▒┌────┐▒▒▒▒▒▒ │  A   L1 tab + interstice band
  └───────────────┘                ├──┘ L2 └──────┤
                                   │   content     │  B   L2 tab + content
   2 tones                         └───────────────┘
                                    3 tones
```

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

Human, 2026-08-24, on what this file is actually for: *"the idea is to declare a 2 level tab vs 1 level."*
Not a prose register — **a property the markup carries, that the stylesheet reads.**

A tab system declares its depth ONCE, on the container that owns the strip:

```html
<div class="settings-modal" data-tabs="2">   <!-- Settings: L1 + L2 -->
<div class="gateway-app"    data-tabs="1">   <!-- Gateway: one strip -->
<div id="controller-dock"   data-tabs="1">   <!-- the keyboard deck -->
```

and the tone ladder follows from that number alone:

```css
/* the three tones, per theme — declared beside the other --tab-* tokens */
--tab-strip: …;   /* C — behind the tabs. MUST differ from the active tab. */
--tab-mid:   …;   /* A — the L1 tab AND the interstice band. Depth 2 only. */
--tab-body:  …;   /* B — the deepest active tab AND the content it opens. */

[data-tabs] .tab-strip            { background: var(--tab-strip); }

[data-tabs="1"] .tab-l1.active    { background: var(--tab-body); }   /* merges into content */

[data-tabs="2"] .tab-l1.active,
[data-tabs="2"] .tab-interstice   { background: var(--tab-mid); }    /* L1 merges into the band */
[data-tabs="2"] .tab-l2.active    { background: var(--tab-body); }   /* L2 merges into content */
```

⭐ **At depth 1, `--tab-mid` is simply unused.** One declaration covers both shapes — there is no depth-1
branch and no depth-2 branch to keep in step, which is the entire point. A third level, if one ever appears,
adds a tone and a line rather than a new special case.

⭐ **And a new tab system gets the whole ladder by declaring one attribute.** Nobody has to remember the rule,
which is the failure mode this file exists to end: the rule WAS known, written in a comment on the shared strip
rule, and four themes still shipped without a band.

### ⚠ What this does NOT do

⛔ It does not merge the systems into one component, restyle anything by itself, or replace per-theme
character. `--tab-strip` in steampunk is brass and in futuristic is cyan-black; the DECLARATION is shared, the
VALUES are not.

⛔ It does not license renaming every existing class at once. See the adoption note below.

### Adoption — pilot first, per this project's own habit

⛔ Do NOT convert seven systems in one turn. Settings is being fixed anyway and is the only CONFIRMED depth-2
system, so it is the pilot: declare `data-tabs="2"`, wire the three tones, prove the `elementFromPoint` scan
shows exactly three contiguous tones. **Everything else adopts when it is next touched**, and its row here
moves from UNVERIFIED to a depth only once it has been counted on screen.

⚠ The existing class names (`.settings-main-tab`, `.settings-tab`, `.deck-tab`) do not have to become
`.tab-l1`/`.tab-l2` on day one — the attribute can select through whatever a system already calls its parts.
Renaming is a separate, optional tidy; the DECLARATION is the part that carries the value.

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
