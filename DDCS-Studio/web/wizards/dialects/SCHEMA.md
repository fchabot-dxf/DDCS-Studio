# Dialect registry — per-profile primitive bindings

The block atoms emit **intent**; a **dialect** renders that intent into one controller's real G-code/macro.
"Register the words per profile." One module per controller: `wizards/dialects/<id>.js`, each `export const dialect`.

Grounded in the captured dumps under `bridge/controllers/<id>/` — see memory `ddcs-ground-truth-reference`.
Verify every form against the dump; cite `file:line` in a comment when a form is non-obvious.

## The contract (every dialect exports this shape)

```
export const dialect = {
  id, name,
  programModel: 'inline' | 'script',     // inline G-code (DDCS/Centroid/RS274) vs a macro language (Mach3 VBScript)
  probeModel:   'g31' | 'g38' | 'move-until-input' | 'script',
  dwellUnits:   'ms' | 's',
  vars: { dro, probeStatus, probeTrig, wcsBase, wcsStride, activeWcs, toolTable, ax:{X,Y,Z,A} },  // base #-numbers

  // each returns string[] of emitted lines (so a primitive can be multi-line). axis ∈ 'X'|'Y'|'Z'|'A'.
  probeMove(axis, dist, { feed, port, level }),     // a single probe toward dist along axis
  probeStatus(axis, label),                         // branch to label if it did NOT trigger; [] if stop-at-contact
  probeRead(axis, varName),                         // capture contact position into varName ('#50'); [] if stop-at-contact
  readMachine(axis, varName),                        // capture live machine DRO into varName
  machineMove(axis, ref, { feed }),                  // move in the MACHINE frame; ref is a #var where the controller requires one
  setWorkOffset(wcsExpr, axis, value),               // write the active WCS axis offset = value (wcsExpr = active-WCS index 1..6)
  readActiveWcs(varName),                             // active WCS index (1=G54…) into varName
  distMode(mode),                                    // 'abs'|'inc' -> a single token string (e.g. 'G90')
  dwell(seconds),
  endProgram(),
  ifGoto(lhs, op, rhs, label),                       // op canonical: '=='|'!='|'<'|'>'|'<='|'>=' (map to the dialect's spelling)
  goto(label), label(n),
  spindle(dir, rpm), spindleOff(), coolant(on),
  hmiPrompt(msg), hmiToast(msg), hmiInput(varName, prompt),

  notes: 'free text: structural quirks, what is NOT expressible, dump file:line evidence',
};
```

## Rules
- **Single source of truth = the dump.** If the form isn't in the dump, say so in `notes` and mark it `TO CONFIRM`.
- Return `[]` (empty) for a primitive a controller folds away (e.g. Centroid's `probeStatus`/`probeRead` — it stops *at* contact).
- For `programModel:'script'` (Mach3/Mach4), each method returns the *script statement(s)*, not G-code lines — and `notes`
  must flag that this dialect needs the script-emitter backend, not the line emitter.
- Keep functions pure (no DOM, no imports beyond a local axis map) so they're Node-testable.

## Reference
`ddcs-expert-m350.js` is the hand-written, dump-verified anchor — mirror its exact shape.
