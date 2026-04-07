# Injection Tooltips & Live Highlighting — Design Guide

## Concept

Every wizard UI control injects *something* into the generated G-code. The tooltip system makes this relationship visible: hover a control, see what it injects, and watch it glow in the code preview.

The user should never have to guess what a control does to the output. The tooltip tells them, and the highlight shows them where.

---

## The Rule

**If a control changes the G-code output, it must be possible to describe what it injects and where.**

Every control falls into one of three injection categories. The category determines what the tooltip displays and what gets highlighted.

---

## Injection Taxonomy

### 1. Value Injection

A control writes a **numeric value** into a specific `#variable`.

- **Tooltip shows:** `#token = value` (e.g., `#100 = 25`)
- **Highlights:** Every instance of that `#variable` in the code preview
- **Examples:** Feed rates, distances, retract amounts, port numbers, WCS base addresses

This is the simplest and most common type. One input, one variable, one-to-one.

### 2. Direction Injection

A control determines **which axis letters and/or sign characters** (`+` / `-`) appear throughout the code.

- **Tooltip shows:** The axis/sign it produces (e.g., `X+ Y+`, or just `X`)
- **Highlights:** Every axis letter and signed axis pair it controls in the code preview
- **Examples:** Corner location (FL→X+Y+), probe axis (X vs Y), first probe direction (pos vs neg)

Direction controls affect many lines at once — probe moves, retracts, travel moves — because the sign or axis letter is baked into every motion command. Changing one selector flips signs or swaps axis letters across the entire program.

Key detail: retract signs are always the **opposite** of probe signs. Both are owned by the same control. Highlight all of them.

### 3. Block Injection

A control determines **which code blocks exist** in the output. One setting produces lines that the other setting doesn't generate at all.

- **Tooltip shows:** A summary of the unique tokens that setting injects (e.g., `#55=#882 → G53 Z restore`)
- **Highlights:** The variables and commands that only exist because of that setting
- **Examples:** Pocket vs Boss (boss injects Z-save, manual jog pause, G53 Z-restore), Find Both Axes (adds perpendicular axis block), Probe Sequence YX vs XY (reorders which axis block comes first)

When the "simpler" setting is selected (e.g., pocket), there may be nothing unique to highlight — the tooltip should still describe what it does (e.g., `Direct probe-travel`).

---

## How to Classify a Control

Ask these questions in order:

```
1. Does it write a number into one #variable?
   → Value injection

2. Does it change axis letters or +/- signs on existing lines?
   → Direction injection

3. Does it add/remove entire lines or blocks of code?
   → Block injection
```

Some controls may combine types. For example, a WCS selector might inject a value (`#110 = 805`) AND change axis offset calculations. In that case, treat it as its primary type and note the secondary effects.

---

## Tooltip Design Rules

- Tooltips show **raw G-code tokens**, not descriptions. `#3 = 200` not "Fast feed rate is 200."
- Monospace font, dark background, high contrast. It should look like it belongs in the code preview.
- Tooltip updates **live** as the user types or changes a selector.
- One line only. If a control injects multiple things, compress: `#55=#882  G53 Z`

---

## Highlight Design Rules

- Highlights appear **simultaneously** with the tooltip on hover.
- All instances of the injected token glow — not just the first one.
- Highlight color must be distinct from syntax highlighting colors already in use.
- Highlights clear completely on mouse leave. No lingering state.
- For direction injection, highlight **all** instances of that axis regardless of sign, because the control owns both the probe sign and the retract sign.

---

## Formatter Requirements

The G-code formatter must wrap tokens in spans with data attributes so the highlight engine can target them:

| Token Type | Class | Data Attributes | Example |
|---|---|---|---|
| Variable | `g-var` | `data-token="#100"` | `<span class="g-var" data-token="#100">#100</span>` |
| Signed axis | `g-sign` | `data-axis="X"` `data-sign="+"` | `<span class="g-sign" data-axis="X" data-sign="+">X+</span>` |
| Bare axis | `g-axis` | `data-axis="X"` | `<span class="g-axis" data-axis="X">X</span>` |
| Command | `g-cmd` | `data-cmd="G53"` | `<span class="g-cmd" data-cmd="G53">G53</span>` |

The regex order matters: signed axis (`X+`) must match before bare axis (`X`) to avoid splitting `X+` into two spans.

---

## Data Layer Requirements

A central mapping object connects each UI input ID to its injection definition. This object is the **single source of truth** — the tooltip text, the highlight targets, and the formatter spans all derive from it.

Each entry needs:

- **Injection type** — value, direction, or block
- **How to resolve tokens** — for value: a fixed `#variable`; for direction: a function that returns axis/sign pairs from the current selector value; for block: a function that returns which unique tokens that setting injects
- **Label** — human-readable name for documentation and debugging

The mapping must be **per-wizard** with prefixed IDs to avoid collisions when different wizards use the same variable numbers for different purposes.

---

## Interaction Flow

```
hover input → look up injection map → show tooltip → query code spans → add highlight class
leave input → hide tooltip → remove highlight class from all spans
change input → update tooltip text → regenerate code → re-highlight if still hovered
```

---

## Applying to New Wizards

When adding a new wizard or control:

1. Generate the G-code with two different values for the new control
2. Diff the output — what changed?
3. If a `#variable` value changed → **value injection**
4. If axis letters or signs changed → **direction injection**
5. If entire lines appeared/disappeared → **block injection**
6. Add the entry to the injection map
7. Verify the formatter wraps the relevant tokens
8. Test: hover the control, confirm tooltip and highlights match the actual output
