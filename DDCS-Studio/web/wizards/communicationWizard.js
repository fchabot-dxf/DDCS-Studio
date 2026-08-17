/**
 * DDCS Studio - Communication Wizard
 * Generates G-code for controller communication and UI interactions
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
// t1728 (gameplan step 1) — commStack MOVED to stacks/communicationWizard.js (the twin's own builder dependency,
// kept importable+re-exported here unchanged for every other existing caller — pure move, no signature change).
// CommunicationWizard (the class below) is NOT a legacy screen only — its generateScreenPreview() is also the
// LIVE renderer for the twin's own 'commscreen' panel (userOpView.js), so it stays in place, untouched, either way.
import { commStack, fmtLine, STATUS_PERSISTENT } from './stacks/communicationWizard.js';   // t2030 — fmtLine REUSED for the preview's own single-line formatting, not a second hand-typed copy; t2051 — same for the persistent-status constant
export { commStack };

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
        return emitMapped(commStack(params), activeDialectOpts()).text;
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
                const persistent = modeNum === STATUS_PERSISTENT;
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

    // t2030 — formatMessageForController (a byte-identical, unused 3rd copy of fmtCtrl — zero callers, confirmed by
    // grep across the whole app) removed as an orphan, not collapsed: nothing rendered from it, so there was no call
    // site to redirect. formatMessageSingleLine now calls the imported fmtLine (stacks/communicationWizard.js — the
    // SAME function commStack's own real emit uses) instead of re-deriving the identical regex by hand.
    formatMessageSingleLine(msg) {
        return fmtLine(msg);
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
