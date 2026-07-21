/**
 * ui/units.js — the ONE mm<->inch conversion leaf (t1008).
 *
 * mm is ALWAYS the authoritative, exact storage; inch/IPM is a DERIVED display/input view. This module is the SINGLE
 * home of the 25.4 conversion so no consumer hand-rolls its own (drift). Three consumers import it: the op-form dual-unit
 * widget (formWidgets.numberWidget), the tool-library table editor + its "Add from catalog" picker (settingsPanel).
 *
 *   toDisp(mm)   → inch/IPM for DISPLAY (4 dp). Used for a hint, a field value, a picker label.
 *   fromDisp(in) → mm for STORAGE (3 dp, matching the op-form's original inverse so emit stays byte-identical).
 *
 * The kind (length "in" vs feed "IPM") only changes the LABEL, never the ÷25.4 arithmetic — so one pair covers both.
 */
export const MM_PER_IN = 25.4;
export const toDisp = (mm) => Math.round((mm / MM_PER_IN) * 10000) / 10000;   // mm → inch/IPM (display only, 4 dp)
export const fromDisp = (disp) => Math.round(disp * MM_PER_IN * 1000) / 1000;  // inch/IPM → mm (storage, 3 dp; 0.25 in → 6.35 exact)
