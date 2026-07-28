/**
 * data/stockShape.js — WHAT SHAPE THE STOCK IS, declared once (t1313).
 *
 * The record already carried the facts (`shape` / `axis` / `origin` since t1281, and `latheSimStock` builds a bar);
 * what was missing was a place that says what those combinations MEAN, so the modal, the 3D and the persistence
 * layer stop each deciding for themselves. Three kinds of stock exist, and each is a different physical thing:
 *
 *   BOX          a rectangular block on the table. `boss` and `pocket` are the same box — they say which SIDE a
 *                probe works from — so they are box VARIANTS here, not separate shapes.
 *   ROUND BLANK  a disc standing on the table (axis 'z'), or a bar along a declared ROTARY axis. Its datum is the
 *                CENTRE OF THE TOP FACE, because a round part has no corner to measure from.
 *   BAR          a lathe bar on the centreline: axis 'z' AND origin 'finished-face'. Its datum is the centreline
 *                and Z0 is the finished face — the lathe convention, not a choice anyone makes.
 *
 * The last two are both `shape: 'cylinder'`; what separates them is `origin`, which is why that field exists.
 */
import { normalizeBar, barToStock, radiusOf, DEFAULT_BAR } from './lathe.js';

/** The two shapes a person picks between. Box variants live under BOX. */
export const STOCK_SHAPES = {
    box: { id: 'box', label: 'Box', why: 'A rectangular block — the everyday milling blank.' },
    cylinder: { id: 'cylinder', label: 'Cylinder', why: 'Round stock: a blank standing on the table, or a bar on the centreline.' },
};

/** Which of the two a record IS. A box variant (boss/pocket) is a box. */
export const shapeKindOf = (stock) => ((stock && stock.shape === 'cylinder') ? 'cylinder' : 'box');

/** …and which KIND of cylinder: a lathe bar (on the centreline, Z0 at the finished face) or a round blank. */
export const isLatheBar = (stock) => !!(stock && stock.shape === 'cylinder' && stock.axis === 'z' && stock.origin === 'finished-face');
export const isRoundBlank = (stock) => !!(stock && stock.shape === 'cylinder' && !isLatheBar(stock));

/** The default box variant to return to when someone switches back from a cylinder. */
export const DEFAULT_BOX_VARIANT = 'boss';

/**
 * THE ROUND BLANK'S DATUM IS THE CENTRE OF ITS TOP FACE (user ruling). A round part has no corner: the corner picks
 * that a box offers would be asking someone to measure from thin air. 'cc' = centred in X and Y, 'p' = the top.
 */
export const ROUND_BLANK_DATUM = 'ccp';

/** The reason a corner pick is greyed on round stock — said once, so every surface says the same thing. */
export const ROUND_DATUM_WHY = 'a round blank is measured from the CENTRE of its top face — it has no corner to pick';

/** The reason a box is greyed on a lathe — same rule: one sentence, one place. */
export const LATHE_BOX_WHY = 'a lathe turns BAR stock on the centreline, so its workpiece is a cylinder';

/** The reason the features editor is box-only for now. */
export const FEATURES_BOX_ONLY_WHY = 'pockets and bosses are placed on a rectangular face — on round stock they have no frame to sit in yet';

/** A round blank, as a stock record: a disc of `diameter` standing `height` tall on the table. */
export function roundBlankStock(diameter, height, axis = 'z', current = null) {
    const d = Math.max(0.001, Number(diameter) || 0);
    const h = Math.max(0.001, Number(height) || 0);
    const a = (axis === 'x' || axis === 'y') ? axis : 'z';
    // the box the cylinder is inscribed in: its two cross dims are the diameter, the axial one is the height
    const dims = a === 'z' ? { x: d, y: d, z: h } : (a === 'x' ? { x: h, y: d, z: d } : { x: d, y: h, z: d });
    return {
        ...(current || {}), shape: 'cylinder', axis: a, diameter: d, ...dims,
        origin: undefined,               // …NOT a lathe bar: no finished face, so no bar origin
        datum: ROUND_BLANK_DATUM, show: true,
    };
}

/** The bar a lathe record describes, in the terms a turner types: diameter, stick-out, raw-end allowance. */
export function barOfStock(stock) {
    const s = stock || {};
    if (!isLatheBar(s)) return normalizeBar({ diameter: s.diameter || DEFAULT_BAR.diameter, stickOut: DEFAULT_BAR.stickOut, allowance: DEFAULT_BAR.allowance });
    const allowance = Number(s.faceZ) || 0;
    return normalizeBar({ diameter: s.diameter, stickOut: (Number(s.z) || 0) - allowance, allowance });
}

/**
 * …and back: those three numbers as the ONE bar record every lathe consumer reads. Built through `barToStock`, the
 * same function `latheSimStock` uses, so the modal cannot describe a bar the wizards would draw differently.
 */
export function barStock(bar, current = null) {
    const b = normalizeBar(bar);
    const st = barToStock(b);
    return {
        ...(current || {}), shape: 'cylinder', axis: 'z', origin: 'finished-face',
        x: st.diameter, y: st.diameter, z: st.z, diameter: st.diameter, faceZ: b.allowance,
        datum: 'ccp', pin: (current && current.pin) || 'origin', show: true,
    };
}

/** What the datum row SAYS when it is not a choice — the lathe convention, stated where it applies. */
export const BAR_DATUM_TEXT = 'the centreline, with Z0 at the finished face';

/** The radius a round record draws at, whichever kind it is. */
export const stockRadius = (stock) => radiusOf((stock && stock.diameter) || 0);
