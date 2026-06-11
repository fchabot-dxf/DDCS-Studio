/**
 * ui/ioTable.js — dynamic Input / Output tables for the Hardware settings.
 *
 * Pure renderer: the caller passes the array (settings.inputs / settings.outputs) and an
 * onChange() callback. renderIoTable mutates the array in place and calls onChange() to persist
 * (settingsPanel wires onChange → syncIO(), which mirrors the rows back to the flat probes/limits
 * the sim + wizards still read until stage 3). Only the rows you've added are shown — no empty pin
 * slots. Pin ranges: inputs 1–24, outputs 1–20; pins already in use are disabled in the picker so a
 * pin can't be double-assigned. Choosing a type in "+ Add" drops a row pre-expanded with its params.
 */

const INPUT_TYPES = [
    { type: 'probe',  label: '3D Probe' },
    { type: 'touch',  label: 'Touch-plate (ground)' },
    { type: 'setter', label: 'Tool Setter' },
    { type: 'limit',  label: 'Limit switch' },
    { type: 'estop',  label: 'E-stop' },
    { type: 'sensor', label: 'Sensor' },
];
const OUTPUT_TYPES = [
    { type: 'coolant',   label: 'Coolant',              onCode: 'M8',   offCode: 'M9' },
    { type: 'drawbar',   label: 'Drawbar (ATC)',        onCode: 'M154', offCode: 'M155' },
    { type: 'dustcover', label: 'Dust cover (ATC)',     onCode: 'M305', offCode: 'M306' },
    { type: 'rotate',    label: 'Carousel rotate (ATC)', onCode: '',    offCode: '' },
    { type: 'mist',      label: 'Mist',                 onCode: 'M7',   offCode: 'M9' },
    { type: 'custom',    label: 'Custom',               onCode: '',     offCode: '' },
];
const LIMIT_AXES = [['x_min', 'X−'], ['x_max', 'X+'], ['y_min', 'Y−'], ['y_max', 'Y+'], ['z_min', 'Z−'], ['z_max', 'Z+']];

const INP = 'padding:3px 6px; border:1px solid #b3a98f; border-radius:3px; font-size:12px; background:#fff; color:#222;';
let _seq = 0;
function uid(p) { return p + '_' + Date.now().toString(36) + (_seq++); }

function field(text, control, w) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:2px; font-size:10px; color:#6b6150;';
    wrap.appendChild(document.createTextNode(text));
    control.style.cssText = INP + (w ? ` width:${w}px;` : '');
    wrap.appendChild(control);
    return wrap;
}

