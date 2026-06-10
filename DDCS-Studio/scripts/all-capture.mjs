/**
 * Capture corner/edge/wcs/alignment wizard output across key branches.
 * Proves the words.js port is byte-identical: run before & after, diff.
 * Run: node scripts/all-capture.mjs > <outfile>
 */
import { CornerWizard } from '../web/wizards/cornerWizard.js';
import { EdgeWizard } from '../web/wizards/edgeWizard.js';
import { WCSWizard } from '../web/wizards/wcsWizard.js';
import { AlignmentWizard } from '../web/wizards/alignmentWizard.js';

const dump = (name, txt) => { console.log(`=== ${name} ===`); process.stdout.write(txt); console.log(`=== /${name} ===`); };

const corner = new CornerWizard();
const cBase = { dist:500, retract:5, f_fast:200, f_slow:50, port:3, level:0, qStop:1, safeZ:10, travelDist:50, scanDepth:5, radius:2.0 };
dump('corner FL probeZ XY active',   corner.generate({ ...cBase, corner:'FL', probeZ:true,  probeSeq:'XY', wcs:'active' }));
dump('corner BR YX G55 sync',        corner.generate({ ...cBase, corner:'BR', probeZ:false, probeSeq:'YX', wcs:'G55', syncA:true, slave:'3' }));
dump('corner FR probeZ YX G54',      corner.generate({ ...cBase, corner:'FR', probeZ:true,  probeSeq:'YX', wcs:'G54' }));

const edge = new EdgeWizard();
const eBase = { dist:500, retract:2, clearance:2, f_fast:200, f_slow:50, port:3, level:0, qStop:1 };
dump('edge X pos active',            edge.generate({ ...eBase, axis:'X', dir:'pos', wcs:'active' }));
dump('edge Y neg G55 sync',          edge.generate({ ...eBase, axis:'Y', dir:'neg', wcs:'G55', syncA:true, slave:'3' }));

const wcs = new WCSWizard();
dump('wcs auto XYZ',                 wcs.generate({ sys:'0',  axisX:true, axisY:true, axisZ:true }));
dump('wcs G55 XZ sync A',            wcs.generate({ sys:'55', axisX:true, axisZ:true, sync:true, slave:'3' }));
dump('wcs G54 Y sync B',             wcs.generate({ sys:'54', axisY:true, sync:true, slave:'4' }));

const align = new AlignmentWizard();
const aBase = { safeZ:10, tolerance:0.05, dist:20, retract:2, f_fast:200, f_slow:20, port:3, level:0, qStop:0 };
dump('align checkX pos',             align.generate({ ...aBase, checkAxis:'X', probeDir:'pos' }));
dump('align checkY neg',             align.generate({ ...aBase, checkAxis:'Y', probeDir:'neg' }));
