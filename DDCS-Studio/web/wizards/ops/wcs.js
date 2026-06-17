/** wizards/ops/wcs.js — WCS-SELECT (Machine): choose the work coordinate system (G54…G59). */
export const wcsBlock = {
    type: 'wcs', label: 'WCS', kind: 'leaf', category: 'Machine',
    defaults: { wcs: 'G54' },
    fields: ['wcs'],          // select: G54…G59
    emit: (p, dx, dy, dialect) => {
        if (!p.wcs || p.wcs === 'active') return [];
        let w = p.wcs;
        if (w.startsWith('G59P')) w = w.replace('G59P', 'G59 P');
        
        // Classic grbl does not support extended WCS
        if (w.includes(' P') && dialect && dialect.caps && dialect.caps.flow === 'none') {
            return [`( ${w} - warning: extended WCS not supported on ${dialect.name} )`];
        }
        
        return [`${w}   ( work offset )`];
    },
};
