# Probe / Sim Preview — Frame & Collision Issues

Captured during rotary (4th-axis) probe work. Most of these are **one underlying problem**: the preview
has several coordinate frames — the 3D stock render, the 3D probe collision, the 3D start marker, the 2D
canvas, and the incremental probe path — and they only agree in the simplest case (**top/corner datum,
start over the part, no envelope**). Any other case exposes a divergence.

## The unifying principle (agreed)

The right discriminator is **incremental (G91) vs absolute (G90)**, *not* "probe wizard". The flag already
exists: `_anchorToStart = !parsed.stats.absolute` (`web/viz/createPreviewPanel.js` ~L194). It already governs
the **path** anchor. The bug is that the **stock render (and the 2D) don't honor the same flag**.

- **Incremental / start-anchored (probe):** operator-relative → the stock should be **top-at-0,
  datum-independent** (the same frame the collision + marker + path already use).
- **Absolute (mill):** datum-aware, as today (the datum legitimately places where Z0 / the toolpath sits).

Proof it's the render that's out of step: for the **nnp (top corner)** datum the render box and the collision
box are *identical* — `pg.position=(x/2,y/2,−z/2)` → stock spans `[0,x]×[0,y]×[−z,0]`, exactly the collision
box `{z:−z..0}`. For a **bottom** datum `D[2]=0` → `pg.position.z=z/2` → stock spans `[0,x]×[0,y]×[0,+z]`
(top at `+z`), while the collision **stays** `[−z..0]`. Only the rendered stock moved.

---

## Open problems

### 1. Stock render ≠ collision frame on a non-top datum  **[ROOT]**
- **Observed:** with a bottom datum the probe stops at the wrong height and the path appears to run *through*
  the rendered stock.
- **Cause:** render is datum-aware (`gcodeViz3d.js` `setStock`, pg.position from `dcode`/`dfrac`/`D`, ~L943-951);
  collision (`engine/probeGeometry.js` `stockProbeStop`) is hard-coded top-at-0 with no datum awareness.
- **Fix:** the stock render honors `_anchorToStart` → render in the top-at-0 corner frame when incremental.

### 2. Probe path appears datum-offset
- **Observed/noted:** a probe is operator-relative (absolute in intent); it should *not* be shifted by the
  datum the way a mill toolpath is.
- **Cause:** same as #1 — the datum moves the rendered stock relative to the start-anchored probe path.
- **Fix:** same `_anchorToStart` gate (this is the same bug, seen from the path side).

### 3. Start position in the 2D canvas is wrong
- **Observed:** the start marker in the 2D canvas lands in a different place than in the 3D view / the stock.
- **Cause:** `web/viz/toolpath2d.js` draws its own stock rect + start (`t2.setStart`, `createPreviewPanel.js`
  ~L187); it must honor `_anchorToStart` too, or the 2D keeps drifting after the 3D is fixed.
- **Fix:** apply the same incremental→top-at-0 frame rule in the 2D renderer.

### 4. Tool "hit box" is higher than expected (all wizards)
- **Observed:** the probe registers contact higher than where the tool tip visually sits; the tool model
  doesn't rest on its contact point.
- **Likely cause:** partly a facet of #1 (datum offset); and/or the **stylus-ball radius** — the collision
  clamps the *path point* (tool tip / origin), ignoring the ruby ball radius, so the contact sits a ball-radius
  off the visible surface.
- **Status:** re-check after #1; decide whether the ball radius should offset the contact.

### 5. Jogging the start outside the bar's reach → no collision
- **Observed:** jogging the start off the bar makes the path stop colliding (it shoots past the stock).
- **Cause:** the incremental auto-cycle is relative to the start, which it assumes is over the bar centre. On a
  *round* bar a fixed-travel probe at an off-centre Y genuinely misses the curved surface. This is correct
  collision behaviour but confusing UX.
- **Possible fix:** constrain the rotary start to sit over the bar (Z-only jog), or clamp X/Y to the centreline.

### 6. The sim auto-completes a probe that misses
- **Observed:** the path "completes like it does" even when the probe geometrically misses the stock.
- **Cause:** trace mode auto-answers every probe (so IF/GOTO probe loops terminate), which masks a geometric
  miss.
- **Fix:** a geometric miss should read as a **miss** (don't auto-detect when the ray never hits the stock),
  so the operator can see it didn't touch.

---

## Resolved this session (for context)
- Rotary stock is a real **round** collision object (shared sim+engine `probeGeometry`). `5e3f3ac`
- Rotary-centre **known-method** flanks probe the OD — auto + manual-jog, both simulate to the true centreline. `8660791`
- Traverse-over runs **clear above the bar** (no skim-through). `6f23e46`
- Middle probe **auto vs manual-jog** + explicit boss traverse height. `47f9a19`
- App-load crash (duplicate `const`) + **Ø pulled from cylinder stock** + cylinder **activated on open**. `04cea8b`
- **4th-axis fixture** (chuck + tailstock), rotary-op only. `43a3b45`
