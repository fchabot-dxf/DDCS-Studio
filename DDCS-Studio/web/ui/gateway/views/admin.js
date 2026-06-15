// admin.js — the Setup view. On a LOCAL gateway it's an editable form (machine name, controller disk,
// beacons) with a clear connection status. On the CLOUD console it's read-only (the cloud can't reach
// into the gateway — configure it on the machine PC). A form view: mounted on tab click, not polled.
import { el, toast } from "../util.js";
import { getService, setService } from "../service.js";

export default {
  id: "admin",
  label: "Console",

  async mount(ctx) {
    this.serviceCard = el("section", { class: "block" });
    this.card = el("section", { class: "block" });
    ctx.root.append(this.serviceCard, this.card);
    this.renderService(ctx);                 // optional cloud-service picker (always available)
    await this.render(ctx);                  // gateway config (needs a reachable gateway)
  },

  // Optional cloud-service picker — CLIENT-side: which /api the Gateway talks to. Local-first by default so
  // users stay autonomous (no service needed); pointing at a service just sets ddcs_api/ddcs_token (service.js).
  // Always rendered, even when no gateway answers, so you can re-point at a different service.
  renderService(ctx) {
    const svc = getService();
    const baseIn = el("input", { type: "text", value: svc.base, placeholder: "https://your-service.example/  (Cloudflare / self-host)", style: "width:100%" });
    const tokIn = el("input", { type: "text", value: svc.token, placeholder: "access token (optional)", style: "width:100%" });
    // One-click: point the hosted (HTTPS) page at a gateway running on THIS PC — gives the exe experience
    // (cloud UI + local controller). Browsers allow HTTPS→http://localhost, and the gateway already sends CORS.
    const localGw = el("button", { class: "op-btn" }, "↩ Use local gateway (127.0.0.1:8765)");
    localGw.onclick = () => { baseIn.value = "http://127.0.0.1:8765"; tokIn.value = ""; };
    const cloudFields = el("div", { class: "block" },
      el("div", { class: "row" }, localGw),
      el("div", { style: "margin-top:8px" }, el("span", { class: "label" }, "Service URL"), baseIn),
      el("div", { style: "margin-top:8px" }, el("span", { class: "label" }, "Access token"), tokIn),
      el("div", { class: "hint" },
        "Same PC: point at http://127.0.0.1:<port> — the hosted page reaches a local gateway (localhost is "
        + "allowed even from HTTPS; the gateway already sends CORS). Other PC / remote: the gateway needs HTTPS "
        + "or a tunnel (browsers block an HTTPS page → http:// on a LAN IP)."));

    const local = el("input", { type: "radio", name: "gw-svc" }); local.checked = svc.mode === "local";
    const cloud = el("input", { type: "radio", name: "gw-svc" }); cloud.checked = svc.mode === "cloud";
    const sync = () => cloudFields.classList.toggle("hidden", !cloud.checked);
    local.onchange = cloud.onchange = sync;

    const gdrive = el("button", { class: "op-btn", disabled: "" }, "🔗 Connect Google Drive (OAuth) — coming soon");

    const apply = el("button", { class: "primary" }, "Apply");
    apply.onclick = () => {
      setService(cloud.checked ? { base: baseIn.value.trim(), token: tokIn.value.trim() } : {});
      toast("Service updated — reloading");
      setTimeout(() => location.reload(), 400);
    };

    this.serviceCard.replaceChildren(
      el("div", { class: "section-label" }, "Service (optional)"),
      el("div", { class: "wiz-usage" },
        "Local-first: by default the Gateway uses the gateway on this PC — no account, fully autonomous. "
        + "Optionally point it at a cloud service (your own Cloudflare / self-host endpoint now; OAuth'd cloud "
        + "storage like Google Drive later). Clearing it returns to local."),
      el("label", { class: "row", style: "gap:6px;cursor:pointer;margin-top:8px" }, local, "Local (this PC) — autonomous"),
      el("label", { class: "row", style: "gap:6px;cursor:pointer" }, cloud, "Cloud service"),
      cloudFields,
      el("div", { class: "row", style: "margin-top:8px" }, gdrive),
      el("div", { class: "row", style: "margin-top:12px" }, apply));
    sync();
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
    const beacons = el("input", { type: "checkbox" });
    beacons.checked = !!cfg.enable_slave;
    // LAN serving ("personal cloud", COMBINED-APP-PLAN Step 3): off = 127.0.0.1 (this PC only),
    // on = 0.0.0.0 (any device on the user's wifi opens Studio in a browser — no install).
    const lan = el("input", { type: "checkbox" });
    lan.checked = cfg.host === "0.0.0.0";
    const lanUrl = cfg.lan_ip ? `http://${cfg.lan_ip}:${cfg.port || 8765}` : "";
    const lanHint = el("span", { class: "hint" },
      lan.checked && lanUrl ? `On your phone/tablet, open ${lanUrl}` : "Off = this PC only.");
    lan.onchange = () => {
      lanHint.textContent = lan.checked
        ? (lanUrl ? `On your phone/tablet, open ${lanUrl}` : "LAN address unavailable — check after restart.")
        : "Off = this PC only.";
    };
    // Serve port (desktop exe): which loopback port the app uses — limited to our registered ports so the
    // OAuth JS-origin list still covers it. Takes effect on the next launch (fairy_gateway._preferred_port).
    const PORTS = [8765, 8766, 8767, 8768, 8769];
    const portSel = el("select", {}, PORTS.map((p) => el("option", { value: String(p) }, String(p))));
    portSel.value = String(cfg.port || 8765);
    const save = el("button", { class: "primary" }, "Save");
    const info = el("div", { class: "hint" });

    save.onclick = async () => {
      save.disabled = true;
      try {
        const r = await ctx.client.setConfig({
          machine_name: name.value, dest: destField.value.trim(), enable_slave: beacons.checked,
          host: lan.checked ? "0.0.0.0" : "127.0.0.1", port: parseInt(portSel.value, 10),
        });
        if (!r.ok) { toast(r.error || "save failed", true); info.textContent = r.error || ""; }
        else {
          toast("Saved");
          info.textContent = r.restart_needed
            ? "Saved. Restart the gateway to apply (beacons / network binding)." : "Saved + applied.";
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
      el("label", { class: "row", style: "margin-top:12px;gap:6px;cursor:pointer" },
        beacons, "Beacons (Modbus progress — Expert only; leave off for V4.1)"),
      el("label", { class: "row", style: "margin-top:12px;gap:6px;cursor:pointer" },
        lan, "Allow other devices on my network (serve Studio on the LAN)"),
      lanHint,
      el("div", { style: "margin-top:12px" },
        el("span", { class: "label" }, "Serve port (desktop app)"), portSel,
        el("span", { class: "hint" }, "Loopback port the app serves on (8765-8769). Restart to apply.")),
      el("div", { class: "row", style: "margin-top:14px" }, save), info,

      this.profileBlock(prof),
      el("div", { class: "wiz-usage" }, `gateway v${d.version || "?"} · backend ${d.backend || "?"}`));
  },
};
