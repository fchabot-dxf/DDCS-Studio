/**
 * DDCS Studio - Communication Wizard
 * Generates G-code for controller communication and UI interactions
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { resolveActivePost, getCaps } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };

const fmtCtrl = (msg) => String(msg || '').replace(/\r\n|\r|\n/g, ' / ').replace(/\s*\/\s*/g, ' / ').trim();
const fmtLine = (msg) => String(msg || '').replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Communication (HMI) params → its block SNIPPET (Comment / Set# / If Goto / Goto / Label / Raw). A snippet —
 * no Program Start/End — because it's inserted mid-program. The one source of truth for both displays.
 * #1505 popup / #1503 status / #2070 input / #2042-43 beep — the (msg) goes verbatim in the Set# value.
 */
export function commStack(params = {}, opts = {}) {
    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const IF = (lhs, op, rhs, g) => { const b = newBlock('ifgoto'); b.params = { lhs, op, rhs, goto: g }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const RAW = (t) => { const b = newBlock('raw'); b.params = { text: t }; S.push(b); };
    // t514 — the `message` atom (dialect-aware: hmiToast on HMI posts, an operator comment on non-HMI). Used ONLY in the
    // non-HMI FALLBACK branches below; it was CALLED but never defined → a ReferenceError aborted commStack/generate on any
    // post without caps.hmi (Comm was broken there). Mirrors alignmentWizard's MSG (newBlock('message')).
    const MSG = (t) => { const b = newBlock('message'); b.params = { text: t }; S.push(b); };
    // E0 (t516) — the data-op twin port. `opts.superset` carries the STRUCTURAL forks GUARDED so pruneGuards collapses to the
    // concrete shape (the alignment/rotaryClock E0 pattern): type(popup/status/input/beep/dwell) × the HMI cap × popupMode ×
    // the conditional slots/color/dest/dwell. The guard keys use DERIVED numeric/boolean params (_hmi/_popupMode/_statusMode/
    // _useColor/_hasDwell/_hasDest/_hasCyc, injected by the twin's deriveGuards + the E0 test) so a value-typed fork guards
    // cleanly. Concrete (superset:false) is the untouched imperative build → BYTE-IDENTICAL, and prune(superset)==concrete.
    const GUARD = (when, kids) => { const b = newBlock('guard'); b.params = { when }; b.children = kids; return b; };
    const cap = (fn) => { const n = S.length; fn(); return S.splice(n); };   // capture the blocks fn pushes (for GUARD children)
    const superset = !!opts.superset;

    const dialect = getDialect();
    if (!dialect) { C('Error: No dialect loaded'); return S; }
    const caps = getCaps(dialect.id);

    const type = params.type;
    // ── data slots (#1510-1513) — each present iff its param is truthy (only popup/status/input set them; beep/dwell never do) ──
    const SLOTS = [['slot1', '#1510'], ['slot2', '#1511'], ['slot3', '#1512'], ['slot4', '#1513']];
    if (superset) { for (const [p, v] of SLOTS) S.push(GUARD({ param: p, is: true }, cap(() => A(v, params[p])))); }
    else if (['popup', 'status', 'input'].includes(type)) { for (const [p, v] of SLOTS) if (params[p]) A(v, params[p]); }

    const msg = fmtCtrl(params.msg);

    // ── POPUP arm (its own hmi fork; the HMI side forks on popupMode 1/3/toast) ──
    const popupFallback = () => {
        C(`Fallback: Controller does not support HMI popups`); MSG(msg);
        const m00 = () => RAW('M00 ( Pause for operator acknowledgement )');
        if (superset) S.push(GUARD({ param: '_popupMode', is: 1 }, cap(m00)), GUARD({ param: '_popupMode', is: 3 }, cap(m00)));
        else { const mode = Number(params.popupMode); if (mode === 1 || mode === 3) m00(); }
    };
    const popupHmiOk = () => { C('Popup - OK/Cancel'); RAW(dialect.hmiPrompt(msg, 1).join('\n')); IF('#1505', '==', '0', 9); C('--- action if OK ---'); LB(9); };
    const popupHmiBinary = () => { C('Popup - Binary Choice'); RAW(dialect.hmiPrompt(msg, 3).join('\n')); IF('#1505', '==', '0', 8); C('--- ENTER action ---'); GO(9); LB(8); C('--- ESC action ---'); LB(9); };
    const popupHmiToast = () => { C('Popup - Toast'); RAW(dialect.hmiToast ? dialect.hmiToast(msg).join('\n') : dialect.hmiPrompt(msg, -5000).join('\n')); };
    const popupHmi = () => {
        // the toast arm is the "else" (mode NOT 1 and NOT 3 — e.g. the form's -5000) → un-guardable by a single value, so it
        // rides the DERIVED boolean `_popupToast` (= mode !== 1 && mode !== 3), injected by deriveGuards / the E0 test.
        if (superset) S.push(GUARD({ param: '_popupMode', is: 1 }, cap(popupHmiOk)), GUARD({ param: '_popupMode', is: 3 }, cap(popupHmiBinary)), GUARD({ param: '_popupToast', is: true }, cap(popupHmiToast)));
        else { const mode = Number(params.popupMode); if (mode === 1) popupHmiOk(); else if (mode === 3) popupHmiBinary(); else popupHmiToast(); }
    };
    const popupArm = () => {
        if (superset) S.push(GUARD({ param: '_hmi', is: false }, cap(popupFallback)), GUARD({ param: '_hmi', is: true }, cap(popupHmi)));
        else if (!caps.hmi) popupFallback(); else popupHmi();
    };

    // ── STATUS arm ──
    const line = fmtLine(params.msg);
    const statusMode = (params.statusMode != null && params.statusMode !== '') ? Number(params.statusMode) : 1;
    const statusFallback = () => { C('Fallback: Status bar text not supported'); MSG(line); };
    const statusHmi = () => {
        const setColor = () => A('#2039', Number(params.statusColor), 'Status bar color - BGR');
        const restColor = () => A('#2039', '-1', 'Restore default color');
        const dwellRaw = () => RAW(`G4 P${Number(params.statusDwell)}  ( Dwell - keep message visible )`);
        if (superset) {
            S.push(GUARD({ param: '_useColor', is: true }, cap(setColor)));
            A('#1503', `${statusMode}(${line})`);
            S.push(GUARD({ param: '_useColor', is: true }, cap(restColor)), GUARD({ param: '_hasStatusDwell', is: true }, cap(dwellRaw)));
        } else {
            const useColor = params.statusColor != null && Number(params.statusColor) !== -1;
            const dwell = (params.statusDwell && Number(params.statusDwell) > 0) ? Number(params.statusDwell) : 0;
            if (useColor) setColor();
            A('#1503', `${statusMode}(${line})`);
            if (useColor) restColor();
            if (dwell > 0 && statusMode !== -3000) dwellRaw();
        }
    };
    const statusArm = () => {
        C(statusMode === -3000 ? 'Persistent Status Bar' : 'Status Bar Update');
        if (superset) S.push(GUARD({ param: '_hmi', is: false }, cap(statusFallback)), GUARD({ param: '_hmi', is: true }, cap(statusHmi)));
        else if (!caps.hmi) statusFallback(); else statusHmi();
    };

    // ── INPUT arm ──
    const idNum = Number(String(params.id).replace('#', ''));
    const useId = (Number.isFinite(idNum) && idNum >= 50 && idNum <= 499) ? idNum : 100;
    const inputFallback = () => { C('Fallback: Numeric input not supported'); MSG(`Missing input for #${useId}: ${msg}`); RAW('M00 ( Pause to manually edit variable if needed )'); };
    const inputHmi = () => {
        C('Numeric Input - DDCS Safe');
        RAW(dialect.hmiInput ? dialect.hmiInput(`#${useId}`, msg).join('\n') : `#2070=${useId}(${msg})`);
        const copyDest = () => A(String(params.dest), `#${useId}`, 'Copy to persistent');
        if (superset) S.push(GUARD({ param: '_hasDest', is: true }, cap(copyDest)));
        else if (params.dest && String(params.dest).trim() !== '') copyDest();
    };
    const inputArm = () => {
        if (superset) S.push(GUARD({ param: '_hmi', is: false }, cap(inputFallback)), GUARD({ param: '_hmi', is: true }, cap(inputHmi)));
        else if (!caps.hmi) inputFallback(); else inputHmi();
    };

    // ── BEEP arm (cyc fork) ──
    const beepArm = () => {
        const dur = (params.val != null && params.val !== '') ? params.val : 500;
        const beepCyc = () => { const cyc = Number(params.cycle); C(`System Beep - ${Math.round(dur / (cyc * 2))} pulses of ${cyc}ms`); A('#2043', cyc, 'Pulse width ms'); A('#2042', dur, 'Total duration ms'); };
        const beepPlain = () => { C('System Beep'); A('#2042', dur, 'Beep duration ms'); };
        if (superset) S.push(GUARD({ param: '_hasCyc', is: true }, cap(beepCyc)), GUARD({ param: '_hasCyc', is: false }, cap(beepPlain)));
        else { const cyc = (params.cycle != null && params.cycle !== '') ? Number(params.cycle) : 0; if (cyc > 0) beepCyc(); else beepPlain(); }
    };

    // ── DWELL arm ──
    const dwellArm = () => { C('Dwell'); if (dialect && dialect.dwell) RAW(dialect.dwell(params.val).join('\n')); else RAW(`G4 P${params.val}`); };

    if (superset) {
        S.push(
            GUARD({ param: 'type', is: 'popup' }, cap(popupArm)),
            GUARD({ param: 'type', is: 'status' }, cap(statusArm)),
            GUARD({ param: 'type', is: 'input' }, cap(inputArm)),
            GUARD({ param: 'type', is: 'beep' }, cap(beepArm)),
            GUARD({ param: 'type', is: 'dwell' }, cap(dwellArm)),
        );
    } else if (type === 'popup') popupArm();
    else if (type === 'status') statusArm();
    else if (type === 'input') inputArm();
    else if (type === 'beep') beepArm();
    else if (type === 'dwell') dwellArm();
    else C(`Unknown communication type: ${type}`);
    return S;
}

// CommunicationWizard: Generates UI G-code (popup/status/input/etc.)
// No runtime verifier is invoked here to keep generation deterministic.
export class CommunicationWizard {
    constructor() {
        // No special initialization needed
    }

    // BGR color presets for #2039 status bar color control
    static get COLOR_PRESETS() {
        return [
            { label: 'Default (green)', value: -1        },
            { label: 'Blue',            value: 16711680  },
            { label: 'Green',           value: 65280     },
            { label: 'Red',             value: 255       },
            { label: 'Cyan',            value: 16776960  },
            { label: 'Magenta',         value: 16711935  },
            { label: 'Yellow',          value: 65535     },
            { label: 'Light Blue',      value: 16744576  },
            { label: 'Light Green',     value: 8454016   },
            { label: 'Light Red',       value: 8421631   },
            { label: 'Light Cyan',      value: 16777088  },
            { label: 'Light Magenta',   value: 16744703  },
            { label: 'Light Yellow',    value: 8454143   },
            { label: 'Dark Blue',       value: 8388608   },
            { label: 'Dark Green',      value: 32768     },
            { label: 'Dark Red',        value: 128       },
            { label: 'Dark Cyan',       value: 8421376   },
            { label: 'Dark Magenta',    value: 8388736   },
            { label: 'Dark Yellow',     value: 32896     },
            { label: 'White',           value: 16777215  },
            { label: 'Light Gray',      value: 13882323  },
            { label: 'Gray',            value: 8421504   },
            { label: 'Dark Gray',       value: 4210752   },
            { label: 'Black',           value: 0         },
        ];
    }

    generate(params) {
        recordOp('comm', params);   // let the Blocks tab open this op as its stack
        return emitMapped(commStack(params)).text;
    }

    /**
     * Generate an HTML preview simulating the DDCS controller screen
     */
    generateScreenPreview(params) {
        const { type, msg, val, cycle, id, statusColor, statusMode } = params;
        const safeMsg = (type === 'popup')
            ? (this.formatMessageForPreview(msg) || '&nbsp;')
            : (this.escapeMessageForPreview(this.formatMessageSingleLine(msg)) || '&nbsp;');

        switch (type) {
            case 'popup': {
                const modeNum = Number(params.popupMode);
                let btns = `<div class="comm-dialog-btn">Enter</div>`;
                let btnRowClass = 'comm-dialog-btns popup single';
                if (modeNum === 1) btns = `<div class="comm-dialog-btn">Esc</div><div class="comm-dialog-btn">Enter</div>`;
                if (modeNum === 3) btns = `<div class="comm-dialog-btn">Esc</div><div class="comm-dialog-btn">Enter</div>`;
                if (modeNum === 1 || modeNum === 3) btnRowClass = 'comm-dialog-btns popup';
                const titleLabel = modeNum === 1 ? 'OK / Cancel' : modeNum === 3 ? 'Choice' : 'Message';
                return `<div class="comm-dialog-overlay"><div class="comm-dialog popup-dialog">
                    <div class="comm-dialog-title">${titleLabel}</div>
                    <div class="comm-dialog-body">
                        <div class="comm-dialog-msg">${safeMsg}</div>
                        <div class="${btnRowClass}">${btns}</div>
                    </div>
                </div></div>`;
            }
            case 'input': {
                return `<div class="comm-dialog-overlay"><div class="comm-dialog input-dialog">
                    <div class="comm-dialog-title">Edit</div>
                    <div class="comm-dialog-body">
                        <div class="comm-dialog-msg">${safeMsg}</div>
                        <div class="comm-dialog-input">0_</div>
                        <div class="comm-dialog-btns">
                            <div class="comm-dialog-btn">Esc</div>
                            <div class="comm-dialog-btn">Enter</div>
                        </div>
                    </div>
                </div></div>`;
            }
            case 'status': {
                const colorVal = Number(statusColor);
                let barBg = '#00ff00';
                if (!isNaN(colorVal) && colorVal !== -1) {
                    const b = (colorVal >> 16) & 0xff;
                    const g = (colorVal >> 8) & 0xff;
                    const r = colorVal & 0xff;
                    barBg = `rgb(${r},${g},${b})`;
                }
                const modeNum = Number(statusMode);
                const persistent = modeNum === -3000;
                return `<div class="comm-status-bar" style="background:${barBg}">${safeMsg}${persistent ? ' <span style="opacity:0.6;font-size:0.85em">[persistent]</span>' : ''}&nbsp;</div>`;
            }
            case 'beep': {
                const durNum = Math.max(30, Number(val) || 500);
                const cycleNum = Math.max(0, Number(cycle) || 0);
                const modeLabel = cycleNum > 0 ? `Pulsed: ${cycleNum}ms on / ${cycleNum}ms off` : 'Continuous tone';
                return `<div class="comm-simple-overlay"><div class="comm-simple-stack">
                    <div class="comm-simple-note">🔔 Beep &mdash; ${durNum}ms<br/><span class="comm-simple-sub">${modeLabel}</span></div>
                    <button type="button" class="comm-dialog-btn comm-beep-preview-btn" onclick="window.playCommBeepPreview && window.playCommBeepPreview(${durNum}, ${cycleNum})">Play Sound</button>
                </div></div>`;
            }
            case 'dwell': {
                const sec = val || '?';
                return `<div class="comm-simple-overlay"><div class="comm-simple-note">⏱ Pause &mdash; G4 P${sec}</div></div>`;
            }
            default:
                return '';
        }
    }

    /**
     * Get UI field visibility based on communication type
     */
    getFieldVisibility(type) {
        return {
            showMode:       type === 'popup' || type === 'status',
            showPopupMode:  type === 'popup',
            showStatusMode: type === 'status',
            showValue:      type === 'beep' || type === 'dwell',
            showCycle:      type === 'beep',
            showMessage:    type !== 'dwell' && type !== 'beep',
            showSlots:      ['popup', 'status', 'input'].includes(type),
            showVar:        type === 'input',
            showColor:      type === 'status',
            modeLabel:      type === 'status' ? 'STATUS MODE' : 'POPUP MODE',
            valLabel:       type === 'beep'  ? 'DURATION' : type === 'dwell' ? 'DURATION' : 'VALUE',
            valHint:        type === 'beep'  ? '#2042 total beep duration in ms (e.g. 1000 = 1 sec)' :
                            type === 'dwell' ? 'P is in MS (P3000 = 3 s). A decimal like P1.0 is ~1 ms / instant, NOT 1 s — for N sec use P{N*1000}' : ''
        };
    }

    formatMessageForController(msg) {
        const text = String(msg || '');
        return text
            .replace(/\r\n|\r|\n/g, ' / ')
            .replace(/\s*\/\s*/g, ' / ')
            .trim();
    }

    formatMessageSingleLine(msg) {
        return String(msg || '')
            .replace(/\r\n|\r|\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    escapeMessageForPreview(msg) {
        return String(msg || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    formatMessageForPreview(msg) {
        const escaped = this.escapeMessageForPreview(msg);

        return escaped
            .replace(/\r\n|\r|\n/g, '<br/>')
            .replace(/\s*\/\s*/g, '<br/>');
    }
}
