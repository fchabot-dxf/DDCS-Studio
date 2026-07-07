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
import { SWITCH_TYPES } from '../engine/switchTypes.js';   // H2 (t483) — the declared limit switch-type catalog (mechanical / proximity)

const INPUT_TYPES = [
    { type: 'probe',  label: '3D Probe', help: 'The touch-probe / edge-finder input — its trigger fires G31 to record the touched position (the corner/edge wizards read it).' },
    { type: 'touch',  label: 'Touch-plate (ground)', help: 'A grounded touch-plate input for tool-length / Z-zero touch-off.' },
    { type: 'setter', label: 'Tool Setter' },
    { type: 'limit',  label: 'Limit switch', help: 'An axis limit / home switch input — the machine references off it (pick which axis end below).' },
    { type: 'estop',  label: 'E-stop' },
    { type: 'sensor', label: 'Sensor', help: 'A digital input the program WAITS on before continuing. The ATC change waits on three: drawbar released (M301), drawbar clamped (M302), spindle stopped (M300).' },
];
export const OUTPUT_TYPES = [
    { type: 'coolant',   label: 'Coolant',              onCode: 'M8',   offCode: 'M9',   help: 'Flood coolant — the ON code turns it on, the OFF code off (typically M8 / M9).' },
    { type: 'drawbar',   label: 'Drawbar (ATC)',        onCode: 'M154', offCode: 'M155', help: 'The spindle drawbar solenoid — its ON code RELEASES (unclamps) the tool, its OFF code CLAMPS it. The ATC change pulses this to swap tools.' },
    { type: 'dustcover', label: 'Dust cover (ATC)',     onCode: 'M162', offCode: 'M163', help: 'The dust-cover / chip-shield actuator — opened (ON) before a tool change, closed (OFF) after.' },
    { type: 'rotate',    label: 'Carousel rotate (ATC)', onCode: '',    offCode: '',     help: 'Carousel-rotate output for a disk magazine — indexes the target pocket to the fixed pickup station.' },
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

        // Editable label — bound to row.label (default = the type label). ONE SOURCE: row.label shows in BOTH this
        // config UI and the I/O panel (ioTab reads r.label). Edit to rename a pin (e.g. "Pusher", "Locating pin").
        const typeDef = TYPES.find(t => t.type === row.type) || {};
        const typeLabel = typeDef.label || row.type;
        const nameWrap = document.createElement('div');
        nameWrap.style.cssText = 'display:flex; align-items:center; gap:6px; min-width:150px; padding-bottom:4px;';
        const name = document.createElement('input');
        name.type = 'text';
        name.value = (row.label != null && row.label !== '') ? row.label : typeLabel;
        // DECLARED HELP SLOT (1b): the optional `help` on the I/O TYPE CATALOG entry renders as a native tooltip on the
        // row label (what the pin DOES on the machine); types without help keep the plain rename hint (unchanged).
        name.title = typeDef.help || 'Label — shown in the I/O panel (edit to rename this pin)';
        name.style.cssText = INP + ' min-width:120px; font-size:13px; font-weight:600; color:#3a3a3a;';   // legible (t187)
        name.addEventListener('change', () => { row.label = name.value; onChange(); });
        nameWrap.appendChild(name);
        if (row.group) {
            const badge = document.createElement('span');
            badge.textContent = row.group.toUpperCase();
            badge.style.cssText = 'font-size:9px; font-weight:700; background:#6b7b3a; color:#fff; padding:1px 5px; border-radius:3px; flex:none;';
            nameWrap.appendChild(badge);
        }
        tr.appendChild(nameWrap);

        if (isInput && row.type === 'limit') {
            const ax = document.createElement('select');
            LIMIT_AXES.forEach(([a, l]) => { const o = document.createElement('option'); o.value = a; o.textContent = l; if (row.axis === a) o.selected = true; ax.appendChild(o); });
            ax.addEventListener('change', () => { row.axis = ax.value; onChange(); });
            tr.appendChild(field('Axis', ax, 56));

            // H2 (t483) — the per-EDGE switch-type picker (mechanical AT the edge / proximity Sn BEFORE it). Stored as
            // row.switchType; syncs to settings.limits.<edge>SwitchType → the sim's trip standoff. SIM-CONFIG only (no macro).
            const stw = document.createElement('select');
            SWITCH_TYPES.forEach((s) => { const o = document.createElement('option'); o.value = s.type; o.textContent = s.label; o.title = s.help || ''; if ((row.switchType || 'mechanical') === s.type) o.selected = true; stw.appendChild(o); });
            stw.addEventListener('change', () => { row.switchType = stw.value; onChange(); });
            tr.appendChild(field('Switch type', stw, 104));
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
        if (isInput && sel.value === 'limit') Object.assign(row, { axis: 'x_min', switchType: 'mechanical' });
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
    const cnt = document.createElement('input'); cnt.type = 'number'; cnt.min = '0'; cnt.max = '99'; cnt.value = atc.magazine.length; cnt.setAttribute('data-atc-count', '');
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
        const axSel = document.createElement('select');
        [['+y', '+Y'], ['-y', '-Y'], ['+x', '+X'], ['-x', '-X']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if ((atc.diskAxis || '+y') === v) o.selected = true; axSel.appendChild(o); });
        axSel.addEventListener('change', () => { atc.diskAxis = axSel.value; onChange(); });
        pkr.appendChild(field('Disk toward', axSel, 64));
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

    // Linear racks sit on a LINE — a PARAMETRIC fill (regular = the common case): keep pocket 1 as the origin, then
    // evenly space the rest over a total LENGTH along one axis (pitch = length ÷ (count − 1)). The controller still
    // stores each pocket individually (#1330+ tables, usually taught by jogging / pulled), so you can fine-tune any
    // row after (the irregular override) — this just saves typing the evenly-spaced ones.
    if (!isDisk && atc.magazine.length > 1) {
        const lf = document.createElement('div');
        lf.style.cssText = 'display:flex; gap:8px; align-items:flex-end; margin:6px 0 4px; flex-wrap:wrap;';
        const axSel = document.createElement('select'); axSel.setAttribute('data-atc-line-axis', '');
        [['x', 'X'], ['y', 'Y'], ['z', 'Z']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if ((atc._lineAxis || 'x') === v) o.selected = true; axSel.appendChild(o); });
        axSel.addEventListener('change', () => { atc._lineAxis = axSel.value; });
        const len = document.createElement('input'); len.type = 'number'; len.step = '1'; len.min = '0'; len.value = atc._lineLength ?? ''; len.setAttribute('data-atc-len', '');
        len.addEventListener('change', () => { atc._lineLength = len.value === '' ? '' : Number(len.value); });
        const btn = document.createElement('button'); btn.className = 'toolbar-btn settings-io'; btn.textContent = '↳ Fill line from P1'; btn.setAttribute('data-atc-fill', '');
        btn.title = 'Regular rack: keep pocket 1 as the origin, then evenly space the rest over LENGTH along the axis (pitch = length ÷ (count − 1)). Edit any row after for an irregular pocket, or Pull the taught positions from the controller.';
        btn.addEventListener('click', () => {
            const ax = axSel.value, n = atc.magazine.length, L = Number(len.value) || 0, p0 = atc.magazine[0];
            const pp = n > 1 ? L / (n - 1) : 0;
            atc.magazine.forEach((row, i) => { if (i === 0) return; row.x = p0.x; row.y = p0.y; row.z = p0.z; row[ax] = Math.round(((Number(p0[ax]) || 0) + i * pp) * 1000) / 1000; });
            onChange(); rerender();
        });
        lf.appendChild(field('Line axis', axSel, 56));
        lf.appendChild(field('Length (mm)', len, 80));
        lf.appendChild(btn);
        container.appendChild(lf);
    }

    atc.magazine.forEach((row, i) => {
        row.pocket = i + 1;
        const tr = document.createElement('div');
        tr.style.cssText = 'display:flex; gap:8px; align-items:center; padding:3px 2px; border-bottom:1px solid rgba(0,0,0,0.08);';
        const pk = document.createElement('span'); pk.textContent = i + 1; pk.style.cssText = 'width:46px; font-weight:600; color:#3a3a3a;'; tr.appendChild(pk);

        // Tool = a picker into the tool library (T-number); Description shows what that tool is.
        // A7: a pocket may reference a tool# that was DELETED from the library — the picker would silently
        // drop it (looks empty though row.tool is still set). Detect that orphan, keep it visible as a flagged
        // option, and mark the row so the user knows the reference is dangling.
        const has = row.tool !== '' && row.tool != null;
        const orphan = has && !getTool(row.tool);
        const sel = document.createElement('select');
        sel.innerHTML = toolOptionsHTML('— empty —')
            + (orphan ? `<option value="${row.tool}">⚠ T${row.tool} — not in library</option>` : '');
        sel.value = has ? String(row.tool) : '';
        sel.style.cssText = INP + ' width:158px;' + (orphan ? ' border-color:var(--danger,#ef4444); color:var(--danger,#ef4444);' : '');
        const desc = document.createElement('span'); desc.style.cssText = 'width:150px; font-size:11px; color:#6b6150; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        const fillDesc = () => {
            const t = getTool(row.tool);
            if (t) { desc.style.color = '#6b6150'; desc.removeAttribute('title'); desc.textContent = [t.type, t.flutes !== '' ? t.flutes + 'F' : '', t.feed !== '' ? 'F' + t.feed : ''].filter(Boolean).join(' · ') || t.name || '—'; }
            else if (row.tool !== '' && row.tool != null) { desc.style.color = 'var(--danger,#ef4444)'; desc.title = `Tool #${row.tool} is not in the library — pick a tool or clear this pocket.`; desc.textContent = `⚠ tool #${row.tool} not in library`; }
            else { desc.style.color = '#6b6150'; desc.removeAttribute('title'); desc.textContent = '(empty)'; }
        };
        fillDesc();
        if (orphan) tr.style.background = 'rgba(239,68,68,0.08)';
        sel.addEventListener('change', () => { row.tool = sel.value === '' ? '' : Number(sel.value); rerender(); onChange(); });
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

const _code = (x) => parseInt(String(x || '').replace(/[^0-9]/g, ''), 10);

// DECLARED ATC I/O function catalog for the pin-picker (GUI-3) — each function carries its canonical M-code(s) so the
// io-tab labeling join (onCode / waitCode → ATC_DIALECT → the semantic pin) LIGHTS the assigned pin. rotate / pocket-
// index have no M-code (special disk I/O) → matched by type; assignable but label-only in the io-tab. This is the ONE
// place the picker's function set is declared; rows are found/created against the SAME settings.outputs/inputs the
// general I/O table + the labeling use (no duplicated data).
const ATC_IO_FUNCTIONS = {
    output: [
        { key: 'drawbar', label: 'Drawbar (unclamp / clamp)', onCode: 'M154', offCode: 'M155', type: 'drawbar' },
        { key: 'dust', label: 'Dust cover', onCode: 'M162', offCode: 'M163', type: 'dustcover' },
        { key: 'pusher', label: 'Pusher cylinder', onCode: 'M160', offCode: 'M161', type: 'custom' },
        { key: 'pin', label: 'Locating pin', onCode: 'M156', offCode: 'M157', type: 'custom' },
        { key: 'vacuum', label: 'Vacuum pump', onCode: 'M158', offCode: 'M159', type: 'custom' },
        { key: 'gripper', label: 'Gripper (open / close)', onCode: 'M150', offCode: 'M151', type: 'custom' },
        { key: 'rotate', label: 'Carousel rotate', onCode: '', offCode: '', type: 'rotate' },
    ],
    input: [
        { key: 'spindle_stopped', label: 'Spindle stopped', waitCode: 'M300' },
        { key: 'drawbar_released', label: 'Drawbar released', waitCode: 'M301' },
        { key: 'drawbar_clamped', label: 'Drawbar clamped', waitCode: 'M302' },
        { key: 'mag_open', label: 'Magazine open', waitCode: 'M303' },
        { key: 'mag_closed', label: 'Magazine closed', waitCode: 'M304' },
        { key: 'gripper_open', label: 'Gripper open', waitCode: 'M305' },
        { key: 'gripper_closed', label: 'Gripper closed', waitCode: 'M306' },
        { key: 'pocket_index', label: 'Pocket index', waitCode: '', type: 'sensor' },
    ],
};

// Find the existing config row for an ATC function by its canonical M-code (the join key — relabel-proof), else by
// type for the M-code-less rotate/index. null = not yet a row.
function _findAtcRow(list, fn, kind) {
    if (kind === 'output') return fn.onCode ? list.find((r) => _code(r.onCode) === _code(fn.onCode)) : list.find((r) => r.group === 'atc' && r.type === fn.type);
    return fn.waitCode ? list.find((r) => r.group === 'atc' && _code(r.waitCode) === _code(fn.waitCode)) : list.find((r) => r.group === 'atc' && r.type === (fn.type || 'sensor') && !r.waitCode);
}
function _makeAtcRow(fn, kind) {
    return kind === 'output'
        ? { id: uid('out'), type: fn.type || 'custom', label: fn.label, pin: '', onCode: fn.onCode || '', offCode: fn.offCode || '', group: 'atc' }
        : { id: uid('in'), type: fn.type || 'sensor', label: fn.label, pin: '', level: 0, group: 'atc', waitCode: fn.waitCode || '' };
}

/**
 * A FOCUSED ATC I/O pin-picker (GUI-3) — assign the ATC I/O pins visually, a PEER editor of the general I/O tables.
 * It writes the SAME settings.outputs / settings.inputs `.pin` the io-labeling reads, so assigning a pin here LIGHTS
 * it in the I/O panel (the P-C.2c/d join). ONE SOURCE — no duplicated data. Free/taken aware: a pin already used by
 * any row of that kind is DISABLED so a pin can't map to two functions (conflict prevented). Rows are matched by their
 * canonical M-code (relabel-proof) and created on first assignment. SIM/UI only — emit byte-identical.
 */
export function renderAtcPinPicker(container, { outputs, inputs, onChange } = {}) {
    if (!container) return;
    const rerender = () => renderAtcPinPicker(container, { outputs, inputs, onChange });
    container.innerHTML = '';
    const section = (title, kind, list) => {
        const pinMax = kind === 'input' ? 24 : 20;
        const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'font-size:11px; font-weight:700; color:#6b7280; margin:8px 0 5px;';
        container.appendChild(h);
        const grid = document.createElement('div'); grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:6px 16px;';
        ATC_IO_FUNCTIONS[kind].forEach((fn) => {
            const row = _findAtcRow(list, fn, kind);
            const cur = row && row.pin !== '' && row.pin != null ? String(row.pin) : '';
            const taken = new Set(list.filter((r) => r !== row).map((r) => r.pin).filter((p) => p !== '' && p != null).map(String));
            const lab = document.createElement('label');
            lab.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; color:var(--text-main,#334155);';
            lab.appendChild(document.createTextNode(fn.label));
            const sel = document.createElement('select');
            sel.setAttribute('data-atc-pin', fn.key);
            sel.style.cssText = INP + ' width:88px;';
            const none = document.createElement('option'); none.value = ''; none.textContent = '—'; sel.appendChild(none);
            for (let p = 1; p <= pinMax; p++) {
                const o = document.createElement('option'); o.value = String(p);
                o.textContent = taken.has(String(p)) ? p + ' (taken)' : String(p);
                if (taken.has(String(p))) o.disabled = true;
                if (cur === String(p)) o.selected = true;
                sel.appendChild(o);
            }
            sel.addEventListener('change', () => {
                let r = _findAtcRow(list, fn, kind);
                if (sel.value === '') { if (r) r.pin = ''; }
                else { if (!r) { r = _makeAtcRow(fn, kind); list.push(r); } r.pin = Number(sel.value); }
                if (onChange) onChange();
                rerender();
            });
            lab.appendChild(sel);
            grid.appendChild(lab);
        });
        container.appendChild(grid);
    };
    section('Outputs (pins 1–20)', 'output', outputs);
    section('Inputs (pins 1–24)', 'input', inputs);
}
