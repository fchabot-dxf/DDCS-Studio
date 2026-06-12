// queue.js — the Queue view: the full queue + the active job's events.
// The active job's BIG progress display is its own view now (tracker.js — the shop-floor Tracker).
// Borderless sections (Studio pattern): a .section-label heading + bare content, spaced by .block.
import { el } from "../util.js";

export default {
  id: "queue",
  label: "Queue",

  mount(ctx) {
    this.queue = el("section", { class: "block" });
    this.events = el("section", { class: "block" });
    ctx.root.append(this.queue, this.events);
    this.onPoll(ctx);
  },

  async onPoll(ctx) {
    let items = [];
    try { items = await ctx.client.listQueue(); } catch { return; }
    const active = items
      .filter((i) => ["running", "delivered", "stalled"].includes(i.state))
      .sort((a, b) => (a.jobId < b.jobId ? 1 : -1))[0];
    this.renderQueue(items);
    this.renderEvents(active);
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
