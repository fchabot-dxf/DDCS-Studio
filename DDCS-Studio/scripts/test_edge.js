import { EdgeWizard } from '../src/wizards/edgeWizard.js';

const ew = new EdgeWizard();

const paramsSingle = {
    axis: 'X', dir: 'pos', wcs: 'G54', dist: '15', retract: '2', f_fast: '200', f_slow: '50', port: '3', level: '0', qStop: '1'
};

const paramsBoth = { ...paramsSingle, findBoth: true, clearance: '5' };

console.log('--- EDGE SINGLE ---');
console.log(ew.generate(paramsSingle));

console.log('\n--- EDGE BOTH ---');
console.log(ew.generate(paramsBoth));
