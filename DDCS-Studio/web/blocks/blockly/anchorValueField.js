/**
 * blocks/blockly/anchorValueField.js — the SEARCHABLE ANCHOR VALUE field (t2679, BACKLOG #71/#72 Phase 2
 * board, proposal (a) — the owner's OWN mid-turn redesign, amendments 1-3, superseding an earlier value-
 * SOCKET + reporter-block design entirely; see `pointHandle.js`/`rectHandle.js`'s own headers for the full
 * account of what was tried and replaced).
 *
 * `point_handle`/`rect_handle`'s own `ax`/`ay` use this field. The owner's own words: "authoring should be
 * as natural as possible — not literal world names, a SEARCH BOX for allowed values in the input itself."
 * TWO things this ONE field does, and the split is the whole design:
 *   - Type a NUMBER → it commits AS a number (a literal anchor coordinate, unchanged from the field's own
 *     pre-t2679 shape — just typed, not searched).
 *   - Type LETTERS → it searches an ALLOWED, CLOSED candidate list and commits ONLY from that list — the
 *     search IS the gate (no free text lands as a name; `pickerField.js`'s own must-match rung, not
 *     `comboField.js`'s spelling-aid tolerance, even though the UI shell — a filter box + a live list — is
 *     `comboField.js`'s own promoted from spelling-aid to committing picker, per the owner's own framing).
 *
 * ⭐ THE ALLOWED LIST IS THE WHOLE DESIGN (amendment 3, the FINAL scope, superseding amendments 1-2's own
 * multi-world/grouped-header ideas): ONE world — THIS DEF'S OWN AUTHORABLE SURFACE. Candidates are ONLY:
 *   - this def's own bound FORM PARAMS (every `formfield`/`param_field` elsewhere in the stack) — shown by
 *     their own FORM LABEL ("Origin X"), not the raw param name — the word the person already put on the
 *     form they built, costs nothing new to show.
 *   - this def's own preview MARKERS (every `simstart` block's own declared `id`, t2585 — the SAME candidate
 *     pool `relToRow` already offers) — shown by their own id.
 * ⛔ NOTHING ELSE. No stock-dimension tokens, no setup values, and — the load-bearing exclusion — NEVER a
 * controller `#N` macro-var: that world doesn't exist at AUTHORING time (a render/anchor slot is evaluated
 * before the machine ever runs), so it is excluded BY CONSTRUCTION (it is simply never in the source list),
 * not by a filter rule that could be gotten wrong. THE STANDING PRINCIPLE (put here for the next block that
 * wants this shape too): the authoring GUI plugs into things the PERSON authored and can SEE on the canvas
 * (form fields they built, markers they placed) — the moment a value would need a non-human name, that is
 * the signal it is plumbing, not authoring, and it stays under the floor (resolved at RENDER time —
 * `panelTypes.js`'s own `resolveAnchorCoord`/`markerAnchorCoord` — never offered here).
 *
 * RESULTS ARE FLAT, RANKED, NO GROUP HEADERS (amendment 2, refining amendment 1's own first draft): a
 * machinist searches for the VALUE ("origin"), not its category — grouping was the advisor's own namespace
 * instinct leaking onto the authoring face, the owner's own words. A per-row SOURCE HINT ("· form" / "·
 * marker") appears ONLY when two candidates share the same LABEL (a genuine tie a person needs to break) —
 * a lone unambiguous result carries no tag.
 *
 * Built on `pickerField.js`'s own popup/candidate-list mechanics (the "must-match reference" parent) with a
 * `comboField.js`-shaped filter-as-you-type shell (the "promoted spelling aid" parent) — a NEW field class
 * rather than a config flag on either: neither parent's own `_candidates()`/`showEditor_()` shape fits the
 * "numeric input bypasses the list entirely" branch this field needs first.
 */
import { openFieldPopup } from './dropdownPopup.js';

