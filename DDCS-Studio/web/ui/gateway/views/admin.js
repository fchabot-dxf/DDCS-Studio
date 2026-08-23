// admin.js — the Setup view. On a LOCAL gateway it's an editable form (machine name, controller disk,
// beacons) with a clear connection status. On the CLOUD console it's read-only (the cloud can't reach
// into the gateway — configure it on the machine PC). A form view: mounted on tab click, not polled.
import { el, toast } from "../util.js";
import { getService, setService, GATEWAY_PORTS, DEFAULT_LOCAL_BASE } from "../service.js";
import { roleInfoFromDescriptor } from "../../gatewayStatus.js";   // t2151 — the client-side, workspace-relative role, applied to THIS view's own freshly-fetched descriptor (`d` below) — never gatewayStatus.js's separately-polled cache, which a hand-mounted view under test never populates

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

    // t1325 (USER, blocked live) — THE DAEMON URL FIELD THE STATUS MESSAGE ALREADY PROMISED. Status says "connect
    // one in the Console tab (a local daemon or a service URL)" and, until now, the only URL box lived behind the
    // CLOUD radio — so in Local mode there was nothing to type into, and reaching a local daemon from a hosted page
    // meant picking "Cloud service" and then clicking a button labelled "use local gateway". The message and the
    // controls now describe the same thing.
    const daemonIn = el("input", { type: "text", id: "gw-daemon-url", value: svc.typed, placeholder: DEFAULT_LOCAL_BASE + "  (leave empty to find it automatically)", style: "width:100%" });
    const daemonState = el("div", { class: "hint", id: "gw-daemon-state" });
    const setDaemonState = () => {
        const cur = getService();
        daemonState.textContent = cur.typed
            ? "Using the address you entered."
            : cur.adopted
                ? "Found automatically: " + cur.adopted + " — type an address above to override it."
                : "Looking for a gateway on 127.0.0.1 (ports " + GATEWAY_PORTS.join(", ") + ") while this page is open. "
                  + "Loopback works even from an https:// page, so a gateway running on this PC is reached with no setup.";
    };
    setDaemonState();
    const localFields = el("div", { class: "block" },
        el("div", { style: "margin-top:8px" }, el("span", { class: "label" }, "Daemon URL"), daemonIn),
        daemonState);

    const local = el("input", { type: "radio", name: "gw-svc" }); local.checked = svc.mode === "local";
    const cloud = el("input", { type: "radio", name: "gw-svc" }); cloud.checked = svc.mode === "cloud";
    const sync = () => {
        cloudFields.classList.toggle("hidden", !cloud.checked);
        localFields.classList.toggle("hidden", !local.checked);
    };
    local.onchange = cloud.onchange = sync;

    // t2076 — the dead "Connect Google Drive — coming soon" button lived here and is GONE: Drive is real
    // now, and it belongs in Setup beside the transport it actually configures, not in the Service card
    // (which chooses which GATEWAY this browser talks to — a different question entirely).
    const apply = el("button", { class: "primary" }, "Apply");
    apply.onclick = () => {
      // LOCAL with a typed daemon URL is still an explicit base — the same seam, just named for what it is here.
      // Empty returns to auto (setService clears the adopted one too, so the next probe re-decides).
      setService(cloud.checked ? { mode: 'cloud', base: baseIn.value.trim(), token: tokIn.value.trim() }
                               : { mode: 'local', base: daemonIn.value.trim() });
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
      localFields,
      el("label", { class: "row", style: "gap:6px;cursor:pointer" }, cloud, "Cloud service"),
      cloudFields,
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
    // t2111 (S1, ROLES-PLAN) - GATE THE CONTROLLER-WIRING FIELDS BY ROLE. The human's own definition of the
    // feature: 'the client is really hiding the settings that help connect the gateway to the controller'.
    // A client is a PC with no controller wired to it, so the disk path, the Modbus beacons and the
    // controller-profile card are settings for hardware it does not have.
    // ⛔ ROLE GATES ONLY THIS GROUP. The cloud/account settings below are NOT gated and must never be: a
    //    client's ONLY transport is Drive, so hiding them would remove the one thing it needs, and a
    //    Drive-less gateway is a first-class setup that must still be able to REACH them (hiding a door is
    //    the bug, not the feature). See ROLES-PLAN's retraction of the second gating axis.
    // ⚠ REDUCE, NEVER HIDE, THE WAY TO CORRECT A WRONG ROLE. role_conflict = an explicit 'client' override
    //    with a controller disk still configured. If we hid the disk field in that state the user could
    //    never CLEAR it, and the contradiction would be permanent. So a conflict SHOWS the fields and says
    //    what is wrong - stated, never silently resolved (S0's own constraint).
    // t2151 (BACKLOG #11) — TWO DIFFERENT QUESTIONS, deliberately kept apart. `baseRole` (from THIS view's own
    // freshly-fetched `d`, same source as before t2151) answers "does this PC have a controller disk
    // configured at all?" and is what governs whether the WIRING FIELDS EXIST: real settings for real
    // hardware, unaffected by which workspace happens to be open. `mismatch` answers a DIFFERENT question —
    // "does the connected controller match the OPEN WORKSPACE's declared one?" — and must NEVER hide these
    // fields: a PC that is a genuine gateway for a DIFFERENT controller still has real wiring to show/edit
    // here, it just cannot currently act as gateway for the workspace that happens to be open right now (see
    // the banner below, not a field hide).
    const { baseRole, role: effRole, reason: mismatchReason } = roleInfoFromDescriptor(d);
    const isClient = baseRole === 'client';
    const conflict = !!d.role_conflict;
    const hideWiring = isClient && !conflict;
    const mismatch = baseRole === 'gateway' && effRole === 'client' && !!mismatchReason;
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
    const PORTS = GATEWAY_PORTS;   // t1325 — one source: the same registered ports the loopback auto-probe scans
    const portSel = el("select", {}, PORTS.map((p) => el("option", { value: String(p) }, String(p))));
    portSel.value = String(cfg.port || 8765);
    // t2076 — BYO CLOUD: send jobs through the user's OWN Google Drive instead of this PC's folder.
    // The gateway's `backend` IS the transport ("local" = this PC, "drive" = their Drive), so the toggle
    // writes exactly that. Both ends sign into the same Google account and share one OAuth client, so the
    // sending machine's Drive folder IS the receiving gateway's inbox — no ports, no addresses, no LAN.
    const useDrive = el("input", { type: "checkbox" });
    useDrive.checked = cfg.backend === "drive";
    const gConnect = el("button", { class: "op-btn" }, "🔗 Connect Google Drive");
    const gState = el("span", { class: "hint" }, "checking…");
    const paintGoogle = (st) => {
      const on = !!(st && st.connected);
      gState.textContent = !st || !st.configured
        ? "No Google client configured in this build — Drive sending unavailable."
        : on ? "Connected to Google Drive." : "Not connected — click Connect and approve in your browser.";
      gConnect.textContent = on ? "🔗 Reconnect Google Drive" : "🔗 Connect Google Drive";
      gConnect.disabled = !!(st && !st.configured);
    };
    ctx.client.googleStatus().then(paintGoogle).catch(() => paintGoogle(null));
    gConnect.onclick = async () => {
      gConnect.disabled = true;
      try {
        const r = await ctx.client.googleConnect();
        if (r && r.ok) {
          // The gateway opened the SYSTEM browser (Google blocks OAuth inside an embedded webview).
          gState.textContent = "Approve DDCS Studio in the browser window, then click Connect again to confirm.";
        } else toast((r && r.error) || "could not start Google sign-in", true);
      } catch (e) { toast("sign-in failed: " + e.message, true); }
      finally { gConnect.disabled = false; }
    };

    const save = el("button", { class: "primary" }, "Save");
    const info = el("div", { class: "hint" });

    save.onclick = async () => {
      save.disabled = true;
      try {
        const r = await ctx.client.setConfig({
          machine_name: name.value, dest: destField.value.trim(), enable_slave: beacons.checked,
          host: lan.checked ? "0.0.0.0" : "127.0.0.1", port: parseInt(portSel.value, 10),
          backend: useDrive.checked ? "drive" : "local",
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
      ...(conflict ? [el("div", { class: "wiz-usage", style: "border-left:3px solid var(--warn,#f59e0b);padding-left:8px" },
        "This PC is set to CLIENT, but a controller disk is still configured. Those disagree - clear the disk below, "
        + "or set the role back to gateway. Nothing has been changed for you.")] : []),
      // t2151 (BACKLOG #11) — STATE IT, NEVER AUTO-SWITCH. This PC IS a gateway (wiring fields below are real
      // and stay visible) but not FOR the workspace that happens to be open right now — a fact, not a caution,
      // and never resolved by re-pointing anything: the user may be authoring for a machine not in front of
      // them, which is legitimate.
      ...(mismatch ? [el("div", { class: "wiz-usage", style: "border-left:3px solid var(--warn,#f59e0b);padding-left:8px" },
        "This PC's own gateway is wired to a different controller than the WORKSPACE you have open (" + mismatchReason
        + "). Sending/tracking here act as a CLIENT for this workspace — the job queues until a matching gateway "
        + "claims it. This PC's own wiring below is unaffected; nothing has been changed for you.")] : []),
      el("div", {}, el("span", { class: "label" }, "Machine name"), name),
      ...(hideWiring ? [] : [
      el("div", { style: "margin-top:10px" },
        el("span", { class: "label" }, "Controller disk (network share)"),
        destField,
        el("span", { class: "hint" }, "Must be a network share, e.g. \\\\10.0.0.50\\cncdisk — local folders aren't allowed.")),
      el("label", { class: "row", style: "margin-top:12px;gap:6px;cursor:pointer" },
        beacons, "Beacons (Modbus progress — Expert only; leave off for V4.1)"),
      ]),
      el("label", { class: "row", style: "margin-top:12px;gap:6px;cursor:pointer" },
        lan, "Allow other devices on my network (serve Studio on the LAN)"),
      lanHint,
      el("div", { style: "margin-top:12px" },
        el("span", { class: "label" }, "Serve port (desktop app)"), portSel,
        el("span", { class: "hint" }, "Loopback port the app serves on (8765-8769). Restart to apply.")),

      // t2076 — the "send from anywhere" path. Deliberately in Setup (not the Service card): this is the
      // GATEWAY's own transport, not which gateway the browser talks to.
      el("div", { class: "section-label", style: "margin-top:18px" }, "Cloud storage (send from anywhere)"),
      el("div", { class: "wiz-usage" },
        "Sends jobs through YOUR Google Drive instead of this PC. Sign in on both machines with the same "
        + "Google account: the one you send from writes the job, the one wired to the controller picks it "
        + "up and delivers it. No ports, no IP addresses, works over the internet."),
      el("div", { class: "row", style: "margin-top:8px;gap:8px" }, gConnect),
      gState,
      el("label", { class: "row", style: "margin-top:10px;gap:6px;cursor:pointer" },
        useDrive, "Send jobs through my Google Drive"),
      el("span", { class: "hint" }, "Restart the gateway to apply. Polls every ~15s (Drive's rate limits) — "
        + "fine for sending; live progress always uses the serial cable, never this."),
      el("div", { class: "row", style: "margin-top:14px" }, save), info,

      ...(hideWiring ? [] : [this.profileBlock(prof)]),
      el("div", { class: "wiz-usage" }, `gateway v${d.version || "?"} · backend ${d.backend || "?"}`));
  },
};
