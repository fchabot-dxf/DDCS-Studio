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
 */
export const placeOnStockBlock = {
    type: 'placeonstock', label: 'Place on Stock', kind: 'place', category: 'Modify',
    defaults: { stockAttach: '', pathDatum: '', offX: 0, offY: 0, offZ: 0, optIn: false, stockW: 0, stockH: 0, stockZ: 0, stockDatum: 'nnp', bminX: 0, bmaxX: 0, bminY: 0, bmaxY: 0 },
    fields: ['stockAttach', 'pathDatum', 'offX', 'offY', 'offZ'],   // the editable intent; the snapshot params ride along
};