export function installAnchorValueField(Blockly) {
    /** typeof number stays a number; a numeric-looking string normalizes to one (legacy pre-redesign records,
     *  and Blockly's own `loadState` round-trip, always hand this a STRING even for what was authored as a
     *  number — see `doClassValidation_` below); anything else (a param name, a marker id) stays a string. */
    function normalize(v) {
        if (typeof v === 'number') return v;
        if (v == null || v === '') return 0;
        const s = String(v);
        const n = Number(s);
        return (s.trim() !== '' && Number.isFinite(n)) ? n : s;
    }

    class FieldAnchorValue extends Blockly.Field {
        constructor(value, validator, config) {
            super(normalize(value), validator, config);
            this.SERIALIZABLE = true;
            this.size_ = new Blockly.utils.Size(70, 24);
        }
        static fromJson(options) { return new FieldAnchorValue(options.value, undefined, options); }
        doClassValidation_(v) { return normalize(v); }
        isClickable() { return true; }

        /** every OTHER formfield/param_field's own PARAM (value=param name, label=its own FORM LABEL) plus
         *  every simstart's own declared id (value=label=id) — the def's own authorable surface, flat. */
        _candidates() {
            const blk = this.getSourceBlock();
            const ws = blk && blk.workspace;
            if (!ws) return [];
            const all = ws.getAllBlocks(false);
            const params = all
                .filter((b) => (b.type === 'formfield' || b.type === 'param_field') && b.id !== blk.id)
                .map((b) => {
                    const name = b.getFieldValue('PARAM');
                    const label = b.getFieldValue('LABEL');
                    return name ? { value: name, label: label || name, source: 'form' } : null;
                }).filter(Boolean);
            const markers = all.filter((b) => b.type === 'simstart')
                .map((b) => { const id = b.getFieldValue('ID'); return id ? { value: id, label: id, source: 'marker' } : null; })
                .filter(Boolean);
            // dedup by value (a param renamed to collide with a marker id is a pre-existing authoring conflict
            // elsewhere, not this field's problem to resolve) — first occurrence wins, params before markers.
            const seen = new Set(), out = [];
            for (const c of [...params, ...markers]) { if (seen.has(c.value)) continue; seen.add(c.value); out.push(c); }
            return out;
        }

        /** a NAMED value shows its own FORM LABEL/marker id (never the raw stored value if a nicer label is
         *  known); a plain number shows itself; an unmatched name (the target renamed/deleted elsewhere) shows
         *  the raw value with a visible warning, the same "decorate, never silently hide" convention
         *  `comboField.js`'s own 'var' traffic-light and `pickerField.js`'s own tool/pin kinds already use. */
        getText() {
            const v = this.getValue();
            if (typeof v === 'number') return String(v);
            if (!v) return '(pick or type…)';
            const c = this._candidates().find((c) => c.value === v);
            return c ? c.label : `${v}  ⚠ not a param/marker in this stack`;
        }

        showEditor_() {
            openFieldPopup(this, (content, close) => {
                const candidates = this._candidates();
                const filterBox = document.createElement('input');
                filterBox.type = 'text';
                filterBox.placeholder = 'number, or search a param/marker…';
                const cur = this.getValue();
                filterBox.value = (typeof cur === 'number') ? String(cur) : '';
                filterBox.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:6px;padding:4px 6px;font:inherit;';
                const list = document.createElement('div');
                list.style.cssText = 'max-height:220px;overflow-y:auto;';
                const commit = (v) => { this.setValue(v); close(); };
                const rank = (q, label) => { const l = label.toLowerCase(); if (l === q) return 0; if (l.startsWith(q)) return 1; return 2; };
                const renderList = (raw) => {
                    list.innerHTML = '';
                    const q = raw.trim();
                    const n = Number(q);
                    if (q !== '' && Number.isFinite(n)) {
                        // a numeric query is ALWAYS a literal — never also searched as a name (a param/marker
                        // named "40" would be an absurd authoring choice; the numeric read wins unconditionally).
                        const row = document.createElement('div');
                        row.className = 'ddcs-picker-row';
                        row.textContent = `= ${n}`;
                        row.style.cssText = 'padding:5px 6px;cursor:pointer;border-radius:3px;font-style:italic;';
                        row.addEventListener('mousedown', (e) => e.preventDefault());
                        row.addEventListener('click', () => commit(n));
                        list.appendChild(row);
                        return;
                    }
                    const ql = q.toLowerCase();
                    const shown = candidates
                        .filter((c) => !ql || c.label.toLowerCase().includes(ql))
                        .sort((a, b) => rank(ql, a.label) - rank(ql, b.label));
                    if (!shown.length) {
                        const empty = document.createElement('div');
                        empty.textContent = candidates.length ? 'no match' : '(place a form field or a sim-start marker in this stack first)';
                        empty.style.cssText = 'opacity:.6;padding:4px 6px;';
                        list.appendChild(empty);
                    }
                    // amendment 2 — a per-row source hint ONLY when the label is ambiguous (2+ candidates share
                    // it); a lone result needs no tag, never a group header.
                    const labelCounts = {};
                    for (const c of shown) labelCounts[c.label] = (labelCounts[c.label] || 0) + 1;
                    for (const c of shown) {
                        const row = document.createElement('div');
                        row.className = 'ddcs-picker-row';
                        row.textContent = labelCounts[c.label] > 1 ? `${c.label}  ·  ${c.source}` : c.label;
                        row.style.cssText = 'padding:5px 6px;cursor:pointer;border-radius:3px;';
                        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(0,0,0,.08)'; });
                        row.addEventListener('mouseleave', () => { row.style.background = ''; });
                        row.addEventListener('mousedown', (e) => e.preventDefault());
                        row.addEventListener('click', () => commit(c.value));
                        list.appendChild(row);
                    }
                };
                filterBox.addEventListener('input', () => renderList(filterBox.value));
                filterBox.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') close();
                    else if (e.key === 'Enter') {
                        const n = Number(filterBox.value.trim());
                        if (filterBox.value.trim() !== '' && Number.isFinite(n)) commit(n);
                    }
                });
                renderList(filterBox.value);
                content.appendChild(filterBox);
                content.appendChild(list);
                setTimeout(() => { filterBox.focus(); filterBox.select(); }, 0);
            });
        }
    }

    try { Blockly.fieldRegistry.register('field_anchor_value', FieldAnchorValue); } catch (_) { /* already registered */ }
    return FieldAnchorValue;
}
