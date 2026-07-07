/**
 * wizards/ops/wcszero.js — WCS ZERO-AT-CURRENT (t475): zero the selected WCS axes = the current machine position,
 * DIALECT-AWARE at EMIT. The FLOW differs per controller — M350: direct #805+ register writes (dump-grounded, the
 * intermediate-var indirect form); rs274/grbl: G10 L20 P<n>; v41/dm500: G90 G92 — so the DIALECT owns the emit
 * (dialect.wcsZeroAtCurrent), resolved per-post at emit (unlike the old build-time getDialect + M350-hardcoded assigns
 * that leaked #880 onto every controller). The forks (auto|fixed × axisX/Y/Z × sync) are COMPUTED inside the dialect
 * method from the block's value params — no structural guards, a static-shape op (so the twin binds values, no superset).
 */
export const wcsZeroBlock = {
    type: 'wcszero', label: 'WCS Zero', kind: 'leaf', category: 'Coordinates',
    defaults: { sys: '0', axisX: true, axisY: true, axisZ: false, sync: false, slave: '3' },
    fields: ['sys', 'axisX', 'axisY', 'axisZ', 'sync', 'slave'],
    emit: (p, dx, dy, dialect) => (dialect && typeof dialect.wcsZeroAtCurrent === 'function')
        ? dialect.wcsZeroAtCurrent(p)
        : ['( WCS zero: this controller has no WCS-set flow )'],
};
