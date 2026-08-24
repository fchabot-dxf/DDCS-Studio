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
