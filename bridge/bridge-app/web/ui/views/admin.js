// admin.js — the Setup view. On a LOCAL gateway it's an editable form (machine name, controller disk)
// with a clear connection status. On the CLOUD console it's read-only (the cloud can't reach
// into the gateway — configure it on the machine PC). A form view: mounted on tab click, not polled.
import { el, toast } from "../util.js";

export default {
  id: "admin",
  label: "Setup",

  async mount(ctx) {
    this.card = el("section", { class: "block" });
    ctx.root.append(this.card);
    await this.render(ctx);
  },

  async render(ctx) {
    let d;
    try { d = await ctx.client.descriptor(); }
    catch { this.card.replaceChildren(el("div", { class: "muted" }, "gateway unreachable")); return; }
    if ("online" in d) return this.renderCloud(d);          // cloud console: read-only
    let cfg = {};
    try { cfg = await ctx.client.getConfig(); } catch { /* keep defaults */ }
    let prof = null;
    try { prof = await ctx.client.profile(); } catch { /* controller may be offline */ }
    this.renderSetup(ctx, d, cfg, prof);
  },

  renderCloud(d) {
    const rows = [
      ["machine name", d.machine_name || "—"],
      ["controller", d.dest || "—"],
      ["gateway online", d.online ? "yes" : "no"],
      ["controller connected", d.controller_connected ? "yes" : "no"],
      ["backend", d.backend],
    ];
    const tbl = el("table");
    for (const [k, v] of rows) tbl.append(el("tr", {}, el("td", {}, k), el("td", { class: "mono" }, String(v))));
    this.card.replaceChildren(
      el("div", { class: "section-label" }, "Gateway (cloud view)"),
      tbl,
      el("div", { class: "wiz-usage" },
        "This is the cloud console — it can't configure the gateway (the gateway is outbound-only). "
        + "Set it up in the Setup tab of the gateway's own console, on the machine PC."));
  },

  // Controller-profile card: what hardware the connected controller actually reports, and whether it
  // matches the expected baseline. Source "controller" = read live off the machine; "builtin" = the
  // fallback baseline (controller not read). Validation surfaces a wrong share / decode / ATC-misconfig.
  profileBlock(prof) {
    const wrap = el("section", { style: "margin-top:18px" },
      el("div", { class: "section-label" }, "Controller profile"));
    if (!prof) {
      wrap.append(el("div", { class: "muted" }, "controller not read — connect the controller to detect its hardware"));
      return wrap;
    }
    const live = prof.source === "controller";
    wrap.append(el("div", { class: "row", style: "gap:8px;align-items:center" },
      el("span", {}, prof.name || prof.id || "—"),
      el("span", { class: "mono muted", style: "font-size:11px;border:1px solid #3a3a3a;border-radius:4px;padding:1px 6px" },
        live ? "from controller" : "builtin baseline")));

    const tabs = prof.hardwareTabs || [];
    const chips = el("div", { class: "row", style: "gap:6px;margin-top:8px;flex-wrap:wrap" },
      el("span", { class: "muted", style: "font-size:12px" }, "tabs:"));
    if (tabs.length) {
      for (const t of tabs) chips.append(el("span",
        { style: "font-size:11px;background:#26331f;color:#9fd17a;border-radius:4px;padding:1px 7px" }, t));
    } else chips.append(el("span", { class: "muted", style: "font-size:12px" }, "none"));
    wrap.append(chips);

    const p = prof.pins;
    if (p) {
      const lvl = (n) => (n === 1 ? "P" : "N");
      const parts = [];
      if (p.probe) parts.push(`probe IN${p.probe} (${lvl(p.probeLevel)})`);
      if (p.setter) parts.push(`setter IN${p.setter} (${lvl(p.setterLevel)})`);
      const lim = Object.keys(p.limits || {}).length;
      if (lim) parts.push(`${lim} limit input${lim > 1 ? "s" : ""}`);
      if (parts.length) wrap.append(el("div", { class: "muted mono", style: "font-size:12px;margin-top:6px" }, parts.join("  ·  ")));
    }

    const v = prof.validation;
    if (live && v) {
      if (v.ok) {
        wrap.append(el("div", { class: "row", style: "gap:6px;margin-top:10px" },
          el("span", { class: "dot ok" }), el("span", { style: "font-size:12px" },
            `matches baseline (${v.paramCount} params, anchors OK)`)));
      } else {
        wrap.append(el("div", { class: "row", style: "gap:6px;margin-top:10px" },
          el("span", { class: "dot warn" }), el("span", { style: "font-size:12px" }, "profile mismatch")));
        for (const w of v.warnings || []) wrap.append(el("div", { class: "hint", style: "color:#d1a35a" }, "• " + w));
      }
    }
    return wrap;
  },

  renderSetup(ctx, d, cfg, prof) {
    const dest = (cfg.dest || "");
    const isRemote = dest.startsWith("\\\\") || dest.startsWith("//");
    const statusText = !dest ? "no controller set — enter the controller disk below"
      : !isRemote ? "sandbox (local folder)"
      : d.controller_connected ? "live — connected to " + dest
      : "controller offline — " + dest + " not reachable";
    const statusDot = (!dest || !isRemote || !d.controller_connected) ? "warn" : "ok";

    const name = el("input", { type: "text", value: cfg.machine_name || "", placeholder: "e.g. Ultimate Bee" });
    const destField = el("input", { type: "text", value: dest, placeholder: "\\\\10.0.0.50\\cncdisk", style: "width:100%" });
    const PORTS = [8765, 8766, 8767, 8768, 8769];
    const portSel = el("select", {}, PORTS.map((p) => el("option", { value: String(p) }, String(p))));
    portSel.value = String(cfg.port || 8765);
    const save = el("button", { class: "primary" }, "Save");
    const info = el("div", { class: "hint" });

    save.onclick = async () => {
      save.disabled = true;
      try {
        const r = await ctx.client.setConfig({
          machine_name: name.value, dest: destField.value.trim(),
          port: parseInt(portSel.value, 10),
        });
        if (!r.ok) { toast(r.error || "save failed", true); info.textContent = r.error || ""; }
        else {
          toast("Saved");
          info.textContent = r.restart_needed ? "Saved — restart the gateway to apply." : "Saved + applied.";
          await this.render(ctx);
        }
      } catch (e) { toast("save failed: " + e.message, true); }
      finally { save.disabled = false; }
    };

    this.card.replaceChildren(
      el("div", { class: "section-label" }, "Connection"),
      el("div", { class: "row" }, el("span", { class: "dot " + statusDot }), el("span", {}, statusText)),

      el("div", { class: "section-label", style: "margin-top:18px" }, "Setup"),
      el("div", {}, el("span", { class: "label" }, "Machine name"), name),
      el("div", { style: "margin-top:10px" },
        el("span", { class: "label" }, "Controller disk (network share)"),
        destField,
        el("span", { class: "hint" }, "Must be a network share, e.g. \\\\10.0.0.50\\cncdisk — local folders aren't allowed.")),
      el("div", { class: "row", style: "margin-top:14px" }, save), info,

      this.profileBlock(prof),
      el("div", { class: "wiz-usage" }, `gateway v${d.version || "?"} · backend ${d.backend || "?"}`));
  },
};
