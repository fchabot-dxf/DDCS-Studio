/**
 * wizards/ops/corner_title.js — Corner Title Block
 * 
 * Provides dropdowns for the structural settings (corner and sequence) directly
 * on the title block inside the stack. When these change in Blockly, blocksApp
 * intercepts the event and rebuilds the stack via replaceOp().
 */
export const cornerTitleBlock = {
    type: 'corner_title',
    label: 'Corner Probe',
    category: 'Control',
    defaults: { corner: 'FL', probeSeq: 'YX' },
    fields: ['corner', 'probeSeq'],
    emit: (p) => {
        const corner = p.corner || 'FL', probeSeq = p.probeSeq || 'YX';
        const [xDir, yDir] = { FL: ['+', '+'], FR: ['-', '+'], BL: ['+', '-'], BR: ['-', '-'] }[corner] || ['+', '+'];
        const dirLabel = (d) => (d === '+' ? 'pos' : 'neg');
        return `( Corner | ${corner} OUTSIDE | Seq: ${probeSeq} | X ${dirLabel(xDir)} Y ${dirLabel(yDir)} )`;
    }
};
