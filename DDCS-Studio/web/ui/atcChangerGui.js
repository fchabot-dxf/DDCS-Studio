/**
 * ui/atcChangerGui.js — the ATC CHANGER composer (RE-PLAN #2, I3): the two doors to the ONE declared changer config.
 *
 *  • PRESET LIBRARY — pick a ready-made changer (the built-in PRESETS from atcModel + the user's SAVED ones) → pre-fills
 *    settings.atc.{grip, motion, layout}.
 *  • FROM-ZERO composer — pick layout × grip × motion yourself (from the atcModel GRIPS / MOTIONS vocabulary).
 *  • SAVE AS PRESET — persist the current config to settings.atc.userPresets so it re-appears in the library.
 *
 * ONE-SOURCE: this writes settings.atc.{grip, motion, layout}; the I2 seam (atcChoreography → atcCombo) reads that
 * declared config, so the SIM reflects the chosen changer. SIM/UI only — byte-identical for the 3 shipped presets (the
 * emit still delegates via the op's method; new from-zero combos don't emit yet — I5).
 */
import { GRIPS, MOTIONS, PRESETS } from '../wizards/atcModel.js';

const LAYOUTS = [['linear', 'Linear / rack'], ['disk', 'Disk / carousel'], ['station', 'Fixed station'], ['custom', 'Custom']];
const INP = 'padding:3px 6px; border:1px solid #b3a98f; border-radius:3px; font-size:12px; background:#fff; color:#222;';

function opt(value, label, sel) { const o = document.createElement('option'); o.value = value; o.textContent = label; if (sel) o.selected = true; return o; }
function field(text, control, w) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:2px; font-size:10px; color:#6b6150;';
    wrap.appendChild(document.createTextNode(text));
    control.style.cssText = INP + (w ? ` width:${w}px;` : '');
    wrap.appendChild(control);
    return wrap;
}

export function renderAtcChanger(container, { atc, onChange } = {}) {
    if (!container || !atc) return;
    atc.userPresets = Array.isArray(atc.userPresets) ? atc.userPresets : [];
    const rerender = () => renderAtcChanger(container, { atc, onChange });
    const commit = () => { if (onChange) onChange(); };
    container.innerHTML = '';

    // ── PRESET LIBRARY ──────────────────────────────────────────────────────
    const presetRow = document.createElement('div');
    presetRow.style.cssText = 'display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-bottom:12px;';
    const presetSel = document.createElement('select'); presetSel.setAttribute('data-atc-preset', '');
    presetSel.appendChild(opt('', '— pick a preset —', true));
    Object.entries(PRESETS).forEach(([k, p]) => presetSel.appendChild(opt('builtin:' + k, p.label + (p.candidate ? ' (candidate)' : ''), false)));
    atc.userPresets.forEach((p, i) => presetSel.appendChild(opt('user:' + i, (p.name || 'Saved ' + (i + 1)) + ' ★', false)));
    presetSel.addEventListener('change', () => {
        const v = presetSel.value; if (!v) return;
        const [kind, key] = v.split(':');
        const p = kind === 'builtin' ? PRESETS[key] : atc.userPresets[Number(key)];
        if (p) { atc.grip = p.grip || null; atc.motion = p.motion || null; atc.layout = p.layout || null; commit(); rerender(); }
    });
    presetRow.appendChild(field('Preset library', presetSel, 210));
    container.appendChild(presetRow);

    // ── FROM-ZERO COMPOSER (layout × grip × motion) ─────────────────────────
    const composer = document.createElement('div');
    composer.style.cssText = 'display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap;';
    const picker = (label, options, current, set, attr) => {
        const sel = document.createElement('select'); sel.setAttribute(attr, '');
        sel.appendChild(opt('', '—', !current));
        options.forEach(([v, l]) => sel.appendChild(opt(v, l, current === v)));
        sel.addEventListener('change', () => { set(sel.value || null); commit(); rerender(); });
        composer.appendChild(field(label, sel, 150));
    };
    picker('Layout', LAYOUTS, atc.layout, (v) => { atc.layout = v; }, 'data-atc-layout');
    picker('Grip', Object.entries(GRIPS).map(([k, g]) => [k, g.label + (g.candidate ? ' (candidate)' : '')]), atc.grip, (v) => { atc.grip = v; }, 'data-atc-grip');
    picker('Motion', Object.entries(MOTIONS).map(([k, m]) => [k, m.label + (m.candidate ? ' (candidate)' : '')]), atc.motion, (v) => { atc.motion = v; }, 'data-atc-motion');
    container.appendChild(composer);

    // ── SAVE AS PRESET ──────────────────────────────────────────────────────
    const saveRow = document.createElement('div');
    saveRow.style.cssText = 'display:flex; gap:8px; align-items:center; margin-top:12px;';
    const name = document.createElement('input');
    name.type = 'text'; name.placeholder = 'Preset name'; name.setAttribute('data-atc-savename', '');
    name.style.cssText = INP + ' width:170px;';
    const save = document.createElement('button');
    save.className = 'toolbar-btn settings-io'; save.textContent = '★ Save as preset'; save.setAttribute('data-atc-save', '');
    save.addEventListener('click', () => {
        if (!atc.grip && !atc.motion) return;   // nothing composed yet
        atc.userPresets.push({ name: name.value || ('Changer ' + (atc.userPresets.length + 1)), grip: atc.grip || null, motion: atc.motion || null, layout: atc.layout || null });
        commit(); rerender();
    });
    saveRow.appendChild(name); saveRow.appendChild(save);
    container.appendChild(saveRow);

    // ── current-combo summary ──
    const sum = document.createElement('div'); sum.className = 'settings-hint'; sum.style.marginTop = '8px';
    sum.textContent = (atc.grip || atc.motion)
        ? `Changer: ${atc.layout || '—'} layout · ${(GRIPS[atc.grip] || {}).label || atc.grip || '—'} grip · ${(MOTIONS[atc.motion] || {}).label || atc.motion || '—'} motion`
        : 'No changer declared — pick a preset or compose one (layout × grip × motion).';
    container.appendChild(sum);
}
