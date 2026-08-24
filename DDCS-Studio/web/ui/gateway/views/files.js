// files.js — the CNCDISK explorer: list the controller's files, view G-code (preview-block), delete (safe).
// t1327 — it obeys the declared connection-state contract: no gateway → no rows (gateway/state.js).
import { el, toast } from "../util.js";
import { stateNote } from "../state.js";   // t1327 — the one wording for "nothing here is live"
import { dlgConfirm, dlgPrompt, dlgNotice } from '../../dialog.js';   // in-app dialogs (t684 d — no bare confirm/prompt/alert)

export default {
  id: "files",
  // t2241 (BACKLOG amendment 6) — was "Files (CNCDISK)"; shortened for the one-row tab-strip goal. CNCDISK
  // itself is not lost — the section-label inside the tab body already reads "CNCDISK · <path>" (below).
  label: "Files",

  mount(ctx) {
    // t1249 — THE DEPLOY TARGET ROW. The deploy buttons themselves (Export program, the CAM bundle, a SYSDISK file)
    // just write; WHERE they write is a property of the app, not of each button, so it is stated once — here, on the
    // Gateway's files surface, which is already where "getting things onto the machine" lives.
    this.target = el("section", { class: "block", id: "gw_deploy_target" });
    this.list = el("section", { class: "block" });
    this.viewer = el("section", { class: "block hidden" });
    ctx.root.append(this.target, this.list, this.viewer);
    this.renderTarget();
    this.onPoll(ctx);
  },

  async renderTarget() {
    const D = await import('../../../data/deployFolder.js');
    const name = await D.deployTargetName();
    const row = el("div", { class: "row", style: "align-items:center; gap:8px; flex-wrap:wrap;" });
    row.append(el("span", { class: "section-label", style: "margin:0;" }, "DEPLOY TARGET"));
    row.append(el("span", { class: name ? "mono" : "muted" },
      name ? ("📁 " + name) : "not chosen yet — the first deploy will ask (a USB stick works: deploys land straight on it)"));
    row.append(el("span", { style: "flex:1" }));
    const btn = el("button", { class: "op-btn", id: "gw_deploy_pick", onclick: async () => {
      // re-pick ALWAYS opens the picker: this button exists to CHANGE the target, so silently reusing the remembered
      // one (which is what a plain ensure() does) would make the button look broken.
      const dir = await D.ensureDeployFolder({ repick: true });
      if (dir) { toast("Deploy target: " + (dir.name || "chosen")); this.renderTarget(); }
    } }, name ? "Change…" : "Choose folder…");
    if (!D.hasFSA()) { btn.disabled = true; btn.title = "This browser cannot grant a folder — deploys download instead."; }
    row.append(btn);
    this.target.replaceChildren(row);
  },

  async onPoll(ctx) {
    let idx;
    // t1327 — THE PHANTOM LISTING'S ROOT. This used to `return` on a failed poll, leaving the LAST SUCCESSFUL listing
    // on screen — rows naming files on a controller that is not there, with view and DELETE still armed. A delete
    // clicked from that state fires at whatever gateway answers next. The contract (gateway/state.js) says this tab
    // CLEARS when unreachable: a tab either has an answer from the current state or it says it has none.
    try { idx = await ctx.client.listFiles(); }
    catch {
      this.list.replaceChildren(el("div", { class: "section-label" }, "CNCDISK"), stateNote(el, "files"));
      return;
    }
    const c = this.list;
    c.replaceChildren(el("div", { class: "section-label" }, "CNCDISK · " + (idx.path || "")));
    if (idx.error) { c.append(el("div", { class: "muted" }, "unreachable: " + idx.error)); return; }
    if (!idx.files.length) { c.append(el("div", { class: "muted" }, "(empty)")); return; }
    const tbl = el("table", {}, el("tr", {}, el("th", {}, "name"), el("th", {}, "size"), el("th", {}, "")));
    for (const f of idx.files) {
      tbl.append(el("tr", {},
        el("td", { class: "mono" }, f.name),
        el("td", { class: "mono" }, String(f.size)),
        el("td", {}, el("div", { class: "row" },
          el("button", { class: "op-btn", onclick: () => this.view(ctx, f.name) }, "view"),
          el("button", { class: "op-btn danger", onclick: () => this.del(ctx, f.name) }, "delete")))));
    }
    c.append(tbl);
  },

  async del(ctx, name) {
    if (!(await dlgConfirm(`Delete ${name} from the controller?`, { danger: true, okLabel: 'Delete' }))) return;
    try {
      const r = await ctx.client.deleteFile(name);
      r.ok ? toast("Deleted " + name) : toast("Delete refused: " + r.error, true);
      this.onPoll(ctx);
    } catch (e) { toast("Delete failed: " + e.message, true); }
  },

  async view(ctx, name) {
    try {
      const r = await ctx.client.readFile(name);
      const v = this.viewer;
      v.classList.remove("hidden");
      v.replaceChildren();
      if (!r.ok) { v.append(el("div", { class: "muted" }, "cannot read: " + r.error)); return; }
      v.append(
        el("div", { class: "row spread" },
          el("div", { class: "section-label" }, "G-code · " + name),
          el("button", { class: "op-btn", onclick: () => v.classList.add("hidden") }, "close")),
        el("div", { class: "preview-block" }, el("pre", {}, r.content)));
    } catch (e) { toast("Read failed: " + e.message, true); }
  },
};
