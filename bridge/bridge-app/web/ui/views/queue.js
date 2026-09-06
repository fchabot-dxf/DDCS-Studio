// queue.js — the Queue/Tracker view: the active job's state + the full queue + its events.
// Borderless sections (Studio pattern): a .section-label heading + bare content, spaced by .block.
//
// t2649 (BACKLOG #78) — the tracker used to show a percent bar + ETA/Operation/Line, all decoded from the
// beacon mechanism's own per-job map. The beacon mechanism is REMOVED (owner-directed 2026-09-04, never
// demonstrably ran end-to-end) — a job's status object now carries only {jobId, name, state, updated_at,
// events} (PROTOCOL §5), and delivery is synchronous, so there is no multi-tick progress left to bar-chart.
// Simplified to what the status object can actually say: which job, and its delivery state.
import { el } from "../util.js";

export default {
  id: "queue",
  label: "Queue · Tracker",

  mount(ctx) {
    this.tracker = el("section", { class: "block" });
    this.queue = el("section", { class: "block" });
    this.events = el("section", { class: "block" });
    ctx.root.append(this.tracker, this.queue, this.events);
    this.onPoll(ctx);
  },

  async onPoll(ctx) {
    let items = [];
    try { items = await ctx.client.listQueue(); } catch { return; }
    const active = items
      .filter((i) => ["delivering", "delivered"].includes(i.state))
      .sort((a, b) => (a.jobId < b.jobId ? 1 : -1))[0];
    this.renderTracker(active);
    this.renderQueue(items);
    this.renderEvents(active);
  },

  renderTracker(j) {
    const c = this.tracker;
    c.replaceChildren(el("div", { class: "section-label" }, "Tracker"));
    if (!j) {
      c.append(el("div", { class: "muted" }, "No active job — submit one, or it appears here on delivery."));
      return;
    }
    c.append(
      el("div", { class: "row spread" },
        el("span", { class: "job" }, j.name || j.jobId),
        el("span", { class: "state s-" + j.state }, (j.state || "").toUpperCase())),
    );
  },

  renderQueue(items) {
    const c = this.queue;
    c.replaceChildren(el("div", { class: "section-label" }, "Queue"));
    if (!items.length) { c.append(el("div", { class: "muted" }, "empty")); return; }
    for (const j of items)
      c.append(el("div", { class: "q" },
        el("span", { class: "pill " + (j.state || "queued") }, j.state || "queued"),
        el("span", { class: "mono" }, j.name || j.jobId)));
  },

  renderEvents(j) {
    const c = this.events;
    c.replaceChildren(el("div", { class: "section-label" }, "Events"));
    const ev = (j && j.events) || [];
    if (!ev.length) { c.append(el("div", { class: "muted" }, "—")); return; }
    const ul = el("ul", { class: "log" });
    [...ev].reverse().forEach((e) => ul.append(el("li", {}, e)));
    c.append(ul);
  },
};
