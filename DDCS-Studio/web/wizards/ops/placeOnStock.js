/**
 * wizards/ops/placeOnStock.js — PLACE ON STOCK: a Modify container (a Blockly C-block) that sits the wrapped op on
 * the stock.
 *
 * The wrapped path has its own datum corner (`pathDatum`); it attaches to a chosen stock corner (`stockAttach`) plus
 * a signed offset (offX/offY/offZ). Both datums default to the stock's part-zero datum, so the path follows the stock
 * with zero config. To stay a SELF-CONTAINED, stable block (a saved file's G-code must not drift when the stock
 * changes), the pattern's bounding box and the stock dims/datum are SNAPSHOTTED into the block:
 *   bminX/bmaxX/bminY/bmaxY — the wrapped path's bbox (centres) at author time
 *   stockW/stockH/stockDatum — the stock at author time
 * The emit fold (blockModel kind:'place') emits the child, then translates its output by placeShiftFromParams(). The
 * wizard refreshes the snapshot every generate; re-opening the op re-derives it.
 *
 * ── t1406 — `role`: WHICH PHASE OF ITS OP THIS PLACEMENT FRAMES ───────────────────────────────────────────────────
 * Emits nothing and is read by nothing at emit time. It exists because an op may now be placed MORE THAN ONCE: when
 * pocket's rect clearing re-pointed through `surfaceraster`, the atom had to sit ALONE under its place (absorbingChild
 * is strict — exactly one child, or the shift is painted onto the emitted text, which shears a macro body: t1349), so
 * the wall finish moved into a place of its own. Two blocks of one type in one stack is exactly what `deriveBindings`
 * refuses (a spec must match exactly 1), and that refusal is a safety feature, not an obstacle to route around — it is
 * why t871 kept the rest section inside the single place rather than adding a second one.
 *
 * So the discriminator is a DECLARATION rather than a positional convention: 'clear' = the op's clearing/primary place,
 * 'wall' = the finish pass that follows it. Default '' — every other wizard's place is untouched and byte-identical,
 * and a spec that does not qualify its match behaves exactly as it always did.
 */
export const placeOnStockBlock = {
    type: 'placeonstock', label: 'Place on Stock', kind: 'place', category: 'Transforms',
    defaults: { stockAttach: '', pathDatum: '', offX: 0, offY: 0, offZ: 0, optIn: false, stockW: 0, stockH: 0, stockZ: 0, stockDatum: 'nnp', bminX: 0, bmaxX: 0, bminY: 0, bmaxY: 0, role: '' },
    fields: ['stockAttach', 'pathDatum', 'offX', 'offY', 'offZ'],   // the editable intent; the snapshot params + `role` ride along
};
