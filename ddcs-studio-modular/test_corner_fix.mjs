import { CornerWizard } from './src/wizards/cornerWizard.js';

const wizard = new CornerWizard();
const params = {
    corner: 'FL',
    probeZ: true,
    probeZFirst: true,
    syncA: false,
    probeSeq: 'YX',
    wcs: 'G54',
    dist: 20,
    retract: 5,
    f_fast: 200,
    f_slow: 50,
    port: 3,
    level: 0,
    qStop: 1,
    safeZ: 10,
    travelDist: 50,
    scanDepth: 5,
    radius: 2.0
};

const gcode = wizard.generate(params);
console.log('--- GENERATED G-CODE (FL, YX) ---');
console.log(gcode);
console.log('------------------------------');

const checkZTravel = gcode.includes('G0 Z#19') && gcode.includes('G0 Y#16 ( Travel 50mm toward first wall )') && gcode.includes('Hover OVER the FL corner material');
const checkYXTravel = gcode.includes('G0 Y#15 X#16 ( Move Y past edge, X far off side )') && gcode.includes('IF #1921==0 GOTO1');

console.log('Check Z Escape (Move Y-):', checkZTravel ? 'PASS' : 'FAIL');
console.log('Check YX Reposition (Move Y+, X-):', checkYXTravel ? 'PASS' : 'FAIL');

if (checkZTravel && checkYXTravel) {
    process.exit(0);
} else {
    process.exit(1);
}
