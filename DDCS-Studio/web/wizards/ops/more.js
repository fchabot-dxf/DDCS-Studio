/**
 * wizards/ops/more.js — additional standard atoms (universal G/M codes that fit all DDCS controllers):
 *   Stop (M0/M1) · Plane (G17/18/19) · Feed Mode (G94/95) · Home (G28) · Call (M98) · Return (M99).
 * M98/M99/G28 are evidenced in the DM500 macros and are standard CNC codes; they emit ungated. In the SIM they
 * are non-motion (M-codes skip; G28 lands at its intermediate Z0), so the preview never errors.
 */
import { num } from './util.js';

export const stopBlock = {
    type: 'stop', label: 'Stop', kind: 'leaf', category: 'Control',
    defaults: { stop: 'M0' }, fields: ['stop'],   // M0 = program stop · M1 = optional stop
    emit: (p) => [{ M0: 'M0   ( program stop )', M1: 'M1   ( optional stop )' }[p.stop] || 'M0   ( program stop )'],
};

export const planeBlock = {
    type: 'plane', label: 'Plane', kind: 'leaf', category: 'Coordinates',
    defaults: { plane: 'G17' }, fields: ['plane'],
    emit: (p) => [{ G17: 'G17   ( XY plane )', G18: 'G18   ( XZ plane )', G19: 'G19   ( YZ plane )' }[p.plane] || 'G17   ( XY plane )'],
};

export const feedModeBlock = {
    type: 'feedmode', label: 'Feed Mode', kind: 'leaf', category: 'Spindle & Feed',
    defaults: { fmode: 'G94' }, fields: ['fmode'],
    emit: (p) => [{ G94: 'G94   ( feed per min )', G95: 'G95   ( feed per rev )' }[p.fmode] || 'G94   ( feed per min )'],
};

export const homeBlock = {
    type: 'home', label: 'Home', kind: 'leaf', category: 'Move',
    defaults: { axes: 'Z' }, fields: ['axes'],   // axes to reference-return via their 0 intermediate, e.g. Z, XY, XYZ
    emit: (p) => {
        const words = (String(p.axes || 'Z').toUpperCase().match(/[XYZA]/g) || ['Z']).map((a) => `${a}0`).join(' ');
        return [`G28 ${words}   ( reference return )`];
    },
};

export const callBlock = {
    type: 'call', label: 'Call (M98)', kind: 'leaf', category: 'Control',
    defaults: { prog: 9000 }, fields: ['prog'],   // O-number of an installed subprogram (probe.nc, T.nc, a CAM slot…)
    emit: (p) => [`M98 P${num(p.prog, 0)}   ( call subprogram )`],
};

export const returnBlock = {
    type: 'return', label: 'Return (M99)', kind: 'leaf', category: 'Control',
    defaults: {}, fields: [],
    emit: () => ['M99   ( subprogram return )'],
};
