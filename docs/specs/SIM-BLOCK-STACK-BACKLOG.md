# Sim block-stack backlog — the refactor's culmination (Phase 2 / the block layer)

The sim-side declare-not-infer refactor, finished: the sim-only declarations become **declared DATA**, then
**Blockly blocks**. Built ON inc-1's `opSimStarts` registry + the editor-sim fix (B0). One increment per
loop turn, verify-first, human-eyes each. Design = the converged hybrid (parallel op + sim mouth + shared
stacks); see [FEATURE-CANVAS-PROBE-SCOPE.md](FEATURE-CANVAS-PROBE-SCOPE.md) and the NEXT-SESSION design notes.

## Design recap (one paragraph)
The op block is **parallel**: a `GCODE` mouth → emit (the existing stack), a `SIM` mouth → declare (sim-only
context), routed by mouth NAME (order cosmetic). The `SIM` mouth holds the op's **own** start (inline,
`def.sim.starts`) + a **reference** to the shared-sim stacks (Stock / Magazine / Machine). The `SIM` mouth's
blocks round-trip against the **DECLARATION** (`def.sim.starts`), never the macro (no emitted line to
reverse-sync — the block-care). Owned = portable, can't dangle; shared = one definition, referenced.

## The increments (sequenced)

### B0 — editor sim applies the registry hints  *(IN FLIGHT, turn 88)*
The editor reads an inserted op's `@DDCS` markers → `opSimStarts(op, params, stock)` → the default per-pass
hints → its sim matches the wizard (kills the 2nd-axis-glued-to-stock-edge divergence). **The foundation:
the registry now spans wizard AND editor.** [Done when this passes back.]

### B1 — `def.sim.starts` declarative path  *(the DATA foundation)*
Make a sim-start **declarable as DATA** (`def.sim.starts`), so an op carries its starts as a declared spec,
not computed-only. `opSimStarts` reads `def.sim.starts` for an op (custom ops DECLARE; built-ins keep their
fn or migrate). **Spec must be BLOCK-FRIENDLY** — maps cleanly to a sim-declaration block, declaration
round-trip (not the emit-atom model). Verify-first: `def.sim` today carries INTENT flags only
([[custom-op-sim-intent-infer-vs-declare]]); the registry's `USER_*` layer (`viz/opSimStarts.js`
`setUserSimStarts`); design the spec. **This is also the wizard-maker payoff** — a custom op declares its
starts as data, no code.

### B2 — the dragged-② persists as op data  *(the drag carries to the editor)*
`userStarts` (the GUI drag) is session-state today, so a dragged ② does NOT carry to the editor. Save it into
`def.sim.starts` / the op markers → the editor reads it → a DRAGGED start carries (completes B0 for drags).
Verify-first: where `userStarts` lives (`createPreviewPanel`); persist into the op data (the `@DDCS` markers /
`def.sim.starts`); the editor reads it via B0's path.

### B3 — the SIM-declaration block  *(def.sim.starts as a Blockly block)*
Surface the per-pass starts as a **"Start" / sim-declaration block** in the Blockly view, round-tripping
against `def.sim.starts` (the DECLARATION), NOT the macro (block-care — no emitted line; reads as a distinct
**sim/preview** block so a user never expects it to emit). Verify-first: the bridge block kinds
(`blocks/blockly/bridge.js` — reporter / wrap-DO / statement); add a sim-declaration kind + its declaration
round-trip (not the emit reverse-sync).

### B4 — the parallel two-mouth op block
The op block = a `GCODE` mouth (the existing emit stack) + a `SIM` mouth (the B3 sim-declaration block);
the bridge routes by mouth NAME (`GCODE`→emit, `SIM`→declare). Verify-first: the bridge's wrap/C-block emits
ONE `DO` mouth today (`bridge.js:190`) → add a SECOND `input_statement`; route each mouth by name (cosmetic
vertical order). Start with MIDDLE (the prototype).

### B5 — the shared-sim stacks (Stock / Magazine) referenced  *(the bigger / later piece)*
Surface the **Stock** (then Magazine / Machine) as a SEPARATE referenced declaration block; the op's `SIM`
mouth REFERENCES it ("relative to", not a copy). The op-type already preselects `stock.shape` (turn-87) — this
makes the stock a first-class referenced block. Verify-first: `settings.stock` → a block; the reference
mechanism (a name reference, procedures-like). Avoids the A7 dangling-ref class only if the reference is
validated. [[federated-registry-and-wizards-as-data-stage4]]

## Rollout (after the middle prototype)
The block layer is per-wizard. MIDDLE first (B1–B4 prove the shape), then the other probe wizards + **ATC**
(the cross-wizard sim-only pattern — the audit flagged ATC carousel/magazine as sim-only; see NEXT-SESSION).
The shared-stack pattern (B5) is where ATC's magazine/frame plugs in.

## Gates / unknowns (resolve at dispatch, verify-first)
- B1: the `def.sim.starts` spec shape — gate the design with the human (it's the authoring contract).
- B3/B4: whether the bridge's round-trip cleanly supports a declaration-round-trip block vs the emit model —
  gate if it needs a real bridge restructure.
- B5: the reference mechanism (named-ref) + dangling-ref validation — the largest unknown; scope separately.
