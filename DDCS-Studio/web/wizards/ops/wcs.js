/** wizards/ops/wcs.js — WCS-SELECT (Machine): choose the work coordinate system (G54…G59). */
export const wcsBlock = {
    type: 'wcs', label: 'WCS', kind: 'leaf', category: 'Machine',
    defaults: { wcs: 'G54' },
    fields: ['wcs'],          // select: G54…G59
    emit: (p) => [`${p.wcs || 'G54'}   ( work offset )`],
};
