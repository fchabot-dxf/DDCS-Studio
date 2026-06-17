/**
 * wizards/ops/corner_config.js — Universal Corner Configuration Block
 *
 * This block defines the runtime structural parameters for the universal corner probe macro.
 * Instead of JavaScript using these values at generation time to hardcode X/Y directions,
 * this block emits them as G-code variables (#30 and #31). The rest of the G-code uses
 * IF/GOTO logic to read these variables and compute multipliers dynamically.
 *
 * This makes the Blockly stack 100% static. You can switch the dropdowns here and it
 * immediately updates the G-code without needing to rebuild the entire block stack.
 */

export const cornerConfigBlock = {
    type: 'corner_config',
    label: 'Config',
    kind: 'leaf',
    category: 'Control',
    defaults: { corner: 'FL', probeSeq: 'YX' },
    fields: ['corner', 'probeSeq'],
    emit: (p) => {
        const corner   = p.corner   || 'FL';
        const probeSeq = p.probeSeq || 'YX';
        
        // Map string enums to integer variables for the macro logic
        const cNum = { FL: 1, FR: 2, BL: 3, BR: 4 }[corner] || 1;
        const sNum = { XY: 1, YX: 2 }[probeSeq] || 2;
        
        return [
            `#30=${cNum} ( Corner: 1=FL 2=FR 3=BL 4=BR )`,
            `#31=${sNum} ( Sequence: 1=XY 2=YX )`
        ];
    },
};
