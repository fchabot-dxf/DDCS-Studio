// tracker.js — the big shop-floor Tracker: ONE job, readable from across the room.
// Giant percent + bar + stats, scaled with the viewport (clamp). Queue/history live in send.js (t2241 —
// were jobs.js, folded in when Jobs merged into Send).
import { el, fmtEta } from "../util.js";
import { stateNote } from "../state.js";   // t1327 — the declared connection-state contract

const stat = (k, v) => el("div", { class: "bt-stat" },
  el("div", { class: "k" }, k), el("div", { class: "v" }, v));

export default {
  id: "tracker",
  // t2113 (human: "the tracking tab should be gated") - LIVE TRACKING NEEDS MODBUS RTU AND THE V4.1 HAS NONE.
  // Every number this tab can show arrives via beacons over Modbus, so on a V4.1 it can only ever render an
  // empty frame - or worse, a STALE one: the human found it displaying a job at 63% from a status record two
  // months old. A tab that cannot answer should say so, not present blank furniture.
  // ⛔ DECLARED, not hand-rolled into the panel: the view states its own requirement and gatewayPanel reads it,
  //    so a second capability-gated view adds a line here rather than a branch there.
  requiresModbus: true,
  // t2151 (BACKLOG #9 dispatch, ROLES-PLAN section 1: "tracker: REFRAME or hide — live progress comes off the
  // gateway's serial cable; a client can only mirror what the gateway published"). Mirroring (ROLES-PLAN S5) is
  // not built, so for now this tab needs to BE the workspace's gateway — a client (this PC not currently
  // wired to what's open, even with its own local daemon) cannot show anything live regardless of controller
  // family, so it gates on role too, same declared-not-hand-rolled pattern as requiresModbus above.
  requiresGateway: true,
  label: "Track",   // t2241 (BACKLOG amendment 6) — was "Tracking"; shortened for the one-row tab-strip goal

  mount(ctx) {
    this.wrap = el("section", { class: "block bigtrack" });
    this.posBlock = el("section", { class: "block bt-position", style: "display:none" });   // t2073 — hidden until enabled
    this.jobTrackBlock = el("section", { class: "block bt-jobtrack", style: "display:none" });   // t2647 — hidden until enabled
    ctx.root.append(this.wrap, this.jobTrackBlock, this.posBlock);
    this.onPoll(ctx);
  },

  async onPoll(ctx) {
    let items = [];
    // t1327 — IDLE AND UNREACHABLE ARE DIFFERENT FACTS. Idle means "I asked the gateway and there is no job";
    // unreachable means "I could not ask". This used to return on the failure and leave the big calm IDLE showing,
    // which tells an operator their machine is quietly waiting when Studio has no idea what it is doing.
    try { items = await ctx.client.listQueue(); }
    catch { this.renderUnreachable(); return; }
    const active = items
      .filter((i) => ["delivering", "running", "delivered", "stalled"].includes(i.state))
      .sort((a, b) => (a.jobId < b.jobId ? 1 : -1))[0];
    this.render(active);
    this.renderPosition(ctx);      // t2073 — independent of job state (Poll-mode position isn't wired to job tracking)
    this.renderJobTracking(ctx);   // t2647 (BACKLOG #79) — same poller, decoded: run state + executing line
  },

  // t2647 (BACKLOG #79) — the DECODED half of renderPosition's own raw stub: run state + executing line
  // number, both float32 CDAB and CONFIRMED on the owner's own M350 (expert-m350/FINDINGS.md, 2026-09-05),
  // unlike work_position/machine_position which stay raw because their byte order is still unattested. Silent
  // (block stays hidden) for every gateway that hasn't enabled --position-poll, same convention as
  // renderPosition — this must never appear as a broken feature for the majority who use beacons instead.
  // ⛔ NO PERCENT — BACKLOG #79's own explicit constraint: whether register 16062 counts physical file lines
  // or executable blocks is UNTESTED (a hardware question, FAIRY's to resolve, not ours) — showing "line N"
  // sidesteps it entirely rather than drawing a percentage off an unconfirmed denominator.
  // ⛔ M350-ONLY, via THIS VIEW'S OWN `requiresModbus` gate above — the real capability gate (BACKLOG #78's
  // own table) does not exist yet, so this is the honest available substitute (profile/dialect-derived,
  // gatewayPanel.js's own viewUnavailable()), named here so nobody mistakes it for the eventual real gate.
  async renderJobTracking(ctx) {
    let tr;
    try { tr = await ctx.client.getTracking(); } catch { return; }   // gateway-unreachable already shown by render() above
    if (!tr || !tr.enabled) { this.jobTrackBlock.style.display = "none"; return; }
    this.jobTrackBlock.style.display = "";
    if (!tr.connected) {
      this.jobTrackBlock.replaceChildren(
        el("div", { class: "section-label" }, "Live job tracking — Modbus poll (register 10002/16062)"),
        el("div", { class: "muted" }, tr.error || "not connected"));
      return;
    }
    this.jobTrackBlock.replaceChildren(
      el("div", { class: "section-label" }, "Live job tracking — Modbus poll (register 10002/16062)"),
      el("div", { class: "bt-stats" },
        stat("state", tr.running ? "RUNNING" : "IDLE"),
        stat("line", tr.line != null ? String(tr.line) : "—"),
        stat("read at", tr.read_at || "—")));
  },

  // t2073 — AN HONEST STUB, not a job-progress feature. Poll-mode reads (t2059/2063) are bench-proven to
  // reach the controller, but nothing yet turns "the tool is at these numbers" into "this job is N% done"
  // (that cursor stays gated on a real bench session — JOB-PROGRESS-PLAN.md). So this shows exactly what
  // the bridge measures — RAW, UNDECODED registers — and nothing more; decoding a register pair into a
  // float32 X/Y/Z would be a second unverified guess on top of an already-unattested register map (see
  // Ops.position_status's own docstring). Silent (block stays hidden) for every gateway that hasn't
  // enabled --position-poll — this must never appear as a broken/empty tracking feature for the majority
  // who use beacons instead.
  async renderPosition(ctx) {
    let pos;
    try { pos = await ctx.client.getPosition(); } catch { return; }   // gateway-unreachable is already shown by render() above; don't double-report
    if (!pos || !pos.enabled) { this.posBlock.style.display = "none"; return; }
    this.posBlock.style.display = "";
    const rows = Object.entries(pos.raw || {}).map(([k, v]) => stat(k, Array.isArray(v) ? v.join(",") : String(v)));
    this.posBlock.replaceChildren(
      el("div", { class: "section-label" }, "Live position poll — raw registers, undecoded, not linked to job progress"),
      pos.connected
        ? el("div", { class: "bt-stats" }, rows.concat(stat("read at", pos.read_at || "—")))
        : el("div", { class: "muted" }, pos.error || "not connected"));
  },

  renderUnreachable() {
    this.wrap.replaceChildren(
      el("div", { class: "bt-idle", "data-gw-state": "unreachable" }, "UNREACHABLE"),
      stateNote(el, "tracker"),
      el("div", { class: "muted", style: "text-align:center" }, "No gateway answering — Studio cannot see whether a job is running."));
  },

  render(j) {
    const c = this.wrap;
    if (!j) {
      c.replaceChildren(
        el("div", { class: "bt-idle" }, "IDLE"),
        el("div", { class: "muted", style: "text-align:center" },
          "No active job — it appears here on delivery."));
      return;
    }
    const pct = Math.round(j.percent ?? 0);
    const fill = el("div", { class: "bt-fill" });
    fill.style.width = pct + "%";
    c.replaceChildren(
      el("div", { class: "bt-top" },
        el("span", { class: "bt-job" }, j.name || j.jobId),
        el("span", { class: "bt-state s-" + j.state }, (j.state || "").toUpperCase())),
      el("div", { class: "bt-pct" }, pct + "%"),
      el("div", { class: "bt-bar" }, fill),
      el("div", { class: "bt-stats" },
        stat("ETA", fmtEta(j.eta_s)),
        stat("Operation", j.op || "—"),
        stat("Line", j.line != null ? String(j.line) : "—"),
        stat("Beacon", j.last_beacon ? `${j.last_beacon}/${j.total_beacons ?? "?"}` : "—")),
    );
  },
};
