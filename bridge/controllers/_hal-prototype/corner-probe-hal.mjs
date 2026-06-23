// =====================================================================
// EXTRACTION PROOF  —  run: `node corner-probe-hal.mjs`
//
// ONE dialect-agnostic corner-probe (the "wizard") -> rendered to THREE
// dialects via pluggable primitive bindings. Proves the locked decision:
// the shared unit is the PRIMITIVES/HAL, not a dialect engine. The wizard
// emits structure + calls primitives; each dialect binds the ~5 that vary.
//
// This is a PROOF, not yet wired into Studio. The byte-for-byte swap of
// cornerWizard.js onto this layer is the follow-up integration step.
// =====================================================================

const cfg = { dist:20, retract:2, fFast:200, fSlow:50, radius:2,
              safez:10, scandep:5, travel:50, wcs:1, probeIn:3, xdir:1, ydir:1 };

// ---- THE WIZARD: builds a controller-agnostic op list (shared structure) ----
function cornerProbeIR(c) {
  const ops = [];
  ops.push({op:'banner', text:'Corner FL outside (probe +X, +Y), Z surface first'});
  ops.push({op:'config'});
  ops.push({op:'confirm', text:'Hover OVER the FL corner material, then start'});
  ops.push({op:'mode', v:'abs'});
  // Z surface (two-pass, no radius)
  ops.push({op:'mode', v:'inc'});
  twoPass(ops, 'Z', -1);
  ops.push({op:'setZeroSurface', axis:'Z'});
  ops.push({op:'mode', v:'abs'}); ops.push({op:'rapidSafeZ'});
  // reposition to X wall (schematic, shared)
  ops.push({op:'mode', v:'inc'});
  ops.push({op:'rapid', axis:'X', sign:-c.xdir, mag:'travel'});
  ops.push({op:'rapid', axis:'Z', sign:-1, mag:'plunge'});
  // X wall
  twoPass(ops, 'X', c.xdir);
  ops.push({op:'setZeroWall', axis:'X', sign:c.xdir});
  ops.push({op:'rapid', axis:'X', sign:-c.xdir, mag:'retract'});
  ops.push({op:'rapid', axis:'Z', sign:1, mag:'plunge'});
  // reposition to Y wall
  ops.push({op:'rapid', axis:'X', sign:c.xdir, mag:'travel'});
  ops.push({op:'rapid', axis:'Y', sign:-c.ydir, mag:'travel'});
  ops.push({op:'rapid', axis:'Z', sign:-1, mag:'plunge'});
  // Y wall
  twoPass(ops, 'Y', c.ydir);
  ops.push({op:'setZeroWall', axis:'Y', sign:c.ydir});
  ops.push({op:'rapid', axis:'Y', sign:-c.ydir, mag:'retract'});
  ops.push({op:'mode', v:'abs'}); ops.push({op:'rapidSafeZ'});
  ops.push({op:'done', text:'Corner FL found: WCS X0 Y0 Z0 set'});
  return ops;
}
function twoPass(ops, axis, sign) {
  ops.push({op:'probe',        axis, sign, mag:'dist',     speed:'fast'});
  ops.push({op:'probeRetract', axis, sign, mag:'retract'});
  ops.push({op:'probe',        axis, sign, mag:'retract2', speed:'slow'});
}

// ---- RENDERER: shared ops here; dialect-specific ops dispatch to the binding ----
function render(ir, d) {
  const out = [];
  for (const o of ir) {
    switch (o.op) {
      case 'mode':       out.push(o.v === 'abs' ? 'G90' : 'G91'); break;          // SHARED
      case 'rapid':      out.push(`G0 ${o.axis}${d.tok(o.mag, o.sign)}`); break;  // SHARED structure
      case 'rapidSafeZ': out.push(`G0 Z${d.safez}`); break;                       // SHARED structure
      default:           out.push(...d[o.op](o));                                 // PRIMITIVE (dialect)
    }
  }
  return out.join('\n');
}

const neg = (s, t) => s > 0 ? t.pos : t.neg;   // pick +/- token

// ===================== DIALECT BINDINGS =====================
const TOK = {
  ddcs:   { dist:{pos:'#8',neg:'#7'}, retract2:{pos:'#8',neg:'#7'}, retract:{pos:'#10',neg:'#9'},
            travel:{pos:'#15',neg:'#16'}, plunge:{pos:'#17',neg:'#18'} },
  rs274:  { dist:{pos:'[#<dist>]',neg:'[-1 * #<dist>]'}, retract2:{pos:'[#<retract> * 2]',neg:'[-1 * #<retract> * 2]'},
            retract:{pos:'[#<retract>]',neg:'[-1 * #<retract>]'}, travel:{pos:'[#<travel>]',neg:'[-1 * #<travel>]'},
            plunge:{pos:'[#<safez> + #<scandep>]',neg:'[-1 * [#<safez> + #<scandep>]]'} },
  centroid:{ dist:{pos:'[#100]',neg:'[-1 * #100]'}, retract2:{pos:'[#101 * 2]',neg:'[-1 * #101 * 2]'},
            retract:{pos:'[#101]',neg:'[-1 * #101]'}, travel:{pos:'[#107]',neg:'[-1 * #107]'},
            plunge:{pos:'[#105 + #106]',neg:'[-1 * [#105 + #106]]'} },
};

