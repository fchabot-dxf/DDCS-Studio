/**
 * wizards/ops/setworkoffset.js — SET WCS OFFSET (Machine): write the active WCS axis offset = value.
 *
 * The G10-equivalent that probe routines end with (distinct from `wcs`, which only SELECTS G54-59).
 * PROFILE-AWARE: Expert → indirect `#[805+[wcs-1]*5+ax]=value`; V4.1/DM500 → `G90 G92 <axis>value`;
 * RS274NGC → `G10 L20 P<wcs> <axis>value`. `wcs` defaults to `#578` (the active-WCS index).
 */
import { num } from './util.js';

export const setWorkOffsetBlock = {
    type: 'setworkoffset', label: 'Set WCS Offset', kind: 'leaf', category: 'Coordinates',
    defaults: { wcs: '#578', axis: 'X', value: '#50' }, fields: ['wcs', 'axis', 'value'],
    emit: (p, dx, dy, dialect) => dialect.setWorkOffset(p.wcs || '#578', p.axis || 'X',
        (p.value === '' || p.value == null) ? 0 : (typeof p.value === 'number' ? num(p.value, 0) : p.value)),
};
