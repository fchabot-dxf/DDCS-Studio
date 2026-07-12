/**
 * toolPicker.js — shared Tool ▾ picker for the Mill wizards.
 *
 * Reads the tool library (settings.atc.tools[] — see settingsPanel.js). The list is the same
 * whether the machine has an ATC or does manual tool change; picking a tool loads its
 * dimensions and feeds/speeds into the wizard fields as the defaults.
 */
import { libraryTools } from '../ui/settingsPanel.js';

/** A compact unicode TIP GLYPH per tool type — for the picker rows (the tool-table modal shows the full SVG silhouette).
 *  t768 P1b — the "tip glyph" of the ruled row read T# · name · Ø · tip. */
export function tipGlyph(type) {
    return ({ endmill: '▭', ballnose: '◗', drill: '▽', vbit: '◣', chamfer: '◣', engraver: '◣', spotdrill: '▽', face: '▬', tap: '≣', reamer: '▯' })[type] || '·';
}

/** Library tools, each labelled for a dropdown. Keyed by tool number (T-word).
 *  Returns [{ num, name, type, dia, flutes, length, rpm, feed, plunge, label }]. */
export function getToolLibrary() {
    const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
    return libraryTools(s.atc || {}).map((t) => {
        const dia = (t.dia !== '' && t.dia != null) ? ('Ø' + t.dia) : '';
        // t768 P1b — the full row read: T# · name · Ø · tip glyph.
        const label = 'T' + t.num + (t.name ? ' · ' + t.name : '') + (dia ? ' (' + dia + ')' : '') + ' · ' + tipGlyph(t.type);
        return { ...t, label };
    });
}

/** <option> markup for a picker <select>; first entry is a no-pick placeholder. */
export function toolOptionsHTML(placeholder = 'Tool… (from library)') {
    const opts = ['<option value="">' + placeholder + '</option>'];
    getToolLibrary().forEach((t) => { opts.push('<option value="' + t.num + '">' + t.label + '</option>'); });
    return opts.join('');
}

/** Look up a tool by tool number (T-word). null if not in the library. */
export function getTool(num) {
    return getToolLibrary().find((t) => Number(t.num) === Number(num)) || null;
}

/** Refill a picker <select> from the library, preserving the current selection if it still exists. */
export function populateToolSelect(selectEl) {
    if (!selectEl) return;
    const keep = selectEl.value;
    selectEl.innerHTML = toolOptionsHTML();
    selectEl.value = keep;
}

/** Map a tool's params onto wizard field ids. `ids` keys: { dia, feed, plunge, rpm } → field id.
 *  Only fields the tool actually has (and you name) are returned, ready for the view's setFields(). */
export function toolFieldMap(tool, ids) {
    const m = {};
    if (!tool || !ids) return m;
    const put = (key, id) => { if (id && tool[key] !== '' && tool[key] != null) m[id] = tool[key]; };
    put('dia', ids.dia); put('feed', ids.feed); put('plunge', ids.plunge); put('rpm', ids.rpm);
    return m;
}