const ddcs = {
  id:'DDCS', ext:'nc', safez:'#19',
  tok:(m,s)=>neg(s, TOK.ddcs[m]),
  banner:o=>[`( ${o.text} )`, `( DIALECT: DDCS  —  G31 + IF/GOTO + #vars )`],
  config:()=>['( config )','#3=200 #4=50 #5=3 #6=2','#7=-20 #8=20 #9=-2 #10=2',
              '#15=50 #16=-50 #17=15 #18=-15 #19=10','#70=805 ( G54 WCS base, stride 5 )'],
  confirm:o=>[`#1505=1 ( ${o.text} )`],
  probe:o=>{ const st={X:'#1920',Y:'#1921',Z:'#1922'}[o.axis];
    return [`G31 ${o.axis}${neg(o.sign,TOK.ddcs[o.mag])} F${o.speed==='fast'?'#3':'#4'} P#5 L0 Q1`,
            `IF ${st}!=2 GOTO1`]; },
  probeRetract:o=>[`G0 ${o.axis}${neg(-o.sign,TOK.ddcs.retract)}`],
  setZeroWall:o=>{ const tr={X:'#1925',Y:'#1926'}[o.axis], off={X:'0',Y:'1'}[o.axis];
    const c=[`#102 = [${tr} ${o.sign>0?'+':'-'} #6]`];
    if(off==='0') c.push('#[#70] = #102'); else c.push(`#73 = [#70+${off}]`,'#[#73] = #102');
    return c; },
  setZeroSurface:()=>['#73 = [#70+2]','#[#73] = #1927'],
  done:o=>['GOTO2','( === ERROR HANDLER === )','N1','G91 G0 Z#17','G90','#1505=1 ( probe failed )',
           'N2',`#1505=-5000 ( ${o.text} )`,'M30'],
};

const rs274 = {
  id:'RS274NGC (LinuxCNC / grblHAL)', ext:'ngc', safez:'#<safez>',
  tok:(m,s)=>neg(s, TOK.rs274[m]),
  banner:o=>[`( ${o.text} )`, `( DIALECT: RS274NGC  —  G38.2 + #5061 + G10 L20 )`],
  config:()=>['#<dist>=20  #<retract>=2  #<f_fast>=200  #<f_slow>=50','#<radius>=2  #<safez>=10  #<scandep>=5  #<travel>=50  #<wcs>=1'],
  confirm:o=>[`(MSG, ${o.text})`,'M0'],
  probe:o=>[`G38.2 ${o.axis}${neg(o.sign,TOK.rs274[o.mag])} F#<${o.speed==='fast'?'f_fast':'f_slow'}>`],
  probeRetract:o=>[`G0 ${o.axis}${neg(-o.sign,TOK.rs274.retract)}`],
  setZeroWall:o=>[`G10 L20 P#<wcs> ${o.axis}[${o.sign>0?'-1 * #<radius>':'#<radius>'}]`],
  setZeroSurface:o=>[`G10 L20 P#<wcs> ${o.axis}0`],
  done:o=>[`(MSG, ${o.text})`,'M2'],
};

const centroid = {
  id:'Centroid CNC12', ext:'mac', safez:'#105',
  tok:(m,s)=>neg(s, TOK.centroid[m]),
  banner:o=>[`; ${o.text}`, `; DIALECT: Centroid CNC12  —  M115/M116 + G92`],
  config:()=>['#100=20  #101=2  #102=20  #103=5  #104=2','#105=10  #106=5  #107=50  #108=3  #111=0'],
  confirm:o=>[`M225 #111 "${o.text}"`,'M0'],
  probe:o=>[`M115 /${o.axis}${neg(o.sign,TOK.centroid[o.mag])} P[#108] F[#${o.speed==='fast'?'102':'103'}]`],
  probeRetract:o=>[`M116 /${o.axis}${neg(-o.sign,TOK.centroid.retract)} P[#108] F[#103]`],
  setZeroWall:o=>[`G92 ${o.axis}[${o.sign>0?'-1 * #104':'#104'}]`],
  setZeroSurface:o=>[`G92 ${o.axis}0`],
  done:o=>[`M225 #111 "${o.text}"`,'M30'],
};

// ===================== RUN =====================
const ir = cornerProbeIR(cfg);
console.log(`IR ops: ${ir.length}  (one wizard, shared structure)\n`);
for (const d of [ddcs, rs274, centroid]) {
  console.log('='.repeat(64));
  console.log(`### ${d.id}   (.${d.ext})`);
  console.log('='.repeat(64));
  console.log(render(ir, d));
  console.log('');
}
