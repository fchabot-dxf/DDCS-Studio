/**
 * data/paramAddressing.js — THE ONE macro#↔param# offset, JS side (t2073).
 *
 * A DDCS macro variable reads the persisted file 500/1000/100 BELOW its number: macro #805 (G54-X) =
 * setting param #305, macro #1430 = camsetting #430, macro #150 = uservar #50. This is the SAME fact the
 * bridge declares in Python (`bridge/bridge-app/fairy/ops.py` → `Ops.PARAM_FILE_OFFSET`), and the SAME
 * `−500` that t2067 got wrong in one place while right in another. It lives here ONCE for JS so the
 * dump-importer's param bases and the dialects' macro bases resolve through a single offset, and the
 * cross-language test pins these values equal to Python's.
 *
 * Only the OFFSET is shared — not the per-controller layout (that stays in dumpImport's index maps / the
 * dialects), and NOT V4.1's WCS which lives in the separate `coord1` file, not `setting` (the −500 does
 * not apply to it).
 */
export const PARAM_FILE_OFFSET = { uservar: 100, setting: 500, camsetting: 1000 };

/** macro number → index into its persisted file (default `setting`). The inverse of "G-code addresses #n". */
export const macroToParam = (macro, file = 'setting') => macro - PARAM_FILE_OFFSET[file];
