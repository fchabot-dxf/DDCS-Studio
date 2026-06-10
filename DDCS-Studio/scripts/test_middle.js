import { MiddleWizard } from '../src/wizards/middleWizard.js';

const mw = new MiddleWizard();

const paramsDefault = {
    featureType: 'pocket',
    axis: 'X',
    dir1: 'pos',
    findBoth: false,
    syncA: false,
    wcs: 'G54',
    dist: '15',
    retract: '2',
    safeZ: '10',
    clearance: '5',
    f_fast: '200',
    f_slow: '50',
    port: '3',
    level: '0',
    qStop: '1'
};

const paramsBoth = { ...paramsDefault, findBoth: true };

console.log('--- FIND BOTH = false ---');
console.log(mw.generate(paramsDefault));

console.log('\n--- FIND BOTH = true ---');
console.log(mw.generate(paramsBoth));