export function renderIoTable(container, kind, list, onChange) {
    if (!container) return;
    const isInput = kind === 'input';
    const TYPES = isInput ? INPUT_TYPES : OUTPUT_TYPES;
    const pinMax = isInput ? 24 : 20;
    const rerender = () => renderIoTable(container, kind, list, onChange);

    container.innerHTML = '';

    if (!list.length) {
        const e = document.createElement('div');
        e.className = 'settings-hint';
        e.textContent = `No ${isInput ? 'inputs' : 'outputs'} yet — use "${isInput ? '+ Add input' : '+ Add output'}" below to add the ones your machine has.`;
        container.appendChild(e);
    }

    list.forEach((row) => {
        const usedByOthers = new Set(list.filter(r => r !== row).map(r => r.pin).filter(p => p !== '' && p != null).map(String));
        const tr = document.createElement('div');
        tr.style.cssText = 'display:flex; align-items:flex-end; gap:8px; flex-wrap:wrap; padding:7px 0; border-bottom:1px solid rgba(0,0,0,0.08);';

        const name = document.createElement('span');
        name.style.cssText = 'min-width:130px; font-weight:600; color:#3a3a3a; padding-bottom:4px;';
        name.textContent = (TYPES.find(t => t.type === row.type) || {}).label || row.type;
        tr.appendChild(name);

        if (isInput && row.type === 'limit') {
            const ax = document.createElement('select');
            LIMIT_AXES.forEach(([a, l]) => { const o = document.createElement('option'); o.value = a; o.textContent = l; if (row.axis === a) o.selected = true; ax.appendChild(o); });
            ax.addEventListener('change', () => { row.axis = ax.value; onChange(); });
            tr.appendChild(field('Axis', ax, 56));
        }

        // Pin picker (free-pin aware: pins used by other rows are disabled)
        const pin = document.createElement('select');
        const none = document.createElement('option'); none.value = ''; none.textContent = '—'; pin.appendChild(none);
        for (let p = 1; p <= pinMax; p++) {
            const o = document.createElement('option'); o.value = String(p); o.textContent = String(p);
            if (usedByOthers.has(String(p))) o.disabled = true;
            if (String(row.pin) === String(p)) o.selected = true;
            pin.appendChild(o);
        }
        pin.addEventListener('change', () => { row.pin = pin.value === '' ? '' : Number(pin.value); onChange(); rerender(); });
        tr.appendChild(field('Pin', pin, 64));

        if (isInput) {
            const lvl = document.createElement('select');
            [['0', 'NC'], ['1', 'NO']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (String(row.level) === v) o.selected = true; lvl.appendChild(o); });
            lvl.addEventListener('change', () => { row.level = Number(lvl.value); onChange(); });
            tr.appendChild(field('Level', lvl, 64));

            if (row.type === 'setter') {
                [['x', 'X'], ['y', 'Y'], ['z', 'Z'], ['w', 'W'], ['h', 'H']].forEach(([k, t]) => {
                    const i = document.createElement('input'); i.type = 'number'; i.step = '0.1'; i.value = row[k] ?? '';
                    i.addEventListener('change', () => { row[k] = i.value === '' ? '' : Number(i.value); onChange(); });
                    tr.appendChild(field(t, i, 52));
                });
            }
        } else {
            const on = document.createElement('input'); on.type = 'text'; on.value = row.onCode ?? '';
            on.addEventListener('change', () => { row.onCode = on.value; onChange(); });
            tr.appendChild(field('ON M-code', on, 78));
            const off = document.createElement('input'); off.type = 'text'; off.value = row.offCode ?? '';
            off.addEventListener('change', () => { row.offCode = off.value; onChange(); });
            tr.appendChild(field('OFF M-code', off, 78));
        }

        const rm = document.createElement('button');
        rm.className = 'toolbar-btn'; rm.textContent = '✕'; rm.title = 'Remove';
        rm.style.cssText = 'margin-left:auto; padding:2px 9px; align-self:center;';
        rm.addEventListener('click', () => { const i = list.indexOf(row); if (i >= 0) list.splice(i, 1); onChange(); rerender(); });
        tr.appendChild(rm);

        container.appendChild(tr);
    });

    // "+ Add" tool: type dropdown → drops a row pre-expanded with that type's params.
    const add = document.createElement('div');
    add.style.cssText = 'display:flex; gap:8px; align-items:center; margin-top:12px;';
    const sel = document.createElement('select'); sel.style.cssText = INP;
    TYPES.forEach(t => { const o = document.createElement('option'); o.value = t.type; o.textContent = t.label; sel.appendChild(o); });
    const btn = document.createElement('button'); btn.className = 'toolbar-btn settings-io';
    btn.textContent = isInput ? '+ Add input' : '+ Add output';
    btn.addEventListener('click', () => {
        const def = TYPES.find(x => x.type === sel.value) || {};
        const row = isInput
            ? { id: uid('in'), type: sel.value, label: def.label, pin: '', level: 0 }
            : { id: uid('out'), type: sel.value, label: def.label, pin: '', onCode: def.onCode || '', offCode: def.offCode || '' };
        if (isInput && sel.value === 'setter') Object.assign(row, { x: 0, y: 0, z: 0, w: 20, h: 20 });
        if (isInput && sel.value === 'limit') row.axis = 'x_min';
        list.push(row); onChange(); rerender();
    });
    add.appendChild(sel); add.appendChild(btn);
    container.appendChild(add);
}
