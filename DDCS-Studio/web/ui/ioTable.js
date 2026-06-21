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
import { toolOptionsHTML, getTool } from '../wizards/toolPicker.js';

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
        tr.style.cssText = 'display:flex; align-items:flex-end; gap:8px 12px; flex-wrap:wrap; padding:10px 12px; margin-bottom:9px; border:1px solid rgba(90,75,40,0.2); border-radius:7px; background:rgba(255,255,255,0.72); box-shadow:0 1px 3px rgba(0,0,0,0.09);';

        const name = document.createElement('span');
        name.style.cssText = 'min-width:130px; font-weight:600; color:#3a3a3a; padding-bottom:4px;';
        name.textContent = (TYPES.find(t => t.type === row.type) || {}).label || row.type;
        if (row.group) {
            const badge = document.createElement('span');
            badge.textContent = row.group.toUpperCase();
            badge.style.cssText = 'margin-left:6px; font-size:9px; font-weight:700; background:#6b7b3a; color:#fff; padding:1px 5px; border-radius:3px; vertical-align:middle;';
            name.appendChild(badge);
        }
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

/**
 * ATC magazine table: magazine type (straight/disk) + pocket count + a row per pocket
 * (pocket # · tool # · name · park X/Y/Z). Mutates atc.magType / atc.magazine[] and calls onChange()
 * (settingsPanel handles the disk-only auto-add of rotate output + index sensor).
 */
