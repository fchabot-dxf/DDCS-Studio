# addstudioverify.md — live DDCS M350 verification in the editor

Verify G-code **as you type**: bad lines are marked inline in the editor, listed in a **VERIFY** panel,
and counted in the status bar — using the robust, grammar-grounded ruleset from the bridge's
`ddcs_lint.py` (ported to JS). The TRANSFER pre-flight (see [`addstudiotransfer.md`](addstudiotransfer.md))
reuses the same result and refuses to send a file with errors.

> Status: spec / not yet built. Goal: catch parse-breakers and controller-wedge hazards at authoring time,
> on the machine that writes the code — *before* anything reaches the controller.

---

## 1. Why client-side (not on the gateway)
The gateway can't tell you while you author:
- **Cloud path is async** — Studio POSTs to R2; the gateway polls it *later*. The "bad G-code" verdict
  would arrive minutes after TRANSFER already returned, far from the editor.
- **The cloud Worker is JS, not Python** — it can't run `ddcs_lint.py` even in principle.

The only place that can say "**L12: nested paren breaks the parser**" *while the cursor is on L12* is Studio
itself. So the linter runs **in the browser, on every edit**. (The gateway may still lint on receipt as a
dumb backstop for non-Studio producers, but that's defense-in-depth, not authoring feedback.)

---

## 2. One ruleset, two languages — keep them in lockstep
The authoritative rules live in the bridge as `controllers/expert-m350/tools/ddcs_lint.py` — grounded in the
Expert's real yacc vocabulary (`parse.out`), the ddcs-expert CORE_TRUTH quirks, and hazards **confirmed live
on the machine** (e.g. reading `#1630` wedges the controller → reboot). Studio needs the same checks in JS.

Because the two repos can't share code, the contract that prevents drift is a **shared golden corpus**:
`ddcs_lint.py --self-test` already has 13 `input → expected-codes` cases. Mirror that exact corpus in a
Studio JS test (§9). When a rule changes in either repo, both the port and the corpus get updated. This is
the same parity discipline the bridge already uses for its JS↔Python instrumenter.

> Studio's pre-existing `verification/` (two rules: `X+#1` positive-sign, missing-version-header) is
> **superseded** by this port — see §8 for what to do with it. Its one unique idea (`X+#1`) is carried
> forward as a *candidate* rule, disabled until confirmed against `parse.out` (§4).

---

## 3. The lint API
A pure, synchronous function — no DOM, no I/O, easy to test and to call from the transfer pre-flight:
```js
// src/gcodeLint.js
export function lintGcode(text) -> Finding[]
// Finding = { line: number, col?: number, severity: 'error'|'warn', code: string,
//             msg: string, suggestion?: string }
```
`line` is 1-based. `code` is the stable rule id (`E-BRACKET`, `W-PRIME`, …) — used for the corpus and for
CSS/icons. Order: by line, then errors before warnings.

---

## 4. Ported ruleset (from `ddcs_lint.py`)
Two stages, exactly as the Python does it.

**(a) `scanComments(line)`** — a state machine, *not* a regex (DDCS comments don't nest and don't span
lines). Tracks `( … )` depth and a `;`-to-end-of-line comment; returns `{ code, errors }` where `code` has
comment spans blanked so later checks ignore comment text. Emits:

| code | sev | when |
|---|---|---|
| `E-NESTPAREN` | error | a second `(` opens while already inside a comment — breaks the parser (flags the *next* line as "syntax error") |
| `E-STRAYPAREN` | error | `)` with no open `(` |
| `E-OPENCOMMENT` | error | `(` never closed on the line |

**(b) Line rules (run on the comment-blanked `code`)**:

| code | sev | catches | fix |
|---|---|---|---|
| `E-BRACKET` | error | unbalanced `[ ]` | match brackets |
| `E-GOTOSPACE` | error | `GOTO 1` (space) | `GOTO1` / `GOTO[expr]` |
| `E-MARGS` | error | `MSETDATA`/`MGETDATA` not exactly 6 args | `[X1..X6]` |
| `E-CH1630` | error | reads `#1630–#1636` (analyze-channel status) | **wedges the controller → reboot**; never read these from a running job |
| `W-FANUCOP` | warn | `EQ/NE/LT/GT/LE/GE` inside an `IF` | C-style `== != < > <= >=` |
| `W-G10` | warn | `G10` | broken on DDCS; write `#805+` offsets directly |
| `W-G53CONST` | warn | `G53 X0` (bare constant) | operand must include a `#var` (`G53 X#x`) |
| `W-2070RANGE` | warn | `#2070 → ` persistent dest (1153–1193 / 2039–2071 / 2500–2599) | input to `#50–#499`, then copy |
| `W-PRIME` | warn | persistent target `= #880–#999` with no arithmetic, target not primed | prime with a constant first, or wash RHS `+ 0` |
| `W-CH1620` | warn | writes `#1620–#1626` (channel exec; 1=pause) | confirm intentional |
| `W-POSSIGN` *(candidate)* | warn | `X+#1` (positive sign before a var) | **[VERIFY against `parse.out` before enabling]** — Studio's old rule; keep off until confirmed |

Plus the **primed pre-pass**: before linting, scan once for `#n = <constant>` lines and collect those targets
into a `primed` set; `W-PRIME` is suppressed for primed targets (matches the Python).

**JS porting notes:**
- The Python lookbehinds (`(?<![A-Za-z0-9_])…`) port directly — V8 (Chrome/Edge and the Windows
  pywebview WebView2 runtime, all Chromium) supports lookbehind. (Only ancient Safari lacks it; not a target.)
- Replace `str.splitlines()` with `split(/\r?\n/)`; iterate lines with 1-based index.
- Keep the regexes byte-identical in intent; the corpus (§9) is what proves they match.

---

## 5. Editor integration — inline markers
Studio's editor is a `<textarea id="editor">` overlaid by a syntax-highlight `<pre id="editor-highlight">`,
kept in sync on `input` ([editorManager.js](src/editorManager.js) `setupSync`). **Don't** mark by rewriting
the highlight HTML — per-line wrapping risks breaking character alignment with the textarea. Instead add a
third **underlay layer** behind the highlight that draws tinted rows at computed line offsets:

- New element in `.editor-container`: `<div id="editor-lint-underlay" class="editor-layer">`, behind the
  highlight (`z-index` below text, above background; `pointer-events` enabled only on its row children).
- After each lint, render one absolutely-positioned row per finding line:
  `top = paddingTop + lineHeight * (line - 1)`, `height = lineHeight`, full width.
  `lineHeight`/`paddingTop` come from `getComputedStyle(editor)` (the same computation `insert()` already
  does for mobile centering).
- Class by worst severity on that line: `.lint-row--error` (red tint + left border) / `.lint-row--warn`
  (amber). CSS only; no layout shift on the text.
- **Scroll sync:** extend the existing `syncScroll` so the underlay's `scrollTop/Left` track the textarea
  (today it only syncs the highlight).
- **Hover → message:** each row carries its finding; on `mouseenter` show `code: msg (suggestion)` via the
  existing `UIUtils.showTooltip(row, text)`, `mouseleave` → `hideTooltip()`.

This decouples marking from syntax highlighting — the trickiest correctness risk (overlay alignment) is
handled once, by the shared `lineHeight` math.

---

## 6. VERIFY panel
A live list of all findings, dismissible, auto-shown when `findings.length > 0`.

- New module `src/verifyPanel.js` (small, self-registering like `settingsPanel.js`).
- Placement: a collapsible strip anchored **above the status bar** (`.statusbar`), inside `main`. Header:
  `VERIFY · N errors · M warnings` with a collapse caret; hidden entirely when clean.
- Each row: severity icon (`⛔`/`⚠`) · `L<line>` · `msg` · dim `code`.
- **Click a row → jump to the line:** `editor.scrollTop = lineHeight * (line - 1)` and select that whole
  line (`setSelectionRange(start, end)`) so it's visibly marked. Do **not** call `editor.focus()` — Studio
  deliberately avoids it to keep the mobile virtual keyboard suppressed (see `insert()`/`backspace()`).
- Re-renders from the same `findings` array on every lint.

---

## 7. Status bar
`#status` shows a live one-liner derived from the same findings:
- clean → `✓ DDCS M350 OK`
- issues → `⛔ 3 errors · ⚠ 1 warning` (clicking it expands the VERIFY panel).

This is the at-a-glance signal; the panel is the detail; the inline rows are the location.

---

## 8. Wiring & lifecycle (file-by-file)
All under `src/` so the bundler inlines them (it builds from `src/` and **excludes** sibling folders like
`verification/` — which is exactly why the port lives here, not there).

| File | Change |
|---|---|
| `src/gcodeLint.js` | **NEW** — the ported linter (§3/§4). Pure; exports `lintGcode`. |
| `src/verifyPanel.js` | **NEW** — the VERIFY panel (§6); exports a `renderFindings(findings)`; self-registers. |
| `src/editorManager.js` | On `input`, **debounced ~120 ms**, call `lintGcode(editor.value)` → `_findings`; update underlay (§5), panel (§6), status (§7). Add the underlay element + scroll-sync. Expose the latest result as `window.ddcsLintResult = () => _findings` for the transfer pre-flight. |
| `src/app.js` | `import './gcodeLint.js'` is pulled in transitively via editorManager; add `import './verifyPanel.js';` next to the other self-registering modules. |
| `src/styles.css` | `.lint-row--error/.lint-row--warn` (underlay tints), `.verify-panel` rows/icons. |

Debounce matters only for typing cadence — the lint itself is cheap (line-local regexes on short macros).

**Reconcile the old verifier:** retire `verification/`'s two ad-hoc rules. Cleanest no-drift option: make
the Node test harness in `verification/` import `lintGcode` from `../src/gcodeLint.js` (Node ESM reaches
across folders even though the browser bundler doesn't) and host the golden corpus there. The browser app
only ever uses `src/gcodeLint.js`. One source of truth, testable in Node, bundled for the app.

---

## 9. Parity corpus (the anti-drift contract)
Mirror `ddcs_lint.py --self-test` as a JS test (e.g. `verification/parity.test.mjs`): the **same** input
snippets, the **same** expected `code` sets. Examples already in the Python self-test:
`( try X5=4 (input regs) )` → `E-NESTPAREN`; `IF #1!=2 GOTO 5` → `E-GOTOSPACE`;
`#1153 = #880` → `W-PRIME`; `#1153 = 1` then `#1153 = #880` → clean (primed);
`#250 = #1630 + 10` → `E-CH1630`; `MSETDATA[200,1,0,4,16]` → `E-MARGS`; `#100 = [#1 + 2` → `E-BRACKET`.
Add Studio-side cases as rules evolve. CI fails if the JS port and the Python linter disagree on any case.

---

## 10. Acceptance criteria
1. **Live:** typing `#100 = [#1 + 2` marks that line red within ~120 ms, lists it in VERIFY
   (`E-BRACKET`), and the status bar shows `⛔ 1 error` — with no transfer/save needed.
2. **Inline accuracy:** the tinted underlay row sits exactly on the offending line and stays aligned while
   scrolling and across theme/scale changes.
3. **Panel jump:** clicking a VERIFY row scrolls to and selects that line; the virtual keyboard does not pop.
4. **Hover:** hovering a marked line shows the rule message + suggestion.
5. **Wizard output is clean:** inserting any wizard's generated code produces **zero** findings (the wizards
   emit DDCS-correct dialect — `GOTO1`, balanced brackets, etc.).
6. **Parity:** the JS linter returns the same `code` set as `ddcs_lint.py` for every shared-corpus case.
7. **Bundled:** the standalone HTML / pywebview `.exe` lints live too (the linter is in `src/`, so it ships).
8. **Transfer gate:** with ≥1 error present, TRANSFER (addstudiotransfer.md) refuses and points at VERIFY;
   warnings do not block.

---

## 11. Out of scope
- **Auto-fix.** Surface + locate; the operator edits. (A later "fix" action per rule is a possible follow-up.)
- **Toolpath/semantic simulation.** That's `gcodeParser.js` + the 3D preview; this is dialect/quirk linting.
- **New rules beyond `ddcs_lint.py`.** Add them *in the bridge first* (where they're grammar-grounded), then
  port + add to the corpus — don't fork Studio-only rules (except the quarantined `W-POSSIGN` candidate).
