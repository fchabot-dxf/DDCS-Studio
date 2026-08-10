/**
 * viz/startGlyph.js — t1688 THE GLYPH RESOLVER. Replaces three renderer-local rules for the per-pass start/
 * reposition marker glyph (featureCanvas.js, toolpath2d.js, gcodeViz3d.js each re-decided this independently and
 * disagreed): shape+colour follow the MANUAL/AUTO axis (t293's own established language — a filled AMBER CIRCLE ●
 * is the operator's own jog, a filled CYAN SQUARE ■ is a machine-driven reposition); fill (solid vs hollow) follows
 * the ORTHOGONAL `emits` axis (t69/t1684 — does dragging this marker write a value the emitted program reads).
 * Declared ONCE, called by every renderer, so a renderer added later is coincident automatically.
 */

// t293: the FIRST surviving pass is always the operator's own jog, regardless of its internal reposition source
// (corner's own cornerSimStartsProvider forces `source:'auto'` at index 0 even though nothing drives it there).
export function isManualStart(source, pass) {
    return pass === 0 || source === 'manual';
}

// `emits` is a tri-state (t1684): undefined = an op that never declares per-pass emits (every op but corner today)
// keeps the pre-existing "solid by default" look; an explicit `false` is the only thing that hollows a marker out.
export function resolveStartGlyph(manual, emits) {
    return {
        shape: manual ? 'circle' : 'square',
        fill: emits !== false,
        colour: manual ? '#ffb300' : '#22d3ee',
    };
}