export function renderMagazineTable(container, atc, onChange) {
    if (!container) return;
    if (!Array.isArray(atc.magazine)) atc.magazine = [];
    const rerender = () => renderMagazineTable(container, atc, onChange);
    container.innerHTML = '';

    const ctl = document.createElement('div');
    ctl.style.cssText = 'display:flex; gap:16px; align-items:flex-end; margin-bottom:12px; flex-wrap:wrap;';
    const typeSel = document.createElement('select');
    [['straight', 'Straight / linear'], ['disk', 'Disk / carousel']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if ((atc.magType || 'straight') === v) o.selected = true; typeSel.appendChild(o); });
    typeSel.addEventListener('change', () => { atc.magType = typeSel.value; onChange(); rerender(); });
    ctl.appendChild(field('Magazine type', typeSel, 150));
    const cnt = document.createElement('input'); cnt.type = 'number'; cnt.min = '0'; cnt.max = '99'; cnt.value = atc.magazine.length;
    cnt.addEventListener('change', () => {
        const n = Math.max(0, Math.min(99, parseInt(cnt.value, 10) || 0));
        while (atc.magazine.length < n) { const k = atc.magazine.length + 1; atc.magazine.push({ pocket: k, tool: '', name: '', x: '', y: '', z: '' }); }
        atc.magazine.length = n;
        onChange(); rerender();
    });
    ctl.appendChild(field('Pockets', cnt, 60));
    container.appendChild(ctl);

    const isDisk = atc.magType === 'disk';
    if (isDisk) {
        // Disk/carousel: ONE fixed pickup; the carousel rotates each pocket to it by index. So no per-pocket XYZ —
        // just the shared pickup + which tool is in each pocket.
        atc.pickup = atc.pickup || { x: '', y: '', z: '' };
        const pkr = document.createElement('div');
        pkr.style.cssText = 'display:flex; gap:16px; align-items:flex-end; margin-bottom:10px; flex-wrap:wrap;';
        const pcell = (key) => { const inp = document.createElement('input'); inp.type = 'number'; inp.step = '0.1'; inp.value = atc.pickup[key] ?? ''; inp.addEventListener('change', () => { atc.pickup[key] = inp.value === '' ? '' : Number(inp.value); onChange(); }); return inp; };
        pkr.appendChild(field('Pickup X', pcell('x'), 70));
        pkr.appendChild(field('Pickup Y', pcell('y'), 70));
        pkr.appendChild(field('Pickup Z', pcell('z'), 70));
        const dia = document.createElement('input'); dia.type = 'number'; dia.step = '1'; dia.min = '0'; dia.value = atc.diskDia ?? '';
        dia.addEventListener('change', () => { atc.diskDia = dia.value === '' ? '' : Number(dia.value); onChange(); });
        pkr.appendChild(field('Carousel Ø', dia, 80));
        container.appendChild(pkr);
        const note = document.createElement('div'); note.className = 'settings-hint';
        note.textContent = 'Disk: one fixed pickup — the carousel (Ø) rotates each pocket to it by index, so per-pocket XYZ aren’t needed (just the pickup + which tool is in each pocket).';
        container.appendChild(note);
    }

    if (!atc.magazine.length) {
        const e = document.createElement('div'); e.className = 'settings-hint'; e.textContent = 'Set the pocket count to build the magazine table.'; container.appendChild(e);
        return;
    }

    const COLS = isDisk
        ? [['Pocket', 46], ['Tool', 168], ['Description', 150]]
        : [['Pocket', 46], ['Tool', 168], ['Description', 150], ['Park X', 66], ['Park Y', 66], ['Park Z', 66]];
    const head = document.createElement('div');
    head.style.cssText = 'display:flex; gap:8px; font-size:10px; color:#6b6150; font-weight:600; padding:2px;';
    COLS.forEach(([h, w]) => { const s = document.createElement('span'); s.textContent = h; s.style.width = w + 'px'; head.appendChild(s); });
    container.appendChild(head);

    atc.magazine.forEach((row, i) => {
        row.pocket = i + 1;
        const tr = document.createElement('div');
        tr.style.cssText = 'display:flex; gap:8px; align-items:center; padding:3px 2px; border-bottom:1px solid rgba(0,0,0,0.08);';
        const pk = document.createElement('span'); pk.textContent = i + 1; pk.style.cssText = 'width:46px; font-weight:600; color:#3a3a3a;'; tr.appendChild(pk);

        // Tool = a picker into the tool library (T-number); Description shows what that tool is.
        const sel = document.createElement('select'); sel.innerHTML = toolOptionsHTML('— empty —');
        sel.value = (row.tool === '' || row.tool == null) ? '' : String(row.tool);
        sel.style.cssText = INP + ' width:158px;';
        const desc = document.createElement('span'); desc.style.cssText = 'width:150px; font-size:11px; color:#6b6150; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        const fillDesc = () => {
            const t = getTool(row.tool);
            desc.textContent = t ? ([t.type, t.flutes !== '' ? t.flutes + 'F' : '', t.feed !== '' ? 'F' + t.feed : ''].filter(Boolean).join(' · ') || t.name || '—') : '(empty)';
        };
        fillDesc();
        sel.addEventListener('change', () => { row.tool = sel.value === '' ? '' : Number(sel.value); fillDesc(); onChange(); });
        tr.appendChild(sel); tr.appendChild(desc);

        const cell = (key, w) => {
            const inp = document.createElement('input'); inp.type = 'number'; inp.step = '0.1';
            inp.value = row[key] ?? ''; inp.style.cssText = INP + ` width:${w}px;`;
            inp.addEventListener('change', () => { row[key] = inp.value === '' ? '' : Number(inp.value); onChange(); });
            return inp;
        };
        if (!isDisk) { tr.appendChild(cell('x', 58)); tr.appendChild(cell('y', 58)); tr.appendChild(cell('z', 58)); }

        // Reorganise: ▲/▼ swap the TOOL assignment with the neighbouring pocket (the physical pocket position +
        // its park XYZ stay put — you're moving which tool lives in which pocket, not moving the pocket).
        const moves = document.createElement('span');
        moves.style.cssText = 'display:flex; gap:3px; margin-left:6px;';
        const mk = (txt, ttl, dir) => {
            const b = document.createElement('button'); b.className = 'toolbar-btn'; b.textContent = txt; b.title = ttl;
            b.style.cssText = 'padding:1px 7px; align-self:center;';
            if ((dir < 0 && i === 0) || (dir > 0 && i === atc.magazine.length - 1)) b.disabled = true;
            b.addEventListener('click', () => {
                const j = i + dir; if (j < 0 || j >= atc.magazine.length) return;
                const a = atc.magazine[i], b2 = atc.magazine[j];
                [a.tool, b2.tool] = [b2.tool, a.tool];
                [a.name, b2.name] = [b2.name, a.name];
                onChange(); rerender();
            });
            return b;
        };
        moves.appendChild(mk('▲', 'Move this tool up a pocket', -1));
        moves.appendChild(mk('▼', 'Move this tool down a pocket', 1));
        tr.appendChild(moves);
        container.appendChild(tr);
    });
}
