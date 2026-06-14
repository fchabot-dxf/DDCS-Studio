/**
 * DDCS Studio - WCS (Work Coordinate System) Wizard
 * V9.20 - DDCS Compliant (Direct #805+ writes, NO G10)
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `wcsStack(params)` → a snippet of Comment +
 * Set# (assign) atoms, emitted bare (no program header/footer — it's a macro snippet, not a cutting program).
 * The form and the Blocks view are two editors of this one stack. No motion: pure #805+ register writes.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';

/** WCS params → [ Comment | Set# … ]. The one source of truth for both displays. */
export function wcsStack(params = {}) {
    const auto = params.sys === '0';
    const axes = [];
    if (params.axisX) axes.push({ off: 0, var: '#880' });
    if (params.axisY) axes.push({ off: 1, var: '#881' });
    if (params.axisZ) axes.push({ off: 2, var: '#882' });

    const S = [];
    const C = (text) => { const b = newBlock('comment'); b.params = { text }; S.push(b); };
    const A = (v, value, note) => { const b = newBlock('assign'); b.params = { var: v, value, note: note || '' }; S.push(b); };

    C('WCS | Direct #805+ writes');
    C('M350 Ready - G10 not used');
    if (auto) {
        C('Auto-detect active WCS from #578');
        A('#150', '#578');
        A('#151', '805+[#150-1]*5');
        C('Zero selected axes');
        axes.forEach((a) => A(`#[#151+${a.off}]`, a.var));
    } else {
        const base = 805 + (parseInt(params.sys, 10) - 53 - 1) * 5;
        C(`Fixed WCS: G${params.sys} - Base address #${base}`);
        C('Zero selected axes');
        axes.forEach((a) => A(`#${base + a.off}`, a.var));
    }
    if (params.sync) {
        const slave = params.slave, slaveOffset = slave === '3' ? 3 : 4;
        C(`Dual Gantry Sync - Slave ${slave === '3' ? 'A' : 'B'}`);
        if (auto) {
            A('#152', `[#151+${slaveOffset}]`, 'Base WCS + Slave Offset');
            A('#[#152]', `#88${slave}`);
        } else {
            const base = 805 + (parseInt(params.sys, 10) - 53 - 1) * 5;
            A(`#${base + slaveOffset}`, `#88${slave}`);
        }
    }
    return S;
}

export class WCSWizard {
    constructor() {
        this.wcsBaseMap = { '54': 805, '55': 810, '56': 815, '57': 820, '58': 825, '59': 830 };
    }

    generate(params) {
        recordOp('wcs', params);   // let the Blocks tab open this op as its stack
        return emitMapped(wcsStack(params), { bare: true }).text;
    }

    getWCSName(sys) { return sys === '0' ? 'Active WCS' : `G${sys}`; }
    getWCSBase(sys) { return sys === '0' ? 'Auto-detected' : (this.wcsBaseMap[sys] || 'Unknown'); }
    isValidWCS(sys) { return sys === '0' || (sys >= '54' && sys <= '59'); }
}
