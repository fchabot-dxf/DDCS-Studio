/**
 * ui/numericInputGuards.js — integer/decimal input filtering for wizard fields.
 * Extracted from app.js. The NUMERIC_INPUT_POLICY table is the single source
 * of truth for which fields take integers vs decimals.
 */
import { el } from './uiUtils.js';

export function setupNumericInputGuards() {
        const ALLOWED_INTEGER_CHARS = new Set('0123456789'.split(''));
        const ALLOWED_DECIMAL_CHARS = new Set('0123456789.'.split(''));
        const CONTROL_KEYS = new Set([
            'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
            'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
            'Home', 'End'
        ]);

        // Numeric input policy table (single source of truth)
        // - integer: digits only (0-9)
        // - decimal: digits + one decimal point (0-9 and .)
        // - signed variants can be added later if needed
        const NUMERIC_INPUT_POLICY = {
            integer: [
                'c_dist', 'c_retract', 'c_safe_z', 'c_travel_dist', 'c_port',
                'm_port', 'p_port', 'al_port',
                'c_cycle', 'c_id', 'c_status_dwell',
                'c_slot1', 'c_slot2', 'c_slot3', 'c_slot4'
            ],
            decimal: [
                'c_feed_fast', 'c_feed_slow',
                'm_dist', 'm_retract', 'm_safe_z', 'm_feed_fast', 'm_feed_slow',
                'p_dist', 'p_retract', 'p_feed_fast', 'p_feed_slow',
                'al_dist', 'al_retract', 'al_safe_z', 'al_tolerance', 'al_feed_fast', 'al_feed_slow',
                'c_val'
            ]
        };

        const integerFieldIds = NUMERIC_INPUT_POLICY.integer;
        const decimalFieldIds = NUMERIC_INPUT_POLICY.decimal;

        const numericFieldIds = [...integerFieldIds, ...decimalFieldIds];

        const sanitizeNumeric = (value, allowDecimal, allowNegative) => {
            let text = String(value ?? '');
            text = text.replace(/[^\d.\-]/g, '');

            if (allowNegative) {
                text = text.replace(/(?!^)-/g, '');
            } else {
                text = text.replace(/-/g, '');
            }

            if (allowDecimal) {
                const firstDot = text.indexOf('.');
                if (firstDot !== -1) {
                    text = text.slice(0, firstDot + 1) + text.slice(firstDot + 1).replace(/\./g, '');
                }
            } else {
                text = text.replace(/\./g, '');
            }

            return text;
        };

        numericFieldIds.forEach((id) => {
            const input = el(id);
            if (!input) return;

            const allowDecimal = decimalFieldIds.includes(id);
            const allowNegative = false;
            const allowedChars = allowDecimal ? ALLOWED_DECIMAL_CHARS : ALLOWED_INTEGER_CHARS;

            input.setAttribute('inputmode', allowDecimal ? 'decimal' : 'numeric');
            input.setAttribute('autocomplete', 'off');

            const currentType = (input.getAttribute('type') || '').toLowerCase();
            if (!currentType) input.setAttribute('type', 'text');

            if (input.dataset.numericGuardBound === 'true') return;
            input.dataset.numericGuardBound = 'true';

            input.addEventListener('keydown', (e) => {
                if (!e.key) return;
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                if (CONTROL_KEYS.has(e.key)) return;
                if (e.key.length !== 1) return;

                if (!allowedChars.has(e.key)) {
                    e.preventDefault();
                    return;
                }

                if (e.key === '.') {
                    if (!allowDecimal) {
                        e.preventDefault();
                        return;
                    }
                    const start = input.selectionStart ?? 0;
                    const end = input.selectionEnd ?? 0;
                    const nextValue = input.value.slice(0, start) + e.key + input.value.slice(end);
                    if ((nextValue.match(/\./g) || []).length > 1) {
                        e.preventDefault();
                        return;
                    }
                }

                if (e.key === '-') {
                    if (!allowNegative) {
                        e.preventDefault();
                        return;
                    }
                }
            });

            input.addEventListener('input', () => {
                const cleaned = sanitizeNumeric(input.value, allowDecimal, allowNegative);
                if (cleaned !== input.value) {
                    input.value = cleaned;
                }
            });

            // Sanitize initial values too
            input.value = sanitizeNumeric(input.value, allowDecimal, allowNegative);
        });
    }
