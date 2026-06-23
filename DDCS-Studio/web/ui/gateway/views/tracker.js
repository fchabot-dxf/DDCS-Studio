// tracker.js — the big shop-floor Tracker: ONE job, readable from across the room.
// Giant percent + bar + stats, scaled with the viewport (clamp). Queue/events live in queue.js.
import { el, fmtEta } from "../util.js";

const stat = (k, v) => el("div", { class: "bt-stat" },
  el("div", { class: "k" }, k), el("div", { class: "v" }, v));

export default {
  id: "tracker",
  label: "Tracking",

  mount(ctx) {
    this.wrap = el("section", { class: "block bigtrack" });
    ctx.root.append(this.wrap);
    this.onPoll(ctx);
  },

  async onPoll(ctx) {
    let items = [];
    try { items = await ctx.client.listQueue(); } catch { return; }
    const active = items
      .filter((i) => ["running", "delivered", "stalled"].includes(i.state))
      .sort((a, b) => (a.jobId < b.jobId ? 1 : -1))[0];
    this.render(active);
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
