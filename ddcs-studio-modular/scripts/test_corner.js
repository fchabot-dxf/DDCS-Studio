import { CornerWizard } from '../src/wizards/cornerWizard.js';

const cw = new CornerWizard();

const paramsChecked = {
    corner: 'FL',
    probeZ: true,
    syncA: false,
    probeSeq: 'YX',
    wcs: 'G54',
    dist: '10',
    retract: '2',
    f_fast: '200',
    f_slow: '50',
    port: '3',
    level: '0',
    qStop: '1',
    safeZ: '10',
    travelDist: '5'
};

const paramsUnchecked = { ...paramsChecked, probeZ: false };

console.log('--- PROBEZ = true ---');
console.log(cw.generate(paramsChecked));

console.log('\n--- PROBEZ = false ---');
console.log(cw.generate(paramsUnchecked));
