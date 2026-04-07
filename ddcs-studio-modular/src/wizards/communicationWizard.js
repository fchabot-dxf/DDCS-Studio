/**
 * DDCS Studio - Communication Wizard
 * Generates G-code for controller communication and UI interactions
 */

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
        const {
            type,        // popup, status, input, beep, alarm, dwell, keywait
            msg,         // Message text
            val,         // Value (for beep/dwell)
            cycle,       // Cycle pulse width ms (for beep type, #2043)
            popupMode,   // Popup mode (for popup type)
            id,          // Variable ID (for input type)
            dest,        // Destination variable (for input type)
            slot1,       // Data slot 1 (#1510)
            slot2,       // Data slot 2 (#1511)
            slot3,       // Data slot 3 (#1512)
            slot4,       // Data slot 4 (#1513)
            statusColor, // BGR color value for #2039 (status type only, -1 = default)
            statusMode,  // 1 = standard, -3000 = persistent
            statusDwell  // dwell ms after #1503 (standard mode only)
        } = params;

        let gcode = '';

        // Generate slots code if supported
        const supportsSlots = ['popup', 'status', 'input'].includes(type);
        const slotsCode = this.generateSlotsCode(supportsSlots, slot1, slot2, slot3, slot4);

        // Generate specific communication type
        switch (type) {
            case 'popup':
                gcode = this.generatePopup(slotsCode, popupMode, msg);
                break;
            case 'status':
                gcode = this.generateStatus(slotsCode, msg, statusColor, statusMode, statusDwell);
                break;
            case 'input':
                gcode = this.generateInput(slotsCode, id, dest, msg);
                break;
            case 'beep':
                gcode = this.generateBeep(val, cycle);
                break;
            case 'dwell':
                gcode = this.generateDwell(val);
                break;
            default:
                gcode = `( Unknown communication type: ${type} )`;
        }

        return gcode;
    }

    generateSlotsCode(supportsSlots, slot1, slot2, slot3, slot4) {
        if (!supportsSlots) return '';

        let slotsCode = '';
        if (slot1) slotsCode += `#1510=${slot1}\n`;
        if (slot2) slotsCode += `#1511=${slot2}\n`;
        if (slot3) slotsCode += `#1512=${slot3}\n`;
        if (slot4) slotsCode += `#1513=${slot4}\n`;

        return slotsCode;
    }

    generatePopup(slotsCode, mode, msg) {
        const formattedMsg = this.formatMessageForController(msg);
        const modeNum = Number(mode);
        if (modeNum === 1) {
            let gcode = `${slotsCode}( Popup - OK/Cancel )\n`;
            gcode += `#1505=1(${formattedMsg})\n`;
            gcode += `IF #1505==0 GOTO9  ( ESC = cancel )\n`;
            gcode += `( --- action if OK --- )\n`;
            gcode += `N9 ( end )`;
            return gcode;
        }
        if (modeNum === 3) {
            let gcode = `${slotsCode}( Popup - Binary Choice )\n`;
            gcode += `#1505=3(${formattedMsg})\n`;
            gcode += `IF #1505==0 GOTO8  ( ESC branch )\n`;
            gcode += `( --- ENTER action --- )\n`;
            gcode += `GOTO9\n`;
            gcode += `N8 ( --- ESC action --- )\n`;
            gcode += `N9 ( end )`;
            return gcode;
        }
        // Toast: -5000, display only, no wait
        let gcode = `${slotsCode}( Popup - Toast )\n`;
        gcode += `#1505=-5000(${formattedMsg})`;
        return gcode;
    }

    generateStatus(slotsCode, msg, color, mode, dwell) {
        const formattedMsg = this.formatMessageSingleLine(msg);
        const useColor = color !== undefined && color !== null && Number(color) !== -1;
        const modeNum = (mode !== undefined && mode !== null && mode !== '') ? Number(mode) : 1;
        const dwellVal = (dwell !== undefined && dwell !== null && dwell !== '' && Number(dwell) > 0) ? Number(dwell) : 0;
        const modeLabel = modeNum === -3000 ? 'Persistent Status Bar' : 'Status Bar Update';
        let gcode = `${slotsCode}( ${modeLabel} )\n`;
        if (useColor) gcode += `#2039=${Number(color)}  ( Status bar color — BGR )\n`;
        gcode += `#1503=${modeNum}(${formattedMsg})`;
        if (useColor) gcode += `\n#2039=-1  ( Restore default color )`;
        if (dwellVal > 0 && modeNum !== -3000) gcode += `\nG4 P${dwellVal}  ( Dwell — keep message visible )`;
        return gcode;
    }

    generateInput(slotsCode, id, dest, msg) {
        const formattedMsg = this.formatMessageForController(msg);
        const idNum = Number(String(id).replace('#', ''));
        let gcode = `${slotsCode}( Numeric Input - DDCS Safe )\n`;
        if (Number.isFinite(idNum) && idNum >= 50 && idNum <= 499) {
            gcode += `#2070=${idNum}(${formattedMsg})`;
            if (dest && String(dest).trim() !== '') {
                gcode += `\n${dest}=#${idNum}  ( Copy to persistent )`;
            }
        } else {
            const temp = 100;
            gcode += `#2070=${temp}(${formattedMsg})`;
            if (dest && String(dest).trim() !== '') {
                gcode += `\n${dest}=#${temp}  ( Copy to persistent )`;
            }
        }
        return gcode;
    }

    generateBeep(val, cycle) {
        const duration = (val !== undefined && val !== null && val !== '') ? val : 500;
        const cycleNum = (cycle !== undefined && cycle !== null && cycle !== '') ? Number(cycle) : 0;
        if (cycleNum > 0) {
            const pulses = Math.round(duration / (cycleNum * 2));
            return `( System Beep - ${pulses} pulses of ${cycleNum}ms )\n#2043=${cycleNum}  ( Pulse width ms )\n#2042=${duration}  ( Total duration ms )`;
        }
        return `( System Beep )\n#2042=${duration}  ( Beep duration ms )`;
    }

    generateDwell(val) {
        // G4 P — units unclear: SPINDLE_WARMUP uses P30 = '30 seconds', Q.G. Zhang uses P3000 for 3s (ms)
        // Decimal values (P1.0) likely seconds, integer values (P3000) likely milliseconds
        return `( Dwell )\nG4 P${val}`;
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
                            type === 'dwell' ? 'e.g. P1.0 or P3000 — units unconfirmed (seconds or ms)' : ''
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
