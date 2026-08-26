export const edgeTitleBlock = {
    type: 'edge_title',
    label: 'Edge Probe',
    category: 'Control',
    defaults: { axis: 'X', axisDir: 'pos' },
    fields: ['axis', 'axisDir'],
    emit: (p) => `( Edge | ${p.axis || 'X'} ${p.axisDir || 'pos'} )`
};

export const middleTitleBlock = {
    type: 'middle_title',
    label: 'Middle Probe',
    category: 'Control',
    defaults: { featureType: 'boss', axis: 'X', dir1: 'pos', twoAxis: false, dir2: 'pos' },
    fields: ['featureType', 'axis', 'dir1', 'twoAxis', 'dir2'],
    emit: (p) => {
        const ft = p.featureType || 'boss';
        const ax = p.axis || 'X';
        const d1 = p.dir1 || 'pos';
        if (p.twoAxis) {
            const ax2 = ax === 'X' ? 'Y' : 'X';
            const d2 = p.dir2 || 'pos';
            return `( Middle | ${ft} | ${ax} ${d1} + ${ax2} ${d2} )`;
        }
        return `( Middle | ${ft} | ${ax} ${d1} )`;
    }
};

export const circularTitleBlock = {
    type: 'circular_title',
    label: 'Circular Probe',
    category: 'Control',
    defaults: { featureType: 'bore' },
    fields: ['featureType'],
    // t2305 — LIVE DEFECT: 'Boss (outside)'/'Bore (inside)' nested a paren pair inside this comment's own
    // outer `( … )`. No vendor dialect nests a comment (bridge/controllers/COMMENT-CHARACTERS.md §1, 0/2248
    // vendor comments nested) — DDCS closes at the first `)`, so " )" fell outside and was parsed as code.
    // Replaced with `-`, that doc's own #1-ranked safe separator (1488 vendor occurrences).
    emit: (p) => `( Circular | ${p.featureType === 'boss' ? 'Boss - outside' : 'Bore - inside'} )`
};
