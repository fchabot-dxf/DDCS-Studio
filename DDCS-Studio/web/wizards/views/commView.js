/**
 * views/commView.js — Communication wizard view.
 * Owns the DOM ids, field-visibility logic, preview and generation glue that
 * used to live in WizardManager.updateCommunicationWizard().
 */
import { el } from '../../ui/uiUtils.js';
import { CommunicationWizard } from '../communicationWizard.js';

const wizard = new CommunicationWizard();

export const commView = {
    type: 'comm',
    panelId: 'wiz_comm',
    codeElId: 'wiz_comm_code',
    large: false,
    inputIds: [
        'c_type', 'c_msg', 'c_val', 'c_cycle', 'c_id', 'c_dest', 'c_popup_mode',
        'c_status_mode', 'c_status_dwell', 'c_status_color',
        'c_slot1', 'c_slot2', 'c_slot3', 'c_slot4',
    ],

    /** Default message text + dwell-default clearing (runs when the panel is shown). */
    onShow() {
        const msgEl = el('c_msg');
        if (msgEl && !msgEl.value) {
            msgEl.value = 'Enter message...';
            msgEl.dataset.isDefault = 'true';
            if (!msgEl._defaultClearBound) {
                msgEl._defaultClearBound = true;
                msgEl.addEventListener('keydown', function clearDefault() {
                    if (msgEl.dataset.isDefault === 'true') {
                        msgEl.value = '';
                        delete msgEl.dataset.isDefault;
                    }
                }, { once: false });
                msgEl.addEventListener('focus', function () {
                    if (msgEl.dataset.isDefault === 'true') msgEl.select();
                });
            }
        }

        const valEl = el('c_val');
        if (valEl && !valEl._dwellDefaultClearBound) {
            valEl._dwellDefaultClearBound = true;
            valEl.addEventListener('beforeinput', () => {
                const commTypeEl = el('c_type');
                if (!commTypeEl || commTypeEl.value !== 'dwell') return;
                if (valEl.dataset.isDwellDefault === 'true') {
                    valEl.value = '';
                    delete valEl.dataset.isDwellDefault;
                }
            });
        }
    },

    update() {
        const type = el('c_type').value;
        const params = {
            type: type,
            msg: el('c_msg')?.value || '',
            val: el('c_val')?.value || '',
            cycle: el('c_cycle')?.value || '',
            popupMode: el('c_popup_mode')?.value || '',
            id: el('c_id')?.value || '',
            dest: el('c_dest')?.value || '',
            slot1: el('c_slot1')?.value || '',
            slot2: el('c_slot2')?.value || '',
            slot3: el('c_slot3')?.value || '',
            slot4: el('c_slot4')?.value || '',
            statusColor: el('c_status_color')?.value ?? '-1',
            statusMode:  el('c_status_mode')?.value || '1',
            statusDwell: el('c_status_dwell')?.value || ''
        };

        const commValEl = el('c_val');
        if (type === 'dwell' && commValEl) {
            if (!commValEl.value || commValEl.dataset.isDwellDefault === 'true') {
                commValEl.value = '5.0';
                commValEl.dataset.isDwellDefault = 'true';
                params.val = '5.0';
            }
        } else if (commValEl && commValEl.dataset.isDwellDefault === 'true') {
            delete commValEl.dataset.isDwellDefault;
        }

        // Update type descriptor
        const descEl = el('comm_desc');
        const modeDescs = {
            '-5000': '<b>Toast</b> — Displays message instantly without stopping the macro. No operator input required.',
            '1':     '<b>OK / Cancel</b> — Halts macro, operator presses Enter (continue) or Esc (cancel). Returns 1 (Enter) or 0 (Esc) — macro branches on result.',
            '3':     '<b>Binary Choice</b> — Halts macro, operator presses Enter or Esc to choose between two actions. Returns 1 (Enter) or 0 (Esc) — macro branches on result.',
        };
        if (descEl) {
            const descs = {
                popup:  '<b>Popup</b> (#1505) — Shows a dialog box on screen. Mode controls whether macro pauses and how the operator responds.',
                status: '<b>Status Bar</b> (#1503) — Writes a message to the bottom green bar without stopping the macro. Use for progress updates, current operation labels or live feedback during a run. Requires Pr269=YES.',
                input:  '<b>Numeric Input</b> (#2070) — Pauses macro and shows an Edit dialog for the operator to type a number. Result goes into a temp variable (#50–#499), then you copy it to a persistent variable. Use for runtime parameters like speeds or offsets.',
                beep:   '<b>Beep</b> (#2042/#2043) — #2042 sets total beep duration (ms). #2043 sets pulse cycle (ms): 0 = continuous tone; >0 = ON for cycle, OFF for cycle, repeated within #2042 duration (e.g. #2043=100 with #2042=1000 gives five 100ms beeps).',
                dwell:  '<b>Dwell</b> (G4 P) — Pauses macro execution for a fixed time in seconds. Use for spindle spin-up, coolant settling or any timed wait.',
            };
            const modeEl = type === 'popup' ? el('c_popup_mode') : el('c_status_mode');
            const modeDesc = type === 'popup' && modeEl ? (modeDescs[modeEl.value] || '') : '';
            const statusModeDesc = type === 'status' && modeEl ? (modeEl.value === '-3000' ? '<b>Persistent</b> — message stays on screen after macro ends. Operator can jog freely while reading it.' : '') : '';
            descEl.innerHTML = (descs[type] || '') + (modeDesc ? ' ' + modeDesc : '') + (statusModeDesc ? ' ' + statusModeDesc : '');
        }

        // Update field visibility
        const visibility = wizard.getFieldVisibility(type);
        const modeBlock = el('c_mode_block');
        const valBlock = el('c_val_block');
        const msgBlock = el('c_msg_block');
        const slotsBlock = el('c_slots_block');
        const varBlock = el('c_var_block');
        const colorBlock = el('c_color_block');

        if (modeBlock) modeBlock.classList.toggle('hidden', !visibility.showMode);
        const popupModeEl = el('c_popup_mode');
        const statusModeEl = el('c_status_mode');
        const modeLabelEl = el('c_mode_label');
        if (popupModeEl) popupModeEl.style.display = visibility.showPopupMode ? '' : 'none';
        if (statusModeEl) statusModeEl.style.display = visibility.showStatusMode ? '' : 'none';
        if (modeLabelEl) modeLabelEl.textContent = visibility.modeLabel || 'MODE';
        const dwellBlock = el('c_dwell_block');
        const currentStatusMode = el('c_status_mode')?.value || '1';
        if (dwellBlock) dwellBlock.classList.toggle('hidden', !(type === 'status' && currentStatusMode !== '-3000'));
        if (valBlock) valBlock.classList.toggle('hidden', !visibility.showValue);
        if (msgBlock) msgBlock.classList.toggle('hidden', !visibility.showMessage);
        if (slotsBlock) slotsBlock.classList.toggle('hidden', !visibility.showSlots);
        if (varBlock) varBlock.classList.toggle('hidden', !visibility.showVar);
        if (colorBlock) colorBlock.classList.toggle('hidden', !visibility.showColor);
        const cycleBlock = el('c_cycle_block');
        if (cycleBlock) cycleBlock.classList.toggle('hidden', !visibility.showCycle);

        // Default message when field becomes visible and is empty
        if (visibility.showMessage) {
            const msgEl = el('c_msg');
            if (msgEl && !msgEl.value && msgEl.dataset.isDefault !== 'true') {
                msgEl.value = 'Enter message...';
                msgEl.dataset.isDefault = 'true';
            }
        }

        // Update value field label and hint based on type
        const valLabel = el('c_val_label');
        const valHint  = el('c_val_hint');
        if (valLabel) valLabel.textContent = visibility.valLabel || 'VALUE';
        if (valHint)  valHint.textContent  = visibility.valHint  || '';

        const gcode = wizard.generate(params);
        el('wiz_comm_code').innerHTML = gcode;

        // Update screen preview
        const screenPreview = el('comm_screen_preview');
        if (screenPreview) {
            screenPreview.innerHTML = wizard.generateScreenPreview(params);
        }
    },
};
