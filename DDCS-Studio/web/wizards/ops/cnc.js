/**
 * wizards/ops/cnc.js — RS274NGC feature atoms surfaced from the LinuxCNC audit (granular blocks, insertable in
 * Blocks; not auto-wired into wizards yet). PROFILE-AWARE: each folds to an honest comment on posts that can't
 * run it (classic grbl has no G64 P / canned cycles; DDCS uses named M-codes for I/O → use the M-Code atom there).
 *   pathMode   (#3) — G64 P<tol> blend / G61 exact-stop (accuracy vs speed).
 *   drillCycle (#4) — native canned cycle G81 drill / G82 dwell / G83 peck / G85 bore (modal); cancelCycle = G80.
 *   outPin / waitInput (#5) — digital I/O: M62-65 (out) / M66 (wait-in → #5399), the RS274/grblHAL way.
 */
import { num, r3 } from './util.js';

const isOword = (dialect) => !!(dialect.caps && dialect.caps.flow === 'oword');   // RS274NGC family (LinuxCNC / grblHAL)
const noFlow = (dialect) => !!(dialect.caps && dialect.caps.flow === 'none');      // classic grbl (host-side)
const isDDCS = (dialect) => !!(dialect.id && String(dialect.id).startsWith('ddcs'));   // DDCS Expert / V4.1 / DM500

export const pathModeBlock = {
    type: 'pathmode', label: 'Path Mode', kind: 'leaf', category: 'Machine',
    defaults: { mode: 'blend', tol: 0.01 }, fields: ['mode', 'tol'],
    // G64 P<tol> = blend within tolerance (fast); G61 = exact stop (precise). RS274 standard; DDCS/Centroid
    // accept it (Fanuc-style). Classic grbl has no G64 P → fold to a comment.
    emit: (p, dx, dy, dialect) => {
        const exact = p.mode === 'exact';
        if (noFlow(dialect)) return [`( path mode ${exact ? 'exact stop' : 'blend'} - not supported on ${dialect.name} )`];
        if (exact) return ['G61'];
        const tol = num(p.tol, 0.01);
        return [tol > 0 ? `G64 P${r3(tol)}` : 'G64'];
    },
};

export const drillCycleBlock = {
    type: 'drillcycle', label: 'Drill Cycle', kind: 'leaf', category: 'Ops',
    defaults: { cycle: 'peck', x: '', y: '', z: -5, r: 2, q: 1, dwell: 0, feed: 200 },
    fields: ['cycle', 'x', 'y', 'z', 'r', 'q', 'dwell', 'feed'],
    // Native canned cycle (modal): give X/Y to drill at a point, or leave blank to use the current position;
    // cancel with the Cancel Cycle atom (G80). G82 dwell P is in the dialect's dwell units. Classic grbl has no
    // canned cycles → fold to a comment (use the Drill wizard, which expands to plain moves).
    emit: (p, dx, dy, dialect) => {
        if (noFlow(dialect)) return [`( ${p.cycle} drill cycle - no canned cycles on ${dialect.name}; use the Drill wizard )`];
        const G = { drill: 'G81', dwell: 'G82', peck: 'G83', bore: 'G85' }[p.cycle] || 'G81';
        const at = (axis, v) => (v === '' || v == null) ? '' : ` ${axis}${r3(num(v, 0))}`;
        let s = `${G}${at('X', p.x)}${at('Y', p.y)} Z${r3(num(p.z, -5))} R${r3(num(p.r, 2))}`;
        if (p.cycle === 'peck') s += ` Q${r3(num(p.q, 1))}`;
        if (p.cycle === 'dwell') s += ` P${r3(num(p.dwell, 0))}`;   // dwell in this dialect's units (ms / s)
        return [`${s} F${r3(num(p.feed, 200))}`];
    },
};

export const cancelCycleBlock = {
    type: 'cancelcycle', label: 'Cancel Cycle', kind: 'leaf', category: 'Ops',
    defaults: {}, fields: [],
    emit: (p, dx, dy, dialect) => noFlow(dialect) ? [] : ['G80'],   // cancel any modal canned cycle
};

export const outPinBlock = {
    type: 'outpin', label: 'Output Pin', kind: 'leaf', category: 'Machine',
    defaults: { pin: 0, state: 'on', sync: true }, fields: ['pin', 'state', 'sync'],
    // Digital output, per post:
    //   RS274/grblHAL → M62/M63 (synced) / M64/M65 (immediate) P<n>.
    //   DDCS          → raw output bit via M50/M52/M54… (set) / M51/M53/M55… (clear), i.e. M(50+2n)/M(51+2n);
    //                   these map to #1552+n in the firmware I/O macros (slib O10050-O10091). Pins 0-20.
    //   classic grbl  → no generic output → honest hint (use the M-Code atom).
    emit: (p, dx, dy, dialect) => {
        const on = p.state !== 'off';
        const pin = Math.max(0, Math.round(num(p.pin, 0)));
        if (isOword(dialect)) return [`M${p.sync ? (on ? 62 : 63) : (on ? 64 : 65)} P${pin}`];
        if (isDDCS(dialect)) {
            if (pin > 20) return [`( output P${pin} out of range - DDCS raw outputs are pins 0-20 [M50-M91] )`];
            return [`M${(on ? 50 : 51) + pin * 2}   ( output P${pin} ${on ? 'on' : 'off'} )`];
        }
        return [`( output P${pin} ${on ? 'on' : 'off'} - use an M-Code atom on ${dialect.name} )`];
    },
};

export const waitInputBlock = {
    type: 'waitinput', label: 'Wait Input', kind: 'leaf', category: 'Machine',
    defaults: { pin: 0, mode: 'rise', timeout: 0, var: '#5399' }, fields: ['pin', 'mode', 'timeout', 'var'],
    // RS274/grblHAL wait-on-input: M66 P<n> L<mode> Q<timeout> → result in #5399 (L: 0 immediate, 1 rise, 2 fall,
    // 3 high, 4 low). DDCS uses sensor M-codes (M300-302) → use the M-Code atom there (this folds to a hint).
    emit: (p, dx, dy, dialect) => {
        if (!isOword(dialect)) return [`( wait input P${num(p.pin, 0)} - use an M-Code atom on ${dialect.name} )`];
        const L = { imm: 0, rise: 1, fall: 2, high: 3, low: 4 }[p.mode] ?? 1;
        const q = num(p.timeout, 0);
        return [`M66 P${Math.max(0, Math.round(num(p.pin, 0)))} L${L}${q > 0 ? ` Q${r3(q)}` : ''}`];
    },
};
