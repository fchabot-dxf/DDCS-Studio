// instrument.js — weave progress beacons into a .nc, in the browser (JS port of checkpoint_insert.py).
// Output frame is byte-for-byte the proven one: #251=111 marker + #250=n + MSETDATA[250,1,0,2,16,300].
// Settings (PROTOCOL §1/§2): count (max beacons), pacing (time|line), var/marker. Default = the Python
// behaviour; the frame must never change without re-proving on the machine.
import { scan, stripComment } from "./gcode-parse.js";
import { estimateProgram } from "../../../engine/timeEstimate.js";   // t848 — the ONE time model (the engine trace, same as the editor chip)

// t2113 - BEACON COUNT DEFAULTS TO 100, NOT THE MAXIMUM (human: "make it 100").
// Every beacon inserts `#var = n` + MSETDATA at a Z-up, and MSETDATA is a SYNCHRONOUS Modbus transaction: the
// controller stops feeding motion, completes a serial round-trip, and resumes. Defaulting to the field maximum
// meant a program could carry 255 of those - far more progress resolution than anyone reads, paid for in machine
// time on every single run.
// ⚠ ON A CONTROLLER WITHOUT MODBUS IT WAS WORSE THAN USELESS: the human measured 1-2 SECONDS PER BEACON on a
//   V4.1, because each write blocks until it times out with nothing listening. That path is now gated shut
//   (send.js requires the Expert), but the default should not have been the maximum in the first place.
// ⚠ The field still ACCEPTS up to 255 - this is a default, not a new limit.
export const DEFAULTS = { max: 100, varNum: 250, markerVar: 251, marker: 111, pacing: "time",
                          rapid: 6000, defaultFeed: 1000 };

export const msetdataCall = (varNum = 250) => `MSETDATA[${varNum},1,0,2,16,300]`;

function findM30(lines) {
  for (let i = 0; i < lines.length; i++) if (/\bM30\b/.test(stripComment(lines[i]))) return i;
  return null;
}

// Pick <= max Z-up moves spaced ~evenly by estimated TIME (matches python choose()).
function chooseByTime(zups, totalT, max) {
  if (!zups.length || totalT <= 0) return zups.slice(0, max);
  const step = totalT / max;
  const chosen = [];
  let nxt = step;
  for (const m of zups) {
    if (m.cumT >= nxt) {
      chosen.push(m);
      while (nxt <= m.cumT) nxt += step;
      if (chosen.length >= max) break;
    }
  }
  return chosen;
}
// Pick <= max Z-up moves spaced evenly by their position in the retract sequence (line-paced).
function chooseByLine(zups, max) {
  if (zups.length <= max) return zups.slice();
  const chosen = [];
  const step = zups.length / max;
  for (let k = 1; k <= max; k++) chosen.push(zups[Math.min(zups.length - 1, Math.round(k * step) - 1)]);
  return chosen.filter((m, i) => i === 0 || m !== chosen[i - 1]);
}

const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;

export function instrument(text, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const source = opts.source || "job.nc";
  const lines = text.split(/\r?\n/);
  const { moves, totalTime: scanTotal } = scan(lines, { rapid: o.rapid, defaultFeed: o.defaultFeed });
  // t848 — the QUOTED estimate is the ONE engine-trace model (identical to the editor's time chip); scan stays ONLY the
  // Z-up / beacon detector + its RELATIVE pacing. Fall back to scan's own total if the engine can't run (headless).
  let totalTime = scanTotal;
  try { const e = estimateProgram(text, { rapidRate: o.rapid }); if (e && e.seconds > 0) totalTime = e.seconds; } catch (_) { /* headless → scan total */ }
  const scale = scanTotal > 0 ? totalTime / scanTotal : 1;   // map scan's relative per-move times onto the engine total
  const zups = moves.filter((m) => m.zup);
  const reserve = o.max - 1;                          // reserve one for the forced M30 beacon
  const chosen = o.pacing === "line" ? chooseByLine(zups, reserve) : chooseByTime(zups, scanTotal, reserve);

  const m30 = findM30(lines);
  const inserts = new Map();
  const add = (idx, item) => { (inserts.get(idx) || inserts.set(idx, []).get(idx)).push(item); };
  for (const m of chosen) add(m.idx, { kind: "beacon", op: m.op, cumT: m.cumT });
  if (m30 !== null) add(m30 - 1, { kind: "complete", op: chosen.length ? chosen[chosen.length - 1].op : null, cumT: scanTotal });

  const out = [];
  let n = 0, markerDone = false;
  const beacons = [];
  const firstBeaconLine = chosen.length ? chosen[0].idx : (m30 ? m30 - 1 : null);
  const mset = msetdataCall(o.varNum);
  for (let i = 0; i < lines.length; i++) {
    if (!markerDone && firstBeaconLine !== null && i === firstBeaconLine) {
      out.push(`#${o.markerVar} = ${o.marker}`);
      markerDone = true;
    }
    out.push(lines[i]);
    for (const { kind, op, cumT } of (inserts.get(i) || [])) {
      n++;
      out.push(`#${o.varNum} = ${n}`);
      out.push(mset);
      beacons.push({
        n, orig_line: i + 1, op,
        cum_time_s: r2(cumT * scale),                                   // t848 — scan's relative time mapped onto the engine total
        percent: scanTotal > 0 ? r1(100 * cumT / scanTotal) : null,
        complete: kind === "complete",
      });
    }
  }

  const map = {
    source, var: o.varNum, marker_var: o.markerVar, marker: o.marker, msetdata: mset,
    total_est_time_s: r2(totalTime), total_beacons: n, beacons,
  };
  return { nc: out.join("\n") + "\n", map };
}
