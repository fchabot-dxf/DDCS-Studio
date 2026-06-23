// watch.js — a flexible live variable watch list (read-only snapshot). Add any #N; the gateway reads
// its value from the controller over SMB. CONFIRMED for #100-499 (uservar, slot = #var-100); #0-99
// are locals (RAM-only) and #500+ are pending a per-controller mapping, so those rows say why instead
// of showing a wrong value. Values are a snapshot from the last run start/end, not a live tick.
// Structured groups (WCS, etc.) get their own grid tabs — this stays a flat list of single values.
import { el, clear } from "../util.js";

const KEY = "ddcs_watch_vars";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* ignore */ } };

// Label for #N from the Studio variable DB (whichever controller set is loaded), if present.
function labelFor(n) {
  try {
    const db = window.ddcsStudio && window.ddcsStudio.variableDB;
    if (db) { const e = db.getAll().find((v) => v.i === "#" + n); if (e) return e.d || ""; }
  } catch { /* ignore */ }
  return "";
}

function fmtVal(cell) {
  if (!cell) return "—";
  if (cell.available) return typeof cell.value === "number" ? String(+cell.value.toFixed(4)) : String(cell.value);
  return cell.reason || "n/a";
}

export default {
  id: "watch",
  label: "Watch",

  mount(ctx) {
    this.list = load();
    this.values = {};
    this.card = el("section", { class: "block" });
    ctx.root.append(this.card);
    this.render(ctx);
    this.onPoll(ctx);
  },

  render(ctx) {
    const c = this.card;
    clear(c);
    this._cells = {};
    c.append(el("div", { class: "section-label" }, "Variable watch"));

    const input = el("input", { class: "mono", placeholder: "#N (e.g. 200)", style: "width:110px" });
    const add = () => {
      const m = String(input.value).match(/#?(\d+)/);
      if (!m) return;
      const n = parseInt(m[1], 10);
      if (!this.list.includes(n)) { this.list.push(n); save(this.list); }
      input.value = "";
      this.render(ctx); this.onPoll(ctx);
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    c.append(el("div", { style: "display:flex; gap:6px; margin:6px 0;" },
      input, el("button", { class: "btn", onclick: add }, "+ Add")));

    if (!this.list.length) { c.append(el("div", { class: "muted" }, "no variables watched — add a #N above")); return; }

    const tbl = el("table", {}, el("tr", {},
      el("th", {}, "var"), el("th", {}, "label"), el("th", {}, "value"), el("th", {}, "source"), el("th", {}, "")));
    for (const n of this.list) {
      const cell = this.values[String(n)];
      const vtd = el("td", { class: "mono" + (cell && cell.available ? "" : " muted") }, fmtVal(cell));
      const std = el("td", { class: "muted" }, (cell && cell.source) || "");
      this._cells[n] = { v: vtd, s: std };
      tbl.append(el("tr", {},
        el("td", { class: "mono" }, "#" + n),
        el("td", {}, labelFor(n)),
        vtd, std,
        el("td", {}, el("button", {
          class: "btn ghost", title: "remove",
          onclick: () => { this.list = this.list.filter((x) => x !== n); save(this.list); this.render(ctx); this.onPoll(ctx); },
        }, "×"))));
    }
    c.append(tbl);
    const ok = ctx.status && ctx.status.dot === "ok";
    c.append(el("div", { class: "muted", style: "margin-top:6px;" },
      ok ? "snapshot from last run · read-only" : "connect a gateway to read values"));
  },

  async onPoll(ctx) {
    if (!this.list || !this.list.length) return;
    let res = null;
    try { res = await ctx.client.readVars(this.list); } catch { return; }
    if (!res || !res.values) return;
    this.values = res.values;
    for (const n of this.list) {
      const cell = res.values[String(n)];
      const ref = this._cells && this._cells[n];
      if (ref) {
        ref.v.textContent = fmtVal(cell);
        ref.v.className = "mono" + (cell && cell.available ? "" : " muted");
        ref.s.textContent = (cell && cell.source) || "";
      }
    }
  },
};
