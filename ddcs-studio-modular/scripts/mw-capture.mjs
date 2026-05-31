/**
 * Capture MiddleWizard.generate() output across key branches.
 * Used to prove the words.js port is byte-identical: run before & after, diff.
 * Run: node scripts/mw-capture.mjs > <outfile>
 */
import { MiddleWizard } from '../src/wizards/middleWizard.js';

const w = new MiddleWizard();

const base = {
  dist: 500, retract: 2, safeZ: 10, clearance: 2,
  f_fast: 200, f_slow: 50, port: 3, level: 0, qStop: 1,
  slave: '3',
};

const cases = [
  { name: 'boss X active 1axis',     p: { ...base, featureType: 'boss',   axis: 'X', dir1: 'pos', wcs: 'active' } },
  { name: 'pocket X G54 1axis',      p: { ...base, featureType: 'pocket', axis: 'X', dir1: 'pos', wcs: 'G54' } },
  { name: 'pocket Y G55 1axis neg',  p: { ...base, featureType: 'pocket', axis: 'Y', dir1: 'neg', wcs: 'G55' } },
  { name: 'boss Y active 2axis sync',p: { ...base, featureType: 'boss',   axis: 'Y', dir1: 'pos', wcs: 'active', twoAxis: true, syncA: true } },
  { name: 'pocket X G56 2axis',      p: { ...base, featureType: 'pocket', axis: 'X', dir1: 'pos', dir2: 'neg', wcs: 'G56', twoAxis: true } },
];

for (const c of cases) {
  console.log(`=== ${c.name} ===`);
  process.stdout.write(w.generate(c.p));
  console.log(`=== /${c.name} ===`);
}
