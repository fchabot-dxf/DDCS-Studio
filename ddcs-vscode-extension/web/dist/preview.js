var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../DDCS-Studio/web/ui/cloud/providers.js
function getProvider(id) {
  return CFG[id] || null;
}
function providerLabel(id) {
  return (CFG[id] || {}).label || id;
}
function providerIcon(id) {
  return ICONS[id] || "";
}
function clientId(id) {
  try {
    const v = localStorage.getItem("ddcs_clientid_" + id);
    if (v) return v;
  } catch (e) {
  }
  return DEFAULT_CLIENT_IDS[id] || "";
}
function setClientId(id, v) {
  try {
    v ? localStorage.setItem("ddcs_clientid_" + id, v) : localStorage.removeItem("ddcs_clientid_" + id);
  } catch (e) {
  }
}
var CFG, ICONS, PROVIDER_IDS, DEFAULT_CLIENT_IDS, redirectUri;
var init_providers = __esm({
  "../DDCS-Studio/web/ui/cloud/providers.js"() {
    CFG = {
      google: {
        label: "Google Drive",
        authorize: "https://accounts.google.com/o/oauth2/v2/auth",
        token: "https://oauth2.googleapis.com/token",
        scope: "https://www.googleapis.com/auth/drive.file",
        extraAuth: { access_type: "offline", prompt: "consent" },
        corsToken: false
        // Google's token endpoint blocks browser fetch — needs GIS (TODO)
      },
      dropbox: {
        label: "Dropbox",
        authorize: "https://www.dropbox.com/oauth2/authorize",
        token: "https://api.dropboxapi.com/oauth2/token",
        scope: "files.content.write files.content.read",
        extraAuth: { token_access_type: "offline" },
        corsToken: true
      },
      onedrive: {
        label: "OneDrive",
        authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        scope: "Files.ReadWrite offline_access",
        extraAuth: {},
        corsToken: true
      }
    };
    ICONS = {
      google: '<svg width="16" height="16" viewBox="0 0 87.3 78" aria-hidden="true"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>',
      dropbox: '<svg width="16" height="16" viewBox="0 0 43 40" aria-hidden="true"><path fill="#0061FF" d="M12.6 0 0 8.1l8.7 7 12.8-7.9zM0 22.1l12.6 8.2 8.9-7.4-12.8-7.9zm21.5.8 8.9 7.4L43 22.1l-8.7-6.9zM43 8.1 30.4 0l-8.9 7.2 12.8 7.9zM21.5 24.5l-8.9 7.4-3.8-2.5v2.8l12.7 7.6 12.7-7.6v-2.8l-3.8 2.5z"/></svg>',
      onedrive: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#0364B8" d="M13.6 9.7a4.3 4.3 0 0 0-8.1-1.4A3.8 3.8 0 0 0 6 15.9h12.3a3.2 3.2 0 0 0 .4-6.4 3.7 3.7 0 0 0-5.1-.2z"/></svg>'
    };
    PROVIDER_IDS = Object.keys(CFG);
    DEFAULT_CLIENT_IDS = {
      // PUBLIC OAuth client IDs (safe in the browser — no secret). drive.file SPA client; secret stays out of git.
      google: "895572525139-mapt84pm4lfudmjfq553k6pm4m2o0e77.apps.googleusercontent.com",
      dropbox: "",
      onedrive: ""
    };
    redirectUri = () => location.origin + "/oauth-callback.html";
  }
});

// ../DDCS-Studio/web/ui/cloud/googleDrive.js
var googleDrive_exports = {};
__export(googleDrive_exports, {
  connectGoogle: () => connectGoogle,
  del: () => del,
  ensureRoot: () => ensureRoot,
  getAccessToken: () => getAccessToken,
  list: () => list,
  mkdir: () => mkdir,
  read: () => read,
  rename: () => rename,
  setRoot: () => setRoot,
  write: () => write
});
function setRoot(id) {
  try {
    id ? localStorage.setItem(FOLDER_KEY, id) : localStorage.removeItem(FOLDER_KEY);
  } catch (e) {
  }
}
function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = res;
    s.onerror = () => rej(new Error("Google Identity Services failed to load"));
    document.head.appendChild(s);
  });
}
async function connectGoogle(clientId2) {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId2,
      scope: SCOPE,
      callback: (r) => r && r.access_token ? resolve(r.access_token) : reject(new Error(r && r.error || "no token")),
      error_callback: (e) => reject(new Error(e && e.type || "sign-in cancelled"))
    });
    client.requestAccessToken();
  });
}
async function api(url, opts = {}, retried = false) {
  const r = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + token(), ...opts.headers || {} } });
  if (r.status === 401 && !retried) {
    try {
      await silentRefresh();
    } catch (e) {
      throw new Error("cloud-auth");
    }
    return api(url, opts, true);
  }
  if (r.status === 401) throw new Error("cloud-auth");
  if (!r.ok) throw new Error("Drive " + r.status);
  return r;
}
async function silentRefresh() {
  if (window.pywebview && window.pywebview.api) {
    let t = {};
    try {
      t = await (await fetch("/api/oauth/google/token")).json();
    } catch (e) {
    }
    if (t.access_token) {
      try {
        localStorage.setItem(TOK, t.access_token);
      } catch (e) {
      }
      return;
    }
    throw new Error("silent-fail");
  }
  await loadGis();
  const cid = clientId("google");
  if (!cid) throw new Error("no client id");
  return new Promise((resolve, reject) => {
    const c2 = window.google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: SCOPE,
      callback: (resp) => {
        if (resp && resp.access_token) {
          try {
            localStorage.setItem(TOK, resp.access_token);
          } catch (e) {
          }
          resolve();
        } else reject(new Error("no token"));
      },
      error_callback: () => reject(new Error("silent-fail"))
    });
    c2.requestAccessToken({ prompt: "" });
  });
}
async function ensureRoot() {
  let id = "";
  try {
    id = localStorage.getItem(FOLDER_KEY) || "";
  } catch (e) {
  }
  if (id) {
    try {
      const r = await (await api(`${API}/files/${id}?fields=id,trashed`)).json();
      if (r.id && !r.trashed) return id;
    } catch (e) {
    }
  }
  const q = encodeURIComponent(`mimeType='${FOLDER_MIME}' and name='DDCS Studio' and trashed=false`);
  const found = await (await api(`${API}/files?q=${q}&fields=files(id)`)).json();
  id = found.files && found.files[0] && found.files[0].id || "";
  if (!id) {
    const made = await (await api(`${API}/files?fields=id`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "DDCS Studio", mimeType: FOLDER_MIME }) })).json();
    id = made.id;
  }
  try {
    localStorage.setItem(FOLDER_KEY, id);
  } catch (e) {
  }
  return id;
}
async function list(folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const r = await (await api(`${API}/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&orderBy=folder,name`)).json();
  return (r.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    type: f.mimeType === FOLDER_MIME ? "folder" : "project",
    savedAt: f.modifiedTime
  }));
}
async function read(fileId) {
  return (await api(`${API}/files/${fileId}?alt=media`)).json();
}
async function mkdir(name, parentId) {
  const r = await (await api(`${API}/files?fields=id`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }) })).json();
  return r.id;
}
async function write(name, obj, parentId) {
  const safe = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(`'${parentId}' in parents and name='${safe}' and trashed=false`);
  const ex = await (await api(`${API}/files?q=${q}&fields=files(id)`)).json();
  const content = JSON.stringify(obj, null, 2);
  if (ex.files && ex.files[0]) {
    await api(`${UPLOAD}/files/${ex.files[0].id}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: content });
    return ex.files[0].id;
  }
  const boundary = "ddcs" + Math.random().toString(16).slice(2);
  const meta = JSON.stringify({ name, parents: [parentId], mimeType: "application/json" });
  const multipart = `--${boundary}\r
Content-Type: application/json; charset=UTF-8\r
\r
${meta}\r
--${boundary}\r
Content-Type: application/json\r
\r
${content}\r
--${boundary}--`;
  const r = await (await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart })).json();
  return r.id;
}
async function del(id) {
  await api(`${API}/files/${id}`, { method: "DELETE" });
}
async function rename(id, name) {
  await api(`${API}/files/${id}?fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
}
var SCOPE, API, UPLOAD, FOLDER_MIME, TOK, FOLDER_KEY, token, getAccessToken;
var init_googleDrive = __esm({
  "../DDCS-Studio/web/ui/cloud/googleDrive.js"() {
    init_providers();
    SCOPE = "https://www.googleapis.com/auth/drive.file";
    API = "https://www.googleapis.com/drive/v3";
    UPLOAD = "https://www.googleapis.com/upload/drive/v3";
    FOLDER_MIME = "application/vnd.google-apps.folder";
    TOK = "ddcs_cloud_token";
    FOLDER_KEY = "ddcs_gdrive_folder";
    token = () => {
      try {
        return localStorage.getItem(TOK) || "";
      } catch (e) {
        return "";
      }
    };
    getAccessToken = () => token();
  }
});

// ../DDCS-Studio/web/viz/navCube.js
function initCube(viz) {
  const THREE = viz.THREE;
  viz._cubeScene = new THREE.Scene();
  viz._cubeCam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  viz._cubeCam.up.set(0, 0, 1);
  const labels = ["RIGHT", "LEFT", "BACK", "FRONT", "TOP", "BOTTOM"];
  viz._cubeViews = ["right", "left", "back", "front", "top", "bottom"];
  const mats = labels.map((label) => {
    const c2 = document.createElement("canvas");
    c2.width = c2.height = 128;
    const x = c2.getContext("2d");
    x.fillStyle = "#cdd5df";
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "#7e8a9a";
    x.lineWidth = 7;
    x.strokeRect(4, 4, 120, 120);
    x.fillStyle = "#2b3340";
    x.font = "bold 19px sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(label, 64, 66);
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c2) });
  });
  viz._cubeMats = mats;
  viz._cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
  viz._cubeScene.add(viz._cube);
  viz._cubeScene.add(new THREE.LineSegments(new THREE.EdgesGeometry(viz._cube.geometry), new THREE.LineBasicMaterial({ color: 5595246 })));
  viz._cubeScene.add(new THREE.AxesHelper(0.95));
}
function cubeFaceAt(viz, e) {
  if (!viz._cubeScene || !viz._cubeRect) return -2;
  const r = viz.renderer.domElement.getBoundingClientRect();
  const { size, m } = viz._cubeRect;
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  const left = r.width - size - m, top = m;
  if (cx < left || cx > left + size || cy < top || cy > top + size) return -2;
  const ndc = new viz.THREE.Vector2((cx - left) / size * 2 - 1, -((cy - top) / size * 2 - 1));
  viz.raycaster.setFromCamera(ndc, viz._cubeCam);
  const hit = viz.raycaster.intersectObject(viz._cube, false)[0];
  return hit && hit.face ? hit.face.materialIndex : -1;
}
function highlightCubeFace(viz, idx) {
  if (!viz._cubeMats) return;
  let changed = false;
  for (let i = 0; i < viz._cubeMats.length; i++) {
    const hex = i === idx ? 6728447 : 16777215;
    if (viz._cubeMats[i].color.getHex() !== hex) {
      viz._cubeMats[i].color.setHex(hex);
      changed = true;
    }
  }
  if (changed) viz.render();
}
function nearestVisibleFace(viz, e) {
  if (!viz._cubeRect) return -1;
  const THREE = viz.THREE;
  const r = viz.renderer.domElement.getBoundingClientRect();
  const { size, m } = viz._cubeRect;
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  const left = r.width - size - m, top = m;
  const centers = [[0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0], [0, 0, 0.5], [0, 0, -0.5]];
  const cam = viz._cubeCam.position;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < 6; i++) {
    const c2 = centers[i];
    if (c2[0] * cam.x + c2[1] * cam.y + c2[2] * cam.z <= 0) continue;
    const v = new THREE.Vector3(c2[0], c2[1], c2[2]).project(viz._cubeCam);
    const sx = left + (v.x * 0.5 + 0.5) * size, sy = top + (-v.y * 0.5 + 0.5) * size;
    const d = (sx - cx) ** 2 + (sy - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
function pickCube(viz, e) {
  const idx = cubeFaceAt(viz, e);
  if (idx === -2) return false;
  const face = idx >= 0 ? idx : nearestVisibleFace(viz, e);
  if (face >= 0) {
    const v = viz._cubeViews[face];
    if (v) viz.setView(v);
  }
  return true;
}

// ../DDCS-Studio/web/viz/jogPendant.js
function setupJogPendant(viz) {
  const div = document.createElement("div");
  div.className = "viz3d-jog-pendant";
  div.style.cssText = "color: #fff; z-index: 100; font-size: 11px; display: none; user-select: none; box-sizing: border-box;";
  div.innerHTML = `
            <div class="jog-grid-wrap" style="display: none; background: rgba(18,18,22,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px; margin-bottom: 6px;">
                <div class="jog-start-sel" style="display: none; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                    <span style="color:#9fb4c8;">Start</span>
                    <span class="jog-start-btns" style="display: flex; gap: 4px;"></span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #888; margin-bottom: 6px;">
                    <span style="color:#9fb4c8;">Step</span>
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="1"> 1.0</label>
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="10" checked> 10</label>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 32px 32px; gap: 6px;">
                    <button class="toolbar-btn" data-axis="z" data-dir="-1" style="font-weight:bold; padding:0;">Z-</button>
                    <button class="toolbar-btn" data-axis="y" data-dir="1" style="font-weight:bold; padding:0;">Y+</button>
                    <button class="toolbar-btn" data-axis="z" data-dir="1" style="font-weight:bold; padding:0;">Z+</button>
                    <button class="toolbar-btn" data-axis="x" data-dir="-1" style="font-weight:bold; padding:0;">X-</button>
                    <button class="toolbar-btn" data-axis="y" data-dir="-1" style="font-weight:bold; padding:0;">Y-</button>
                    <button class="toolbar-btn" data-axis="x" data-dir="1" style="font-weight:bold; padding:0;">X+</button>
                </div>
                <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button class="toolbar-btn" data-axis="xy" data-dir="0" style="flex:1; height:24px; padding:0; background:#2b3340; border-color:#555; color:#e6ecf2;" title="Reset X/Y to 0">0 XY</button>
                    <button class="toolbar-btn" data-axis="z" data-dir="0" style="flex:1; height:24px; padding:0; background:#2b3340; border-color:#555; color:#e6ecf2;" title="Reset Z to 0">0 Z</button>
                </div>
            </div>
        `;
  viz.container.appendChild(div);
  viz.jogPendant = div;
  div.addEventListener("pointerdown", (e) => e.stopPropagation());
  div.querySelectorAll("button[data-axis]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const axis = btn.getAttribute("data-axis");
      const dir = parseFloat(btn.getAttribute("data-dir"));
      const stepInput = div.querySelector('input[type="radio"]:checked');
      const step = stepInput ? parseFloat(stepInput.value) : 1;
      const idx = viz.selectedStart || 0;
      if (viz.starts && viz.starts[idx]) {
        const s = viz.starts[idx];
        if (axis === "x") s.x += dir * step;
        if (axis === "y") s.y += dir * step;
        if (axis === "z") s.z += dir * step;
        if (axis === "xy" && dir === 0) {
          s.x = 0;
          s.y = 0;
        }
        if (axis === "z" && dir === 0) {
          s.z = 0;
        }
        viz._positionMarkers();
        viz._rebuild();
        viz.render();
        if (typeof viz.onStartChange === "function") viz.onStartChange(viz.starts);
      }
    });
  });
  const startSel = div.querySelector(".jog-start-sel");
  const startBtns = div.querySelector(".jog-start-btns");
  const renderStarts = () => {
    const n = viz.starts && viz.starts.length || 1;
    startSel.style.display = n > 1 ? "flex" : "none";
    startBtns.innerHTML = "";
    const sel = viz.selectedStart || 0;
    for (let i = 0; i < n; i++) {
      const b2 = document.createElement("button");
      b2.textContent = String(i + 1);
      b2.title = `Jog start ${i + 1}`;
      if (i === sel) b2.classList.add("on");
      b2.addEventListener("click", () => {
        if (viz.selectStart) viz.selectStart(i);
      });
      startBtns.appendChild(b2);
    }
  };
  viz._renderJogStarts = renderStarts;
  renderStarts();
}

// ../DDCS-Studio/web/ui/uiUtils.js
var el = (id) => document.getElementById(id);
function makeDraggable(element, handle, opts = {}) {
  if (!element || !handle || handle.dataset.dragBound) return;
  handle.dataset.dragBound = "1";
  handle.style.cursor = "move";
  handle.style.touchAction = "none";
  const ignore = opts.ignore || "button, input, select, textarea, a";
  let sx = 0, sy = 0, ox = 0, oy = 0, pid = null;
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest && e.target.closest(ignore)) return;
    const r = element.getBoundingClientRect();
    Object.assign(element.style, {
      position: "fixed",
      margin: "0",
      transform: "none",
      left: r.left + "px",
      top: r.top + "px",
      right: "auto",
      bottom: "auto"
    });
    sx = e.clientX;
    sy = e.clientY;
    ox = r.left;
    oy = r.top;
    pid = e.pointerId;
    try {
      handle.setPointerCapture(pid);
    } catch (_) {
    }
    e.preventDefault();
  });
  handle.addEventListener("pointermove", (e) => {
    if (pid === null || e.pointerId !== pid) return;
    element.style.left = Math.max(0, Math.min(window.innerWidth - 60, ox + e.clientX - sx)) + "px";
    element.style.top = Math.max(0, Math.min(window.innerHeight - 30, oy + e.clientY - sy)) + "px";
  });
  const end = () => {
    if (pid === null) return;
    try {
      handle.releasePointerCapture(pid);
    } catch (_) {
    }
    pid = null;
    if (opts.onEnd) opts.onEnd();
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}
var UIUtils = class {
  static showTooltip(element, content, xOffset = 10) {
    const tooltip = el("global-tooltip");
    if (!tooltip) return;
    const rect = element.getBoundingClientRect();
    const margin = 8;
    tooltip.textContent = content;
    tooltip.style.display = "block";
    const tw = tooltip.offsetWidth || 300;
    const th = tooltip.offsetHeight || 60;
    let left = rect.right + xOffset;
    if (left + tw > window.innerWidth - margin) left = rect.left - tw - xOffset;
    if (left < margin) left = margin;
    let top = rect.top;
    if (top + th > window.innerHeight - margin) top = window.innerHeight - th - margin;
    if (top < margin) top = margin;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }
  static hideTooltip() {
    const tooltip = el("global-tooltip");
    if (tooltip) {
      tooltip.style.display = "none";
    }
  }
  static insertAtCursor(textArea, text) {
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    textArea.value = textArea.value.slice(0, start) + text + textArea.value.slice(end);
    const newPos = start + text.length;
    const selEnd = Math.min(textArea.value.length, newPos + 1);
    textArea.selectionStart = newPos;
    textArea.selectionEnd = selEnd;
    textArea.dispatchEvent(new Event("input"));
  }
  static downloadFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  static formatGCode(code) {
    if (!code) return "";
    const safeCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const formatLine = (line) => line.replace(
      /(\([^\)]*\)|(?<!&(?:lt|gt|amp));[^\n]*)|(\b[Gg]31\b)|([Mm]\d+)|([XYZABxyzab])/g,
      (match, comment, g31, mcode, axis) => {
        if (comment) return `<span class="g-comment">${match}</span>`;
        if (g31) return `<span style="color:#60a5fa; font-weight:bold;">${match}</span>`;
        if (mcode) return `<span style="color:#fca5a5">${match}</span>`;
        if (axis) return `<span style="color:#facc15">${match}</span>`;
        return match;
      }
    );
    return safeCode.split(/\r?\n/).map(
      (line, index) => `<span class="g-line" data-line-index="${index}">${formatLine(line)}</span>`
    ).join("\n");
  }
};

// ../DDCS-Studio/web/shared/js/profiles/controllerProfiles.js
var CONTROLLER_PROFILES = {
  "ddcs-expert-m350": {
    id: "ddcs-expert-m350",
    name: "DDCS Expert M350",
    source: "builtin",
    // Hardware tabs shown by DEFAULT for this controller (in addition to the always-on basic tabs).
    // ATC is left OFF by default (most setups are manual tool change) — the user can toggle it on.
    hardwareTabs: ["probes", "limits"],
    atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
    // Probe config with a native controller variable (Pr+500 macro mirror, Expert-confirmed).
    // #1078/#1080/#632 are production-proven (community macro_cam13); the rest are from the
    // official Variables-ENG list. Fields with no native var (slow feed, scan stroke, safe Z)
    // are deliberately absent — they stay Studio-side.
    probeVars: {
      port: { ctrl: "#1078", pr: "Pr578", label: "Floating probe port" },
      level: { ctrl: "#1080", pr: "Pr580", label: "Floating probe level" },
      fastFeed: { ctrl: "#632", pr: "Pr132", label: "Probing speed" },
      retract: { ctrl: "#640", pr: "Pr140", label: "Retraction after probe" },
      setterPort: { ctrl: "#1075", pr: "Pr575", label: "Fixed probe port" },
      setterLevel: { ctrl: "#1077", pr: "Pr577", label: "Fixed probe level" },
      blockHeight: { ctrl: "#633", pr: "Pr133", label: "Probe block thickness" }
    }
  },
  "ddcs-v41": {
    id: "ddcs-v41",
    name: "DDCS V4.1",
    source: "builtin",
    varFamily: "v4.1",
    // which default_vars list to load (variableDB)
    hardwareTabs: ["probes", "limits"],
    atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
    // The V4.1 macro-address offset for its config params isn't confirmed (see default_vars_v41.js),
    // so probe config stays Studio-side until verified on hardware. Reference: bridge/controllers/v4.1/.
    probeVars: {}
  },
  "ddcs-v3-dm500": {
    id: "ddcs-v3-dm500",
    name: "DDCS V3 / DM500",
    source: "builtin",
    varFamily: "v3",
    hardwareTabs: ["probes", "limits"],
    atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
    // TODO: verify ATC base var on a real DM500
    // Probe config sourced from the DM500's own parameter table (bridge/controllers/dm500/install/eng).
    // The DM500 has a single probe input — no configurable port. Verify these #NNNN are macro-readable
    // at runtime before trusting them on real hardware (the user has no DM500 — this is reference/sim).
    probeVars: {
      level: { ctrl: "#70", label: "Probe signal electric level" },
      fastFeed: { ctrl: "#2011", label: "Probe feedrate" },
      retract: { ctrl: "#75", label: "Back distance after probe" },
      blockHeight: { ctrl: "#69", label: "Thickness of tool sensor" }
    }
  },
  "generic": {
    id: "generic",
    name: "Generic / unknown",
    source: "builtin",
    hardwareTabs: [],
    // unknown controller — show only the basic tabs until identified
    atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
    probeVars: {}
    // unknown controller — nothing is safely controller-resident
  }
};
var DEFAULT_PROFILE_ID = "ddcs-expert-m350";
var PROFILE_KEY = "ddcs_controller_profile";
function getActiveProfile() {
  let id = DEFAULT_PROFILE_ID;
  try {
    id = localStorage.getItem(PROFILE_KEY) || DEFAULT_PROFILE_ID;
  } catch (e) {
  }
  return CONTROLLER_PROFILES[id] || CONTROLLER_PROFILES[DEFAULT_PROFILE_ID];
}
function setActiveProfile(id) {
  const profile = CONTROLLER_PROFILES[id] || CONTROLLER_PROFILES[DEFAULT_PROFILE_ID];
  try {
    localStorage.setItem(PROFILE_KEY, profile.id);
  } catch (e) {
  }
  return profile;
}
function registerProfile(profile) {
  if (profile && profile.id) {
    if (!Array.isArray(profile.hardwareTabs)) profile.hardwareTabs = [];
    CONTROLLER_PROFILES[profile.id] = profile;
  }
  return profile;
}

// ../DDCS-Studio/web/wizards/dialects/ddcs-expert-m350.js
var AX = { X: 0, Y: 1, Z: 2, A: 3 };
var dialect = {
  id: "ddcs-expert-m350",
  name: "DDCS Expert M350",
  programModel: "inline",
  probeModel: "g31",
  dwellUnits: "ms",
  vars: { dro: 880, probeStatus: 1920, probeTrig: 1925, wcsBase: 805, wcsStride: 5, activeWcs: 578, toolTable: 1430, ax: AX },
  caps: { vars: true, flow: "goto", probeStatusCheck: true, hmi: true, toolTable: true, probePort: true, inputRead: true },
  // the fullest profile (inputRead = generic live-input poll #[1520+N], slib O10300)
  // G31 Z-10 F100 P3 L0 Q1   (snippets.nc:9 · words.nc:6 "G31 Z#7 F#3 P#5 L0 Q1")
  probeMove: (axis, dist, { feed = 100, port = 3, level = 0 } = {}) => [`G31 ${axis}${dist} F${feed} P${port} L${level} Q1`],
  // IF #1922!=2 GOTO1   (3D PROBE G55.nc:29 · snippets.nc:10). status block #1920+axis; "!=2" = did NOT trigger
  probeStatus: (axis, label) => [`IF #${1920 + AX[axis]}!=2 GOTO${label}`],
  // #50=#1927   (words.nc:12). trigger-position block #1925+axis
  probeRead: (axis, varName) => [`${varName}=#${1925 + AX[axis]}`],
  // #57=#882   (SAVE_WCS_XY_AUTO.nc:16). machine-DRO block #880+axis
  readMachine: (axis, varName) => [`${varName}=#${880 + AX[axis]}`],
  // G53 Z#99   (snippets.nc:4). NO G0 prefix; ref MUST be a #var on M350 (a literal fails)
  machineMove: (axis, ref) => [`G53 ${axis}${ref}`],
  // #[805+[idx-1]*5+ax]=value   (SAVE_WCS_XY_AUTO.nc:21-26). base 805, stride 5; X=base,Y=+1,Z=+2,A=+3
  setWorkOffset: (wcsExpr, axis, value) => [`#[805+[${wcsExpr}-1]*5+${AX[axis]}]=${value}`],
  readActiveWcs: (varName) => [`${varName}=#578`],
  // #578 = active WCS index 1=G54… (COPY_WCS.nc:15)
  distMode: (mode) => mode === "inc" ? "G91" : "G90",
  dwell: (sec) => [`G04 P${Math.round(sec * 1e3)}`],
  // P = ms (slib-g.nc:691 "G04 P100 //100ms")
  endProgram: () => ["M30"],
  // universal end; no M2/M02 in any capture
  ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs} GOTO${label}`],
  // symbolic ops ==/!=/<=; GOTO no space
  goto: (label) => [`GOTO${label}`],
  label: (n) => [`N${n}`],
  // Wait until input N (0-based: pin 0 = IN01 = #1520) reaches level L (0/1): poll #[1520+N] in a
  // WHILE..DO1..END1 with a 10 ms dwell — the verbatim factory sensor-wait idiom (slib-m.nc O10300:
  // `WHILE [#[1520+#4-1] != #6] DO1 / G04 P10 / END1`). P = ms (slib-g.nc:691). No timeout: the poll waits indefinitely.
  waitInput: (n, level) => [`WHILE [#[1520+${n}] != ${level}] DO1   ( wait input ${n} = ${level} )`, "G04 P10", "END1"],
  spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
  // M3.nc / M4.nc
  spindleOff: () => ["M5"],
  coolant: (on) => [on ? "M8" : "M9"],
  // flood M8 / off M9 (mist M7 not present in dump)
  hmiPrompt: (msg) => [`#1505=1(${msg})`],
  // blocking OK/Cancel; ESC sets #1505=0
  hmiCancelVar: "#1505",
  // the prompt's cancel signal — ESC sets it to 0 (confirmBlock bails on it)
  hmiToast: (msg) => [`#1505=-5000(${msg})`],
  // display-only banner
  hmiInput: (varName, prompt2) => [`#2070=${String(varName).replace("#", "")}(${prompt2})`],
  // blocking numeric input
  // recognize(line): the PARSE INVERSE of the dialect-specific emit above (the rest is decoded by the shared
  // core parser). Returns { type, params } or null. Probe/status/DRO reads are syntactically just `#x=#sys`
  // / `IF #status!=2 GOTO` — distinguished ONLY by this controller's magic var numbers (vars above), so these
  // must be tried before the generic assign/ifgoto. Mirrors the verified emit forms 1:1 (round-trips).
  recognize(line) {
    const AXR = ["X", "Y", "Z", "A"];
    const nos = (s) => /[#[]/.test(s) ? s : Number.isFinite(Number(s)) ? Number(s) : s;
    let m;
    if (m = line.match(/^G31 ([XYZA])(\S+) F(\S+) P(\S+) L(\d+) Q1$/)) return { type: "probe", params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]), port: nos(m[4]), level: +m[5] } };
    if (m = line.match(/^IF #(\d+)!=2 GOTO(\d+)$/)) {
      const ax = +m[1] - 1920;
      if (ax >= 0 && ax <= 3) return { type: "probecheck", params: { axis: AXR[ax], goto: +m[2] } };
    }
    if (m = line.match(/^IF (.+?)(==|!=|<=|>=|<|>)(.+?) GOTO(\d+)$/)) return { type: "ifgoto", params: { lhs: m[1], op: m[2], rhs: m[3], goto: +m[4] } };
    if (m = line.match(/^GOTO(\d+)$/)) return { type: "goto", params: { n: +m[1] } };
    if (m = line.match(/^N(\d+)$/)) return { type: "label", params: { n: +m[1] } };
    if (m = line.match(/^#\[805\+\[(.+?)-1\]\*5\+(\d+)\]=(.+)$/)) {
      const ax = +m[2];
      if (ax >= 0 && ax <= 3) return { type: "setworkoffset", params: { wcs: m[1], axis: AXR[ax], value: m[3] } };
    }
    if (m = line.match(/^#1505=-5000\((.*)\)$/)) return { type: "message", params: { text: m[1] } };
    if (m = line.match(/^#2070=([^(]+)\((.*)\)$/)) return { type: "asknumber", params: { var: "#" + m[1].trim(), prompt: m[2] } };
    if (m = line.match(/^(#\d+)=#(\d+)$/)) {
      const sys = +m[2];
      let ax = sys - 1925;
      if (ax >= 0 && ax <= 3) return { type: "proberead", params: { axis: AXR[ax], var: m[1] } };
      ax = sys - 880;
      if (ax >= 0 && ax <= 3) return { type: "readmachine", params: { axis: AXR[ax], var: m[1] } };
    }
    return null;
  },
  notes: "In-program Macro-B-INSPIRED dialect (real Fanuc Macro B does NOT run on M350). G53 needs a #var (no literal, no G0). WCS via direct #[805+] indirect write, stride 5 (G10 L20 also works on this firmware but house style is the indirect write). Dwell P=ms. WHILE/DO/END also exist (word ops, bracketed). Verified vs bridge/controllers/expert-m350 \u2014 appcode/snippets.nc, SYSDISK/slib-*.nc, CNCDISK captures."
};

// ../DDCS-Studio/web/wizards/dialects/ddcs-v41.js
var AX2 = { X: 0, Y: 1, Z: 2, A: 3 };
var dialect2 = {
  id: "ddcs-v41",
  name: "DDCS V4.1",
  programModel: "inline",
  probeModel: "g31",
  dwellUnits: "ms",
  // dro = machine pos #1500-1503; wcsWork = workpiece pos #1506-1509 (what zero*.nc writes); toolTable #1560/#764.
  vars: { dro: 1500, wcsWork: 1506, probeStatus: null, probeTrig: 1500, wcsBase: 1512, wcsStride: 6, activeWcs: null, toolTable: 1560, ax: AX2 },
  caps: { vars: true, flow: "goto", probeStatusCheck: false, hmi: false, toolTable: true, probePort: false },
  // G31 L#682; success read from DRO #1502
  // G91 G31 Z-1000 L#682 Q1 K0 F#106  (probe-float.nc, live). L#682 = probe-selector config param; no P-port word.
  probeMove: (axis, dist, { feed = 100 } = {}) => [`G31 ${axis}${dist} L#682 Q1 K0 F${feed}`],
  probeStatus: () => [],
  // no status var — success read from post-probe DRO #1502 (probe-fix.nc)
  probeRead: (axis, varName) => [`${varName}=#${1500 + AX2[axis]}`],
  // post-probe machine pos #1500+ax (probe-fix.nc: #108=#1502)
  readMachine: (axis, varName) => [`${varName}=#${1500 + AX2[axis]}`],
  // DRO X#1500/Y#1501/Z#1502/A#1503 (safez.nc)
  machineMove: (axis, ref) => [`G0 G53 ${axis}${ref}`],
  // CONFIRMED live: probe-fix.nc "G0G53Z#102" (G0 + G53)
  // CONFIRMED live (probe-vertex.nc): zero at the probed point with G90 G92 <axis><WORK value> — a work coord,
  // NOT a machine coord like Expert's register write. ("zero here" macros zeroz/zeroxy write #1506-1509 directly.)
  setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}${value}`],
  readActiveWcs: () => [],
  // TO CONFIRM
  distMode: (mode) => mode === "inc" ? "G91" : "G90",
  dwell: (sec) => [`G04 P${Math.round(sec * 1e3)}`],
  // ms (firmware G04P1000)
  endProgram: () => ["M30"],
  ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs}GOTO${label}`],
  // NO space before GOTO (probe-h.nc:7)
  goto: (label) => [`GOTO${label}`],
  label: (n) => [`N${n}`],
  spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
  spindleOff: () => ["M5"],
  coolant: (on) => [on ? "M8" : "M9"],
  hmiPrompt: () => [],
  // TO CONFIRM — V4.1 uses MarcoDialog "*.rc", #1505 unconfirmed
  hmiToast: () => [],
  hmiInput: () => [],
  // recognize(line): parse inverse of the V4.1-specific emit (probe G31…L#682, tight IF…GOTO, G90 G92 WCS,
  // #1500+ DRO reads). No status/HMI vars here (those fold to nothing on V4.1). Probe-read and read-machine
  // share #1500+ax, so both decode to proberead (V4.1 conflates them) — byte-identical either way.
  recognize(line) {
    const AXR = ["X", "Y", "Z", "A"];
    const nos = (s) => /[#[]/.test(s) ? s : Number.isFinite(Number(s)) ? Number(s) : s;
    let m;
    if (m = line.match(/^G31 ([XYZA])(\S+) L#682 Q1 K0 F(\S+)$/)) return { type: "probe", params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]) } };
    if (m = line.match(/^IF (.+?)(==|!=|<=|>=|<|>)(.+?)GOTO(\d+)$/)) return { type: "ifgoto", params: { lhs: m[1], op: m[2], rhs: m[3], goto: +m[4] } };
    if (m = line.match(/^GOTO(\d+)$/)) return { type: "goto", params: { n: +m[1] } };
    if (m = line.match(/^N(\d+)$/)) return { type: "label", params: { n: +m[1] } };
    if (m = line.match(/^G90 G92 ([XYZA])(.+)$/)) return { type: "setworkoffset", params: { wcs: "#578", axis: m[1], value: m[2] } };
    if (m = line.match(/^(#\d+)=#(\d+)$/)) {
      const ax = +m[2] - 1500;
      if (ax >= 0 && ax <= 3) return { type: "proberead", params: { axis: AXR[ax], var: m[1] } };
    }
    return null;
  },
  notes: "\u2248Expert FORM, vars at #1500+ (DRO #1500-1503, workpiece #1506-1509, WCS base #1512 stride 6). Zero via G92 with a WORK coord (or direct #1506-1509 write), NOT the indirect #[805+] write. No probe status var (result = post-probe DRO #1502). Machine move = G0 G53. ifGoto has NO space before GOTO. HMI via MarcoDialog *.rc \u2014 TO CONFIRM. CONFIRMED live on \\\\10.0.0.50\\SYSDISK (2026-06-13)."
};

// ../DDCS-Studio/web/wizards/dialects/ddcs-v3-dm500.js
var AX3 = { X: 0, Y: 1, Z: 2, A: 3 };
var OP = { "==": "EQ", "!=": "NE", "<": "LT", ">": "GT", "<=": "LE", ">=": "GE" };
var dialect3 = {
  id: "ddcs-v3-dm500",
  name: "DDCS V3 / DM500",
  programModel: "inline",
  probeModel: "move-until-input",
  dwellUnits: "s",
  vars: { dro: 864, probeStatus: null, probeTrig: 864, wcsBase: 804, wcsStride: 4, activeWcs: 455, toolTable: 1430, ax: AX3 },
  caps: { vars: true, flow: "goto", probeStatusCheck: false, hmi: false, toolTable: true, probePort: false },
  // M101/G01/M102 halts on the probe input
  // move-until-input: arm (M101) → feed move → disarm (M102). probe.nc:23-25.
  probeMove: (axis, dist, { feed = 100 } = {}) => ["M101", `G91 G01 ${axis}${dist} F${feed}`, "M102"],
  probeStatus: () => [],
  // implicit — motion halts on input; no status var
  probeRead: (axis, varName) => [`${varName}=#${864 + AX3[axis]}`],
  // capture machine DRO at contact (probe.nc:4-6)
  readMachine: (axis, varName) => [`${varName}=#${864 + AX3[axis]}`],
  // DRO X#864/Y#865/Z#866/A#867
  machineMove: (axis, ref) => [`G53 ${axis}${ref}`],
  // G53 gated by config #395; dump safe-Z is M98 P101 — TO CONFIRM
  // DM500 macros zero with G92 (defprobe.nc:21) — value is a WORK coord (plate thickness), NOT a machine coord
  // like Expert's register write. Cross-profile value semantics unresolved → VERIFY on hardware.
  setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}${value}   ( set datum - VERIFY on hardware )`],
  readActiveWcs: (varName) => [`${varName}=#455`],
  // #455/#516 select coord system
  distMode: (mode) => mode === "inc" ? "G91" : "G90",
  dwell: (sec) => [`G04 P${sec}`],
  // P = SECONDS (probe.nc, slib.nc G82 P#9)
  endProgram: () => ["M30"],
  // m30.nc empty → controller default
  ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${OP[op] || op}${rhs} GOTO${label}`],
  // word ops; see notes re !=
  goto: (label) => [`GOTO${label}`],
  label: (n) => [`N${n}`],
  spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
  spindleOff: () => ["M5"],
  coolant: (on) => [on ? "M8" : "M9"],
  hmiPrompt: () => [],
  // no scripted operator prompt (pause hook = a Z-lift only)
  hmiToast: () => [],
  hmiInput: () => [],
  // recognize(line): parse inverse of the DM500-specific emit (WORD IF ops, #864+ DRO, G92 WCS). The
  // move-until-input probe (M101 / G91 G01 … / M102) is a 3-line op the per-line parser can't fold back yet,
  // so its lines stay verbatim (raw) — lossless round-trip; proper decode needs parser look-ahead (TODO).
  recognize(line) {
    const AXR = ["X", "Y", "Z", "A"];
    const OPI = { EQ: "==", NE: "!=", LT: "<", GT: ">", LE: "<=", GE: ">=" };
    let m;
    if (/^M10[12]$/.test(line) || /^G91 G01 [XYZA]\S* F\S+$/.test(line)) return { type: "raw", params: { text: line } };
    if (m = line.match(/^IF (.+?)(EQ|NE|LT|GT|LE|GE)(.+?) GOTO(\d+)$/)) return { type: "ifgoto", params: { lhs: m[1], op: OPI[m[2]], rhs: m[3], goto: +m[4] } };
    if (m = line.match(/^GOTO(\d+)$/)) return { type: "goto", params: { n: +m[1] } };
    if (m = line.match(/^N(\d+)$/)) return { type: "label", params: { n: +m[1] } };
    if (m = line.match(/^G90 G92 ([XYZA])(.+)$/)) return { type: "setworkoffset", params: { wcs: "#578", axis: m[1], value: m[2] } };
    if (m = line.match(/^(#\d+)=#(\d+)$/)) {
      const ax = +m[2] - 864;
      if (ax >= 0 && ax <= 3) return { type: "proberead", params: { axis: AXR[ax], var: m[1] } };
    }
    return null;
  },
  notes: "STRUCTURALLY different: move-until-input probing (M101/G01/M102, no G31), #864-866 DRO, G92 WCS, dwell in SECONDS, WORD IF operators (EQ/LT/GT \u2014 `!=`/`NE` NOT in the dump; mapped to NE best-effort, verify before use). machineMove G53 gated by config #395 (dump safe-Z = M98 P101 subprogram) \u2014 TO CONFIRM. HMI absent. Verified vs bridge/controllers/dm500/install."
};

// ../DDCS-Studio/web/wizards/dialects/centroid.js
var AX4 = { X: 0, Y: 1, Z: 2, A: 3 };
var dialect4 = {
  id: "centroid",
  name: "Centroid CNC12 (Acorn)",
  programModel: "inline",
  probeModel: "move-until-input",
  dwellUnits: "s",
  // Centroid probes by move-until-input (stop AT contact) and writes WCS with G92/G10 — so it reads NO
  // trigger/status var. The machine-pos / WCS-offset / tool-table system vars are in operators-manual
  // §11.2.16 (not in our dump) ⇒ left null + TO CONFIRM. #4120 req tool / #4203 in-spindle are known.
  vars: { dro: null, probeStatus: null, probeTrig: null, wcsBase: null, wcsStride: null, activeWcs: null, toolTable: null, ax: AX4 },
  caps: { vars: true, flow: "goto", probeStatusCheck: false, hmi: true, toolTable: true, probePort: false },
  // M115 probe / M225 msg — TO CONFIRM on hardware
  // M115 /Z-10 P3 F20  (manual:309 "M115 /Z P3 F20"; corner-probe-FL.mac:38 "M115 /Z[..] P[..] F[..]").
  // Move-until-input: stops AT contact and AUTO-CANCELS WITH AN ERROR if the bound is reached without
  // contact (manual:868-869) — so no-contact protection is built in. `level` is unused on Centroid.
  probeMove: (axis, dist, { feed = 10, port = 3 } = {}) => [`M115 /${axis}${dist} P${port} F${feed}`],
  probeStatus: () => [],
  // [] — M115 errors out on no-contact (manual:868); no in-program status read
  probeRead: () => [],
  // [] — stops AT contact; define the point with setWorkOffset (G92), no trigger var
  readMachine: () => [],
  // TO CONFIRM — machine-pos system var is in operators manual §11.2.16, not in dump
  // G53 Z.5 / G53 X1  (manual:135-136). Machine-frame move; ref may be a LITERAL or #var (unlike DDCS,
  // which requires a #var). Optional trailing "L<feedrate>" (manual:174 "G53 X1 Y-1 L200").
  machineMove: (axis, ref) => [`G53 ${axis}${ref}`],
  // G92 X<val>  (corner-probe-FL.mac:54 "G92 X[..]"; manual:312 "G92 Z.5"). Sets the ACTIVE WCS so current
  // pos = value — wcsExpr is unused (G92 acts on whatever WCS is active). Alt: G10 P<param> R<val> (manual:692).
  setWorkOffset: (wcsExpr, axis, value) => [`G92 ${axis}${value}`],
  readActiveWcs: () => [],
  // TO CONFIRM — active-WCS index var is in operators manual §11.2.16, not in dump
  distMode: (mode) => mode === "inc" ? "G91" : "G90",
  dwell: (sec) => [`G4 P${sec}`],
  // P = SECONDS (manual:495 "G4 P4 ;Wait 4 seconds"; :313 "G4 P .5")
  endProgram: () => ["M30"],
  // M30 for a top-level macro; M99 if the .mac is a subprogram (manual:193)
  // IF #100==1 THEN GOTO 200  (manual:451 "IF #50005 THEN GOTO 500"; :626 "IF #150 == 0 THEN GOTO 200").
  // Note THEN, and the space before the label. Verified ops: == (and =), <, > ; '!=','<=','>=' TO CONFIRM.
  ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs} THEN GOTO ${label}`],
  goto: (label) => [`GOTO ${label}`],
  // space after GOTO (manual:453 "GOTO 1000") — unlike DDCS's GOTO1
  label: (n) => [`N${n}`],
  // N-block destinations (manual:98 "N1000", :510 "N200")
  spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
  spindleOff: () => ["M5"],
  // manual:728 "M5 ;Stop Spindle"
  coolant: (on) => [on ? "M8" : "M9"],
  // standard flood/off; Acorn-PLC alt is M94/M95 SV_3 (manual:524)
  hmiPrompt: (msg) => [`M225 #0 "${msg}"`],
  // M225 #<timer> "msg"; timer 0 = wait for Cycle Start (manual:296-300).
  //                                              TO CONFIRM: dump pre-loads a user var (#100=0, manual:288); #0-as-0 unverified.
  hmiToast: (msg) => [`M225 #0 "${msg}"`],
  // Centroid has no non-blocking banner in a .mac — M225 always
  //                                              pauses; a timed display needs a preloaded timer var (see notes).
  hmiInput: (varName, prompt2) => [`M224 ${varName} "${prompt2}" #0`],
  // M224 <retvar> "prompt" <?>: dump (manual:514
  //   "M224 #100 \"..\" #105") then reads the FIRST var (#100) as the operator entry; trailing var role TO CONFIRM.
  notes: 'Centroid CNC12 (Acorn): in-program #var/branching like DDCS but a DISTINCT dialect \u2014 IF\u2026THEN\u2026GOTO/ELSE (note THEN; "GOTO 200" has a space, vs DDCS "GOTO1"), and PROBING is M115/M116 (move-until-input) not G31. M115 stops AT contact and AUTO-ERRORS on no-contact, so probeStatus/probeRead fold to [] (the DDCS fast/slow + IF\u2026GOTO collapses to an M115/M116 pair \u2014 LESS code). WCS via G92 (or G10 P R), not an indirect #var write. Dwell P = SECONDS (G4 P4). machineMove G53 takes a literal (no #var needed, unlike DDCS). HMI: M225 display (always pauses the macro \u2014 no non-blocking toast in a .mac), M224 operator input; the #0-as-zero-timer shortcut and M224 var-order are TO CONFIRM (dump pre-allocates a user timer var). NULL vars: machine-pos / active-WCS / WCS-offset / tool-table system vars live in mill operators manual \xA711.2.16, which is NOT in the captured dump \u21D2 readMachine/readActiveWcs return [] (TO CONFIRM). Verified vs bridge/controllers/centroid \u2014 assets/Centroid_CNC12_Macro_Programming.txt + corner-probe-FL.mac. NOT tested on owned hardware.'
};

// ../DDCS-Studio/web/wizards/dialects/rs274ngc.js
var AX5 = { X: 0, Y: 1, Z: 2, A: 3 };
var NEG = { "==": "ne", "!=": "eq", "<": "ge", ">": "le", "<=": "gt", ">=": "lt" };
var dialect5 = {
  id: "rs274ngc",
  name: "RS274NGC (LinuxCNC)",
  // grblHAL shares these forms but is its own post (grblhal.js)
  programModel: "inline",
  probeModel: "g38",
  dwellUnits: "s",
  // All confirmed in grblHAL ngc_params.c (each tagged `// LinuxCNC`): probeTrig #5061-69 (:301),
  // probeStatus #5070 (:302), activeWcs #5220 (:308), wcsBase #5221 stride 20 (:309 + :258 "/20"),
  // dro #5420-28 current-position (:321), toolTable #5401-09 active-tool offsets (:320-321, #5400=tool# :319).
  vars: { dro: 5420, probeStatus: 5070, probeTrig: 5061, wcsBase: 5221, wcsStride: 20, activeWcs: 5220, toolTable: 5401, ax: AX5 },
  caps: { vars: true, flow: "oword", probeStatusCheck: false, hmi: false, toolTable: true, probePort: false },
  // G38.2 alarms on no-contact; structured O-word flow
  // G38.2 Z-10 F100  (probe-hole.ngc:22 "G91 G38.2 X#1000"; gridprobe.ngc:35 "G38.2Z#8"). G38.2 ALARMs on
  // no-contact (host/controller catches) ⇒ probeStatus folds away, like Centroid's M115. `port`/`level` unused.
  probeMove: (axis, dist, { feed = 100 } = {}) => [`G38.2 ${axis}${dist} F${feed}`],
  probeStatus: () => [],
  // [] — G38.2 alarms on no-contact; success param #5070 exists but no in-program GOTO branch
  // #50=#5061  (probe-hole.ngc:19 "#1001=#5061", :31 "#1005=#5062"). Trigger-position block #5061+axis (ngc_params.c:301)
  probeRead: (axis, varName) => [`${varName}=#${5061 + AX5[axis]}`],
  // #50=#5420  (ngc_params.c:321 work_position #5420-28). Current position in the active frame.
  readMachine: (axis, varName) => [`${varName}=#${5420 + AX5[axis]}`],
  machineMove: (axis, ref) => [`G53 G0 ${axis}${ref}`],
  // machine-frame rapid; ref may be a literal or #var (gcode.c:65 G53 non-modal)
  // G10 L20 P1 X<val>  (sets WCS P so current pos = val). wcsExpr = active-WCS index 1..9. Standard RS274NGC
  // (LinuxCNC §G10; grblHAL gcode.c G10 modal :74). The clean DDCS-#[805+] equivalent.
  setWorkOffset: (wcsExpr, axis, value) => [`G10 L20 P${wcsExpr} ${axis}${value}`],
  readActiveWcs: (varName) => [`${varName}=#5220`],
  // #5220 = active coord-system number 1=G54… (ngc_params.c:308)
  distMode: (mode) => mode === "inc" ? "G91" : "G90",
  dwell: (sec) => [`G4 P${sec}`],
  // P = SECONDS in RS274NGC (gridprobe/LinuxCNC dwell)
  endProgram: () => ["M30"],
  // M30 (M2 also ends; .ngc files use M2, e.g. gridprobe.ngc:45)
  // FLOW IS STRUCTURED O-WORDS, NOT GOTO (grblHAL ngc_flowctrl.c:45-56 If/ElseIf/Else/EndIf/While/EndWhile/Sub).
  // ifGoto/label render a skip-block: `o<n> if [cond-negated]` … `o<n> endif`. goto() has no clean 1-line form.
  ifGoto: (lhs, op, rhs, label) => [`o${label} if [${lhs} ${NEG[op]} ${rhs}]`],
  goto: () => [],
  // [] — an unconditional GOTO has no single-line O-word equivalent (restructure: else/endif or M2)
  label: (n) => [`o${n} endif`],
  // closes the o<n> if-block opened by the matching ifGoto
  spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
  spindleOff: () => ["M5"],
  coolant: (on) => [on ? "M8" : "M9"],
  // flood M8 / off M9 (mist M7 also standard)
  hmiPrompt: (msg) => [`(MSG,${msg})`, "M0"],
  // operator confirm = on-screen message + M0 program pause (resume on Cycle Start); no cancel signal
  hmiToast: (msg) => [`(MSG,${msg})`],
  // operator-message comment (probe-hole.ngc:84 uses (debug,…))
  hmiInput: () => [],
  // [] — no blocking numeric input in stream mode
  // recognize(line): parse inverse of the RS274NGC-specific emit. Flow is STRUCTURED O-WORDS: ifGoto emits
  // `o<n> if [cond NEGATED]` and label emits `o<n> endif`, so the inverse un-negates the word operator (INV).
  // Probe = G38.2; WCS = G10 L20; message = (MSG,…) — which looks like a comment, hence recognize runs first.
  recognize(line) {
    const AXR = ["X", "Y", "Z", "A"];
    const nos = (s) => /[#[]/.test(s) ? s : Number.isFinite(Number(s)) ? Number(s) : s;
    const INV = { ne: "==", eq: "!=", ge: "<", le: ">", gt: "<=", lt: ">=" };
    let m;
    if (m = line.match(/^G38\.2 ([XYZA])(\S+) F(\S+)$/)) return { type: "probe", params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]) } };
    if (m = line.match(/^o(\d+) if \[(.+?) (eq|ne|lt|gt|le|ge) (.+?)\]$/)) return { type: "ifgoto", params: { lhs: m[2], op: INV[m[3]], rhs: m[4], goto: +m[1] } };
    if (m = line.match(/^o(\d+) endif$/)) return { type: "label", params: { n: +m[1] } };
    if (m = line.match(/^G10 L20 P(\S+) ([XYZA])(.+)$/)) return { type: "setworkoffset", params: { wcs: nos(m[1]), axis: m[2], value: m[3] } };
    if (m = line.match(/^\(MSG,(.*)\)$/)) return { type: "message", params: { text: m[1] } };
    if (m = line.match(/^(#\d+)=#(\d+)$/)) {
      const sys = +m[2];
      let ax = sys - 5061;
      if (ax >= 0 && ax <= 3) return { type: "proberead", params: { axis: AXR[ax], var: m[1] } };
      ax = sys - 5420;
      if (ax >= 0 && ax <= 3) return { type: "readmachine", params: { axis: AXR[ax], var: m[1] } };
    }
    return null;
  },
  notes: 'RS274NGC family \u2014 grblHAL + LinuxCNC under ONE binding (grblHAL copied LinuxCNC: #5061 is tagged "// LinuxCNC" in ngc_params.c). Cleanest ~1:1 with DDCS concepts and free/open \u21D2 best distribution target. THE KEY DIFFERENCE: flow is STRUCTURED O-WORDS (o<n> if/elseif/else/endif, while/endwhile, sub/endsub/call) with WORD operators (eq ne lt gt le ge, ngc_expr.c:122) \u2014 NOT IF\u2026GOTO. So ifGoto/label here render a skip-block (ifGoto \u2192 "o<n> if [neg-cond]", label \u2192 "o<n> endif"); this models the common forward-skip idiom only \u2014 back-jump loops must be authored as o<n> while, and goto() returns [] (no 1-line equivalent). A fully general RS274NGC port wants a structured-flow emitter, not the GOTO line-emitter (cf. SCHEMA note on script dialects). Probing: G38.2 ALARMs on no-contact \u21D2 probeStatus folds to [] (like Centroid). WCS via G10 L20 (the clean DDCS-#[805+] equivalent). Dwell P = seconds. No blocking HMI in stream mode \u21D2 hmiPrompt/hmiInput [] , hmiToast \u2192 (MSG,\u2026). Caveat: grblHAL full O-word flow runs only for macros on SD/littlefs (stream mode limited); LinuxCNC has no such limit. Digital I/O (M62-65 / M66) is out of the SCHEMA core surface but available. Verified vs grblHAL-core-src (ngc_params/flowctrl/expr/gcode.c) + linuxcnc nc_files (gridprobe.ngc, probe-hole.ngc).'
};

// ../DDCS-Studio/web/wizards/dialects/grblhal.js
var dialect6 = {
  ...dialect5,
  // identical RS274NGC emit forms + recognize() + vars (grblHAL = LinuxCNC for codegen)
  id: "grblhal",
  name: "grblHAL",
  caps: { ...dialect5.caps, flowStreamable: false },
  // O-word flow only from SD/littlefs, not while streaming
  notes: "grblHAL \u2014 RS274NGC emit forms shared with LinuxCNC (re-exports rs274ngc.js): same #5061 probe params, G38.2, G10 L20, O-word flow. The ONE difference is a capability, not syntax: grblHAL O-word flow runs only for macros on SD/littlefs, NOT while streaming over serial \u2014 so probe/ATC (flow-heavy) macros must be saved to the SD card. caps.flowStreamable=false. Verified vs grblHAL-core-src (shared with rs274ngc)."
};

// ../DDCS-Studio/web/wizards/dialects/grbl.js
var AX6 = { X: 0, Y: 1, Z: 2, A: 3 };
var dialect7 = {
  id: "grbl",
  name: "grbl 1.1",
  programModel: "streamed",
  probeModel: "g38",
  dwellUnits: "s",
  g53NeedsVar: false,
  // grbl G53 takes a literal coord directly (no #var staging — grbl has no #vars)
  vars: { dro: null, probeStatus: null, probeTrig: null, wcsBase: null, wcsStride: null, activeWcs: null, toolTable: null, ax: AX6 },
  caps: { vars: false, flow: "none", probeStatusCheck: false, hmi: false, toolTable: false, probePort: false },
  // streamed; host owns the logic
  probeMove: (axis, dist, { feed = 100 } = {}) => [`G38.2 ${axis}${dist} F${feed}`],
  // result pushed as [PRB:…] over serial
  probeStatus: () => [],
  // [] — no in-program status var (host reads [PRB:…:1/0])
  probeRead: () => [],
  // [] — no #vars; host captures the probe report
  readMachine: () => [],
  // [] — no #vars; host reads the status report (<…|MPos:…>)
  machineMove: (axis, ref) => [`G53 G0 ${axis}${ref}`],
  // machine-frame rapid (literal coord; G90 + G0 on the block)
  setWorkOffset: (wcsExpr, axis, value) => [`G10 L20 P${wcsExpr} ${axis}${value}`],
  // grbl 1.1 supports G10 L2/L20
  readActiveWcs: () => [],
  // [] — no #vars
  distMode: (mode) => mode === "inc" ? "G91" : "G90",
  dwell: (sec) => [`G4 P${sec}`],
  // P = seconds
  endProgram: () => ["M30"],
  // grbl supports M2 / M30
  ifGoto: () => [],
  // [] — no flow control in the part program (host state machine)
  goto: () => [],
  // [] — none
  label: () => [],
  // [] — none
  spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
  spindleOff: () => ["M5"],
  coolant: (on) => [on ? "M8" : "M9"],
  // flood M8 / off M9 (mist M7 also supported)
  hmiPrompt: () => [],
  // [] — no blocking prompt (host UI)
  hmiToast: (msg) => [`(${msg})`],
  // grbl ignores ( ) comments; host may surface them
  hmiInput: () => [],
  // recognize(line): grbl-specific emit is just probe / WCS / message (no #var or flow lines to fold back).
  recognize(line) {
    const nos = (s) => Number.isFinite(Number(s)) ? Number(s) : s;
    let m;
    if (m = line.match(/^G38\.2 ([XYZA])(\S+) F(\S+)$/)) return { type: "probe", params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]) } };
    if (m = line.match(/^G10 L20 P(\S+) ([XYZA])(.+)$/)) return { type: "setworkoffset", params: { wcs: nos(m[1]), axis: m[2], value: m[3] } };
    if (m = line.match(/^\((MSG,)?(.*)\)$/)) return { type: "message", params: { text: m[2] } };
    return null;
  },
  notes: "Standard grbl 1.1 \u2014 streamed, host owns the logic. NO #vars / IF-GOTO / WHILE / subroutines / canned cycles (FINDINGS.md). A CUTTING target: geometry wizards emit clean grbl; probe/ATC on-controller flow folds to nothing (probing is host-side: stream G38.2, read [PRB:\u2026], issue G10 L20). G53 takes a literal (g53NeedsVar:false). grblHAL SD O-word flow = the rs274ngc post instead. Verified vs bridge/controllers/grbl."
};

// ../DDCS-Studio/web/wizards/dialects/index.js
var DIALECTS = {
  "ddcs-expert-m350": dialect,
  "ddcs-v41": dialect2,
  "ddcs-v3-dm500": dialect3,
  "centroid": dialect4,
  "rs274ngc": dialect5,
  "grblhal": dialect6,
  "grbl": dialect7
};
var DEFAULT_DIALECT = dialect;
function getDialect(profileId) {
  return DIALECTS[profileId] || DEFAULT_DIALECT;
}
var POST_VERIFIED = /* @__PURE__ */ new Set(["ddcs-expert-m350", "ddcs-v41"]);
var ACTIVE_POST_KEY = "ddcs_active_post";
function listPosts() {
  return Object.values(DIALECTS).map((d) => ({ id: d.id, name: d.name, verified: POST_VERIFIED.has(d.id) }));
}
function isPostVerified(id) {
  return POST_VERIFIED.has(id);
}
function getActivePostId() {
  try {
    return localStorage.getItem(ACTIVE_POST_KEY) || "auto";
  } catch (e) {
    return "auto";
  }
}
function setActivePostId(id) {
  const v = id && DIALECTS[id] ? id : "auto";
  try {
    localStorage.setItem(ACTIVE_POST_KEY, v);
  } catch (e) {
  }
  return v;
}

// ../DDCS-Studio/web/shared/js/client.js
function resolveBase(opts) {
  if (opts.base != null) return opts.base;
  try {
    const q = new URLSearchParams(location.search).get("api");
    if (q != null) {
      localStorage.setItem("ddcs_api", q);
      return q;
    }
    return localStorage.getItem("ddcs_api") || "";
  } catch {
    return "";
  }
}
function resolveToken() {
  try {
    const q = new URLSearchParams(location.search).get("token");
    if (q != null) {
      localStorage.setItem("ddcs_token", q);
      return q;
    }
    return localStorage.getItem("ddcs_token") || "";
  } catch {
    return "";
  }
}
function makeClient(opts = {}) {
  const base = resolveBase(opts);
  const tok = opts.token ?? resolveToken();
  const authH = tok ? { Authorization: "Bearer " + tok } : {};
  async function call(path, init = {}) {
    const r = await fetch(base + path, { ...init, headers: { ...authH, ...init.headers || {} } });
    if (r.status === 401) throw new Error(`${path} -> 401 (set ?token=\u2026 for the cloud API)`);
    if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
    return r.json();
  }
  const postJSON = (path, body) => call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return {
    mode: base ? "remote" : "local",
    descriptor: () => call("/api/descriptor"),
    profile: () => call("/api/profile"),
    // controller profile in the shared shape (controllerProfiles.js)
    readVars: (ns) => call("/api/vars?ns=" + (ns || []).join(",")),
    // live watch-list values (read-only)
    listQueue: () => call("/api/queue"),
    listHistory: (limit = 100) => call("/api/history?limit=" + limit),
    getStatus: (id) => call("/api/status?id=" + encodeURIComponent(id)),
    listFiles: () => call("/api/files"),
    readFile: (name) => call("/api/file?name=" + encodeURIComponent(name)),
    deleteFile: (name) => postJSON("/api/files/delete", { name }),
    submitJob: (name, nc, map) => postJSON("/api/jobs", { name, nc, map }),
    getConfig: () => call("/api/config"),
    setConfig: (updates) => postJSON("/api/config", updates)
  };
}

// ../DDCS-Studio/web/wizards/toolPicker.js
function getToolLibrary() {
  const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
  return libraryTools(s.atc || {}).map((t) => {
    const dia = t.dia !== "" && t.dia != null ? "\xD8" + t.dia : "";
    const label = "T" + t.num + (t.name ? " \xB7 " + t.name : "") + (dia ? " (" + dia + ")" : "");
    return { ...t, label };
  });
}
function toolOptionsHTML(placeholder = "Tool\u2026 (from library)") {
  const opts = ['<option value="">' + placeholder + "</option>"];
  getToolLibrary().forEach((t) => {
    opts.push('<option value="' + t.num + '">' + t.label + "</option>");
  });
  return opts.join("");
}
function getTool(num2) {
  return getToolLibrary().find((t) => Number(t.num) === Number(num2)) || null;
}

// ../DDCS-Studio/web/ui/ioTable.js
var INPUT_TYPES = [
  { type: "probe", label: "3D Probe" },
  { type: "touch", label: "Touch-plate (ground)" },
  { type: "setter", label: "Tool Setter" },
  { type: "limit", label: "Limit switch" },
  { type: "estop", label: "E-stop" },
  { type: "sensor", label: "Sensor" }
];
var OUTPUT_TYPES = [
  { type: "coolant", label: "Coolant", onCode: "M8", offCode: "M9" },
  { type: "drawbar", label: "Drawbar (ATC)", onCode: "M154", offCode: "M155" },
  { type: "dustcover", label: "Dust cover (ATC)", onCode: "M305", offCode: "M306" },
  { type: "rotate", label: "Carousel rotate (ATC)", onCode: "", offCode: "" },
  { type: "mist", label: "Mist", onCode: "M7", offCode: "M9" },
  { type: "custom", label: "Custom", onCode: "", offCode: "" }
];
var LIMIT_AXES = [["x_min", "X\u2212"], ["x_max", "X+"], ["y_min", "Y\u2212"], ["y_max", "Y+"], ["z_min", "Z\u2212"], ["z_max", "Z+"]];
var INP = "padding:3px 6px; border:1px solid #b3a98f; border-radius:3px; font-size:12px; background:#fff; color:#222;";
var _seq = 0;
function uid(p) {
  return p + "_" + Date.now().toString(36) + _seq++;
}
function field(text, control, w) {
  const wrap = document.createElement("label");
  wrap.style.cssText = "display:flex; flex-direction:column; gap:2px; font-size:10px; color:#6b6150;";
  wrap.appendChild(document.createTextNode(text));
  control.style.cssText = INP + (w ? ` width:${w}px;` : "");
  wrap.appendChild(control);
  return wrap;
}
function renderIoTable(container, kind, list2, onChange) {
  if (!container) return;
  const isInput = kind === "input";
  const TYPES = isInput ? INPUT_TYPES : OUTPUT_TYPES;
  const pinMax = isInput ? 24 : 20;
  const rerender = () => renderIoTable(container, kind, list2, onChange);
  container.innerHTML = "";
  if (!list2.length) {
    const e = document.createElement("div");
    e.className = "settings-hint";
    e.textContent = `No ${isInput ? "inputs" : "outputs"} yet \u2014 use "${isInput ? "+ Add input" : "+ Add output"}" below to add the ones your machine has.`;
    container.appendChild(e);
  }
  list2.forEach((row) => {
    const usedByOthers = new Set(list2.filter((r) => r !== row).map((r) => r.pin).filter((p) => p !== "" && p != null).map(String));
    const tr = document.createElement("div");
    tr.style.cssText = "display:flex; align-items:flex-end; gap:8px 12px; flex-wrap:wrap; padding:10px 12px; margin-bottom:9px; border:1px solid rgba(90,75,40,0.2); border-radius:7px; background:rgba(255,255,255,0.72); box-shadow:0 1px 3px rgba(0,0,0,0.09);";
    const name = document.createElement("span");
    name.style.cssText = "min-width:130px; font-weight:600; color:#3a3a3a; padding-bottom:4px;";
    name.textContent = (TYPES.find((t) => t.type === row.type) || {}).label || row.type;
    if (row.group) {
      const badge = document.createElement("span");
      badge.textContent = row.group.toUpperCase();
      badge.style.cssText = "margin-left:6px; font-size:9px; font-weight:700; background:#6b7b3a; color:#fff; padding:1px 5px; border-radius:3px; vertical-align:middle;";
      name.appendChild(badge);
    }
    tr.appendChild(name);
    if (isInput && row.type === "limit") {
      const ax = document.createElement("select");
      LIMIT_AXES.forEach(([a, l]) => {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = l;
        if (row.axis === a) o.selected = true;
        ax.appendChild(o);
      });
      ax.addEventListener("change", () => {
        row.axis = ax.value;
        onChange();
      });
      tr.appendChild(field("Axis", ax, 56));
    }
    const pin = document.createElement("select");
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "\u2014";
    pin.appendChild(none);
    for (let p = 1; p <= pinMax; p++) {
      const o = document.createElement("option");
      o.value = String(p);
      o.textContent = String(p);
      if (usedByOthers.has(String(p))) o.disabled = true;
      if (String(row.pin) === String(p)) o.selected = true;
      pin.appendChild(o);
    }
    pin.addEventListener("change", () => {
      row.pin = pin.value === "" ? "" : Number(pin.value);
      onChange();
      rerender();
    });
    tr.appendChild(field("Pin", pin, 64));
    if (isInput) {
      const lvl = document.createElement("select");
      [["0", "NC"], ["1", "NO"]].forEach(([v, t]) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        if (String(row.level) === v) o.selected = true;
        lvl.appendChild(o);
      });
      lvl.addEventListener("change", () => {
        row.level = Number(lvl.value);
        onChange();
      });
      tr.appendChild(field("Level", lvl, 64));
      if (row.type === "setter") {
        [["x", "X"], ["y", "Y"], ["z", "Z"], ["w", "W"], ["h", "H"]].forEach(([k, t]) => {
          const i = document.createElement("input");
          i.type = "number";
          i.step = "0.1";
          i.value = row[k] ?? "";
          i.addEventListener("change", () => {
            row[k] = i.value === "" ? "" : Number(i.value);
            onChange();
          });
          tr.appendChild(field(t, i, 52));
        });
      }
    } else {
      const on = document.createElement("input");
      on.type = "text";
      on.value = row.onCode ?? "";
      on.addEventListener("change", () => {
        row.onCode = on.value;
        onChange();
      });
      tr.appendChild(field("ON M-code", on, 78));
      const off = document.createElement("input");
      off.type = "text";
      off.value = row.offCode ?? "";
      off.addEventListener("change", () => {
        row.offCode = off.value;
        onChange();
      });
      tr.appendChild(field("OFF M-code", off, 78));
    }
    const rm = document.createElement("button");
    rm.className = "toolbar-btn";
    rm.textContent = "\u2715";
    rm.title = "Remove";
    rm.style.cssText = "margin-left:auto; padding:2px 9px; align-self:center;";
    rm.addEventListener("click", () => {
      const i = list2.indexOf(row);
      if (i >= 0) list2.splice(i, 1);
      onChange();
      rerender();
    });
    tr.appendChild(rm);
    container.appendChild(tr);
  });
  const add = document.createElement("div");
  add.style.cssText = "display:flex; gap:8px; align-items:center; margin-top:12px;";
  const sel = document.createElement("select");
  sel.style.cssText = INP;
  TYPES.forEach((t) => {
    const o = document.createElement("option");
    o.value = t.type;
    o.textContent = t.label;
    sel.appendChild(o);
  });
  const btn = document.createElement("button");
  btn.className = "toolbar-btn settings-io";
  btn.textContent = isInput ? "+ Add input" : "+ Add output";
  btn.addEventListener("click", () => {
    const def = TYPES.find((x) => x.type === sel.value) || {};
    const row = isInput ? { id: uid("in"), type: sel.value, label: def.label, pin: "", level: 0 } : { id: uid("out"), type: sel.value, label: def.label, pin: "", onCode: def.onCode || "", offCode: def.offCode || "" };
    if (isInput && sel.value === "setter") Object.assign(row, { x: 0, y: 0, z: 0, w: 20, h: 20 });
    if (isInput && sel.value === "limit") row.axis = "x_min";
    list2.push(row);
    onChange();
    rerender();
  });
  add.appendChild(sel);
  add.appendChild(btn);
  container.appendChild(add);
}
function renderMagazineTable(container, atc, onChange) {
  if (!container) return;
  if (!Array.isArray(atc.magazine)) atc.magazine = [];
  const rerender = () => renderMagazineTable(container, atc, onChange);
  container.innerHTML = "";
  const ctl = document.createElement("div");
  ctl.style.cssText = "display:flex; gap:16px; align-items:flex-end; margin-bottom:12px; flex-wrap:wrap;";
  const typeSel = document.createElement("select");
  [["straight", "Straight / linear"], ["disk", "Disk / carousel"]].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    if ((atc.magType || "straight") === v) o.selected = true;
    typeSel.appendChild(o);
  });
  typeSel.addEventListener("change", () => {
    atc.magType = typeSel.value;
    onChange();
    rerender();
  });
  ctl.appendChild(field("Magazine type", typeSel, 150));
  const cnt = document.createElement("input");
  cnt.type = "number";
  cnt.min = "0";
  cnt.max = "99";
  cnt.value = atc.magazine.length;
  cnt.addEventListener("change", () => {
    const n = Math.max(0, Math.min(99, parseInt(cnt.value, 10) || 0));
    while (atc.magazine.length < n) {
      const k = atc.magazine.length + 1;
      atc.magazine.push({ pocket: k, tool: "", name: "", x: "", y: "", z: "" });
    }
    atc.magazine.length = n;
    onChange();
    rerender();
  });
  ctl.appendChild(field("Pockets", cnt, 60));
  container.appendChild(ctl);
  if (atc.magType === "disk") {
    const note = document.createElement("div");
    note.className = "settings-hint";
    note.textContent = "Disk: a carousel-rotate output + pocket-index sensor input were added (Output / Input). One fixed pickup; the magazine rotates each pocket to it.";
    container.appendChild(note);
  }
  if (!atc.magazine.length) {
    const e = document.createElement("div");
    e.className = "settings-hint";
    e.textContent = "Set the pocket count to build the magazine table.";
    container.appendChild(e);
    return;
  }
  const COLS = [["Pocket", 46], ["Tool", 168], ["Description", 150], ["Park X", 66], ["Park Y", 66], ["Park Z", 66]];
  const head = document.createElement("div");
  head.style.cssText = "display:flex; gap:8px; font-size:10px; color:#6b6150; font-weight:600; padding:2px;";
  COLS.forEach(([h, w]) => {
    const s = document.createElement("span");
    s.textContent = h;
    s.style.width = w + "px";
    head.appendChild(s);
  });
  container.appendChild(head);
  atc.magazine.forEach((row, i) => {
    row.pocket = i + 1;
    const tr = document.createElement("div");
    tr.style.cssText = "display:flex; gap:8px; align-items:center; padding:3px 2px; border-bottom:1px solid rgba(0,0,0,0.08);";
    const pk = document.createElement("span");
    pk.textContent = i + 1;
    pk.style.cssText = "width:46px; font-weight:600; color:#3a3a3a;";
    tr.appendChild(pk);
    const sel = document.createElement("select");
    sel.innerHTML = toolOptionsHTML("\u2014 empty \u2014");
    sel.value = row.tool === "" || row.tool == null ? "" : String(row.tool);
    sel.style.cssText = INP + " width:158px;";
    const desc = document.createElement("span");
    desc.style.cssText = "width:150px; font-size:11px; color:#6b6150; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
    const fillDesc = () => {
      const t = getTool(row.tool);
      desc.textContent = t ? [t.type, t.flutes !== "" ? t.flutes + "F" : "", t.feed !== "" ? "F" + t.feed : ""].filter(Boolean).join(" \xB7 ") || t.name || "\u2014" : "(empty)";
    };
    fillDesc();
    sel.addEventListener("change", () => {
      row.tool = sel.value === "" ? "" : Number(sel.value);
      fillDesc();
      onChange();
    });
    tr.appendChild(sel);
    tr.appendChild(desc);
    const cell = (key, w) => {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = "0.1";
      inp.value = row[key] ?? "";
      inp.style.cssText = INP + ` width:${w}px;`;
      inp.addEventListener("change", () => {
        row[key] = inp.value === "" ? "" : Number(inp.value);
        onChange();
      });
      return inp;
    };
    tr.appendChild(cell("x", 58));
    tr.appendChild(cell("y", 58));
    tr.appendChild(cell("z", 58));
    container.appendChild(tr);
  });
}

// ../DDCS-Studio/web/ui/themes.js
var THEMES = ["studio", "normal", "steampunk", "futuristic", "organic"];

// ../DDCS-Studio/web/data/atcGenerator.js
function num(v, d) {
  return v === "" || v == null || isNaN(Number(v)) ? d : Number(v);
}
function generateToolChangeNc(atc, outputs) {
  atc = atc || {};
  const mag = (Array.isArray(atc.magazine) ? atc.magazine : []).filter((p) => p && p.tool !== "" && p.tool != null);
  const nameOf = {};
  (Array.isArray(atc.tools) ? atc.tools : []).forEach((t) => {
    if (t && t.num != null && t.num !== "") nameOf[Number(t.num)] = t.name || "";
  });
  const label = (p) => {
    const nm = p.name || nameOf[num(p.tool, 0)] || "";
    return nm ? " - " + nm : "";
  };
  const drawbar = (outputs || []).find((o) => o.type === "drawbar") || {};
  const release = (drawbar.onCode || "M154").trim();
  const clamp = (drawbar.offCode || "M155").trim();
  const safeZ = num(atc.safeZ, 10);
  const dwell = 500;
  const L = [];
  const w = (s) => L.push(s);
  w("(T.nc - tool-change macro generated by DDCS Studio)");
  w("(GENERATED TEMPLATE - review every line + dry-run before cutting. NOT validated on a live ATC.)");
  w("(Straight/linear magazine, " + mag.length + " pockets. Drawbar: release " + release + " / clamp " + clamp + ".)");
  w("(#1504=requested tool [Tn M6]  #1300=tool in spindle  #1430+=tool-length table)");
  w("");
  w("IF #1504==#1300 GOTO999            ; requested tool already in spindle");
  w("M5  M9                             ; spindle + coolant OFF before any drawbar action");
  w("M300                              ; wait: spindle stopped (delete if no sensor)");
  w("#4 = " + safeZ);
  w("G53 G0 Z#4                         ; lift to safe Z (G53 needs a variable)");
  w("");
  w("(===== return the current tool to its pocket =====)");
  w("IF #1300==0 GOTO500               ; spindle empty - nothing to return");
  mag.forEach((p, i) => w("IF #1300==" + num(p.tool, 0) + " GOTO" + (101 + i) + "         ; current tool -> pocket " + num(p.pocket, i + 1)));
  w("GOTO500                           ; current tool not in magazine - skip return");
  mag.forEach((p, i) => {
    w("N" + (101 + i) + " (return T" + num(p.tool, 0) + " to pocket " + num(p.pocket, i + 1) + label(p) + ")");
    w("#1 = " + num(p.x, 0) + "  #2 = " + num(p.y, 0) + "  #3 = " + num(p.z, 0));
    w("G53 G0 X#1 Y#2");
    w("G53 G0 Z#3");
    w(release + "                          ; drawbar release");
    w("G04 P" + dwell);
    w("M301                              ; wait: drawbar released (delete if no sensor)");
    w("G53 G0 Z#4");
    w("GOTO500");
  });
  w("");
  w("N500 (===== fetch the requested tool =====)");
  mag.forEach((p, i) => w("IF #1504==" + num(p.tool, 0) + " GOTO" + (201 + i) + "         ; requested tool -> pocket " + num(p.pocket, i + 1)));
  w("#1505 = 1(Tool not in magazine!) ; requested tool has no pocket");
  w("GOTO999");
  mag.forEach((p, i) => {
    w("N" + (201 + i) + " (fetch T" + num(p.tool, 0) + " from pocket " + num(p.pocket, i + 1) + label(p) + ")");
    w("#1 = " + num(p.x, 0) + "  #2 = " + num(p.y, 0) + "  #3 = " + num(p.z, 0));
    w("G53 G0 X#1 Y#2");
    w(release + "                          ; open collet BEFORE descending over the tool shank");
    w("M301                              ; wait: drawbar released (delete if no sensor)");
    w("G53 G0 Z#3                          ; descend over the tool");
    w(clamp + "                          ; drawbar clamp");
    w("G04 P" + dwell);
    w("M302                              ; wait: drawbar clamped (delete if no sensor)");
    w("G53 G0 Z#4");
    w("#1300 = #1504               ; record the new tool");
    w("GOTO999");
  });
  w("");
  w("N999");
  w("M99");
  return L.join("\n");
}

// ../DDCS-Studio/web/ui/cloudAccount.js
init_providers();

// ../DDCS-Studio/web/ui/cloud/pkce.js
var b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function randBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}
var randToken = (n = 32) => [...randBytes(n)].map((b2) => b2.toString(16).padStart(2, "0")).join("");
async function makeChallenge() {
  const verifier = b64url(randBytes(48).buffer);
  const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(dig) };
}
var makeState = () => randToken(16);
function buildAuthUrl(p, { clientId: clientId2, redirectUri: redirectUri2, challenge, state }) {
  const q = new URLSearchParams({
    client_id: clientId2,
    redirect_uri: redirectUri2,
    response_type: "code",
    scope: p.scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    ...p.extraAuth || {}
  });
  return `${p.authorize}?${q.toString()}`;
}
async function exchangeCode(p, { code, clientId: clientId2, redirectUri: redirectUri2, verifier }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId2,
    redirect_uri: redirectUri2,
    code_verifier: verifier
  });
  const r = await fetch(p.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`token exchange ${r.status}`);
  return r.json();
}

// ../DDCS-Studio/web/ui/cloudAccount.js
var TOK2 = "ddcs_cloud_token";
var PROV = "ddcs_cloud_provider";
var EMAIL = "ddcs_cloud_email";
var REFRESH = "ddcs_cloud_refresh";
function getAccount() {
  try {
    return { connected: !!localStorage.getItem(TOK2), provider: localStorage.getItem(PROV) || "", email: localStorage.getItem(EMAIL) || "" };
  } catch (e) {
    return { connected: false, provider: "", email: "" };
  }
}
function disconnect() {
  try {
    [TOK2, PROV, EMAIL, REFRESH].forEach((k) => localStorage.removeItem(k));
  } catch (e) {
  }
  window.dispatchEvent(new CustomEvent("ddcs:cloud-account"));
}
function connect(provider = "google") {
  const p = getProvider(provider);
  if (!p) return;
  if (provider === "google" && window.pywebview && window.pywebview.api) {
    connectGoogleDesktop();
    return;
  }
  if (!clientId(provider)) {
    const v = window.prompt(
      `Connect ${p.label} \u2014 your OWN account (no server, no secret).

No client ID is configured. Register a PUBLIC / SPA OAuth app for ${p.label}` + (provider === "google" ? " (Authorized JavaScript origin = " + location.origin + ")" : `, redirect URI:
   ${redirectUri()}`) + `

Paste its Client ID:`
    );
    if (!v) return;
    setClientId(provider, v.trim());
  }
  if (provider === "google") {
    connectGoogleFlow();
    return;
  }
  openConnectModal(provider);
}
async function connectGoogleFlow() {
  try {
    const { connectGoogle: connectGoogle2 } = await Promise.resolve().then(() => (init_googleDrive(), googleDrive_exports));
    const tok = await connectGoogle2(clientId("google"));
    localStorage.setItem(TOK2, tok);
    localStorage.setItem(PROV, "google");
    window.dispatchEvent(new CustomEvent("ddcs:cloud-account"));
  } catch (e) {
    if (String(e && e.message) !== "sign-in cancelled") window.alert("Google sign-in failed: " + (e && e.message));
  }
}
async function connectGoogleDesktop() {
  let r;
  try {
    r = await (await fetch("/oauth/google/start")).json();
  } catch (e) {
    window.alert("Could not reach the gateway to start Google sign-in.");
    return;
  }
  if (!r.ok) {
    window.alert("Google sign-in unavailable: " + (r.error || "set a Google Desktop client id in the gateway Setup."));
    return;
  }
  const deadline = Date.now() + 18e4;
  const tick = async () => {
    let t = {};
    try {
      t = await (await fetch("/api/oauth/google/token")).json();
    } catch (e) {
    }
    if (t.access_token) {
      try {
        localStorage.setItem(TOK2, t.access_token);
        localStorage.setItem(PROV, "google");
      } catch (e) {
      }
      window.dispatchEvent(new CustomEvent("ddcs:cloud-account"));
      return;
    }
    if (Date.now() < deadline) setTimeout(tick, 1500);
  };
  setTimeout(tick, 2e3);
}
async function openConnectModal(provider) {
  const p = getProvider(provider);
  const cid = clientId(provider);
  const ov = document.createElement("div");
  ov.className = "cloud-modal";
  ov.innerHTML = `<div class="cloud-modal-panel"><div class="proj-head"><span class="proj-title">\u{1F517} Connect ${p.label}</span><button class="op-btn" data-cm="cancel" title="Cancel">\u2715</button></div><div class="cloud-modal-body"><div class="cloud-modal-status">Opening ${p.label} sign-in\u2026</div><div class="hint">A secure ${p.label} window opens \u2014 approve access and it returns here automatically. Your token stays in this browser; nothing is sent to a server.</div></div><div class="cloud-modal-foot"><button class="op-btn" data-cm="retry">Open sign-in</button><span style="flex:1"></span><button class="op-btn" data-cm="cancel">Cancel</button></div></div>`;
  document.body.appendChild(ov);
  const statusEl = ov.querySelector(".cloud-modal-status");
  const { verifier, challenge } = await makeChallenge();
  const state = makeState();
  const ruri = redirectUri();
  const url = buildAuthUrl(p, { clientId: cid, redirectUri: ruri, challenge, state });
  let popup = null;
  const onMsg = async (e) => {
    if (e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.type !== "ddcs-oauth-code" || d.state !== state) return;
    window.removeEventListener("message", onMsg);
    if (d.error) {
      statusEl.textContent = "Sign-in failed: " + d.error;
      return;
    }
    try {
      statusEl.textContent = "Finishing\u2026";
      if (!p.corsToken) throw new Error(`${p.label}: code received, but its token exchange needs the provider SDK (TODO).`);
      const tok = await exchangeCode(p, { code: d.code, clientId: cid, redirectUri: ruri, verifier });
      localStorage.setItem(TOK2, tok.access_token || "");
      localStorage.setItem(PROV, provider);
      if (tok.refresh_token) localStorage.setItem(REFRESH, tok.refresh_token);
      cleanup(true);
    } catch (err) {
      statusEl.textContent = err.message;
    }
  };
  const open = () => {
    popup = window.open(url, "ddcs_oauth", "width=520,height=680");
    statusEl.textContent = popup ? `Waiting for ${p.label} sign-in\u2026` : "Popup blocked \u2014 allow popups, then \u201COpen sign-in\u201D.";
  };
  const cleanup = (ok) => {
    window.removeEventListener("message", onMsg);
    try {
      popup && popup.close();
    } catch (_) {
    }
    ov.remove();
    if (ok) window.dispatchEvent(new CustomEvent("ddcs:cloud-account"));
  };
  window.addEventListener("message", onMsg);
  ov.addEventListener("click", (e) => {
    const t = e.target.closest("[data-cm]");
    if (!t) {
      if (e.target === ov) cleanup(false);
      return;
    }
    if (t.dataset.cm === "cancel") cleanup(false);
    else open();
  });
  open();
}
function renderCloudLogin(container) {
  if (!container) return;
  const a = getAccount();
  const wrap = document.createElement("div");
  wrap.className = "cloud-login";
  const status = document.createElement("div");
  status.className = "cloud-status" + (a.connected ? "" : " muted");
  status.textContent = a.connected ? `Connected \xB7 ${providerLabel(a.provider)}${a.email ? " \xB7 " + a.email : ""}` : "Not connected \u2014 projects stay local until you connect your own cloud account.";
  wrap.appendChild(status);
  if (a.connected) {
    const dc = document.createElement("button");
    dc.className = "op-btn";
    dc.textContent = "Disconnect";
    dc.addEventListener("click", () => disconnect());
    wrap.appendChild(dc);
  } else {
    const row = document.createElement("div");
    row.className = "cloud-providers";
    for (const id of PROVIDER_IDS) {
      const b2 = document.createElement("button");
      b2.className = "op-btn cloud-connect";
      b2.innerHTML = providerIcon(id) + "<span>Connect " + providerLabel(id) + "</span>";
      b2.addEventListener("click", () => connect(id));
      row.appendChild(b2);
    }
    wrap.appendChild(row);
  }
  container.replaceChildren(wrap);
  if (!container._cloudWired) {
    container._cloudWired = true;
    window.addEventListener("ddcs:cloud-account", () => renderCloudLogin(container));
  }
}

// ../DDCS-Studio/web/ui/settingsPanel.js
var DDCS_SETTINGS_KEY = "ddcs_studio_settings";
var TOOL_TYPES = ["endmill", "drill", "ballnose", "chamfer", "vbit", "spotdrill", "face", "tap", "reamer", "engraver", "other"];
var STANDARD_TOOLS = [
  { num: 1, name: "6mm Flat Endmill", type: "endmill", dia: 6, flutes: 2, length: "", rpm: 18e3, feed: 1200, plunge: 400 },
  { num: 2, name: '1/8" Flat Endmill', type: "endmill", dia: 3.175, flutes: 2, length: "", rpm: 18e3, feed: 800, plunge: 300 },
  { num: 3, name: "6mm Ball Nose", type: "ballnose", dia: 6, flutes: 2, length: "", rpm: 18e3, feed: 1e3, plunge: 350 },
  { num: 4, name: "60\xB0 V-Bit", type: "vbit", dia: 6, flutes: 1, length: "", rpm: 18e3, feed: 600, plunge: 200 }
];
var standardTools = () => STANDARD_TOOLS.map((t) => ({ ...t }));
function normalizeTool(t, fallbackNum) {
  const fb = fallbackNum != null ? fallbackNum : "";
  if (typeof t === "number") return { num: fb, name: "", type: "", dia: "", flutes: "", length: t, rpm: "", feed: "", plunge: "" };
  const o = t && typeof t === "object" ? t : {};
  return {
    num: o.num != null && o.num !== "" ? o.num : fb,
    name: o.name || "",
    type: o.type || "",
    dia: o.dia ?? "",
    flutes: o.flutes ?? "",
    length: o.length ?? "",
    rpm: o.rpm ?? "",
    feed: o.feed ?? "",
    plunge: o.plunge ?? ""
  };
}
function libraryTools(atc) {
  const tools = Array.isArray(atc && atc.tools) ? atc.tools : [];
  return tools.map((t, i) => normalizeTool(t, i + 1)).filter((t) => t.name || t.type || t.dia !== "" || t.flutes !== "" || t.length !== "" || t.rpm !== "" || t.feed !== "" || t.plunge !== "");
}
var STOCK_TEMPLATES = [
  { name: "3-axis plate (small)", x: 150, y: 100, z: 20, shape: "boss" },
  { name: "3-axis board (large)", x: 400, y: 300, z: 18, shape: "boss" },
  { name: "Rotary block 3\u2033", x: 150, y: 76.2, z: 76.2, shape: "boss" },
  { name: "Rotary cylinder \xD83\u2033", x: 150, y: 76.2, z: 76.2, shape: "cylinder" }
];
var SETTINGS_DEFAULTS = {
  stock: { x: 100, y: 80, z: 20, shape: "boss", show: true },
  stockTemplates: [],
  // user-saved presets: { name, x, y, z, shape }
  machine: { x: 300, y: 300, z: 120, ox: 0, oy: 0, oz: 0, show: true, workOrigin: { x: 0, y: 0, z: 0 } },
  view: { theta: -1.5708, phi: 1.0472 },
  // 3D preview start orientation (front: +X right, +Y back)
  probes: {
    probePin: 3,
    probeLevel: 0,
    // IN03 = YunKia V6 3D probe (confirmed)
    setterPin: 2,
    setterLevel: 0,
    // IN02 = fixed Tool Setter (confirmed); was 4 (IN04 = unwired)
    setterX: 10,
    setterY: 10,
    setterZ: -50,
    setterW: 20,
    setterH: 20,
    // 3D-probe global defaults the touch-probe wizards (corner/edge/middle/circular/alignment/rotary)
    // start from. radius drives radius compensation; feeds/retract/safeZ/maxDist/qStop seed each op.
    radius: 2,
    fastFeed: 200,
    slowFeed: 50,
    retract: 2,
    safeZ: 10,
    maxDist: 100,
    qStop: 1,
    // Per-field source: 'studio' = literal from the form (current behaviour) | 'ctrl' = generated
    // code reads the controller's own parameter at runtime (e.g. F#632 P#1078 — see
    // PROBE-CONFIG-SOURCE.md). Only fields the active controller profile lists in probeVars
    // can be 'ctrl'; the wizard inputs show a controller glyph to flip each one.
    sources: {
      port: "studio",
      level: "studio",
      fastFeed: "studio",
      retract: "studio",
      setterPort: "studio",
      setterLevel: "studio",
      blockHeight: "studio"
    }
  },
  limits: {
    xMinPin: "",
    xMinLevel: 0,
    xMaxPin: "",
    xMaxLevel: 0,
    yMinPin: "",
    yMinLevel: 0,
    yMaxPin: "",
    yMaxLevel: 0,
    zMinPin: "",
    zMinLevel: 0,
    zMaxPin: "",
    zMaxLevel: 0
  },
  // Which hardware tabs are shown (manual toggles, persisted). Defaults match the M350 profile:
  // Probes + Limits on, ATC off (no clutter unless you have a tool changer). Fully manual so non-bridge
  // users can configure for accurate simulation; a controller profile just presets these.
  hardwareTabs: { probes: true, atc: false, limits: true, spindle: false },
  // 3D/2D toolpath preview (read by viz/createPreviewPanel via window.ddcsGetSettings().preview).
  preview: { followDamp: 50, showRapids: true, defaultView: "3d", defaultSpeed: 1, followDefault: true, autoLoop: true },
  // Composing assists (Blocks suggestions, Studio editor autocomplete, ghost next-block).
  compose: { suggestions: true, autocomplete: true, ghost: true },
  // ATC: tool-length probe defaults (consumed by the Tool Length wizard) + the tool-offset table.
  // baseVar = DDCS tool-offset table base (#1430 = tool 1); tools[i] = stored length for tool i+1.
  atc: {
    baseVar: 1430,
    tools: standardTools(),
    blockHeight: 50,
    safeZ: 10,
    maxDist: 100,
    retract: 3,
    fFast: 300,
    fSlow: 50,
    qStop: 1,
    magType: "straight",
    magazine: []
    // magType: straight|disk; magazine[]: {pocket,tool,name,x,y,z}
  },
  // Toolhead fitted to the machine. spindle/router is the working type; plasma/laser are stubs.
  // Type-specific config lives in its own object (spindle below; plasma/laser TBD).
  head: { type: "spindle" },
  // Spindle / VFD — Studio-side authoring defaults. The DDCS controller owns the live spindle
  // params (PWM/analog, max RPM #582); these seed generated M3/M4 + S words, spin-up/down dwell,
  // and the warm-up wizard target. Added via the Head tab's "Add head".
  spindle: { maxRpm: 24e3, defaultRpm: 18e3, dir: "cw", spinUp: 3, spinDown: 3 },
  // End-of-program routine — the safe footer appended to generated programs. DDCS note: G53
  // machine-coord moves are verified; G28 is NOT configured, so retract/park use G53. Global
  // default; per-wizard overrides can layer on top later.
  endProgram: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: "M30" },
  // Dynamic machine I/O — the new source of truth; seeded from probes/limits on first load.
  inputs: [],
  outputs: [],
  // Axis roles — X/Y/Z linear; A/B optionally rotary. The sim reads this to spin the solid on a
  // rotary-axis move (around the declared Cartesian axis). Two rotary axes are allowed (A and B).
  motors: {
    x: { role: "linear" },
    y: { role: "linear" },
    z: { role: "linear" },
    a: { role: "unused", around: "x" },
    b: { role: "unused", around: "y" }
  }
};
var LIMIT_AXES2 = [
  ["x_min", "Limit X\u2212", "xMinPin", "xMinLevel"],
  ["x_max", "Limit X+", "xMaxPin", "xMaxLevel"],
  ["y_min", "Limit Y\u2212", "yMinPin", "yMinLevel"],
  ["y_max", "Limit Y+", "yMaxPin", "yMaxLevel"],
  ["z_min", "Limit Z\u2212", "zMinPin", "zMinLevel"],
  ["z_max", "Limit Z+", "zMaxPin", "zMaxLevel"]
];
function migrateIO(s) {
  if (!Array.isArray(s.inputs)) s.inputs = [];
  if (!Array.isArray(s.outputs)) s.outputs = [];
  if (s.inputs.length === 0) {
    const p = s.probes || {};
    s.inputs.push({ id: "probe", type: "probe", label: "3D Probe", pin: p.probePin ?? "", level: p.probeLevel ?? 0 });
    s.inputs.push({
      id: "setter",
      type: "setter",
      label: "Tool Setter",
      pin: p.setterPin ?? "",
      level: p.setterLevel ?? 0,
      x: p.setterX,
      y: p.setterY,
      z: p.setterZ,
      w: p.setterW,
      h: p.setterH
    });
    const L = s.limits || {};
    for (const [axis, label, pinK, lvlK] of LIMIT_AXES2) {
      if (L[pinK] !== "" && L[pinK] != null) s.inputs.push({ id: "limit_" + axis, type: "limit", axis, label, pin: L[pinK], level: L[lvlK] || 0 });
    }
  }
  return s;
}
function syncFlatFromIO(s) {
  const first = (t) => (s.inputs || []).find((i) => i.type === t);
  const probe = first("probe"), setter = first("setter");
  s.probes = s.probes || {};
  if (probe) {
    s.probes.probePin = probe.pin;
    s.probes.probeLevel = probe.level;
  }
  if (setter) Object.assign(s.probes, { setterPin: setter.pin, setterLevel: setter.level, setterX: setter.x, setterY: setter.y, setterZ: setter.z, setterW: setter.w, setterH: setter.h });
  s.limits = s.limits || {};
  for (const [, , pinK, lvlK] of LIMIT_AXES2) {
    s.limits[pinK] = "";
    s.limits[lvlK] = 0;
  }
  for (const inp of s.inputs || []) {
    if (inp.type !== "limit") continue;
    const row = LIMIT_AXES2.find((a) => a[0] === inp.axis);
    if (row) {
      s.limits[row[2]] = inp.pin;
      s.limits[row[3]] = inp.level || 0;
    }
  }
}
var _ddcsSettings = loadSettings();
if (_ddcsSettings.atc) _ddcsSettings.atc.tools = libraryTools(_ddcsSettings.atc);
function loadSettings() {
  try {
    const raw = localStorage.getItem(DDCS_SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const merged = migrateIO({
        toolsSeeded: p.toolsSeeded === true,
        stock: { ...SETTINGS_DEFAULTS.stock, ...p.stock || {} },
        stockTemplates: Array.isArray(p.stockTemplates) ? p.stockTemplates : [],
        machine: { ...SETTINGS_DEFAULTS.machine, ...p.machine || {} },
        view: { ...SETTINGS_DEFAULTS.view, ...p.view || {} },
        probes: {
          ...SETTINGS_DEFAULTS.probes,
          ...p.probes || {},
          sources: { ...SETTINGS_DEFAULTS.probes.sources, ...(p.probes || {}).sources || {} }
        },
        limits: { ...SETTINGS_DEFAULTS.limits, ...p.limits || {} },
        hardwareTabs: { ...SETTINGS_DEFAULTS.hardwareTabs, ...p.hardwareTabs || {} },
        preview: { ...SETTINGS_DEFAULTS.preview, ...p.preview || {} },
        compose: { ...SETTINGS_DEFAULTS.compose, ...p.compose || {} },
        atc: { ...SETTINGS_DEFAULTS.atc, ...p.atc || {} },
        head: { ...SETTINGS_DEFAULTS.head, ...p.head || {} },
        spindle: { ...SETTINGS_DEFAULTS.spindle, ...p.spindle || {} },
        endProgram: { ...SETTINGS_DEFAULTS.endProgram, ...p.endProgram || {} },
        motors: { ...SETTINGS_DEFAULTS.motors, ...p.motors || {} },
        inputs: Array.isArray(p.inputs) ? p.inputs : [],
        outputs: Array.isArray(p.outputs) ? p.outputs : []
      });
      if (!merged.toolsSeeded && (!Array.isArray(merged.atc.tools) || merged.atc.tools.length === 0)) {
        merged.atc.tools = standardTools();
      }
      merged.toolsSeeded = true;
      return merged;
    }
  } catch (e) {
  }
  return migrateIO(JSON.parse(JSON.stringify(SETTINGS_DEFAULTS)));
}
function saveSettings() {
  try {
    localStorage.setItem(DDCS_SETTINGS_KEY, JSON.stringify(_ddcsSettings));
  } catch (e) {
  }
  window.dispatchEvent(new CustomEvent("ddcs:settings-changed", { detail: _ddcsSettings }));
}
function getSettings() {
  return _ddcsSettings;
}
function getInputs() {
  return _ddcsSettings.inputs || [];
}
function getOutputs() {
  return _ddcsSettings.outputs || [];
}
function getRotaryAxes() {
  const m = _ddcsSettings.motors || {};
  const out = {};
  for (const ax of ["a", "b"]) {
    if (m[ax] && m[ax].role === "rotary") out[ax] = m[ax].around || "x";
  }
  return out;
}
function syncIO() {
  syncFlatFromIO(_ddcsSettings);
  saveSettings();
}
function probeSrc(field2) {
  const pv = (getActiveProfile().probeVars || {})[field2];
  if (!pv) return null;
  return (_ddcsSettings.probes.sources || {})[field2] === "ctrl" ? pv : null;
}
function probeSrcAvailable(field2) {
  return !!(getActiveProfile().probeVars || {})[field2];
}
function setProbeSrc(field2, mode) {
  if (!_ddcsSettings.probes.sources) _ddcsSettings.probes.sources = {};
  _ddcsSettings.probes.sources[field2] = mode === "ctrl" ? "ctrl" : "studio";
  saveSettings();
}
function resolveProbeSources(fields) {
  const out = {};
  for (const f of fields) {
    const s = probeSrc(f);
    if (s) out[f] = s;
  }
  return out;
}
window.ddcsProbeSrc = probeSrc;
window.ddcsProbeSrcAvailable = probeSrcAvailable;
window.ddcsSetProbeSrc = setProbeSrc;
window.ddcsResolveProbeSources = resolveProbeSources;
var _fillSettingsInputs = null;
function applySettings(incoming) {
  if (!incoming || typeof incoming !== "object") return;
  if (incoming.stock) _ddcsSettings.stock = { ...SETTINGS_DEFAULTS.stock, ..._ddcsSettings.stock, ...incoming.stock };
  if (incoming.machine) _ddcsSettings.machine = { ...SETTINGS_DEFAULTS.machine, ..._ddcsSettings.machine, ...incoming.machine };
  if (incoming.probes) _ddcsSettings.probes = { ...SETTINGS_DEFAULTS.probes, ..._ddcsSettings.probes, ...incoming.probes };
  if (incoming.limits) _ddcsSettings.limits = { ...SETTINGS_DEFAULTS.limits, ..._ddcsSettings.limits, ...incoming.limits };
  if (Array.isArray(incoming.inputs)) {
    _ddcsSettings.inputs = incoming.inputs;
    syncFlatFromIO(_ddcsSettings);
  }
  if (Array.isArray(incoming.outputs)) _ddcsSettings.outputs = incoming.outputs;
  saveSettings();
  if (_fillSettingsInputs) _fillSettingsInputs();
}
function buildSettingsOverlay() {
  const parent = document.getElementById("settings-app");
  if (!parent) return;
  if (parent.querySelector(".settings-body")) return;
  parent.classList.remove("hidden");
  parent.innerHTML = `
        <style>
            #settings-app { display: flex; flex-direction: column; }
            #settings-app .settings-head { padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--panel); flex: 0 0 auto; display: flex; align-items: center; }
            #settings-app .settings-main-tab, #settings-app .settings-main-tab:hover, #settings-app .settings-main-tab:active { position: relative; padding: 6px 6px; font-size: 12.5px; font-weight: 700; letter-spacing: 1px; font-family: inherit; color: var(--text-dim); background: transparent; border: none; border-radius: 0; box-shadow: none; text-shadow: none; filter: none; transform: none; cursor: pointer; transition: 120ms; }
            #settings-app .settings-main-tab:hover, #settings-app .settings-main-tab.active { color: var(--text-main); }
            #settings-app .settings-main-tab.active::after { content: ''; position: absolute; left: 4px; right: 4px; bottom: -8px; height: 3px; background: var(--accent); border-radius: var(--radius, 3px) var(--radius, 3px) 0 0; }
            #settings-app .settings-body { display: flex; flex-direction: row; flex: 1; min-height: 0; overflow: hidden; }
            #settings-app .settings-sidebar { width: 160px; flex: 0 0 160px; display: flex; flex-direction: column; gap: 2px; padding: 12px 8px; border-right: 1px solid var(--border); background: var(--panel); overflow-y: auto; }
            #settings-app .settings-sidebar .settings-tab { display: block; width: 100%; text-align: left; padding: 7px 12px; font-size: 12.5px; font-weight: 600; border-radius: var(--radius, 4px); border: none; background: transparent; color: var(--text-dim); cursor: pointer; transition: 120ms; }
            #settings-app .settings-sidebar .settings-tab:hover { background: var(--bg); color: var(--text-main); }
            #settings-app .settings-sidebar .settings-tab.active { background: var(--bg); color: var(--text-main); border-left: 3px solid var(--accent); padding-left: 9px; }
            #settings-app .settings-sidebar .sidebar-group-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); padding: 8px 12px 4px; opacity: .6; }
            #settings-app .settings-sidebar .sidebar-group-label:first-child { padding-top: 2px; }
            #settings-app .settings-content { flex: 1; min-width: 0; overflow-y: auto; padding: 16px 20px; background: var(--bg); }
            #settings-app .settings-foot { flex: 0 0 auto; padding: 8px 16px; border-top: 1px solid var(--border); background: var(--panel); display: flex; gap: 8px; }
        </style>
            <div class="settings-head">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div class="settings-tabs" style="display: flex; gap: 8px;">
                        <button class="settings-main-tab active" data-group="general">General</button>
                        <button class="settings-main-tab" data-group="hardware">Hardware</button>
                    </div>
                </div>
            </div>
            <div class="settings-body">
                <div class="settings-sidebar">
                    <div class="sidebar-group-label" data-group-label="general">General</div>
                    <button class="settings-tab active" data-group="general" data-target="set_tab_profile">Profile</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_appearance">Appearance</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_preview">Preview</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_compose">Editor</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_variables">Variables</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_program">Program</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_feedback">Feedback</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_network">Network</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_about">About</button>
                    <div class="sidebar-group-label" data-group-label="hardware" style="display:none;">Hardware</div>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_machine" style="display:none;">Machine</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_spindle" style="display:none;">Head</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_input" style="display:none;">Input</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_output" style="display:none;">Output</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_atc" style="display:none;">Tool table</button>
                </div>
                <div class="settings-content">
                <!-- GENERAL: PREVIEW (3D/2D toolpath view + simulation) -->
                <div id="set_tab_preview" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">TOOLPATH PREVIEW</div>
                        <div class="settings-field">Default view
                            <select id="set_pv_view"><option value="3d">3D</option><option value="2d">2D (top-down)</option></select>
                        </div>
                        <div class="settings-field">Default play speed
                            <select id="set_pv_speed"><option value="1">1\xD7</option><option value="2">2\xD7</option><option value="5">5\xD7</option><option value="10">10\xD7</option></select>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_pv_rapids"> Show rapid moves (yellow) in the 3D view</label>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">FOLLOW CAMERA</div>
                        <div class="settings-hint">Toggle the follow-cam (the \u2316 button in the preview bar) to keep the tool centred while playing. Damping smooths how fast the camera catches up.</div>
                        <label class="settings-check"><input type="checkbox" id="set_pv_follow_default"> Centre-lock the camera when a preview opens</label>
                        <label class="settings-check"><input type="checkbox" id="set_pv_autoloop"> Auto-play in a loop when a preview opens</label>
                        <div class="settings-field" style="margin-top:10px">Centre-lock damping \u2014 <span id="set_pv_followdamp_val">50%</span>
                            <input type="range" id="set_pv_followdamp" min="0" max="100" step="5" style="width:100%; max-width:280px;">
                        </div>
                        <div class="settings-hint">Low = snaps to the tool \xB7 High = smooth, gentle follow.</div>
                    </div>
                </div>
                <!-- GENERAL: COMPOSING (authoring assists \u2014 Blocks suggestions + Studio editor autocomplete) -->
                <div id="set_tab_compose" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">EDITOR ASSISTS</div>
                        <div class="settings-hint">Authoring help across both editors \u2014 the Blocks tab and the Studio text editor. All optional.</div>
                        <label class="settings-check"><input type="checkbox" id="set_cp_suggestions"> Block suggestions \u2014 the "Suggested next" chip strip in the Blocks tab</label>
                        <label class="settings-check"><input type="checkbox" id="set_cp_autocomplete"> Editor autocomplete \u2014 context suggestions at the cursor in the Studio editor</label>
                        <label class="settings-check"><input type="checkbox" id="set_cp_ghost"> Suggestion box \u2014 a floating box of likely next blocks on the canvas (click, or Tab takes the first)</label>
                    </div>
                </div>
                <!-- GENERAL: PROFILE -->
                <div id="set_tab_profile">
                    <div class="settings-section">
                        <div class="settings-section-title">CONTROLLER PROFILE</div>
                        <div class="settings-row">
                            <select id="set_profile" title="Controller profile \u2014 presets the hardware your machine has" style="background:#222; color:#ddd; border:1px solid #888; font-size:13px; padding:4px 8px;"></select>
                            <button class="toolbar-btn settings-io" id="set_profile_pull" title="Fetch this machine's profile (tabs + pins) from the bridged controller. Offline controllers like the DDCS 3.1: use Import profile.">\u21A7 Pull from controller</button>
                        </div>
                        <div class="settings-hint">Presets which hardware your machine has (DDCS Expert, 4.1, \u2026). You still add/remove inputs &amp; outputs in the Hardware tabs.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">POST PROCESSOR</div>
                        <div class="settings-row">
                            <select id="set_post" title="Which controller's G-code to generate. 'Follow machine profile' uses your machine's native post; override to emit code for another controller." style="background:#222; color:#ddd; border:1px solid #888; font-size:13px; padding:4px 8px;"></select>
                        </div>
                        <div class="settings-hint" id="set_post_hint">Which controller's G-code the Blocks view generates. Defaults to your machine's post; override to target another controller.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">PROFILE (settings + variables)</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_profile_export">\u2B07 Export profile</button>
                            <button class="toolbar-btn settings-io" id="set_profile_import">\u2B06 Import profile</button>
                        </div>
                        <div class="settings-hint">One JSON with your machine/stock/limits + user variables. The desktop app saves it to a local file automatically.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">EDITOR</div>
                        <label class="settings-check"><input type="checkbox" id="set_suggest_on"> Smart suggestion bar (predictive keys above the keyboard)</label>
                        <div class="settings-hint">A phone-style row suggesting the likely next G-code / macro token. Turning it off hides the row and reclaims the space.</div>
                    </div>
                    <!-- legacy hardware-tab toggles kept hidden so profile gating still works (replaced by the Input/Output tables) -->
                    <div style="display:none">
                        <input type="checkbox" id="set_show_probes"><input type="checkbox" id="set_show_atc"><input type="checkbox" id="set_show_limits">
                    </div>
                </div>

                <!-- GENERAL: VARIABLES -->
                <div id="set_tab_variables" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">VARIABLES (CSV)</div>
                        <div class="settings-row">
                            <label class="toolbar-btn settings-io">\u{1F4C2} Import CSV<input type="file" id="set_csv_input" accept=".csv,text/csv" style="display:none"></label>
                            <button class="toolbar-btn settings-io" id="set_export">\u2B07 Export CSV</button>
                            <span class="settings-hint" id="set_var_count"></span>
                        </div>
                    </div>
                </div>

                <!-- GENERAL: FEEDBACK -->
                <div id="set_tab_feedback" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">FEEDBACK</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_report">\u{1F41B} Report a bug</button>
                        </div>
                    </div>
                </div>

                <!-- GENERAL: NETWORK (cloud account + machine network) -->
                <div id="set_tab_network" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">CLOUD ACCOUNT</div>
                        <div class="settings-hint">Connect your OWN cloud account (Google Drive / Dropbox / OneDrive) to sync projects \u2014 browser-direct, no server. Projects stay local until you connect.</div>
                        <div id="set_cloud_mount" style="margin-top:8px"></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">MACHINE NETWORK</div>
                        <div class="settings-hint">Point this gateway at your controller's SMB share \u2014 or scan the LAN to find it. Live view/control needs the gateway (the desktop app); the hosted page can't reach a machine on your network.</div>
                        <div id="set_machinenet_mount" style="margin-top:8px"></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">LAN ACCESS</div>
                        <div class="settings-hint">Open Studio from a phone/laptop on the same wifi \u2014 your exe serves it (the "personal cloud"). Use this URL, not the hosted page.</div>
                        <div id="set_lan_mount" style="margin-top:8px"></div>
                    </div>
                </div>

                <!-- GENERAL: APPEARANCE -->
                <div id="set_tab_appearance" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">THEME</div>
                        <div class="settings-row">
                            <select id="set_theme" title="UI theme"></select>
                        </div>
                        <div class="settings-hint">Switches the whole UI skin. Saved on this device.</div>
                    </div>
                </div>

                <!-- GENERAL: PROGRAM (end-of-program routine) -->
                <div id="set_tab_program" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">END OF PROGRAM</div>
                        <div class="settings-hint">The safe footer appended to generated programs. On the DDCS, retract &amp; park use <b>G53</b> machine coordinates (G28 isn't configured).</div>
                        <label class="settings-check"><input type="checkbox" id="set_end_spindleoff"> Stop spindle (M5)</label>
                        <label class="settings-check"><input type="checkbox" id="set_end_coolantoff"> Coolant off (M9)</label>
                        <label class="settings-check"><input type="checkbox" id="set_end_retract"> Retract Z to safe height (G53)</label>
                        <div class="settings-grid">
                            <label>Safe Z (G53, mm)<input type="number" id="set_end_retractz" step="1"></label>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_end_park"> Park XY for unload (G53)</label>
                        <div class="settings-grid">
                            <label>Park X (G53)<input type="number" id="set_end_parkx" step="1"></label>
                            <label>Park Y (G53)<input type="number" id="set_end_parky" step="1"></label>
                        </div>
                        <div class="settings-grid">
                            <label>Program end<select id="set_end_end"><option value="M30">M30 (end + rewind)</option><option value="M2">M2 (end)</option><option value="none">None</option></select></label>
                        </div>
                        <div class="settings-row" style="margin-top:8px;">
                            <button class="toolbar-btn settings-io" id="set_end_insert">\u2B07 Insert end-of-program</button>
                        </div>
                        <div class="settings-hint">Drops the footer into the editor at the cursor. Global default; per-wizard overrides are planned.</div>
                    </div>
                </div>

                <!-- GENERAL: ABOUT -->
                <div id="set_tab_about" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">DDCS STUDIO</div>
                        <div class="settings-hint">Version <b id="set_about_ver">\u2014</b></div>
                        <div class="settings-hint">Modular G-code generator &amp; 3D simulator for the DDCS Expert / FOINNC M350 controller.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">CREDITS</div>
                        <div class="settings-hint">Built by Fr\xE9d\xE9ric \xB7 MIT License</div>
                    </div>
                </div>

                <!-- MACHINE TAB -->
                <div id="set_tab_machine" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">MACHINE ENVELOPE (mm)</div>
                        <div class="settings-grid">
                            <label>Travel X<input type="number" id="set_mach_x" min="0" step="1"></label>
                            <label>Travel Y<input type="number" id="set_mach_y" min="0" step="1"></label>
                            <label>Travel Z<input type="number" id="set_mach_z" min="0" step="1"></label>
                        </div>
                        <div class="settings-section-title sub">LIMIT / ORIGIN POSITION (mm from min corner)</div>
                        <div class="settings-grid">
                            <label>Origin X<input type="number" id="set_mach_ox" step="1"></label>
                            <label>Origin Y<input type="number" id="set_mach_oy" step="1"></label>
                            <label>Origin Z<input type="number" id="set_mach_oz" step="1"></label>
                        </div>
                        <div class="settings-section-title sub">WORK ORIGIN \u2014 machine coords of part-zero (mm)</div>
                        <div class="settings-hint">Where your G54 part-zero sits in machine coordinates (after homing + probing). Makes <code>G53</code> machine-frame moves (safe-Z retract, park) draw correctly in the sim. Leave 0 if program-zero = machine-zero. Auto-filled from a controller dump when available.</div>
                        <div class="settings-grid">
                            <label>Work origin X<input type="number" id="set_mach_wx" step="0.001"></label>
                            <label>Work origin Y<input type="number" id="set_mach_wy" step="0.001"></label>
                            <label>Work origin Z<input type="number" id="set_mach_wz" step="0.001"></label>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_mach_show"> Show machine envelope in 3D</label>
                        <div class="settings-hint">Origin = program zero position within the envelope.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">AXES</div>
                        <div class="settings-hint">X/Y/Z are linear. Set A/B to <b>rotary</b> for a 4th/5th rotary axis \u2014 the 3D sim then spins the part on those axes' moves. One machine config covers both 3-axis and rotary jobs (the program decides).</div>
                        <div class="settings-grid">
                            <label>A \u2014 role<select id="set_axis_a_role"><option value="unused">Unused</option><option value="linear">Linear</option><option value="rotary">Rotary</option></select></label>
                            <label>A \u2014 spins around<select id="set_axis_a_around"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
                            <label>B \u2014 role<select id="set_axis_b_role"><option value="unused">Unused</option><option value="linear">Linear</option><option value="rotary">Rotary</option></select></label>
                            <label>B \u2014 spins around<select id="set_axis_b_around"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
                        </div>
                    </div>
                </div>

                <!-- HARDWARE: SPINDLE -->
                <div id="set_tab_spindle" style="display:none">
                    <div class="settings-section" id="set_spin_add" style="display:none">
                        <div class="settings-section-title">HEAD</div>
                        <div class="settings-hint">Add the machine's toolhead \u2014 spindle / router today (plasma &amp; laser coming). Sets speed/direction and inserts M3/M4 + S into programs.</div>
                        <button class="toolbar-btn settings-io" id="set_spin_add_btn">\u2795 Add head</button>
                    </div>
                    <div id="set_spin_config" style="display:none">
                        <div class="settings-section">
                            <div class="settings-section-title">HEAD</div>
                            <div class="settings-grid">
                                <label>Type<select id="set_head_type"><option value="spindle">Router / Spindle</option><option value="plasma">Plasma</option><option value="laser">Laser</option></select></label>
                            </div>
                        </div>
                        <div id="set_head_spindle">
                            <div class="settings-section">
                                <div class="settings-section-title">SPINDLE / VFD</div>
                                <div class="settings-grid">
                                    <label>Max RPM<input type="number" id="set_spin_maxrpm" min="0" step="100"></label>
                                    <label>Default RPM<input type="number" id="set_spin_defrpm" min="0" step="100"></label>
                                    <label>Direction<select id="set_spin_dir"><option value="cw">M3 \u2014 clockwise</option><option value="ccw">M4 \u2014 counter-clockwise</option></select></label>
                                </div>
                                <div class="settings-grid">
                                    <label>Spin-up dwell (s)<input type="number" id="set_spin_up" min="0" step="0.1"></label>
                                    <label>Spin-down dwell (s)<input type="number" id="set_spin_down" min="0" step="0.1"></label>
                                </div>
                            </div>
                        </div>
                        <div id="set_head_plasma" style="display:none">
                            <div class="settings-section">
                                <div class="settings-section-title">PLASMA</div>
                                <div class="settings-hint">Coming soon \u2014 pierce height/delay, THC (torch-height control), arc-OK input.</div>
                            </div>
                        </div>
                        <div id="set_head_laser" style="display:none">
                            <div class="settings-section">
                                <div class="settings-section-title">LASER</div>
                                <div class="settings-hint">Coming soon \u2014 power %, PWM / M-code mapping.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- LIMITS TAB -->
                <div id="set_tab_limits" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">LIMIT SWITCHES</div>
                        <div class="settings-section-title sub">X AXIS</div>
                        <div class="settings-grid">
                            <label>Min Pin<input type="number" id="set_x_min_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_x_min_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                            <label>Max Pin<input type="number" id="set_x_max_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_x_max_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-section-title sub">Y AXIS</div>
                        <div class="settings-grid">
                            <label>Min Pin<input type="number" id="set_y_min_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_y_min_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                            <label>Max Pin<input type="number" id="set_y_max_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_y_max_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-section-title sub">Z AXIS</div>
                        <div class="settings-grid">
                            <label>Min Pin<input type="number" id="set_z_min_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_z_min_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                            <label>Max Pin<input type="number" id="set_z_max_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_z_max_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-hint">Set the pin inputs used for hard limits. Leave empty if unused.</div>
                    </div>
                </div>

                <!-- PROBES TAB -->
                <div id="set_tab_probes" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title sub">3D PROBE (PINS)</div>
                        <div class="settings-grid">
                            <label>Input Pin<input type="number" id="set_probe_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_probe_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-section-title sub">TOOL SETTER (PINS & LOCATION)</div>
                        <div class="settings-grid">
                            <label>Input Pin<input type="number" id="set_setter_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_setter_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-grid">
                            <label>Loc X<input type="number" id="set_setter_x" step="0.1"></label>
                            <label>Loc Y<input type="number" id="set_setter_y" step="0.1"></label>
                            <label>Loc Z<input type="number" id="set_setter_z" step="0.1"></label>
                            <label>Width<input type="number" id="set_setter_w" step="0.1" min="1"></label>
                            <label>Height<input type="number" id="set_setter_h" step="0.1" min="1"></label>
                        </div>
                        <div class="settings-hint">Used by generators for G31 commands, and by engine to simulate physical collisions accurately.</div>
                    </div>
                </div>

                <!-- HARDWARE: INPUT -->
                <div id="set_tab_input" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">INPUTS</div>
                        <div class="settings-hint">Add the inputs your machine has \u2014 probes, limit switches, sensors. Pins 1\u201324, one use each. Wizards read probe pins from here.</div>
                        <div id="io_input_table"></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">3D PROBE DEFAULTS</div>
                        <div class="settings-hint">What the touch-probe wizards (corner, edge, middle, circular, alignment, rotary) start from each time. <b>Stylus radius</b> drives radius compensation; pin &amp; level come from the 3D-probe input row above.</div>
                        <div class="settings-grid">
                            <label>Stylus radius (mm)<input type="number" id="set_pd_radius" min="0" step="0.1"></label>
                            <label>Fast feed<input type="number" id="set_pd_ffast" min="0" step="1"></label>
                            <label>Slow feed<input type="number" id="set_pd_fslow" min="0" step="1"></label>
                            <label>Retract (mm)<input type="number" id="set_pd_retract" min="0" step="0.1"></label>
                            <label>Safe Z (mm)<input type="number" id="set_pd_safez" step="1"></label>
                            <label>Max search (mm)<input type="number" id="set_pd_maxdist" min="0" step="1"></label>
                            <label>Q-stop<input type="number" id="set_pd_qstop" min="0" max="2" step="1"></label>
                        </div>
                    </div>
                </div>

                <!-- HARDWARE: OUTPUT -->
                <div id="set_tab_output" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">OUTPUTS</div>
                        <div class="settings-hint">Coolant, drawbar, dust cover, etc. Pins 1\u201320. The ATC tab adds its drawbar / dust-cover / carousel-rotate here.</div>
                        <div id="io_output_table"></div>
                    </div>
                </div>

                <!-- TOOL TABLE TAB (always present; "+ Add tool changer (ATC)" lives here) -->
                <div id="set_tab_atc" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">TOOL LIBRARY&nbsp;&nbsp;(length offset \u2192 #[base + tool \u2212 1])</div>
                        <div class="settings-grid">
                            <label>Base variable<input type="number" id="set_atc_basevar" step="1"></label>
                        </div>
                        <div id="set_atc_libsummary" style="margin-top:8px;"></div>
                        <div class="settings-row" style="margin-top:8px;">
                            <button class="toolbar-btn settings-io" id="set_atc_library">\u{1F6E0} Tool library\u2026</button>
                            <button class="toolbar-btn settings-io" id="set_atc_insert">\u2B07 Insert tool table</button>
                        </div>
                        <div class="settings-hint">"Tool library" lists the tools you own (\xD8, flutes, feeds/speeds) \u2014 the Mill wizards and the ATC magazine pick from it. "Insert tool table" drops the #var = length offsets (tools that have a length) into the editor to push them to the controller.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">TOOL LENGTH PROBE (defaults for the Tool Length wizard)</div>
                        <div class="settings-grid">
                            <label>Block height (mm)<input type="number" id="set_atc_blockheight" step="0.1"></label>
                            <label>Safe Z (mm)<input type="number" id="set_atc_safez" step="0.1"></label>
                            <label>Max search (mm)<input type="number" id="set_atc_maxdist" step="1"></label>
                            <label>Retract (mm)<input type="number" id="set_atc_retract" step="0.1"></label>
                            <label>Fast feed<input type="number" id="set_atc_ffast" step="1"></label>
                            <label>Slow feed<input type="number" id="set_atc_fslow" step="1"></label>
                            <label>Q-stop<input type="number" id="set_atc_qstop" step="1"></label>
                        </div>
                        <div class="settings-hint">Tool-setter pin &amp; location live in the Input tab. The Tool Length wizard probes against the setter and writes the result to the tool table above.</div>
                    </div>
                    <div class="settings-section" id="set_atc_add" style="display:none">
                        <div class="settings-section-title">TOOL CHANGER (ATC)</div>
                        <div class="settings-hint">Add an automatic tool changer to set up the magazine and generate the T.nc tool-change macro. This adds the drawbar (and, for a disk magazine, carousel-rotate / index) I/O to Output/Input.</div>
                        <button class="toolbar-btn settings-io" id="set_atc_add_btn">\u2795 Add tool changer (ATC)</button>
                    </div>
                    <div id="set_atc_magazine_wrap" style="display:none">
                        <div class="settings-section">
                            <div class="settings-section-title">TOOL MAGAZINE</div>
                            <div class="settings-hint">Straight = each pocket has a park XYZ; disk = one pickup + rotate-to-pocket (auto-adds rotate / index I/O). The drawbar lives in Output.</div>
                            <div id="atc_magazine"></div>
                            <div class="settings-row" style="margin-top:12px;">
                                <button class="toolbar-btn settings-io" id="atc_gen_tnc">\u2699 Generate T.nc</button>
                                <button class="toolbar-btn settings-io" id="atc_dl_tnc" style="display:none">\u2B07 Download T.nc</button>
                            </div>
                            <div class="settings-hint">Builds the tool-change macro from the table above. Save it as <b>T.nc</b> on the controller \u2014 review &amp; dry-run first (generated template).</div>
                            <textarea id="atc_tnc_out" readonly spellcheck="false" style="display:none; width:100%; height:240px; margin-top:8px; font:12px/1.45 monospace; background:#1a1a1a; color:#d8d8d8; border:1px solid #888; border-radius:4px; padding:8px; box-sizing:border-box;"></textarea>
                        </div>
                    </div>
                </div>

                        </div><!-- end settings-content -->
            `;
  wireSettingsOverlay(parent);
}
async function renderMachineNet(mount) {
  if (!mount) return;
  mount.textContent = "Checking gateway\u2026";
  let d = null;
  try {
    d = await (await fetch("/api/descriptor")).json();
  } catch (e) {
    d = null;
  }
  if (!d) {
    mount.innerHTML = `<div class="settings-hint">Run the <b>desktop app</b> (the gateway) to connect a controller \u2014 the hosted page can't reach a machine on your LAN.</div>`;
    return;
  }
  const connected = !!d.controller_connected;
  const fam = d.controller_family && d.controller_family !== "unknown" ? d.controller_family : "";
  const dest = d.dest || "";
  const wrap = document.createElement("div");
  wrap.innerHTML = '<div class="cloud-status' + (connected ? "" : " muted") + '">' + (connected ? "Connected" + (fam ? " \xB7 " + fam : "") + (dest ? " \xB7 " + dest : "") : "Not connected" + (dest ? " \xB7 " + dest : " \u2014 no controller share set")) + '</div><label style="display:block;margin-top:8px">Controller share (SMB)<input id="mn_dest" type="text" placeholder="\\\\10.0.0.50\\cncdisk" value="' + dest.replace(/"/g, "&quot;") + '"></label><div style="display:flex;gap:8px;margin-top:8px;align-items:center"><button class="op-btn" data-mn="save">Save &amp; connect</button><button class="op-btn" data-mn="scan">\u{1F50D} Scan LAN</button><span class="mn-msg" style="flex:1"></span></div><div class="mn-results" style="margin-top:6px"></div>';
  mount.replaceChildren(wrap);
  const msg = wrap.querySelector(".mn-msg");
  const results = wrap.querySelector(".mn-results");
  async function save(val) {
    const v = (val != null ? val : wrap.querySelector("#mn_dest").value).trim();
    if (!v) {
      msg.textContent = "Enter a share path.";
      return;
    }
    msg.textContent = "Saving\u2026";
    try {
      const r = await (await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dest: v }) })).json();
      if (r && r.ok === false) {
        msg.textContent = r.error || "Save failed.";
        return;
      }
    } catch (e) {
      msg.textContent = "Save failed (gateway unreachable).";
      return;
    }
    renderMachineNet(mount);
  }
  async function scan() {
    msg.textContent = "Scanning the LAN\u2026";
    results.textContent = "";
    let list2 = [];
    try {
      list2 = (await (await fetch("/api/scan")).json()).controllers || [];
    } catch (e) {
      msg.textContent = "Scan failed.";
      return;
    }
    msg.textContent = list2.length ? list2.length + " found \u2014 pick one" : "No controllers found on the LAN.";
    results.replaceChildren(...list2.map((c2) => {
      const b2 = document.createElement("button");
      b2.className = "op-btn";
      b2.style.cssText = "display:block;width:100%;text-align:left;margin-top:4px";
      b2.textContent = (c2.family || "controller") + " \xB7 " + c2.ip + "  (" + c2.dest + ")";
      b2.addEventListener("click", () => save(c2.dest));
      return b2;
    }));
  }
  wrap.addEventListener("click", (e) => {
    const t = e.target.closest("[data-mn]");
    if (!t) return;
    if (t.dataset.mn === "save") save();
    else scan();
  });
}
async function renderLanAccess(mount) {
  if (!mount) return;
  mount.textContent = "Checking\u2026";
  let c2 = null;
  try {
    c2 = await (await fetch("/api/config")).json();
  } catch (e) {
    c2 = null;
  }
  if (!c2) {
    mount.innerHTML = '<div class="settings-hint">Available in the desktop app (the gateway).</div>';
    return;
  }
  const port = location.port || c2.port || 8765;
  const lanOn = c2.host === "0.0.0.0";
  const lanIp = c2.lan_ip || "";
  const lanUrl = lanOn && lanIp ? "http://" + lanIp + ":" + port + "/" : "";
  const wrap = document.createElement("div");
  wrap.innerHTML = '<label class="settings-check"><input type="checkbox" id="lan_toggle"' + (lanOn ? " checked" : "") + '> Allow other devices on my network (LAN)</label><div class="cloud-status" style="margin-top:6px">This PC: <code>http://localhost:' + port + "</code></div>" + (lanUrl ? '<div class="cloud-status" style="margin-top:4px">Other devices: <code>' + lanUrl + `</code></div><img src="/api/lan-qr" alt="Scan to open on your phone" width="148" height="148" style="margin-top:8px;background:#fff;border-radius:6px;padding:6px" onerror="this.style.display='none'">` : '<div class="cloud-status muted" style="margin-top:4px">Turn on LAN access to get a shareable URL + QR code.</div>') + '<div class="lan-msg settings-hint" style="margin-top:6px"></div>';
  mount.replaceChildren(wrap);
  const msg = wrap.querySelector(".lan-msg");
  wrap.querySelector("#lan_toggle").addEventListener("change", async (e) => {
    msg.textContent = "Saving\u2026";
    try {
      await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host: e.target.checked ? "0.0.0.0" : "127.0.0.1" }) });
    } catch (err) {
      msg.textContent = "Save failed.";
      return;
    }
    msg.textContent = "Saved \u2014 restart the app to apply the LAN binding.";
    setTimeout(() => renderLanAccess(mount), 600);
  });
}
function wireSettingsOverlay(ov) {
  const q = (id) => ov.querySelector("#" + id);
  const num2 = (v, d) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d;
  };
  renderCloudLogin(q("set_cloud_mount"));
  renderMachineNet(q("set_machinenet_mount"));
  renderLanAccess(q("set_lan_mount"));
  function updateVarCount() {
    const db = window.ddcsStudio && window.ddcsStudio.variableDB;
    const el2 = q("set_var_count");
    if (el2 && db) el2.textContent = `${db.getAll().length} variables loaded`;
  }
  function fill() {
    const s = _ddcsSettings;
    if (!s.hardwareTabs) s.hardwareTabs = { probes: true, atc: false, limits: true };
    q("set_show_probes").checked = s.hardwareTabs.probes !== false;
    q("set_show_atc").checked = s.hardwareTabs.atc === true;
    q("set_show_limits").checked = s.hardwareTabs.limits !== false;
    const pv = s.preview || (s.preview = { ...SETTINGS_DEFAULTS.preview });
    if (q("set_pv_view")) q("set_pv_view").value = pv.defaultView || "3d";
    if (q("set_pv_speed")) q("set_pv_speed").value = String(pv.defaultSpeed || 1);
    if (q("set_pv_rapids")) q("set_pv_rapids").checked = pv.showRapids !== false;
    if (q("set_pv_follow_default")) q("set_pv_follow_default").checked = pv.followDefault !== false;
    if (q("set_pv_autoloop")) q("set_pv_autoloop").checked = pv.autoLoop !== false;
    const cp = s.compose || (s.compose = { ...SETTINGS_DEFAULTS.compose });
    if (q("set_cp_suggestions")) q("set_cp_suggestions").checked = cp.suggestions !== false;
    if (q("set_cp_autocomplete")) q("set_cp_autocomplete").checked = cp.autocomplete !== false;
    if (q("set_cp_ghost")) q("set_cp_ghost").checked = cp.ghost !== false;
    if (q("set_pv_followdamp")) {
      const d = Number.isFinite(pv.followDamp) ? pv.followDamp : 50;
      q("set_pv_followdamp").value = String(d);
      const lbl = q("set_pv_followdamp_val");
      if (lbl) lbl.textContent = d + "%";
    }
    const ad = SETTINGS_DEFAULTS.atc, a = s.atc || (s.atc = {});
    q("set_atc_blockheight").value = a.blockHeight ?? ad.blockHeight;
    q("set_atc_safez").value = a.safeZ ?? ad.safeZ;
    q("set_atc_maxdist").value = a.maxDist ?? ad.maxDist;
    q("set_atc_retract").value = a.retract ?? ad.retract;
    q("set_atc_ffast").value = a.fFast ?? ad.fFast;
    q("set_atc_fslow").value = a.fSlow ?? ad.fSlow;
    q("set_atc_qstop").value = a.qStop ?? ad.qStop;
    q("set_atc_basevar").value = a.baseVar ?? ad.baseVar;
    renderLibSummary();
    q("set_mach_x").value = s.machine.x;
    q("set_mach_y").value = s.machine.y;
    q("set_mach_z").value = s.machine.z;
    q("set_mach_ox").value = s.machine.ox;
    q("set_mach_oy").value = s.machine.oy;
    q("set_mach_oz").value = s.machine.oz;
    {
      const w = s.machine.workOrigin || { x: 0, y: 0, z: 0 };
      q("set_mach_wx").value = w.x;
      q("set_mach_wy").value = w.y;
      q("set_mach_wz").value = w.z;
    }
    q("set_mach_show").checked = !!s.machine.show;
    if (q("set_axis_a_role")) {
      const mo = s.motors || {};
      q("set_axis_a_role").value = mo.a && mo.a.role || "unused";
      q("set_axis_a_around").value = mo.a && mo.a.around || "x";
      q("set_axis_b_role").value = mo.b && mo.b.role || "unused";
      q("set_axis_b_around").value = mo.b && mo.b.around || "y";
    }
    q("set_probe_pin").value = s.probes.probePin;
    q("set_probe_level").value = s.probes.probeLevel;
    q("set_setter_pin").value = s.probes.setterPin;
    q("set_setter_level").value = s.probes.setterLevel;
    q("set_setter_x").value = s.probes.setterX;
    q("set_setter_y").value = s.probes.setterY;
    q("set_setter_z").value = s.probes.setterZ;
    q("set_setter_w").value = s.probes.setterW;
    q("set_setter_h").value = s.probes.setterH;
    const prd = SETTINGS_DEFAULTS.probes;
    if (q("set_pd_radius")) {
      q("set_pd_radius").value = s.probes.radius ?? prd.radius;
      q("set_pd_ffast").value = s.probes.fastFeed ?? prd.fastFeed;
      q("set_pd_fslow").value = s.probes.slowFeed ?? prd.slowFeed;
      q("set_pd_retract").value = s.probes.retract ?? prd.retract;
      q("set_pd_safez").value = s.probes.safeZ ?? prd.safeZ;
      q("set_pd_maxdist").value = s.probes.maxDist ?? prd.maxDist;
      q("set_pd_qstop").value = s.probes.qStop ?? prd.qStop;
    }
    q("set_x_min_pin").value = s.limits.xMinPin;
    q("set_x_min_level").value = s.limits.xMinLevel;
    q("set_x_max_pin").value = s.limits.xMaxPin;
    q("set_x_max_level").value = s.limits.xMaxLevel;
    q("set_y_min_pin").value = s.limits.yMinPin;
    q("set_y_min_level").value = s.limits.yMinLevel;
    q("set_y_max_pin").value = s.limits.yMaxPin;
    q("set_y_max_level").value = s.limits.yMaxLevel;
    q("set_z_min_pin").value = s.limits.zMinPin;
    q("set_z_min_level").value = s.limits.zMinLevel;
    q("set_z_max_pin").value = s.limits.zMaxPin;
    q("set_z_max_level").value = s.limits.zMaxLevel;
    const sp = s.spindle || (s.spindle = {}), spd = SETTINGS_DEFAULTS.spindle;
    if (q("set_spin_maxrpm")) {
      q("set_spin_maxrpm").value = sp.maxRpm ?? spd.maxRpm;
      q("set_spin_defrpm").value = sp.defaultRpm ?? spd.defaultRpm;
      q("set_spin_dir").value = sp.dir || spd.dir;
      q("set_spin_up").value = sp.spinUp ?? spd.spinUp;
      q("set_spin_down").value = sp.spinDown ?? spd.spinDown;
    }
    if (q("set_head_type")) {
      q("set_head_type").value = s.head && s.head.type || "spindle";
      applyHeadType();
    }
    const ep = s.endProgram || (s.endProgram = {}), epd = SETTINGS_DEFAULTS.endProgram;
    if (q("set_end_end")) {
      q("set_end_spindleoff").checked = ep.spindleOff !== false;
      q("set_end_coolantoff").checked = ep.coolantOff !== false;
      q("set_end_retract").checked = ep.retract !== false;
      q("set_end_retractz").value = ep.retractZ ?? epd.retractZ;
      q("set_end_park").checked = ep.park === true;
      q("set_end_parkx").value = ep.parkX ?? epd.parkX;
      q("set_end_parky").value = ep.parkY ?? epd.parkY;
      q("set_end_end").value = ep.end || epd.end;
    }
    updateVarCount();
  }
  fill();
  _fillSettingsInputs = fill;
  function applyHardwareTabs() {
    const ht = _ddcsSettings.hardwareTabs || {};
    const show = (id, on) => {
      const e = ov.querySelector("#" + id);
      if (e) e.style.display = on ? "" : "none";
    };
    show("set_spin_config", ht.spindle === true);
    show("set_spin_add", ht.spindle !== true);
    show("set_atc_magazine_wrap", ht.atc === true);
    show("set_atc_add", ht.atc !== true);
  }
  function applyHeadType() {
    const t = _ddcsSettings.head && _ddcsSettings.head.type || "spindle";
    const show = (id, on) => {
      const e = ov.querySelector("#" + id);
      if (e) e.style.display = on ? "" : "none";
    };
    show("set_head_spindle", t === "spindle");
    show("set_head_plasma", t === "plasma");
    show("set_head_laser", t === "laser");
  }
  const postSel = q("set_post");
  function fillPostOptions() {
    if (!postSel) return;
    const machinePost = getDialect(getActiveProfile().id);
    postSel.innerHTML = ['<option value="auto">Follow machine profile (' + machinePost.name + ")</option>"].concat(listPosts().map((p) => '<option value="' + p.id + '">' + p.name + (p.verified ? "  \u2713" : "  \u26A0 unverified") + "</option>")).join("");
    postSel.value = getActivePostId();
    updatePostHint();
  }
  function updatePostHint() {
    const hint = q("set_post_hint");
    if (!hint) return;
    const id = getActivePostId();
    if (id === "auto") {
      hint.textContent = "Following the machine profile (" + getDialect(getActiveProfile().id).name + "). Override to generate for another controller.";
      hint.style.color = "";
    } else if (!isPostVerified(id)) {
      hint.textContent = "\u26A0 Unverified post \u2014 dump-derived, simulator/reference only. Not validated on hardware.";
      hint.style.color = "#e0a020";
    } else {
      hint.textContent = "Generating for " + getDialect(id).name + " (verified).";
      hint.style.color = "";
    }
  }
  if (postSel) {
    fillPostOptions();
    postSel.addEventListener("change", () => {
      setActivePostId(postSel.value);
      updatePostHint();
      if (window.ddcsRefreshBlocks) window.ddcsRefreshBlocks();
    });
  }
  const profileSel = q("set_profile");
  function fillProfileOptions() {
    if (!profileSel) return;
    profileSel.innerHTML = Object.values(CONTROLLER_PROFILES).map((p) => '<option value="' + p.id + '">' + p.name + (p.source === "controller" ? " (from controller)" : "") + "</option>").join("");
    profileSel.value = getActiveProfile().id;
  }
  if (profileSel) {
    fillProfileOptions();
    profileSel.addEventListener("change", () => {
      const p = setActiveProfile(profileSel.value);
      const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;
      if (p && p.varFamily && vdb) vdb.setControllerVars(p.varFamily);
      _ddcsSettings.hardwareTabs = {
        probes: p.hardwareTabs.includes("probes"),
        atc: p.hardwareTabs.includes("atc"),
        limits: p.hardwareTabs.includes("limits")
      };
      saveSettings();
      fill();
      applyHardwareTabs();
      fillPostOptions();
    });
    makeClient().profile().then((p) => {
      if (p && p.id && Array.isArray(p.hardwareTabs)) {
        registerProfile(p);
        fillProfileOptions();
      }
    }).catch(() => {
    });
    const pullBtn = q("set_profile_pull");
    if (pullBtn) pullBtn.addEventListener("click", async () => {
      const orig = pullBtn.textContent;
      pullBtn.disabled = true;
      pullBtn.textContent = "Pulling\u2026";
      try {
        let p;
        try {
          p = await makeClient().profile();
        } catch (e) {
          alert("Not bridged to a controller \u2014 run the desktop app (or the gateway) to pull a live profile. Offline controllers like the DDCS 3.1: use Import profile with the exported settings.");
          return;
        }
        if (!p || !p.id) {
          alert("The gateway returned no profile.");
          return;
        }
        if (!confirm('Pull "' + p.name + '" from the controller? This replaces the current hardware tabs and Input/Output list with the controller values.')) return;
        registerProfile(p);
        setActiveProfile(p.id);
        applyControllerProfile(p);
        fillProfileOptions();
        const it = ov.querySelector("#io_input_table");
        if (it) renderIoTable(it, "input", getInputs(), syncIO);
        const ot = ov.querySelector("#io_output_table");
        if (ot) renderIoTable(ot, "output", getOutputs(), syncIO);
        alert('Pulled "' + p.name + '": ' + getInputs().length + " inputs configured.");
      } catch (e) {
        alert("Pull failed: " + (e && e.message ? e.message : e));
      } finally {
        pullBtn.disabled = false;
        pullBtn.textContent = orig;
      }
    });
  }
  function applyControllerProfile(p) {
    if (!p) return;
    if (Array.isArray(p.hardwareTabs)) {
      _ddcsSettings.hardwareTabs = {
        probes: p.hardwareTabs.includes("probes"),
        atc: p.hardwareTabs.includes("atc"),
        limits: p.hardwareTabs.includes("limits")
      };
    }
    const pn = p.pins;
    if (pn) {
      const ins = [];
      if (pn.probe !== "" && pn.probe != null) ins.push({ id: "probe", type: "probe", label: "3D Probe", pin: pn.probe, level: pn.probeLevel || 0 });
      if (pn.setter !== "" && pn.setter != null) ins.push({ id: "setter", type: "setter", label: "Tool Setter", pin: pn.setter, level: pn.setterLevel || 0, x: 10, y: 10, z: -50, w: 20, h: 20 });
      const lim = pn.limits || {};
      const LMAP = [["xMin", "x_min", "Limit X\u2212"], ["xMax", "x_max", "Limit X+"], ["yMin", "y_min", "Limit Y\u2212"], ["yMax", "y_max", "Limit Y+"], ["zMin", "z_min", "Limit Z\u2212"], ["zMax", "z_max", "Limit Z+"]];
      for (const [k, axis, label] of LMAP) {
        if (lim[k] !== "" && lim[k] != null) ins.push({ id: "limit_" + axis, type: "limit", axis, label, pin: lim[k], level: lim[k + "Level"] || 0 });
      }
      _ddcsSettings.inputs = ins;
      syncFlatFromIO(_ddcsSettings);
    }
    const m = _ddcsSettings.machine || (_ddcsSettings.machine = {});
    if (p.geometry && p.geometry.travel) {
      const t = p.geometry.travel;
      if (t.x != null && t.x > 0) m.x = t.x;
      if (t.y != null && t.y > 0) m.y = t.y;
      if (t.z != null && t.z > 0) m.z = t.z;
    }
    if (p.wcs && p.wcs.workOrigin) {
      const wo = p.wcs.workOrigin;
      m.workOrigin = { x: +wo.x || 0, y: +wo.y || 0, z: +wo.z || 0 };
    }
    saveSettings();
    fill();
    applyHardwareTabs();
  }
  applyHardwareTabs();
  function renderLibSummary() {
    const cont = q("set_atc_libsummary");
    if (!cont) return;
    const tools = libraryTools(_ddcsSettings.atc || {});
    if (!tools.length) {
      cont.innerHTML = '<span class="settings-hint">No tools yet \u2014 open the library to add them.</span>';
      return;
    }
    const chips = tools.map((t) => "T" + t.num + (t.name ? " " + t.name : t.dia !== "" ? " \xD8" + t.dia : "")).join("  \xB7  ");
    cont.innerHTML = '<span class="settings-hint">' + tools.length + " tool" + (tools.length > 1 ? "s" : "") + ":  " + chips + "</span>";
  }
  const _atcInsert = q("set_atc_insert");
  if (_atcInsert) {
    _atcInsert.addEventListener("click", () => {
      const a = _ddcsSettings.atc || {};
      const base = parseInt(a.baseVar, 10) || 1430;
      const lines = [];
      libraryTools(a).forEach((t) => {
        const v = t.length, n = parseInt(t.num, 10);
        if (v === "" || v == null || !Number.isFinite(Number(v)) || !Number.isFinite(n)) return;
        lines.push("#" + (base + n - 1) + "=" + Number(v) + " ( T" + n + (t.name ? " " + t.name : "") + " length )");
      });
      if (!lines.length) {
        alert("No tool lengths set in the library.");
        return;
      }
      const code = "( Tool table )\n" + lines.join("\n") + "\n";
      const em = window.ddcsStudio && window.ddcsStudio.editorManager || window.editorManager;
      if (em && typeof em.insert === "function") em.insert(code);
    });
  }
  function nextToolNum(tools) {
    let mx = 0;
    (tools || []).forEach((t) => {
      const n = parseInt(t && t.num, 10);
      if (Number.isFinite(n) && n > mx) mx = n;
    });
    return mx + 1;
  }
  function lenVarLabel(num3, base) {
    const n = parseInt(num3, 10);
    return Number.isFinite(n) ? "#" + (base + n - 1) : "#\u2014";
  }
  function renderToolLibRows() {
    const body = document.getElementById("toollib-rows");
    if (!body) return;
    const a = _ddcsSettings.atc || {};
    const base = parseInt(a.baseVar, 10) || 1430;
    const tools = a.tools || (a.tools = []);
    const opt = (cur) => '<option value="">\u2014</option>' + TOOL_TYPES.map((ty) => '<option value="' + ty + '"' + (ty === cur ? " selected" : "") + ">" + ty + "</option>").join("");
    const cell = (i, f, val, step) => '<td><input type="number" step="' + (step || "any") + '" data-tool="' + i + '" data-field="' + f + '" value="' + (val === "" || val == null ? "" : val) + '"></td>';
    if (!tools.length) {
      body.innerHTML = '<tr><td colspan="10" class="tl-empty">No tools yet \u2014 \u201C\uFF0B Add tool\u201D to start your library.</td></tr>';
      return;
    }
    let html = "";
    tools.forEach((raw, i) => {
      const t = normalizeTool(raw, i + 1);
      html += '<tr><td class="tl-numcell"><input type="number" step="1" min="1" max="99" data-tool="' + i + '" data-field="num" value="' + (t.num === "" || t.num == null ? "" : t.num) + '"><span class="tl-var" data-var="' + i + '">' + lenVarLabel(t.num, base) + '</span></td><td><input type="text" data-tool="' + i + '" data-field="name" value="' + String(t.name).replace(/"/g, "&quot;") + '" placeholder="e.g. 6mm flat 2F"></td><td><select data-tool="' + i + '" data-field="type">' + opt(t.type) + "</select></td>" + cell(i, "dia", t.dia) + cell(i, "flutes", t.flutes, "1") + cell(i, "length", t.length, "0.001") + cell(i, "rpm", t.rpm, "1") + cell(i, "feed", t.feed, "1") + cell(i, "plunge", t.plunge, "1") + '<td><button class="tl-del" data-del="' + i + '" title="Remove tool">\u2715</button></td></tr>';
    });
    body.innerHTML = html;
  }
  function buildToolLibModal() {
    if (document.getElementById("toollib-modal")) return;
    const m = document.createElement("div");
    m.id = "toollib-modal";
    m.innerHTML = `
            <style>
                #toollib-modal { position: fixed; inset: 0; z-index: 1000; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.5); }
                #toollib-modal.active { display: flex; }
                #toollib-modal .tl-panel { background: var(--panel); color: var(--text-main); border: 1px solid var(--border); border-radius: var(--radius, 6px); width: min(980px, 95vw); max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
                #toollib-modal .tl-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700; letter-spacing: .5px; }
                #toollib-modal .tl-head button { background: transparent; border: none; color: var(--text-dim); font-size: 18px; cursor: pointer; }
                #toollib-modal .tl-body { overflow: auto; padding: 8px 16px 16px; }
                #toollib-modal table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
                #toollib-modal th { position: sticky; top: 0; background: var(--panel); text-align: left; font-size: 10.5px; letter-spacing: .5px; text-transform: uppercase; color: var(--text-dim); padding: 6px 6px; border-bottom: 1px solid var(--border); }
                #toollib-modal td { padding: 3px 4px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                #toollib-modal .tl-numcell { white-space: nowrap; }
                #toollib-modal .tl-numcell input { width: 46px; }
                #toollib-modal .tl-var { display: inline-block; margin-left: 6px; font-size: 10px; color: var(--text-dim); }
                #toollib-modal .tl-empty { padding: 16px; text-align: center; color: var(--text-dim); }
                #toollib-modal input, #toollib-modal select { width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text-main); border: 1px solid var(--border); border-radius: 3px; padding: 4px 6px; font: inherit; }
                #toollib-modal td:nth-child(4) input, #toollib-modal td:nth-child(5) input, #toollib-modal td:nth-child(6) input,
                #toollib-modal td:nth-child(7) input, #toollib-modal td:nth-child(8) input, #toollib-modal td:nth-child(9) input { width: 70px; }
                #toollib-modal .tl-del { width: auto; background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 14px; padding: 2px 6px; }
                #toollib-modal .tl-del:hover { color: #d66; }
                #toollib-modal .tl-foot { padding: 10px 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
                #toollib-modal .tl-hint { font-size: 11px; color: var(--text-dim); }
            </style>
            <div class="tl-panel">
                <div class="tl-head"><span>\u{1F6E0} Tool library</span><button id="toollib-close" title="Close">\u2715</button></div>
                <div class="tl-body">
                    <table>
                        <thead><tr>
                            <th>Tool #</th><th>Name</th><th>Type</th><th>\xD8 mm</th><th>Flutes</th><th>Length</th><th>RPM</th><th>Feed</th><th>Plunge</th><th></th>
                        </tr></thead>
                        <tbody id="toollib-rows"></tbody>
                    </table>
                </div>
                <div class="tl-foot">
                    <button class="toolbar-btn settings-io" id="toollib-add">\uFF0B Add tool</button>
                    <span class="tl-hint">Tool # \u2192 length offset #[base + #\u22121]. Feeds in mm/min. The Mill wizards' Tool \u25BE and the ATC magazine read this list.</span>
                    <button class="toolbar-btn settings-io" id="toollib-done">Done</button>
                </div>
            </div>`;
    document.body.appendChild(m);
    const close = () => m.classList.remove("active");
    m.querySelector("#toollib-close").addEventListener("click", close);
    m.querySelector("#toollib-done").addEventListener("click", close);
    m.addEventListener("mousedown", (e) => {
      if (e.target === m) close();
    });
    m.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.tool == null || !t.dataset.field) return;
      const i = parseInt(t.dataset.tool, 10), f = t.dataset.field;
      const a = _ddcsSettings.atc;
      a.tools = a.tools || [];
      const rec = normalizeTool(a.tools[i], i + 1);
      let val = t.value;
      if (f !== "name" && f !== "type") val = val === "" ? "" : parseFloat(val);
      rec[f] = val;
      a.tools[i] = rec;
      saveSettings();
      if (f === "num") {
        const span = m.querySelector('.tl-var[data-var="' + i + '"]');
        if (span) span.textContent = lenVarLabel(rec.num, parseInt(a.baseVar, 10) || 1430);
      }
      renderLibSummary();
    });
    m.addEventListener("click", (e) => {
      if (e.target.id === "toollib-add") {
        const a = _ddcsSettings.atc;
        a.tools = a.tools || [];
        a.tools.push(normalizeTool({}, nextToolNum(a.tools)));
        saveSettings();
        renderToolLibRows();
        renderLibSummary();
        return;
      }
      const del2 = e.target.dataset ? e.target.dataset.del : null;
      if (del2 != null) {
        const a = _ddcsSettings.atc;
        a.tools = a.tools || [];
        a.tools.splice(parseInt(del2, 10), 1);
        saveSettings();
        renderToolLibRows();
        renderLibSummary();
      }
    });
  }
  const _atcLibrary = q("set_atc_library");
  if (_atcLibrary) {
    _atcLibrary.addEventListener("click", () => {
      buildToolLibModal();
      renderToolLibRows();
      document.getElementById("toollib-modal").classList.add("active");
    });
  }
  const closeOv = () => {
    saveSettings();
    ov.classList.remove("active");
    setTimeout(() => {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }, 300);
  };
  const onInput = () => {
    const s = _ddcsSettings;
    if (!s.hardwareTabs) s.hardwareTabs = {};
    s.hardwareTabs.probes = q("set_show_probes").checked;
    s.hardwareTabs.atc = q("set_show_atc").checked;
    s.hardwareTabs.limits = q("set_show_limits").checked;
    applyHardwareTabs();
    const pv = s.preview || (s.preview = { ...SETTINGS_DEFAULTS.preview });
    if (q("set_pv_view")) pv.defaultView = q("set_pv_view").value;
    if (q("set_pv_speed")) pv.defaultSpeed = num2(q("set_pv_speed").value, 1);
    if (q("set_pv_rapids")) pv.showRapids = q("set_pv_rapids").checked;
    if (q("set_pv_follow_default")) pv.followDefault = q("set_pv_follow_default").checked;
    if (q("set_pv_autoloop")) pv.autoLoop = q("set_pv_autoloop").checked;
    const cp = s.compose || (s.compose = { ...SETTINGS_DEFAULTS.compose });
    if (q("set_cp_suggestions")) cp.suggestions = q("set_cp_suggestions").checked;
    if (q("set_cp_autocomplete")) cp.autocomplete = q("set_cp_autocomplete").checked;
    if (q("set_cp_ghost")) cp.ghost = q("set_cp_ghost").checked;
    if (q("set_pv_followdamp")) {
      pv.followDamp = num2(q("set_pv_followdamp").value, 50);
      const lbl = q("set_pv_followdamp_val");
      if (lbl) lbl.textContent = pv.followDamp + "%";
    }
    const a = s.atc || (s.atc = {});
    a.blockHeight = num2(q("set_atc_blockheight").value, a.blockHeight);
    a.safeZ = num2(q("set_atc_safez").value, a.safeZ);
    a.maxDist = num2(q("set_atc_maxdist").value, a.maxDist);
    a.retract = num2(q("set_atc_retract").value, a.retract);
    a.fFast = num2(q("set_atc_ffast").value, a.fFast);
    a.fSlow = num2(q("set_atc_fslow").value, a.fSlow);
    a.qStop = num2(q("set_atc_qstop").value, a.qStop);
    const _nb = num2(q("set_atc_basevar").value, a.baseVar);
    if (_nb !== a.baseVar) {
      a.baseVar = _nb;
      renderLibSummary();
    }
    s.machine.x = num2(q("set_mach_x").value, s.machine.x);
    s.machine.y = num2(q("set_mach_y").value, s.machine.y);
    s.machine.z = num2(q("set_mach_z").value, s.machine.z);
    s.machine.ox = num2(q("set_mach_ox").value, s.machine.ox);
    s.machine.oy = num2(q("set_mach_oy").value, s.machine.oy);
    s.machine.oz = num2(q("set_mach_oz").value, s.machine.oz);
    {
      const w = s.machine.workOrigin || (s.machine.workOrigin = { x: 0, y: 0, z: 0 });
      w.x = num2(q("set_mach_wx").value, w.x);
      w.y = num2(q("set_mach_wy").value, w.y);
      w.z = num2(q("set_mach_wz").value, w.z);
    }
    s.machine.show = q("set_mach_show").checked;
    s.probes.probePin = num2(q("set_probe_pin").value, s.probes.probePin);
    s.probes.probeLevel = num2(q("set_probe_level").value, s.probes.probeLevel);
    s.probes.setterPin = num2(q("set_setter_pin").value, s.probes.setterPin);
    s.probes.setterLevel = num2(q("set_setter_level").value, s.probes.setterLevel);
    s.probes.setterX = num2(q("set_setter_x").value, s.probes.setterX);
    s.probes.setterY = num2(q("set_setter_y").value, s.probes.setterY);
    s.probes.setterZ = num2(q("set_setter_z").value, s.probes.setterZ);
    s.probes.setterW = num2(q("set_setter_w").value, s.probes.setterW);
    s.probes.setterH = num2(q("set_setter_h").value, s.probes.setterH);
    if (q("set_pd_radius")) {
      s.probes.radius = num2(q("set_pd_radius").value, s.probes.radius);
      s.probes.fastFeed = num2(q("set_pd_ffast").value, s.probes.fastFeed);
      s.probes.slowFeed = num2(q("set_pd_fslow").value, s.probes.slowFeed);
      s.probes.retract = num2(q("set_pd_retract").value, s.probes.retract);
      s.probes.safeZ = num2(q("set_pd_safez").value, s.probes.safeZ);
      s.probes.maxDist = num2(q("set_pd_maxdist").value, s.probes.maxDist);
      s.probes.qStop = num2(q("set_pd_qstop").value, s.probes.qStop);
    }
    s.limits.xMinPin = q("set_x_min_pin").value ? num2(q("set_x_min_pin").value, null) : null;
    s.limits.xMinLevel = num2(q("set_x_min_level").value, s.limits.xMinLevel);
    s.limits.xMaxPin = q("set_x_max_pin").value ? num2(q("set_x_max_pin").value, null) : null;
    s.limits.xMaxLevel = num2(q("set_x_max_level").value, s.limits.xMaxLevel);
    s.limits.yMinPin = q("set_y_min_pin").value ? num2(q("set_y_min_pin").value, null) : null;
    s.limits.yMinLevel = num2(q("set_y_min_level").value, s.limits.yMinLevel);
    s.limits.yMaxPin = q("set_y_max_pin").value ? num2(q("set_y_max_pin").value, null) : null;
    s.limits.yMaxLevel = num2(q("set_y_max_level").value, s.limits.yMaxLevel);
    s.limits.zMinPin = q("set_z_min_pin").value ? num2(q("set_z_min_pin").value, null) : null;
    s.limits.zMinLevel = num2(q("set_z_min_level").value, s.limits.zMinLevel);
    s.limits.zMaxPin = q("set_z_max_pin").value ? num2(q("set_z_max_pin").value, null) : null;
    s.limits.zMaxLevel = num2(q("set_z_max_level").value, s.limits.zMaxLevel);
    const sp = s.spindle || (s.spindle = {});
    if (q("set_spin_maxrpm")) {
      sp.maxRpm = num2(q("set_spin_maxrpm").value, sp.maxRpm);
      sp.defaultRpm = num2(q("set_spin_defrpm").value, sp.defaultRpm);
      sp.dir = q("set_spin_dir").value || sp.dir;
      sp.spinUp = num2(q("set_spin_up").value, sp.spinUp);
      sp.spinDown = num2(q("set_spin_down").value, sp.spinDown);
    }
    if (q("set_head_type")) {
      s.head = s.head || {};
      s.head.type = q("set_head_type").value || "spindle";
      applyHeadType();
    }
    const ep = s.endProgram || (s.endProgram = {});
    if (q("set_end_end")) {
      ep.spindleOff = q("set_end_spindleoff").checked;
      ep.coolantOff = q("set_end_coolantoff").checked;
      ep.retract = q("set_end_retract").checked;
      ep.retractZ = num2(q("set_end_retractz").value, ep.retractZ);
      ep.park = q("set_end_park").checked;
      ep.parkX = num2(q("set_end_parkx").value, ep.parkX);
      ep.parkY = num2(q("set_end_parky").value, ep.parkY);
      ep.end = q("set_end_end").value || ep.end;
    }
    saveSettings();
  };
  ov.querySelectorAll('input[type="number"], input[type="checkbox"], input[type="range"], select').forEach((el2) => {
    el2.addEventListener("input", onInput);
    el2.addEventListener("change", onInput);
  });
  const _sg = q("set_suggest_on");
  if (_sg) {
    _sg.checked = localStorage.getItem("ddcs_suggest_on") !== "off";
    _sg.addEventListener("change", () => {
      try {
        localStorage.setItem("ddcs_suggest_on", _sg.checked ? "on" : "off");
      } catch (e) {
      }
      window.dispatchEvent(new CustomEvent("ddcs:suggest-changed"));
    });
  }
  const _theme = q("set_theme");
  if (_theme) {
    const tm = window.ddcsStudio && window.ddcsStudio.themeManager;
    const cur = tm && tm.getCurrent && tm.getCurrent() || localStorage.getItem("ddcs_theme") || THEMES[0];
    _theme.innerHTML = THEMES.map((t) => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join("");
    _theme.value = cur;
    _theme.addEventListener("change", () => {
      const tm2 = window.ddcsStudio && window.ddcsStudio.themeManager;
      if (tm2 && tm2.setCurrent) tm2.setCurrent(_theme.value);
      else {
        document.body.setAttribute("data-theme", _theme.value);
        try {
          localStorage.setItem("ddcs_theme", _theme.value);
        } catch (e) {
        }
      }
    });
  }
  const _aboutVer = q("set_about_ver");
  if (_aboutVer) {
    const v = document.querySelector(".ver");
    _aboutVer.textContent = v ? v.textContent.trim() : "V10.20";
  }
  const _emInsert = (code) => {
    const em = window.ddcsStudio && window.ddcsStudio.editorManager || window.editorManager;
    if (em && typeof em.insert === "function") em.insert(code);
  };
  const _endInsert = q("set_end_insert");
  if (_endInsert) _endInsert.addEventListener("click", () => {
    const ep = _ddcsSettings.endProgram || {};
    const lines = ["( End of program - DDCS Studio )"];
    if (ep.spindleOff !== false) lines.push("M5   ( spindle off )");
    if (ep.coolantOff !== false) lines.push("M9   ( coolant off )");
    if (ep.retract !== false) {
      lines.push("#101 = " + num2(ep.retractZ, 0) + "   ( safe Z - G53 needs a variable )");
      lines.push("G53 G0 Z#101   ( retract )");
    }
    if (ep.park === true) {
      lines.push("#102 = " + num2(ep.parkX, 0) + "  #103 = " + num2(ep.parkY, 0));
      lines.push("G53 G0 X#102 Y#103   ( park for unload )");
    }
    if (ep.end && ep.end !== "none") lines.push(ep.end);
    _emInsert(lines.join("\n") + "\n");
  });
  q("set_csv_input").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const db = window.ddcsStudio && window.ddcsStudio.variableDB;
      if (db) db.loadFromCSV(ev.target.result);
      if (window.refreshDeckVariables) window.refreshDeckVariables();
      updateVarCount();
    };
    r.readAsText(f);
  });
  q("set_export").addEventListener("click", () => {
    const db = window.ddcsStudio && window.ddcsStudio.variableDB;
    if (db) UIUtils.downloadFile("ddcs_variables.csv", db.exportCSV());
  });
  q("set_report").addEventListener("click", () => {
    const code = (document.getElementById("editor") || {}).value || "";
    const body = "Version: V10.20\n\nDescribe your feedback or bug below:\n\n" + (code ? "--- Editor Code ---\n" + code : "(editor empty)");
    window.location.href = "mailto:dansemur@gmail.com?subject=" + encodeURIComponent("DDCS Studio Feedback / Bug Report") + "&body=" + encodeURIComponent(body);
  });
  q("set_profile_export").addEventListener("click", () => {
    if (window.ddcsExportProfile) window.ddcsExportProfile();
  });
  q("set_profile_import").addEventListener("click", () => {
    if (window.ddcsImportProfile) window.ddcsImportProfile();
  });
  const genTnc = q("atc_gen_tnc");
  if (genTnc) genTnc.addEventListener("click", () => {
    const nc = generateToolChangeNc(_ddcsSettings.atc, getOutputs());
    const out = q("atc_tnc_out");
    if (out) {
      out.value = nc;
      out.style.display = "block";
    }
    const dl = q("atc_dl_tnc");
    if (dl) dl.style.display = "";
  });
  const dlTnc = q("atc_dl_tnc");
  if (dlTnc) dlTnc.addEventListener("click", () => {
    const out = q("atc_tnc_out");
    if (out && out.value) UIUtils.downloadFile("T.nc", out.value);
  });
  ["a", "b"].forEach((ax) => {
    const role = q("set_axis_" + ax + "_role"), around = q("set_axis_" + ax + "_around");
    const apply = () => {
      _ddcsSettings.motors = _ddcsSettings.motors || {};
      _ddcsSettings.motors[ax] = { role: role.value, around: around.value };
      saveSettings();
    };
    if (role) role.addEventListener("change", apply);
    if (around) around.addEventListener("change", apply);
  });
  const mainTabs = [...ov.querySelectorAll(".settings-main-tab")];
  const sideTabs = [...ov.querySelectorAll(".settings-sidebar .settings-tab")];
  const sideGroupLabels = [...ov.querySelectorAll(".settings-sidebar .sidebar-group-label")];
  const ALL_IDS = [
    "set_tab_profile",
    "set_tab_appearance",
    "set_tab_preview",
    "set_tab_compose",
    "set_tab_variables",
    "set_tab_program",
    "set_tab_feedback",
    "set_tab_network",
    "set_tab_about",
    "set_tab_machine",
    "set_tab_spindle",
    "set_tab_input",
    "set_tab_output",
    "set_tab_atc"
  ];
  function showPanel(id) {
    ALL_IDS.forEach((p) => {
      const el2 = ov.querySelector("#" + p);
      if (el2) el2.style.display = p === id ? "block" : "none";
    });
    sideTabs.forEach((b2) => b2.classList.toggle("active", b2.dataset.target === id));
    if (id === "set_tab_input") renderIoTable(ov.querySelector("#io_input_table"), "input", getInputs(), syncIO);
    if (id === "set_tab_output") renderIoTable(ov.querySelector("#io_output_table"), "output", getOutputs(), syncIO);
    if (id === "set_tab_atc") renderMagazineTable(ov.querySelector("#atc_magazine"), _ddcsSettings.atc, atcOnChange);
  }
  function showGroup(g) {
    mainTabs.forEach((b2) => b2.classList.toggle("active", b2.dataset.group === g));
    sideTabs.forEach((b2) => {
      b2.style.display = b2.dataset.group === g ? "" : "none";
    });
    sideGroupLabels.forEach((l) => {
      l.style.display = l.dataset.groupLabel === g ? "" : "none";
    });
    if (g === "hardware") applyHardwareTabs();
    const firstVisible = sideTabs.find((b2) => b2.dataset.group === g && b2.style.display !== "none");
    if (firstVisible) showPanel(firstVisible.dataset.target);
  }
  mainTabs.forEach((t) => t.addEventListener("click", () => showGroup(t.dataset.group)));
  sideTabs.forEach((t) => t.addEventListener("click", () => showPanel(t.dataset.target)));
  showGroup("general");
  function addSubsystem(kind) {
    if (kind === "atc") {
      _ddcsSettings.hardwareTabs = _ddcsSettings.hardwareTabs || {};
      _ddcsSettings.hardwareTabs.atc = true;
      const outs = getOutputs();
      if (!outs.some((o) => o.type === "drawbar")) outs.push({ id: "drawbar_atc", type: "drawbar", label: "Drawbar (ATC)", pin: "", onCode: "M154", offCode: "M155", group: "atc" });
      saveSettings();
      applyHardwareTabs();
      showPanel("set_tab_atc");
    }
    if (kind === "spindle") {
      _ddcsSettings.hardwareTabs = _ddcsSettings.hardwareTabs || {};
      _ddcsSettings.hardwareTabs.spindle = true;
      saveSettings();
      applyHardwareTabs();
      showPanel("set_tab_spindle");
    }
  }
  const _spinAddBtn = q("set_spin_add_btn");
  if (_spinAddBtn) _spinAddBtn.addEventListener("click", () => addSubsystem("spindle"));
  const _atcAddBtn = q("set_atc_add_btn");
  if (_atcAddBtn) _atcAddBtn.addEventListener("click", () => addSubsystem("atc"));
  function atcOnChange() {
    const atc = _ddcsSettings.atc;
    const outs = getOutputs(), ins = getInputs();
    if (atc.magType === "disk") {
      if (!outs.some((o) => o.id === "rotate_atc")) outs.push({ id: "rotate_atc", type: "rotate", label: "Carousel rotate (ATC)", pin: "", onCode: "", offCode: "", group: "atc" });
      if (!ins.some((i) => i.id === "index_atc")) ins.push({ id: "index_atc", type: "sensor", label: "Pocket index (ATC)", pin: "", level: 0, group: "atc" });
    } else {
      const ro = outs.findIndex((o) => o.id === "rotate_atc");
      if (ro >= 0) outs.splice(ro, 1);
      const ix = ins.findIndex((i) => i.id === "index_atc");
      if (ix >= 0) ins.splice(ix, 1);
    }
    saveSettings();
  }
}
function openSettings() {
  window.dispatchEvent(new CustomEvent("ddcs:stop-previews"));
  if (window.ddcsStopPreview) window.ddcsStopPreview();
  buildSettingsOverlay();
  const app = document.getElementById("settings-app");
  if (app) app.classList.remove("hidden");
}
function closeSettings() {
  const app = document.getElementById("settings-app");
  if (app) app.classList.add("hidden");
}
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.ddcsGetSettings = getSettings;
window.ddcsApplySettings = applySettings;

// ../DDCS-Studio/web/viz/gcodeViz3d.js
var GcodeViz3D = class {
  constructor(container) {
    const THREE = window.THREE;
    if (!THREE) throw new Error("three.js not loaded");
    this.THREE = THREE;
    this.container = container;
    this.active = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(329482);
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1e6);
    camera.up.set(0, 0, 1);
    this.persp = camera;
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -1e6, 1e6);
    ortho.up.set(0, 0, 1);
    this.ortho = ortho;
    this._ortho = false;
    this.camera = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.target = new THREE.Vector3(0, 0, 0);
    this.radius = 200;
    this.followCam = false;
    this.followLerp = 0.16;
    this._followRaf = null;
    this.theta = -Math.PI / 2;
    this.phi = Math.PI / 3;
    this.lineGroups = {};
    this._dataBounds = null;
    this._stock = null;
    this._machine = null;
    this.stockMesh = null;
    this.stockEdges = null;
    this.machineBox = null;
    this._segs = [];
    this._passCount = 1;
    this.starts = [{ x: 0, y: 0, z: 0 }];
    this.spindleMarkers = [];
    this.selectedStart = 0;
    this._downMarker = -1;
    this._axisMat = {};
    this.pathGroup = new THREE.Group();
    this.scene.add(this.pathGroup);
    this.raycaster = new THREE.Raycaster();
    this.onStartChange = null;
    this.showRapids = true;
    this._animOn = true;
    this._animSimSpeed = 1;
    this._animPaused = false;
    this._gizmoPx = 60;
    this._animRaf = null;
    this._animDist = 0;
    this._animLast = 0;
    this._animSegs = [];
    this._animMs = 0;
    this._setupJogPendant();
    this._initStaticScene();
    this._initCube();
    this._bindControls();
    this._applyCamera();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);
    this._resize();
  }
  _initStaticScene() {
    const THREE = this.THREE;
    const grid = new THREE.GridHelper(200, 20, 2771046, 1451055);
    grid.rotation.x = Math.PI / 2;
    this.grid = grid;
    this.scene.add(grid);
    const axes = new THREE.AxesHelper(25);
    this.axes = axes;
    this.scene.add(axes);
    this._gridLabels = {
      xp: this._makeTextSprite("+X"),
      xn: this._makeTextSprite("-X"),
      yp: this._makeTextSprite("+Y"),
      yn: this._makeTextSprite("-Y")
    };
    for (const k in this._gridLabels) this.scene.add(this._gridLabels[k]);
  }
  _makeTextSprite(text) {
    const THREE = this.THREE;
    const c2 = document.createElement("canvas");
    c2.width = 128;
    c2.height = 64;
    const ctx = c2.getContext("2d");
    ctx.fillStyle = "#7fa8cc";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 36);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c2), depthTest: false, transparent: true }));
    sp.renderOrder = 1;
    return sp;
  }
  // Interactive ViewCube — implementation in viz/navCube.js
  _initCube() {
    initCube(this);
  }
  _cubeFaceAt(e) {
    return cubeFaceAt(this, e);
  }
  _highlightCubeFace(idx) {
    highlightCubeFace(this, idx);
  }
  _pickCube(e) {
    return pickCube(this, e);
  }
  // A draggable start marker for one pass: ruby probe tip
  _makeMarker(pass) {
    const THREE = this.THREE;
    const grp = new THREE.Group();
    const ruby = new THREE.Mesh(
      new THREE.SphereGeometry(3, 20, 20),
      new THREE.MeshBasicMaterial({ color: 12849710, depthTest: false })
    );
    ruby.renderOrder = 11;
    grp.add(ruby);
    grp.add(this._makeNumberSprite(pass + 1));
    return grp;
  }
  // A camera-facing numbered badge floating above the ruby (order of execution)
  _makeNumberSprite(n) {
    const THREE = this.THREE;
    const c2 = document.createElement("canvas");
    c2.width = c2.height = 64;
    const ctx = c2.getContext("2d");
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(18,18,22,0.88)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 32, 35);
    const tex = new THREE.CanvasTexture(c2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(11, 11, 1);
    sp.position.set(0, 0, 11);
    sp.renderOrder = 13;
    return sp;
  }
  // JOG START pendant — implementation in viz/jogPendant.js
  _setupJogPendant() {
    setupJogPendant(this);
  }
  // Recreate markers only when the pass count changes
  _ensureMarkers() {
    if (this.spindleMarkers.length === this._passCount) return;
    for (const m of this.spindleMarkers) this.scene.remove(m);
    this.spindleMarkers = [];
    this._hoverKey = void 0;
    for (let p = 0; p < this._passCount; p++) {
      const m = this._makeMarker(p);
      this.spindleMarkers.push(m);
      this.scene.add(m);
    }
    if (this.selectedStart >= this._passCount) this.selectedStart = 0;
    if (this._renderJogStarts) this._renderJogStarts();
  }
  _positionMarkers() {
    for (let p = 0; p < this.spindleMarkers.length; p++) {
      const s = this.starts[p] || { x: 0, y: 0, z: 0 };
      this.spindleMarkers[p].position.set(s.x, s.y, s.z);
    }
    this._highlightSelectedStart();
  }
  // Choose which start the jog pendant drives (and which ruby is highlighted).
  selectStart(i) {
    const n = this.spindleMarkers.length || 1;
    this.selectedStart = Math.max(0, Math.min(n - 1, i | 0));
    this._highlightSelectedStart();
    if (this._renderJogStarts) this._renderJogStarts();
    this.render();
  }
  // Brighten the selected ruby, dim the rest, so it's clear which start the pendant jogs.
  _highlightSelectedStart() {
    for (let p = 0; p < this.spindleMarkers.length; p++) {
      const ruby = this.spindleMarkers[p].children[0];
      if (!ruby || !ruby.material) continue;
      const sel = p === this.selectedStart;
      ruby.material.color.setHex(sel ? 16722500 : 12849710);
      ruby.material.transparent = !sel;
      ruby.material.opacity = sel ? 1 : 0.5;
    }
  }
  // Ray-pick a start marker (ruby + numbered badge) under the pointer; returns pass index or -1.
  _pickMarker(e) {
    if (!this.spindleMarkers.length) return -1;
    this.raycaster.setFromCamera(this._ndc(e), this.camera);
    let best = -1, bestDist = Infinity;
    for (let p = 0; p < this.spindleMarkers.length; p++) {
      const hit = this.raycaster.intersectObject(this.spindleMarkers[p], true)[0];
      if (hit && hit.distance < bestDist) {
        bestDist = hit.distance;
        best = p;
      }
    }
    return best;
  }
  // Keep each gizmo a constant on-screen size (independent of zoom): world size ∝ the
  // world-per-pixel at the marker (camera distance for perspective, frustum for ortho).
  _scaleMarkers() {
    if (!this.spindleMarkers.length) return;
    const H = this.container.clientHeight || 1;
    const targetPx = this._gizmoPx || 90, base = 26;
    const ortho = this.camera.isOrthographicCamera;
    const tanHalf = Math.tan(this.persp.fov * Math.PI / 180 / 2);
    for (const m of this.spindleMarkers) {
      const worldPerPx = ortho ? (this.camera.top - this.camera.bottom) / H : 2 * this.camera.position.distanceTo(m.position) * tanHalf / H;
      m.scale.setScalar(Math.max(1e-4, targetPx * worldPerPx / base));
    }
    if (this.jogPendant) {
      this.jogPendant.style.display = this.starts && this.starts.length > 0 ? "block" : "none";
    }
  }
  // Set a pass's start programmatically (pass defaults to 0)
  setStart(x, y, z, pass) {
    const p = pass | 0;
    if (!this.starts[p]) this.starts[p] = { x: 0, y: 0, z: 0 };
    this.starts[p].x = x;
    this.starts[p].y = y;
    if (typeof z === "number") this.starts[p].z = z;
    this._rebuild();
    this.render();
    if (typeof this.onStartChange === "function") this.onStartChange(this.starts);
  }
  setShowRapids(on) {
    this.showRapids = !!on;
    if (this.lineGroups.rapid) this.lineGroups.rapid.visible = this.showRapids;
    this.render();
  }
  // Snap the camera to a standard view (keeps the current target + radius)
  setView(name) {
    const H = Math.PI / 2;
    const views = {
      top: [-H, 0],
      bottom: [-H, Math.PI],
      front: [-H, H],
      back: [H, H],
      right: [0, H],
      left: [Math.PI, H],
      iso: [Math.PI / 4, Math.PI / 3]
    };
    const v = views[name] || views.iso;
    this.theta = v[0];
    this.phi = v[1];
    this.camera = this.ortho;
    this._ortho = true;
    this._applyCamera();
    this.render();
  }
  _ensureAnimTool() {
    if (this._animTool) return;
    const THREE = this.THREE;
    this._animTool = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 16, 16),
      new THREE.MeshBasicMaterial({ color: 16777215, depthTest: false })
    );
    this._animTool.renderOrder = 25;
    this._animTool.visible = false;
    this.scene.add(this._animTool);
  }
  // Toggle a tool dot that travels the whole path in execution order, feed-true (real program time)
  setAnimate(on) {
    this._animOn = !!on;
    this._ensureAnimTool();
    this._animTool.visible = this._animOn;
    this._dimRoute(this._animOn);
    if (this._animOn) {
      this._animDist = 0;
      this._animLast = 0;
      if (!this._animRaf) this._animTick();
    } else {
      if (this._animRaf) cancelAnimationFrame(this._animRaf);
      this._animRaf = null;
      this._applyPartRotation(0, 0);
      this.render();
    }
  }
  // Trail mode: while playing, keep the full route (the type-grouped lines) visible but faint — a thin 50%
  // "ghost" of the whole path — and reveal the bold solid "executed" overlay up to the tool head, so you can
  // read where you are against where you're going. Restores the original opacity on stop.
  _dimRoute(on) {
    this._trailOn = on;
    for (const k in this.lineGroups) {
      const o = this.lineGroups[k];
      if (!o) continue;
      if (on) {
        if (o.material.__op0 == null) o.material.__op0 = o.material.opacity != null ? o.material.opacity : 1;
        o.material.transparent = true;
        o.material.opacity = 0.5;
      } else if (o.material.__op0 != null) {
        o.material.opacity = o.material.__op0;
        o.material.transparent = o.material.__op0 < 1;
      }
    }
    if (this._trailLine) {
      this._trailLine.visible = on;
      if (!on) {
        if (this._trailTipIdx != null && this._trailTipOrig) {
          const o = this._trailTipOrig, pa = this._trailLine.geometry.getAttribute("position");
          pa.setXYZ(this._trailTipIdx, o.x, o.y, o.z);
          pa.needsUpdate = true;
        }
        this._trailTipIdx = null;
        this._trailTipOrig = null;
        this._trailLine.geometry.setDrawRange(0, 0);
      }
    }
    this.render();
  }
  // Called by execution engine to update tool position during execution
  setToolPosition(pos) {
    if (!pos || !Number.isFinite(pos.x) && !Number.isFinite(pos.y) && !Number.isFinite(pos.z)) return;
    this._ensureAnimTool();
    this._animTool.visible = true;
    const o = this.starts[0] || { x: 0, y: 0, z: 0 };
    this._animTool.position.set((pos.x || 0) + o.x, (pos.y || 0) + o.y, (pos.z || 0) + o.z);
    if (this._trailLine && this._animSegs && this._animSegs.length) {
      if (!this._trailOn) this._dimRoute(true);
      this._updateTrailTip(this._animTool.position);
    }
    this.render();
  }
  // Grow the bold trail so its tip sits EXACTLY on the tool head, drawing a partial current segment instead of
  // revealing whole segments (which read as a visibility toggle). Completed segments draw fully; the current
  // segment is shortened to a→toolhead by temporarily moving its end vertex (restored when the tip advances).
  _updateTrailTip(tp) {
    const line = this._trailLine, segs = this._animSegs;
    if (!line || !segs || !segs.length) return;
    const pos = line.geometry.getAttribute("position");
    if (this._trailTipIdx != null && this._trailTipOrig) {
      const o = this._trailTipOrig;
      pos.setXYZ(this._trailTipIdx, o.x, o.y, o.z);
    }
    let ci = 0, best = Infinity, qx = 0, qy = 0, qz = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const dx = s.bx - s.ax, dy = s.by - s.ay, dz = s.bz - s.az;
      const len2 = dx * dx + dy * dy + dz * dz || 1e-9;
      let t = ((tp.x - s.ax) * dx + (tp.y - s.ay) * dy + (tp.z - s.az) * dz) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = s.ax + dx * t, cy = s.ay + dy * t, cz = s.az + dz * t;
      const dd = (tp.x - cx) ** 2 + (tp.y - cy) ** 2 + (tp.z - cz) ** 2;
      if (dd < best) {
        best = dd;
        ci = i;
        qx = cx;
        qy = cy;
        qz = cz;
      }
    }
    const vIdx = 2 * ci + 1;
    this._trailTipOrig = { x: pos.getX(vIdx), y: pos.getY(vIdx), z: pos.getZ(vIdx) };
    this._trailTipIdx = vIdx;
    pos.setXYZ(vIdx, qx, qy, qz);
    pos.needsUpdate = true;
    line.geometry.setDrawRange(0, 2 * (ci + 1));
  }
  _animTick() {
    if (!this._animOn || !this.active) {
      this._animRaf = null;
      return;
    }
    const segs = this._animSegs;
    if (segs && segs.length) {
      const now = typeof performance !== "undefined" ? performance.now() : 0;
      const dt = this._animLast ? Math.min(0.1, (now - this._animLast) / 1e3) : 0;
      this._animLast = now;
      const total = this._animMs || 1;
      if (!this._animPaused) {
        this._animDist += dt * 1e3 * (this._animSimSpeed || 1);
        if (this._animDist >= total) {
          this._animDist = total;
          this._animPaused = true;
          setTimeout(() => {
            this._animDist = 0;
            this._animPaused = false;
            this._animLast = 0;
          }, 1e3);
        }
      }
      let d = Math.min(this._animDist, total);
      for (let i = 0; i < segs.length; i++) {
        const sg = segs[i];
        if (d <= sg.ms || i === segs.length - 1) {
          const t = sg.ms > 0 ? Math.min(1, d / sg.ms) : 1;
          this._animTool.position.set(sg.ax + (sg.bx - sg.ax) * t, sg.ay + (sg.by - sg.ay) * t, sg.az + (sg.bz - sg.az) * t);
          this._applyPartRotation(sg.a1 + (sg.a2 - sg.a1) * t, sg.b1 + (sg.b2 - sg.b1) * t);
          if (this._trailLine) this._trailLine.geometry.setDrawRange(0, 2 * i);
          break;
        }
        d -= sg.ms;
      }
      this.render();
    }
    this._animRaf = requestAnimationFrame(() => this._animTick());
  }
  // Spin the part group to the given rotary angles (degrees). A spins around its declared
  // Cartesian axis (getRotaryAxes), defaulting to X; B around its declared axis, if any.
  _applyPartRotation(a, b2) {
    const pg = this._partGroup;
    if (!pg) return;
    const rax = this._rotaryAxes || {};
    const deg = Math.PI / 180;
    pg.rotation.set(0, 0, 0);
    pg.rotation[rax.a || "x"] = (a || 0) * deg;
    if (rax.b) pg.rotation[rax.b] = (b2 || 0) * deg;
  }
  // Short beep at the end of each animation loop (Web Audio; silent until a user gesture)
  _beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this._audio) this._audio = new Ctx();
      const ctx = this._audio;
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 880;
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.12);
    } catch (_) {
    }
  }
  _ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new this.THREE.Vector2(
      (e.clientX - r.left) / r.width * 2 - 1,
      -((e.clientY - r.top) / r.height * 2 - 1)
    );
  }
  // Disabled gizmo picking
  _pickGizmo(e) {
    return null;
  }
  _setHighlight(pass, axis) {
  }
  // t along axisDir (unit) from lineOrigin to the point closest to the pointer ray
  _closestAxisT(ray, lineOrigin, axisDir) {
    const d = axisDir.dot(w0);
    const e = ray.direction.dot(w0);
    const denom = c - b * b;
    if (Math.abs(denom) < 1e-9) return 0;
    return (b * e - c * d) / denom;
  }
  setSegments(parsed, fit = true) {
    this._segs = parsed && parsed.segments || [];
    this._passCount = Math.max(1, parsed && parsed.stats && parsed.stats.passes || 1);
    while (this.starts.length < this._passCount) this.starts.push({ x: 0, y: 0, z: 0 });
    this.starts.length = this._passCount;
    this._ensureMarkers();
    this._rebuild();
    if (fit) this.fitAll();
    else this.render();
  }
  // Walk each pass, clamping probes to the stock so they stop at the wall instead of
  // running the full search distance (which would drift the path off into space).
  // Emits world-coordinate line groups (one per move type) and positions the markers.
  _rebuild() {
    const THREE = this.THREE;
    for (const k in this.lineGroups) {
      const o = this.lineGroups[k];
      if (o) {
        this.pathGroup.remove(o);
        o.geometry.dispose();
        o.material.dispose();
      }
    }
    this.lineGroups = {};
    const st = this._stock;
    const pocket = !!(st && st.shape === "pocket");
    let box = null;
    let cavity = null;
    if (st && st.show && st.x > 0 && st.y > 0 && st.z > 0) {
      box = { min: { x: 0, y: 0, z: -st.z }, max: { x: st.x, y: st.y, z: 0 } };
      if (pocket) {
        const w = Math.max(8, Math.min(st.x, st.y) * 0.25);
        cavity = { min: { x: w, y: w, z: -st.z }, max: { x: st.x - w, y: st.y - w, z: 0 } };
      }
    }
    const CAP = 20;
    const byPass = [];
    for (const s of this._segs) {
      const p = s.pass | 0;
      (byPass[p] || (byPass[p] = [])).push(s);
    }
    const feedPos = [], rapidPos = [], retractPos = [], probeFastPos = [], probeSlowPos = [], jogPos = [];
    let maxProbeFeed = 0;
    for (const s of this._segs) {
      if ((s.type === "probe" || s.probe) && (s.feed || 0) > maxProbeFeed) maxProbeFeed = s.feed;
    }
    const animSegs = [];
    const ROT_DEG_PER_MIN = 3600;
    const pushSeg = (ax, ay, az, bx, by, bz, rate, a1, b1, a2, b2, col) => {
      a1 = a1 || 0;
      b1 = b1 || 0;
      a2 = a2 || 0;
      b2 = b2 || 0;
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      const da = Math.abs(a2 - a1) + Math.abs(b2 - b1);
      if (len < 1e-9 && da < 1e-9) return;
      const ms = len >= 1e-9 ? len / (rate > 0 ? rate : 600) * 6e4 : da / ROT_DEG_PER_MIN * 6e4;
      animSegs.push({ ax, ay, az, bx, by, bz, ms, a1, b1, a2, b2, col: col != null ? col : 16769357 });
    };
    let bounds = null;
    const grow = (x, y, z) => {
      bounds = this._growBounds(bounds, x, y, z, x, y, z);
    };
    let prevEnd = null;
    for (let p = 0; p < this._passCount; p++) {
      const segs = byPass[p] || [];
      const mk = this.starts[p] || { x: 0, y: 0, z: 0 };
      if (prevEnd) {
        jogPos.push(prevEnd.x, prevEnd.y, prevEnd.z, mk.x, mk.y, mk.z);
        grow(prevEnd.x, prevEnd.y, prevEnd.z);
        grow(mk.x, mk.y, mk.z);
        pushSeg(prevEnd.x, prevEnd.y, prevEnd.z, mk.x, mk.y, mk.z, 6e3, 0, 0, 0, 0, 16751117);
      }
      let cur = { x: 0, y: 0, z: 0 };
      for (const s of segs) {
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1, dz = s.z2 - s.z1;
        const type = s.type || (s.probe ? "probe" : s.rapid ? "rapid" : "feed");
        const start = cur;
        let end = { x: start.x + dx, y: start.y + dy, z: start.z + dz };
        if (type === "probe" && box) {
          const Aw = { x: start.x + mk.x, y: start.y + mk.y, z: start.z + mk.z };
          const Bw = { x: end.x + mk.x, y: end.y + mk.y, z: end.z + mk.z };
          let tt = null;
          const ro = this._boxRange(Aw, Bw, box.min, box.max);
          if (ro.hit && ro.tEnter > 1e-6 && ro.tEnter < 1 - 1e-6) tt = ro.tEnter;
          if (cavity) {
            const rc = this._boxRange(Aw, Bw, cavity.min, cavity.max);
            if (rc.hit && rc.tEnter <= 1e-6 && rc.tExit > 1e-6 && rc.tExit < 1 - 1e-6) {
              if (tt == null || rc.tExit < tt) tt = rc.tExit;
            }
          }
          if (tt != null) {
            end = { x: start.x + dx * tt, y: start.y + dy * tt, z: start.z + dz * tt };
          }
        }
        const ax = start.x + mk.x, ay = start.y + mk.y, az = start.z + mk.z;
        const bx = end.x + mk.x, by = end.y + mk.y, bz = end.z + mk.z;
        grow(ax, ay, az);
        grow(bx, by, bz);
        const slowProbe = type === "probe" && (s.feed || 0) > 0 && (s.feed || 0) < maxProbeFeed;
        const arr = type === "rapid" ? rapidPos : type === "retract" ? retractPos : type === "probe" ? slowProbe ? probeSlowPos : probeFastPos : feedPos;
        const col = type === "rapid" ? 16763904 : type === "retract" ? 3394645 : type === "probe" ? slowProbe ? 9684477 : 3900150 : 3538896;
        arr.push(ax, ay, az, bx, by, bz);
        pushSeg(ax, ay, az, bx, by, bz, type === "rapid" || type === "retract" ? 6e3 : s.feed > 0 ? s.feed : 600, s.a1, s.b1, s.a2, s.b2, col);
        cur = end;
      }
      prevEnd = { x: cur.x + mk.x, y: cur.y + mk.y, z: cur.z + mk.z };
    }
    this._animSegs = animSegs;
    this._animMs = animSegs.reduce((t, s) => t + s.ms, 0);
    this._rotaryAxes = getRotaryAxes();
    let feedCol = null;
    if (feedPos.length) {
      const zMin = bounds ? bounds.minZ : 0, zRange = bounds ? bounds.maxZ - bounds.minZ || 1 : 1;
      const cLow = new THREE.Color(675792), cHigh = new THREE.Color(3538896), tmp = new THREE.Color();
      feedCol = [];
      for (let i = 0; i < feedPos.length; i += 3) {
        tmp.copy(cLow).lerp(cHigh, (feedPos[i + 2] - zMin) / zRange);
        feedCol.push(tmp.r, tmp.g, tmp.b);
      }
    }
    this.lineGroups.feed = this._addLine(feedPos, { vertexColors: feedCol });
    this.lineGroups.rapid = this._addLine(rapidPos, { color: 16763904, opacity: 0.6 });
    if (this.lineGroups.rapid) this.lineGroups.rapid.visible = this.showRapids;
    this.lineGroups.retract = this._addLine(retractPos, { color: 3394645, opacity: 0.85 });
    this.lineGroups.probe = this._addLine(probeFastPos, { color: 3900150, dotted: true });
    this.lineGroups.probeSlow = this._addLine(probeSlowPos, { color: 9684477 });
    this.lineGroups.jog = this._addLine(jogPos, { color: 16751117, opacity: 0.95, dashed: true });
    if (this._trailLine) {
      this.pathGroup.remove(this._trailLine);
      this._trailLine.geometry.dispose();
      this._trailLine.material.dispose();
      this._trailLine = null;
    }
    this._trailTipIdx = null;
    this._trailTipOrig = null;
    this._trailOn = false;
    this._trailFat = null;
    if (animSegs.length) {
      const tp = [], tc = [], C = new THREE.Color();
      for (const s of animSegs) {
        tp.push(s.ax, s.ay, s.az, s.bx, s.by, s.bz);
        C.set(s.col != null ? s.col : 16769357);
        tc.push(C.r, C.g, C.b, C.r, C.g, C.b);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(tc, 3));
      g.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 6 });
      mat.depthTest = false;
      const line = new THREE.LineSegments(g, mat);
      line.renderOrder = 22;
      line.visible = false;
      this.pathGroup.add(line);
      this._trailLine = line;
      this._trailFat = [];
      for (let k = 0; k < 4; k++) {
        const c2 = new THREE.LineSegments(g, mat);
        c2.renderOrder = 21;
        line.add(c2);
        this._trailFat.push(c2);
      }
      this._layoutTrailFat();
    }
    this._positionMarkers();
    this._dataBounds = bounds;
  }
  // Build a LineSegments from a flat positions array; null if empty.
  _addLine(pos, opt) {
    if (!pos || !pos.length) return null;
    const THREE = this.THREE;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    let mat;
    if (opt.vertexColors) {
      g.setAttribute("color", new THREE.Float32BufferAttribute(opt.vertexColors, 3));
      mat = new THREE.LineBasicMaterial({ vertexColors: true });
    } else if (opt.dashed || opt.dotted) {
      const op = opt.opacity != null ? opt.opacity : 1;
      const dashSize = opt.dotted ? 0.6 : 3, gapSize = opt.dotted ? 1.4 : 2;
      mat = new THREE.LineDashedMaterial({ color: opt.color, transparent: op < 1, opacity: op, dashSize, gapSize });
    } else {
      const op = opt.opacity != null ? opt.opacity : 1;
      mat = new THREE.LineBasicMaterial({ color: opt.color, transparent: op < 1, opacity: op });
    }
    mat.depthTest = false;
    const lines = new THREE.LineSegments(g, mat);
    lines.renderOrder = 20;
    if (opt.dashed || opt.dotted) lines.computeLineDistances();
    this.pathGroup.add(lines);
    return lines;
  }
  // Parametric range [tEnter, tExit] where the line A→B crosses an axis-aligned box.
  _boxRange(A, B, boxMin, boxMax) {
    const d = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
    let tEnter = -Infinity, tExit = Infinity;
    for (const ax of ["x", "y", "z"]) {
      if (Math.abs(d[ax]) < 1e-9) {
        if (A[ax] < boxMin[ax] - 1e-6 || A[ax] > boxMax[ax] + 1e-6) return { hit: false };
      } else {
        let t1 = (boxMin[ax] - A[ax]) / d[ax];
        let t2 = (boxMax[ax] - A[ax]) / d[ax];
        if (t1 > t2) {
          const t = t1;
          t1 = t2;
          t2 = t;
        }
        if (t1 > tEnter) tEnter = t1;
        if (t2 < tExit) tExit = t2;
      }
    }
    return { hit: tEnter <= tExit, tEnter, tExit };
  }
  fit(b2) {
    const cx = (b2.minX + b2.maxX) / 2;
    const cy = (b2.minY + b2.maxY) / 2;
    const cz = (b2.minZ + b2.maxZ) / 2;
    this.target.set(cx, cy, cz);
    const sx = b2.maxX - b2.minX, sy = b2.maxY - b2.minY, sz = b2.maxZ - b2.minZ;
    const radius = Math.max(1, 0.5 * Math.hypot(sx, sy, sz));
    const fov = this.camera.fov * Math.PI / 180;
    this.radius = radius / Math.sin(fov / 2) * 1.25;
    const sv = typeof window !== "undefined" && window.ddcsGetSettings && window.ddcsGetSettings().view || {};
    this.theta = typeof sv.theta === "number" ? sv.theta : -Math.PI / 2;
    this.phi = typeof sv.phi === "number" ? sv.phi : Math.PI / 3;
    const span = Math.max(sx, sy, 10);
    const floorZ = this._stock && this._stock.show && this._stock.z > 0 ? -this._stock.z : b2.minZ;
    if (this.grid) {
      this.grid.scale.setScalar(span / 200);
      this.grid.position.set(cx, cy, floorZ);
    }
    if (this.axes) this.axes.scale.setScalar(Math.max(1, span / 200));
    if (this._gridLabels) {
      const half = span / 2, off = span * 0.07, lw = span * 0.14, z = floorZ;
      const L = this._gridLabels;
      L.xp.position.set(cx + half + off, cy, z);
      L.xn.position.set(cx - half - off, cy, z);
      L.yp.position.set(cx, cy + half + off, z);
      L.yn.position.set(cx, cy - half - off, z);
      for (const k in L) L[k].scale.set(lw, lw / 2, 1);
    }
    this._applyCamera();
  }
  _growBounds(b2, x0, y0, z0, x1, y1, z1) {
    if (!b2) return { minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1 };
    b2.minX = Math.min(b2.minX, x0);
    b2.minY = Math.min(b2.minY, y0);
    b2.minZ = Math.min(b2.minZ, z0);
    b2.maxX = Math.max(b2.maxX, x1);
    b2.maxY = Math.max(b2.maxY, y1);
    b2.maxZ = Math.max(b2.maxZ, z1);
    return b2;
  }
  // Frame the union of toolpath + stock + machine envelope (whichever are present)
  fitAll() {
    let b2 = null;
    const d = this._dataBounds;
    if (d) b2 = this._growBounds(b2, d.minX, d.minY, d.minZ, d.maxX, d.maxY, d.maxZ);
    const s = this._stock;
    if (s && s.show && s.x > 0 && s.y > 0 && s.z > 0) b2 = this._growBounds(b2, 0, 0, -s.z, s.x, s.y, 0);
    const m = this._machine;
    if (m && m.show && m.x > 0 && m.y > 0 && m.z > 0) {
      const ox = m.ox || 0, oy = m.oy || 0, oz = m.oz || 0;
      b2 = this._growBounds(b2, -ox, -oy, -oz, m.x - ox, m.y - oy, m.z - oz);
    }
    if (b2) this.fit(b2);
    this.render();
  }
  // Translucent stock block — WCS zero at the top, min XY corner: X[0..x] Y[0..y] Z[-z..0]
  setStock(stock) {
    const THREE = this.THREE;
    this._stock = stock || null;
    if (!this._partGroup) {
      this._partGroup = new THREE.Group();
      this.scene.add(this._partGroup);
    }
    const pg = this._partGroup;
    pg.rotation.set(0, 0, 0);
    if (this.stockMesh) {
      pg.remove(this.stockMesh);
      this.stockMesh.geometry.dispose();
      this.stockMesh.material.dispose();
      this.stockMesh = null;
    }
    if (this.stockEdges) {
      pg.remove(this.stockEdges);
      this.stockEdges.geometry.dispose();
      this.stockEdges.material.dispose();
      this.stockEdges = null;
    }
    if (stock && stock.show && stock.x > 0 && stock.y > 0 && stock.z > 0) {
      const pocket = stock.shape === "pocket";
      const fillCol = pocket ? 6983614 : 9416298;
      const edgeCol = pocket ? 8828671 : 10934140;
      let geo;
      const mat = new THREE.MeshBasicMaterial({ color: fillCol, transparent: true, opacity: 0.12, depthWrite: false });
      const mesh = new THREE.Mesh();
      if (pocket) {
        const w = Math.max(8, Math.min(stock.x, stock.y) * 0.25);
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(stock.x, 0);
        shape.lineTo(stock.x, stock.y);
        shape.lineTo(0, stock.y);
        shape.lineTo(0, 0);
        const hole = new THREE.Path();
        hole.moveTo(w, w);
        hole.lineTo(stock.x - w, w);
        hole.lineTo(stock.x - w, stock.y - w);
        hole.lineTo(w, stock.y - w);
        hole.lineTo(w, w);
        shape.holes.push(hole);
        geo = new THREE.ExtrudeGeometry(shape, { depth: stock.z, bevelEnabled: false });
        mesh.position.set(0, 0, -stock.z);
      } else if (stock.shape === "cylinder") {
        const axis = Object.values(getRotaryAxes())[0] || "x";
        const dims = { x: stock.x, y: stock.y, z: stock.z };
        const cross = axis === "x" ? [dims.y, dims.z] : axis === "y" ? [dims.x, dims.z] : [dims.x, dims.y];
        const r = Math.min(cross[0], cross[1]) / 2;
        geo = new THREE.CylinderGeometry(r, r, dims[axis], 48);
        if (axis === "x") geo.rotateZ(Math.PI / 2);
        else if (axis === "z") geo.rotateX(Math.PI / 2);
        mesh.position.set(stock.x / 2, stock.y / 2, -stock.z / 2);
      } else {
        geo = new THREE.BoxGeometry(stock.x, stock.y, stock.z);
        mesh.position.set(stock.x / 2, stock.y / 2, -stock.z / 2);
      }
      mesh.geometry = geo;
      mesh.material = mat;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.55 }));
      edges.position.copy(mesh.position);
      const C = new THREE.Vector3(stock.x / 2, stock.y / 2, -stock.z / 2);
      pg.position.copy(C);
      mesh.position.sub(C);
      edges.position.sub(C);
      this.stockMesh = mesh;
      pg.add(mesh);
      this.stockEdges = edges;
      pg.add(edges);
    }
  }
  // Tool Setter Block
  setProbes(probes) {
    const THREE = this.THREE;
    if (this.setterMesh) {
      this.scene.remove(this.setterMesh);
      this.setterMesh.geometry.dispose();
      this.setterMesh.material.dispose();
      this.setterMesh = null;
    }
    if (this.setterEdges) {
      this.scene.remove(this.setterEdges);
      this.setterEdges.geometry.dispose();
      this.setterEdges.material.dispose();
      this.setterEdges = null;
    }
    if (probes && probes.setterW > 0 && probes.setterH > 0) {
      const fillCol = 16711935;
      const edgeCol = 16738047;
      const mat = new THREE.MeshBasicMaterial({ color: fillCol, transparent: true, opacity: 0.25, depthWrite: false });
      const geo = new THREE.CylinderGeometry(probes.setterW / 2, probes.setterW / 2, probes.setterH, 16);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(probes.setterX, probes.setterY, probes.setterZ - probes.setterH / 2);
      this.setterMesh = mesh;
      this.scene.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.6 }));
      edges.position.copy(mesh.position);
      this.setterEdges = edges;
      this.scene.add(edges);
    }
  }
  // Wireframe machine envelope — origin = program-zero offset from the envelope's min corner
  setMachine(machine) {
    const THREE = this.THREE;
    this._machine = machine || null;
    if (this.machineBox) {
      this.scene.remove(this.machineBox);
      this.machineBox.geometry.dispose();
      this.machineBox.material.dispose();
      this.machineBox = null;
    }
    if (machine && machine.show && machine.x > 0 && machine.y > 0 && machine.z > 0) {
      const src = new THREE.BoxGeometry(machine.x, machine.y, machine.z);
      const eg = new THREE.EdgesGeometry(src);
      src.dispose();
      const box = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 7109260, transparent: true, opacity: 0.4 }));
      const ox = machine.ox || 0, oy = machine.oy || 0, oz = machine.oz || 0;
      box.position.set(machine.x / 2 - ox, machine.y / 2 - oy, machine.z / 2 - oz);
      this.machineBox = box;
      this.scene.add(box);
    }
  }
  // Re-pivot the orbit on the point under the cursor (the stock surface if hovered,
  // otherwise the point at that screen location on the focus plane). Camera stays put.
  _setPivotFromCursor(e) {
    const THREE = this.THREE;
    this.raycaster.setFromCamera(this._ndc(e), this.camera);
    let pivot = null;
    if (this.stockMesh) {
      const hit = this.raycaster.intersectObject(this.stockMesh, false)[0];
      if (hit) pivot = hit.point.clone();
    }
    if (!pivot) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const plane = new THREE.Plane(camDir, -camDir.dot(this.target));
      const pt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, pt)) pivot = pt;
    }
    if (!pivot) return;
    const off = this.camera.position.clone().sub(pivot);
    this.radius = Math.max(1, off.length());
    this.phi = Math.acos(Math.max(-1, Math.min(1, off.z / this.radius)));
    this.theta = Math.atan2(off.y, off.x);
    this.target.copy(pivot);
  }
  _applyCamera() {
    this.phi = Math.max(5e-4, Math.min(Math.PI - 5e-4, this.phi));
    const sinPhi = Math.sin(this.phi);
    const x = this.radius * sinPhi * Math.cos(this.theta);
    const y = this.radius * sinPhi * Math.sin(this.theta);
    const z = this.radius * Math.cos(this.phi);
    this.camera.up.set(-Math.cos(this.phi) * Math.cos(this.theta), -Math.cos(this.phi) * Math.sin(this.theta), sinPhi);
    this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
    this.camera.lookAt(this.target);
    if (this.camera.isOrthographicCamera) {
      const halfH = this.radius * Math.tan(this.persp.fov * Math.PI / 180 / 2);
      const aspect = (this.container.clientWidth || 1) / (this.container.clientHeight || 1);
      this.camera.left = -halfH * aspect;
      this.camera.right = halfH * aspect;
      this.camera.top = halfH;
      this.camera.bottom = -halfH;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
    this._layoutTrailFat();
  }
  // Fat trail: 4 offset copies of the trail line (children of _trailLine → they share its geometry, draw-range,
  // tip edits, colours and visibility) nudged ±right/±up in SCREEN space, so the bold executed path renders a
  // few px thick on any GPU (GL linewidth is capped at 1px on ANGLE). Offsets recompute here so the thickness
  // stays ~constant on screen through zoom.
  _layoutTrailFat() {
    const fat = this._trailFat;
    if (!fat || !fat.length) return;
    const THREE = this.THREE, cam = this.camera;
    const h = this.renderer && this.renderer.domElement.clientHeight || 600;
    const fov = (cam.fov || this.persp && this.persp.fov || 45) * Math.PI / 180;
    const o = 2 * this.radius * Math.tan(fov / 2) / h * 1.1;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).normalize();
    fat[0].position.copy(right).multiplyScalar(o);
    fat[1].position.copy(right).multiplyScalar(-o);
    fat[2].position.copy(up).multiplyScalar(o);
    fat[3].position.copy(up).multiplyScalar(-o);
  }
  /** Centre-lock the camera on the tool. on → a rAF loop eases the orbit target onto the tool each frame. */
  setFollowCam(on) {
    this.followCam = !!on;
    if (this.followCam) {
      if (!this._followRaf) this._followTick();
    }
  }
  setFollowLerp(v) {
    const n = +v;
    if (Number.isFinite(n)) this.followLerp = Math.max(0.01, Math.min(0.6, n));
  }
  _followTick() {
    if (!this.followCam || !this.active) {
      this._followRaf = null;
      return;
    }
    if (this._animTool && this._animTool.visible) {
      const before = this.target.clone();
      this.target.lerp(this._animTool.position, this.followLerp);
      if (this.target.distanceToSquared(before) > 1e-5) {
        this._applyCamera();
        this.render();
      }
    }
    this._followRaf = requestAnimationFrame(() => this._followTick());
  }
  _toPerspective() {
    if (!this._ortho) return;
    this._ortho = false;
    this.camera = this.persp;
    this._applyCamera();
  }
  _bindControls() {
    const THREE = this.THREE;
    const el2 = this.renderer.domElement;
    el2.style.touchAction = "none";
    el2.style.userSelect = "none";
    let mode = null, px = 0, py = 0;
    const pointers = /* @__PURE__ */ new Map();
    const onMove = (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === "pinch") {
        if (pointers.size < 2) return;
        const pts = [...pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
        this.radius = Math.max(0.5, Math.min(5e5, this._pinchRadius * (this._pinchDist / d)));
        const pdx = mx - this._pinchMid.x, pdy = my - this._pinchMid.y;
        this._pinchMid = { x: mx, y: my };
        const ps = this.radius * 15e-4;
        const r0 = new THREE.Vector3(), u0 = new THREE.Vector3();
        this.camera.matrixWorld.extractBasis(r0, u0, new THREE.Vector3());
        this.target.addScaledVector(r0, -pdx * ps);
        this.target.addScaledVector(u0, pdy * ps);
        this._applyCamera();
        this.render();
        return;
      }
      if (mode === "gizmo") {
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        const t1 = this._closestAxisT(this.raycaster.ray, this._dragStart0, this._dragDir);
        const delta = t1 - this._dragT0;
        const s = this.starts[this._dragPass] || (this.starts[this._dragPass] = { x: 0, y: 0, z: 0 });
        s.x = this._dragStart0.x + this._dragDir.x * delta;
        s.y = this._dragStart0.y + this._dragDir.y * delta;
        s.z = this._dragStart0.z + this._dragDir.z * delta;
        this._rebuild();
        this.render();
        return;
      }
      const dx = e.clientX - px, dy = e.clientY - py;
      px = e.clientX;
      py = e.clientY;
      if (mode === "rot") {
        this.theta -= dx * 0.01;
        this.phi -= dy * 0.01;
      } else if (mode === "pan") {
        const panScale = this.radius * 15e-4;
        const right = new THREE.Vector3(), up = new THREE.Vector3();
        this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
        this.target.addScaledVector(right, -dx * panScale);
        this.target.addScaledVector(up, dy * panScale);
      } else {
        return;
      }
      this._applyCamera();
      this.render();
    };
    const onUp = (e) => {
      if (e) pointers.delete(e.pointerId);
      if (mode === "pinch" && pointers.size < 2) mode = null;
      if (pointers.size > 0) return;
      if (mode === "gizmo" && typeof this.onStartChange === "function") {
        this.onStartChange(this.starts);
      }
      if (mode !== "gizmo" && this._downMarker >= 0 && e && Math.hypot(e.clientX - this._downX, e.clientY - this._downY) < 5) {
        this.selectStart(this._downMarker);
      }
      this._downMarker = -1;
      mode = null;
      try {
        if (this._pid != null) el2.releasePointerCapture(this._pid);
      } catch (_) {
      }
      this._pid = null;
      if (this.renderer) this.renderer.domElement.style.cursor = "default";
      this._setHighlight(null, null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    el2.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        this._pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        this._pinchRadius = this.radius;
        this._pinchMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        mode = "pinch";
        this._toPerspective();
        return;
      }
      if (pointers.size > 2) return;
      if (e.button === 0 && this._pickCube(e)) {
        pointers.delete(e.pointerId);
        return;
      }
      const g = e.button === 0 && !e.shiftKey ? this._pickGizmo(e) : null;
      if (g) {
        mode = "gizmo";
        this._dragPass = g.pass;
        this.selectStart(g.pass);
        this._dragDir = g.axis === "x" ? new THREE.Vector3(1, 0, 0) : g.axis === "y" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
        const s = this.starts[g.pass] || { x: 0, y: 0, z: 0 };
        this._dragStart0 = new THREE.Vector3(s.x, s.y, s.z);
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        this._dragT0 = this._closestAxisT(this.raycaster.ray, this._dragStart0, this._dragDir);
        this._setHighlight(g.pass, g.axis);
        this.renderer.domElement.style.cursor = "grabbing";
      } else {
        this._downMarker = e.button === 0 && !e.shiftKey ? this._pickMarker(e) : -1;
        this._downX = e.clientX;
        this._downY = e.clientY;
        if (e.button === 1) mode = e.shiftKey ? "rot" : "pan";
        else mode = e.button === 2 || e.shiftKey ? "pan" : "rot";
        if (mode === "rot") this._toPerspective();
      }
      px = e.clientX;
      py = e.clientY;
      if (e.pointerType !== "touch") {
        try {
          el2.setPointerCapture(e.pointerId);
          this._pid = e.pointerId;
        } catch (_) {
        }
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
    el2.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    el2.addEventListener("contextmenu", (e) => e.preventDefault());
    el2.addEventListener("mousedown", (e) => {
      if (e.button === 1) e.preventDefault();
    });
    el2.addEventListener("pointermove", (e) => {
      if (mode) return;
      const faceIdx = this._cubeFaceAt(e);
      if (faceIdx !== -2) {
        this._highlightCubeFace(faceIdx);
        el2.style.cursor = "pointer";
        this._setHighlight(null, null);
        return;
      }
      this._highlightCubeFace(-1);
      const g = this._pickGizmo(e);
      this._setHighlight(g ? g.pass : null, g ? g.axis : null);
    });
    el2.addEventListener("pointerleave", () => {
      if (!mode) {
        this._setHighlight(null, null);
        this._highlightCubeFace(-1);
      }
    });
    el2.addEventListener("wheel", (e) => {
      e.preventDefault();
      const old = this.radius;
      const next = Math.max(0.5, Math.min(5e5, old * Math.exp(e.deltaY * 2e-3)));
      this.raycaster.setFromCamera(this._ndc(e), this.camera);
      this.raycaster.params.Line.threshold = old * 0.02;
      const objs = [];
      if (this.stockMesh) objs.push(this.stockMesh);
      if (this.pathGroup) objs.push(this.pathGroup);
      const hit = objs.length ? this.raycaster.intersectObjects(objs, true)[0] : null;
      let zoomPoint = hit ? hit.point : null;
      if (!zoomPoint) {
        const THREE2 = this.THREE;
        const camDir = new THREE2.Vector3();
        this.camera.getWorldDirection(camDir);
        const plane = new THREE2.Plane(camDir, -camDir.dot(this.target));
        const p = new THREE2.Vector3();
        if (this.raycaster.ray.intersectPlane(plane, p)) zoomPoint = p;
      }
      if (zoomPoint) this.target.lerp(zoomPoint, 1 - next / old);
      this.radius = next;
      this._applyCamera();
      this.render();
    }, { passive: false });
  }
  _resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this._applyCamera();
    this.render();
  }
  // Called when the 3D tab becomes visible — the container had zero size while
  // hidden, so re-measure and re-render.
  // Re-parent the viewer's canvas into another container (used for the wizard previews).
  attach(container) {
    if (!container) return;
    const cv = this.renderer.domElement;
    container.style.position = "relative";
    cv.style.position = "absolute";
    cv.style.inset = "0";
    cv.style.zIndex = "2";
    if (this.container !== container) {
      this.container = container;
      container.appendChild(cv);
      if (this._ro) {
        this._ro.disconnect();
        this._ro.observe(container);
      }
    }
    if (this.jogPendant) container.appendChild(this.jogPendant);
    this._resize();
  }
  setActive(on) {
    this.active = on;
    if (on) {
      this._resize();
      if (this._animOn) {
        this._ensureAnimTool();
        this._animTool.visible = true;
        if (!this._animRaf) {
          this._animLast = 0;
          this._animTick();
        }
      }
    } else if (this._animRaf) {
      cancelAnimationFrame(this._animRaf);
      this._animRaf = null;
    }
  }
  render() {
    const r = this.renderer;
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this._scaleMarkers();
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
    r.render(this.scene, this.camera);
    if (this._cubeScene) {
      const size = Math.max(64, Math.min(96, w * 0.16)), m = 10;
      const sp = Math.sin(this.phi);
      this._cubeCam.position.set(sp * Math.cos(this.theta), sp * Math.sin(this.theta), Math.cos(this.phi)).multiplyScalar(3.4);
      this._cubeCam.lookAt(0, 0, 0);
      this._cubeCam.updateMatrixWorld();
      const vx = w - size - m, vy = h - size - m;
      r.setViewport(vx, vy, size, size);
      r.setScissor(vx, vy, size, size);
      r.setScissorTest(true);
      r.autoClear = false;
      r.clearDepth();
      r.render(this._cubeScene, this._cubeCam);
      r.autoClear = true;
      r.setScissorTest(false);
      r.setViewport(0, 0, w, h);
      this._cubeRect = { size, m };
    }
  }
  dispose() {
    if (this._ro) this._ro.disconnect();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
};

// ../DDCS-Studio/web/engine/virtualIO.js
var ioState = {
  /** Digital outputs — things the controller commands (e.g. solenoids, relays) */
  outputs: /* @__PURE__ */ new Map(),
  /** Digital inputs — sensor feedback lines (e.g. limit switches, proximity sensors) */
  inputs: /* @__PURE__ */ new Map()
};
var HARDWARE_PIN_MAP = {
  OUT_4: "OUT_SPINDLE_UNCLAMP",
  OUT_5: "OUT_SPINDLE_CLAMP",
  IN_4: "IN_PROBE",
  // Standard probe input
  IN_5: "IN_DRAWBAR_CLOSED",
  // Clamp sensor (Wizard default)
  IN_6: "IN_DRAWBAR_OPEN"
  // Unclamp sensor
};
function resolveVirtualPin(port, mode) {
  const key = `${mode}_${port}`;
  return HARDWARE_PIN_MAP[key] || key;
}
var M3K_TRUTH_TABLE = {
  // -----------------------------------------------------------------------
  // ATC / Spindle clamp cycle
  // -----------------------------------------------------------------------
  /** Unclamp solenoid fires → drawbar open sensor confirms */
  OUT_SPINDLE_UNCLAMP: {
    targetInput: "IN_DRAWBAR_OPEN",
    delayMs: 450,
    // [HYPOTHESIS] pneumatic travel time ~450 ms
    setState: true,
    description: "Spindle unclamp solenoid \u2192 drawbar-open proximity sensor",
    sideEffects: [
      { pin: "IN_DRAWBAR_CLOSED", state: false }
    ]
  },
  /** Unclamp solenoid turns off (single acting) → drawbar closed sensor confirms */
  OUT_SPINDLE_UNCLAMP_OFF: {
    targetInput: "IN_DRAWBAR_CLOSED",
    delayMs: 400,
    // [HYPOTHESIS] pneumatic travel time
    setState: true,
    description: "Spindle unclamp solenoid OFF \u2192 drawbar-closed proximity sensor",
    sideEffects: [
      { pin: "IN_DRAWBAR_OPEN", state: false }
    ]
  },
  /** Clamp solenoid fires → drawbar closed sensor confirms */
  OUT_SPINDLE_CLAMP: {
    targetInput: "IN_DRAWBAR_CLOSED",
    delayMs: 400,
    // [HYPOTHESIS]
    setState: true,
    description: "Spindle clamp solenoid \u2192 drawbar-closed proximity sensor",
    // Side effect: clamp also de-asserts the open sensor
    sideEffects: [
      { pin: "IN_DRAWBAR_OPEN", state: false }
    ]
  },
  // -----------------------------------------------------------------------
  // ATC magazine carousel
  // -----------------------------------------------------------------------
  /** Carousel advance command → carousel-at-position sensor */
  OUT_CAROUSEL_ADVANCE: {
    targetInput: "IN_CAROUSEL_AT_POS",
    delayMs: 600,
    // [HYPOTHESIS] motor + decel time
    setState: true,
    description: "Carousel advance \u2192 carousel-at-position proximity sensor"
  },
  /** Carousel retract (home) */
  OUT_CAROUSEL_RETRACT: {
    targetInput: "IN_CAROUSEL_AT_HOME",
    delayMs: 600,
    // [HYPOTHESIS]
    setState: true,
    description: "Carousel retract \u2192 carousel-at-home proximity sensor"
  },
  // -----------------------------------------------------------------------
  // DDCS native ATC dialect (M154/M155 drawbar · M300/M302-304 sensors · M305/306 cover)
  // Ports for these are CONFIGURED ON THE CONTROLLER (params #1120-#1199, #1250-52),
  // so the sim models them as semantic pins, not numbered ones.
  // -----------------------------------------------------------------------
  /** M154 — tool release output ON → collet opens */
  OUT_TOOL_RELEASE: {
    targetInput: "IN_TOOL_OPEN",
    // M303 waits on this
    delayMs: 450,
    setState: true,
    description: "M154 tool release \u2192 tool-open sensor",
    sideEffects: [
      { pin: "IN_TOOL_LOCKED", state: false },
      { pin: "IN_TOOL_CLOSED", state: false }
    ]
  },
  /** M155 — tool release output OFF (lock) → collet clamps */
  OUT_TOOL_RELEASE_OFF: {
    targetInput: "IN_TOOL_LOCKED",
    // M302 waits on this
    delayMs: 400,
    setState: true,
    description: "M155 tool lock \u2192 tool-locked sensor",
    sideEffects: [
      { pin: "IN_TOOL_OPEN", state: false },
      { pin: "IN_TOOL_CLOSED", state: true }
      // M304 waits on this
    ]
  },
  /** M305 — dust cover open */
  OUT_DUST_COVER: {
    targetInput: "IN_DUST_COVER_OPEN",
    delayMs: 600,
    setState: true,
    description: "M305 dust cover open \u2192 cover sensor"
  },
  /** M306 — dust cover close */
  OUT_DUST_COVER_OFF: {
    targetInput: "IN_DUST_COVER_OPEN",
    delayMs: 600,
    setState: false,
    description: "M306 dust cover close \u2192 cover sensor releases"
  },
  /** M3/M4 — spindle running → "stopped" sensor drops */
  OUT_SPINDLE: {
    targetInput: "IN_SPINDLE_STOPPED",
    delayMs: 100,
    setState: false,
    description: "Spindle start \u2192 spindle-stopped sensor clears"
  },
  /** M5 — spindle off → spins down, then the stopped sensor confirms (M300 waits on it) */
  OUT_SPINDLE_OFF: {
    targetInput: "IN_SPINDLE_STOPPED",
    delayMs: 800,
    setState: true,
    description: "Spindle stop \u2192 spindle-stopped sensor (spin-down)"
  },
  // -----------------------------------------------------------------------
  // Air blast / coolant
  // -----------------------------------------------------------------------
  /** Air-blast valve open → pressure-present sensor (near-instant) */
  OUT_AIR_BLAST: {
    targetInput: "IN_AIR_PRESSURE_OK",
    delayMs: 80,
    // [HYPOTHESIS] valve open time
    setState: true,
    description: "Air-blast valve \u2192 air-pressure-present sensor"
  },
  // -----------------------------------------------------------------------
  // Probe collision detection
  // -----------------------------------------------------------------------
  /** Probe attempted to exceed stock bounds → collision alarm flags (no delay) */
  PROBE_COLLISION: {
    targetInput: "IN_PROBE_COLLISION",
    delayMs: 0,
    // Immediate — no physical travel
    setState: true,
    description: "Probe hit stock boundary \u2192 collision alarm"
  }
};
var _pendingHandshakes = /* @__PURE__ */ new Set();
function resetVirtualIO() {
  for (const id of _pendingHandshakes) clearTimeout(id);
  _pendingHandshakes.clear();
  ioState.outputs.clear();
  ioState.inputs.clear();
  console.log("[VIRTUAL IO] State reset \u2014 all pins cleared.");
}
function setVirtualOutput(pin, value) {
  const prev = ioState.outputs.get(pin);
  ioState.outputs.set(pin, value);
  if (prev !== value) {
    console.log(`[VIRTUAL IO] Output ${pin}: ${prev ?? "undefined"} \u2192 ${value}`);
  }
  triggerVirtualHandshake(pin, value);
}
function getVirtualInput(pin) {
  return ioState.inputs.get(pin) ?? false;
}
function injectVirtualInput(pin, state) {
  ioState.inputs.set(pin, state);
  console.log(`[VIRTUAL IO] Injected input ${pin} = ${state}`);
  _dispatchIoChange(pin, state);
}
function triggerVirtualHandshake(outputPin, state = true) {
  const stateRuleKey = `${outputPin}_${state ? "ON" : "OFF"}`;
  const rule = M3K_TRUTH_TABLE[stateRuleKey] || (state === true ? M3K_TRUTH_TABLE[outputPin] : null);
  if (!rule) {
    return;
  }
  console.log(
    `[VIRTUAL IO] Output ${outputPin} (${state ? "ON" : "OFF"}). Simulating ${rule.description} with ${rule.delayMs} ms delay\u2026`
  );
  const id = setTimeout(() => {
    _pendingHandshakes.delete(id);
    ioState.inputs.set(rule.targetInput, rule.setState);
    console.log(`[VIRTUAL IO] Input ${rule.targetInput} \u2192 ${rule.setState} (handshake complete)`);
    _dispatchIoChange(rule.targetInput, rule.setState);
    if (rule.sideEffects) {
      for (const fx of rule.sideEffects) {
        ioState.inputs.set(fx.pin, fx.state);
        console.log(`[VIRTUAL IO] Side-effect: input ${fx.pin} \u2192 ${fx.state}`);
        _dispatchIoChange(fx.pin, fx.state);
      }
    }
  }, rule.delayMs);
  _pendingHandshakes.add(id);
}
function triggerProbeCollision() {
  const pin = "IN_PROBE_COLLISION";
  ioState.inputs.set(pin, true);
  console.log(`[VIRTUAL IO] Probe collision detected \u2014 alarm ${pin} asserted`);
  _dispatchIoChange(pin, true);
}
function _dispatchIoChange(pin, state) {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(
      new CustomEvent("io_change", {
        detail: { pin, state },
        bubbles: false,
        cancelable: false
      })
    );
  }
}
if (typeof window !== "undefined") {
  window.virtualIO = {
    setOutput: setVirtualOutput,
    getInput: getVirtualInput,
    injectInput: injectVirtualInput,
    reset: resetVirtualIO,
    dumpState() {
      console.group("[VIRTUAL IO] Current state");
      console.log("Outputs:", Object.fromEntries(ioState.outputs));
      console.log("Inputs: ", Object.fromEntries(ioState.inputs));
      console.groupEnd();
    },
    truthTable: M3K_TRUTH_TABLE
  };
}

// ../DDCS-Studio/web/engine/core/tokenizer.js
function tokenizeWords(line) {
  const words = [];
  let i = 0;
  const n = line.length;
  const isLetter = (c2) => c2 >= "A" && c2 <= "Z" || c2 >= "a" && c2 <= "z";
  while (i < n) {
    const ch = line[i];
    if (isLetter(ch)) {
      const letter = ch.toUpperCase();
      i += 1;
      let value = "";
      while (i < n && !isLetter(line[i])) {
        value += line[i];
        i += 1;
      }
      words.push({ letter, value: value.trim() });
    } else {
      i += 1;
    }
  }
  return words;
}

// ../DDCS-Studio/web/engine/core/expression.js
var MACRO_FUNCTIONS = {
  ABS: Math.abs,
  SQRT: Math.sqrt,
  ROUND: Math.round,
  FIX: Math.floor,
  FUP: Math.ceil,
  LN: Math.log,
  EXP: Math.exp,
  SIN: (d) => Math.sin(d * Math.PI / 180),
  COS: (d) => Math.cos(d * Math.PI / 180),
  TAN: (d) => Math.tan(d * Math.PI / 180),
  ASIN: (v) => Math.asin(v) * 180 / Math.PI,
  ACOS: (v) => Math.acos(v) * 180 / Math.PI,
  ATAN: (v) => Math.atan(v) * 180 / Math.PI
};
function lex(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c2 = s[i];
    if (c2 === " " || c2 === "	") {
      i += 1;
      continue;
    }
    if (c2 >= "0" && c2 <= "9" || c2 === ".") {
      let num2 = "";
      while (i < s.length && (s[i] >= "0" && s[i] <= "9" || s[i] === ".")) {
        num2 += s[i];
        i += 1;
      }
      if (num2 === "." || num2.length === 0) return null;
      toks.push(Number.parseFloat(num2));
      continue;
    }
    if (c2 === "#" || c2 === "[" || c2 === "]" || c2 === "+" || c2 === "-" || c2 === "*" || c2 === "/") {
      toks.push(c2);
      i += 1;
      continue;
    }
    if (c2 >= "A" && c2 <= "Z" || c2 >= "a" && c2 <= "z") {
      let name = "";
      while (i < s.length && /[A-Za-z]/.test(s[i])) {
        name += s[i];
        i += 1;
      }
      toks.push({ fn: name.toUpperCase() });
      continue;
    }
    return null;
  }
  return toks;
}
function evalExpr(str, vars, opts = {}) {
  const unsetValue = opts.unsetValue === void 0 ? null : opts.unsetValue;
  if (str == null) return null;
  const s = String(str).trim();
  if (s === "") return null;
  const toks = lex(s);
  if (toks === null) return null;
  let p = 0;
  const peek = () => toks[p];
  function parseExpr() {
    let v = parseTerm();
    while (v !== null && (peek() === "+" || peek() === "-")) {
      const op = toks[p++];
      const r = parseTerm();
      if (r === null) return null;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    while (v !== null && (peek() === "*" || peek() === "/")) {
      const op = toks[p++];
      const r = parseFactor();
      if (r === null) return null;
      v = op === "*" ? v * r : r !== 0 ? v / r : null;
    }
    return v;
  }
  function parseFactor() {
    const t = peek();
    if (t === "+") {
      p += 1;
      return parseFactor();
    }
    if (t === "-") {
      p += 1;
      const f = parseFactor();
      return f === null ? null : -f;
    }
    if (t === "[") {
      p += 1;
      const v = parseExpr();
      if (peek() === "]") p += 1;
      return v;
    }
    if (t && typeof t === "object" && t.fn) {
      const fn = MACRO_FUNCTIONS[t.fn];
      if (!fn) return null;
      p += 1;
      if (peek() !== "[") return null;
      p += 1;
      const arg = parseExpr();
      if (peek() === "]") p += 1;
      if (arg === null) return null;
      return fn(arg);
    }
    if (t === "#") {
      p += 1;
      let idx;
      if (peek() === "[") {
        p += 1;
        idx = parseExpr();
        if (peek() === "]") p += 1;
      } else if (typeof peek() === "number") {
        idx = toks[p++];
      } else {
        return null;
      }
      if (idx == null || !Number.isFinite(idx)) return null;
      const v = vars.get(Math.round(idx));
      return v === void 0 || v === null ? unsetValue : v;
    }
    if (typeof t === "number") {
      p += 1;
      return t;
    }
    return null;
  }
  return parseExpr();
}
function validateExpression(str) {
  if (str == null) return false;
  const s = String(str).trim();
  if (s === "") return false;
  const dummy = { get: () => 1 };
  return evalExpr(s, dummy, { unsetValue: 1 }) !== null;
}

// ../DDCS-Studio/web/engine/core/condition.js
var COMPARATOR_RE = /^(.*?)(==|!=|<=|>=|<|>)(.*)$/;
function normalizeCondition(expr) {
  if (expr == null) return "";
  return String(expr).trim().replace(/\bEQ\b/gi, "==").replace(/\bNE\b/gi, "!=").replace(/\bGT\b/gi, ">").replace(/\bLT\b/gi, "<").replace(/\bGE\b/gi, ">=").replace(/\bLE\b/gi, "<=").replace(/\b<>\b/g, "!=").replace(/(?<![<>!=])=(?![<>!=])/g, "==");
}
function evaluateCondition(expr, vars, opts = {}) {
  const normalized = normalizeCondition(expr);
  const match = normalized.match(COMPARATOR_RE);
  if (!match) return false;
  const left = evalExpr(match[1].trim(), vars, opts);
  const op = match[2];
  const right = evalExpr(match[3].trim(), vars, opts);
  if (left == null || right == null) return false;
  switch (op) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "<=":
      return left <= right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case ">":
      return left > right;
    default:
      return false;
  }
}
function validateCondition(expr) {
  if (expr == null) return false;
  const normalized = normalizeCondition(expr);
  const match = normalized.match(COMPARATOR_RE);
  if (!match) return false;
  return validateExpression(match[1].trim()) && validateExpression(match[3].trim());
}

// ../DDCS-Studio/web/engine/core/program.js
function stripLine(raw) {
  let s = String(raw), prev;
  do {
    prev = s;
    s = s.replace(/\([^()]*\)/g, " ");
  } while (s !== prev);
  return s.replace(/;.*$/, " ").trim();
}
function loadProgram(text, opts = {}) {
  const { keepEmpty = false, repositionMarkers = false } = opts;
  const lines = String(text || "").split(/\r?\n/);
  const program = [];
  const labels = /* @__PURE__ */ new Map();
  lines.forEach((raw, lineIndex) => {
    if (repositionMarkers && /reposition:/i.test(raw)) {
      program.push({ type: "reposition", raw, lineIndex });
      return;
    }
    const stripped = stripLine(raw);
    if (!stripped && !keepEmpty) return;
    const tokens = tokenizeWords(stripped);
    const labelToken = tokens.find((t) => t.letter === "N" && t.value != null);
    const label = labelToken ? Number.parseInt(labelToken.value, 10) : null;
    if (label != null && Number.isFinite(label)) {
      labels.set(label, program.length);
    }
    program.push({ raw, stripped, tokens, label, lineIndex });
  });
  return { program, labels, totalLines: lines.length };
}

// ../DDCS-Studio/web/engine/core/arc.js
function arcPoints(start, end, off, motion, plane, scale = 1) {
  let a, b2, lin;
  if (plane === 18) {
    a = "x";
    b2 = "z";
    lin = "y";
  } else if (plane === 19) {
    a = "y";
    b2 = "z";
    lin = "x";
  } else {
    a = "x";
    b2 = "y";
    lin = "z";
  }
  const sa = start[a], sb = start[b2], ea = end[a], eb = end[b2];
  const sLin = start[lin], eLin = end[lin];
  const offFor = (axis) => axis === "x" ? off.I : axis === "y" ? off.J : off.K;
  let cx, cy;
  if (offFor(a) != null || offFor(b2) != null) {
    cx = sa + (offFor(a) || 0) * scale;
    cy = sb + (offFor(b2) || 0) * scale;
  } else if (off.R != null) {
    const R = off.R * scale;
    const mx = (sa + ea) / 2, my = (sb + eb) / 2;
    const dx = ea - sa, dy = eb - sb;
    const d = Math.hypot(dx, dy);
    if (d === 0 || Math.abs(R) < d / 2 - 1e-6) return [start, end];
    const h = Math.sqrt(Math.max(0, R * R - d * d / 4));
    const ux = -dy / d, uy = dx / d;
    const sign = (motion === 2 ? -1 : 1) * (R >= 0 ? 1 : -1);
    cx = mx + sign * h * ux;
    cy = my + sign * h * uy;
  } else {
    return [start, end];
  }
  const r = Math.hypot(sa - cx, sb - cy);
  let a0 = Math.atan2(sb - cy, sa - cx);
  let a1 = Math.atan2(eb - cy, ea - cx);
  if (motion === 3) {
    if (a1 <= a0) a1 += Math.PI * 2;
  } else {
    if (a1 >= a0) a1 -= Math.PI * 2;
  }
  let sweep = a1 - a0;
  if (Math.abs(sweep) < 1e-9) sweep = (motion === 3 ? 1 : -1) * Math.PI * 2;
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 36)));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = a0 + sweep * t;
    const p = { x: 0, y: 0, z: 0 };
    p[a] = cx + r * Math.cos(ang);
    p[b2] = cy + r * Math.sin(ang);
    p[lin] = sLin + (eLin - sLin) * t;
    pts.push(p);
  }
  return pts;
}

// ../DDCS-Studio/web/engine/GcodeExecutionEngine.js
var GcodeExecutionEngine = class _GcodeExecutionEngine {
  constructor({ stepDelay = 250, onLineChange = null, onStatus = null, onFinish = null, onPositionChange = null, onWait = null, stock = null, stockOffset = null, wcsOffset = null, syntaxValidator = null, createVarStore = null, autoAnswer = true, autoAnswerMs = 800, simSpeed = 1, rapidRate = 6e3 } = {}) {
    this.stepDelay = Number.isFinite(stepDelay) ? stepDelay : 250;
    this.simSpeed = Number.isFinite(simSpeed) && simSpeed > 0 ? simSpeed : 1;
    this.rapidRate = Number.isFinite(rapidRate) && rapidRate > 0 ? rapidRate : 6e3;
    this.createVarStore = typeof createVarStore === "function" ? createVarStore : () => /* @__PURE__ */ new Map();
    this.onLineChange = onLineChange;
    this.onStatus = onStatus;
    this.onFinish = onFinish;
    this.onPositionChange = onPositionChange;
    this.onWait = onWait;
    this.stock = stock || null;
    this._stockOffset = stockOffset || { x: 0, y: 0, z: 0 };
    this._wcsOffset = wcsOffset || { x: 0, y: 0, z: 0 };
    this.syntaxValidator = typeof syntaxValidator === "function" ? syntaxValidator : null;
    this.autoAnswer = autoAnswer !== false;
    this.autoAnswerMs = Number.isFinite(autoAnswerMs) ? autoAnswerMs : 800;
    this._autoTimers = /* @__PURE__ */ new Map();
    this.resetState();
  }
  verifySyntax(text) {
    if (this.syntaxValidator) {
      return this.syntaxValidator(text);
    }
    return _GcodeExecutionEngine.defaultSyntaxVerify(text);
  }
  static defaultSyntaxVerify(text) {
    const errors = [];
    const lines = String(text || "").split(/\r?\n/);
    const reportError = (lineIndex, message) => {
      errors.push({ lineIndex, line: lines[lineIndex], message });
    };
    lines.forEach((raw, lineIndex) => {
      const trimmedRaw = raw.trim();
      const stripped = stripLine(raw);
      if (!stripped) return;
      const ifMatch = stripped.match(/^IF\s+(.+?)\s+GOTO\s*(\d+)$/i);
      if (ifMatch) {
        const condition = ifMatch[1].trim();
        if (!condition) {
          reportError(lineIndex, "Empty IF condition");
        } else if (!validateCondition(condition)) {
          reportError(lineIndex, "Invalid IF condition syntax");
        }
        return;
      }
      const gotoMatch = stripped.match(/^GOTO\s*(\d+)$/i);
      if (gotoMatch) {
        return;
      }
      if (/^(M30|M02|M2|M99)\b/i.test(stripped)) {
        return;
      }
      if (/^#/.test(stripped)) {
        const assignMatch = stripped.match(/^#(\[.*?\]|\d+)\s*=\s*(.+)$/);
        if (!assignMatch) {
          reportError(lineIndex, "Invalid macro assignment");
          return;
        }
        const lhs = assignMatch[1].trim();
        const rhs = assignMatch[2].trim();
        const indexExpr = lhs.startsWith("[") ? lhs.slice(1, -1) : lhs;
        if (!validateExpression(indexExpr)) {
          reportError(lineIndex, "Invalid assignment target");
        }
        if (!validateExpression(rhs)) {
          reportError(lineIndex, "Invalid assignment expression");
        }
        return;
      }
      const words = tokenizeWords(stripped);
      if (words.length === 0) {
        reportError(lineIndex, "Unrecognizable G-code line");
        return;
      }
      for (const word of words) {
        if (word.letter === "G") {
          const value = Number.parseFloat(word.value);
          if (!Number.isFinite(value)) {
            reportError(lineIndex, `Invalid G-code word value: ${word.value}`);
          }
        } else if (word.letter !== "N") {
          if (!validateExpression(word.value)) {
            reportError(lineIndex, `Invalid expression for ${word.letter}`);
          }
        }
      }
    });
    return { valid: errors.length === 0, errors };
  }
  resetState() {
    resetVirtualIO();
    this._clearAutoTimers();
    this.vars = this.createVarStore();
    this.pos = { x: 0, y: 0, z: 0 };
    this.absolute = true;
    this.unitScale = 1;
    this.motion = 0;
    this.feedVal = 0;
    this.plane = 17;
    this.program = [];
    this.labels = /* @__PURE__ */ new Map();
    this.ip = 0;
    this.currentLineIndex = null;
    this.running = false;
    this.paused = false;
    this._waitPin = null;
    this._move = null;
    this._probeArmed = false;
    this._traceSink = null;
    this.timer = null;
    this.stats = {
      feed: 0,
      rapid: 0,
      probe: 0,
      skipped: 0,
      steps: 0
    };
    this.totalLines = 0;
    this._started = false;
  }
  loadProgram(text) {
    const { program, labels, totalLines } = loadProgram(text, { keepEmpty: true });
    this.program = program;
    this.labels = labels;
    this.totalLines = totalLines;
  }
  run(text) {
    this.stop();
    this.resetState();
    this.loadProgram(text);
    if (this.program.length === 0) {
      this._setStatus("No program loaded", false);
      this._finish();
      return;
    }
    this.running = true;
    this._setStatus("Starting execution", true);
    this._scheduleTick();
  }
  /**
   * Synchronous "trace" pass — run the whole program to completion (probes auto-detect, input waits
   * auto-clear, no delays) and return the EXACT path the engine takes: { segments, bounds, stats }.
   * The preview's drawn route comes from this, so it can never disagree with the played tool — both go
   * through _executeStep with the same vars + control flow. Arcs are linearized; loops that never resolve
   * are bounded by a step cap (stats.capped). Leaves the engine reset (ready for a subsequent run()).
   */
  trace(text) {
    this.stop();
    this.resetState();
    this.loadProgram(text);
    const cb = { line: this.onLineChange, pos: this.onPositionChange, status: this.onStatus, wait: this.onWait };
    this.onLineChange = null;
    this.onPositionChange = null;
    this.onStatus = null;
    this.onWait = null;
    const sink = [];
    this._traceSink = sink;
    this.running = true;
    const cap = Math.max(this.program.length * 50, 5e3);
    let guard = 0;
    try {
      while (this.ip >= 0 && this.ip < this.program.length && guard++ < cap) {
        const done = this._executeStep(this.program[this.ip]);
        if (done) break;
      }
    } finally {
      this.running = false;
      this._traceSink = null;
      this.onLineChange = cb.line;
      this.onPositionChange = cb.pos;
      this.onStatus = cb.status;
      this.onWait = cb.wait;
    }
    return this._buildTraceResult(sink, guard >= cap);
  }
  _buildTraceResult(segments, capped) {
    const b2 = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
    let feed = 0, rapid = 0, probe = 0;
    for (const s of segments) {
      b2.minX = Math.min(b2.minX, s.x1, s.x2);
      b2.maxX = Math.max(b2.maxX, s.x1, s.x2);
      b2.minY = Math.min(b2.minY, s.y1, s.y2);
      b2.maxY = Math.max(b2.maxY, s.y1, s.y2);
      b2.minZ = Math.min(b2.minZ, s.z1, s.z2);
      b2.maxZ = Math.max(b2.maxZ, s.z1, s.z2);
      if (s.probe) probe += 1;
      else if (s.rapid) rapid += 1;
      else feed += 1;
    }
    return {
      segments,
      bounds: segments.length ? b2 : null,
      stats: { feed, rapid, probe, retract: 0, passes: 1, skipped: this.stats.skipped, drawable: segments.length > 0, capped: !!capped }
    };
  }
  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._clearAutoTimers();
    this.running = false;
    this.paused = false;
    this._move = null;
    this._setWaitPin(null);
    this._setStatus("Execution stopped", false);
  }
  // Execute exactly one step. Starts (paused) from the top if no run is in
  // progress; pauses a continuous run in place otherwise. A move in flight
  // completes instantly — one step = one whole line.
  step(text) {
    if (!this.running) {
      this.resetState();
      this.loadProgram(text);
      if (this.program.length === 0) {
        this._setStatus("No program loaded", false);
        this._finish();
        return;
      }
      this.running = true;
    }
    this.paused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this._move) {
      this._finishMove();
      return;
    }
    this._tick();
  }
  // Resume continuous execution after a pause/step.
  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    if (this._move) this._move.last = null;
    this._setStatus("Resuming execution", true);
    this._scheduleTick();
  }
  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this._move) this._move.last = null;
    this._setStatus("Paused", true);
  }
  _scheduleTick() {
    if (!this.running || this.paused) return;
    this.timer = setTimeout(() => this._tick(), this._nextDelayMs != null ? this._nextDelayMs : this.stepDelay);
  }
  _tick() {
    if (!this.running) return;
    this._nextDelayMs = 8;
    if (this._move) {
      this._advanceMove();
      if (this.running && !this.paused) this._scheduleTick();
      return;
    }
    if (this.ip >= this.program.length) {
      this._finish();
      return;
    }
    const step = this.program[this.ip];
    this._setCurrentLine(step.lineIndex);
    const done = this._executeStep(step);
    if (done) {
      this._finish();
      return;
    }
    if (this.running && !this.paused) {
      this._scheduleTick();
    }
  }
  _setCurrentLine(lineIndex) {
    if (this.currentLineIndex !== lineIndex) {
      this.currentLineIndex = lineIndex;
      if (typeof this.onLineChange === "function") {
        this.onLineChange({ lineIndex, ip: this.ip, raw: this.program[this.ip].raw });
      }
    }
    this._setStatus(`Running line ${lineIndex + 1}/${this.totalLines}`, true);
  }
  _setStatus(message, running = this.running) {
    if (typeof this.onStatus === "function") {
      this.onStatus({ message, running, stats: { ...this.stats } });
    }
  }
  _finish() {
    this.running = false;
    this.paused = false;
    this._move = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._clearAutoTimers();
    this._setWaitPin(null);
    this._setStatus("Execution complete", false);
    if (typeof this.onFinish === "function") {
      this.onFinish({ stats: { ...this.stats } });
    }
  }
  // Advance the in-flight timed move by the wall-clock elapsed since the last tick,
  // scaled by simSpeed (changing speed mid-move takes effect immediately).
  _advanceMove() {
    const mv = this._move;
    if (!mv) return;
    const now = Date.now();
    const dt = mv.last == null ? 0 : Math.min(250, now - mv.last);
    mv.last = now;
    mv.elapsed += dt * (this.simSpeed > 0 ? this.simSpeed : 1);
    const t = mv.durMs > 0 ? Math.min(1, mv.elapsed / mv.durMs) : 1;
    if (t >= 1) {
      this._finishMove();
      return;
    }
    if (typeof this.onPositionChange === "function") {
      this.onPositionChange({
        x: mv.from.x + (mv.to.x - mv.from.x) * t,
        y: mv.from.y + (mv.to.y - mv.from.y) * t,
        z: mv.from.z + (mv.to.z - mv.from.z) * t
      });
    }
    this._nextDelayMs = 16;
  }
  // Land the in-flight move: snap to the target, fire any deferred probe touch.
  _finishMove() {
    const mv = this._move;
    if (!mv) return;
    this._move = null;
    this.pos = { ...mv.to };
    if (typeof this.onPositionChange === "function") {
      this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    }
    if (mv.touchName) this._touchPulse(mv.touchName);
  }
  // Pulse a probe input ON briefly so the I/O panel shows the touch.
  _touchPulse(pinName) {
    injectVirtualInput(pinName, true);
    setTimeout(() => injectVirtualInput(pinName, false), 400);
  }
  // Slab ray/segment-vs-AABB. Returns the entry/exit params along A→B (0..1 spans the move).
  // Identical to gcodeViz3d._boxRange so the engine's probe collision matches what the 3D view draws.
  _rayBox(A, B, min, max) {
    const d = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
    let tEnter = -Infinity, tExit = Infinity;
    for (const ax of ["x", "y", "z"]) {
      if (Math.abs(d[ax]) < 1e-9) {
        if (A[ax] < min[ax] - 1e-6 || A[ax] > max[ax] + 1e-6) return { hit: false };
      } else {
        let t1 = (min[ax] - A[ax]) / d[ax], t2 = (max[ax] - A[ax]) / d[ax];
        if (t1 > t2) {
          const t = t1;
          t1 = t2;
          t2 = t;
        }
        if (t1 > tEnter) tEnter = t1;
        if (t2 < tExit) tExit = t2;
      }
    }
    return { hit: tEnter <= tExit, tEnter, tExit };
  }
  // Track the input pin execution is parked on (null = not waiting) and notify the UI.
  _setWaitPin(wait) {
    const prev = this._waitPin;
    if (!prev && !wait) return;
    if (prev && wait && prev.pinName === wait.pinName && prev.target === wait.target) return;
    this._waitPin = wait;
    if (typeof this.onWait === "function") this.onWait(wait);
  }
  // Virtual sensor: answer a waited input after autoAnswerMs unless something else
  // (the truth table, or a manual click) already satisfied it. One timer per pin.
  _scheduleAutoAnswer(pinName, targetState) {
    if (this._autoTimers.has(pinName)) return;
    const id = setTimeout(() => {
      this._autoTimers.delete(pinName);
      if (!this.running) return;
      if (getVirtualInput(pinName) === targetState) return;
      injectVirtualInput(pinName, targetState);
      this._setStatus(`${pinName} auto-answered (virtual sensor)`, true);
    }, this.autoAnswerMs);
    this._autoTimers.set(pinName, id);
  }
  _clearAutoTimers() {
    if (!this._autoTimers) return;
    for (const id of this._autoTimers.values()) clearTimeout(id);
    this._autoTimers.clear();
  }
  _executeStep(step) {
    const line = step.stripped;
    this.stats.steps += 1;
    if (!line) {
      this.ip += 1;
      return false;
    }
    if (/^\s*[();]/.test(step.raw.trim())) {
      this.ip += 1;
      return false;
    }
    const ifMatch = line.match(/^IF\s+(.+?)\s+GOTO\s*(\d+)$/i);
    if (ifMatch) {
      const conditionText = ifMatch[1].trim().replace(/^\[|\]$/g, "");
      const targetLabel = Number.parseInt(ifMatch[2], 10);
      if (this._evaluateCondition(conditionText) && this.labels.has(targetLabel)) {
        this.ip = this.labels.get(targetLabel);
        return false;
      }
      this.ip += 1;
      return false;
    }
    const gotoMatch = line.match(/^GOTO\s*(\d+)$/i);
    if (gotoMatch) {
      const targetLabel = Number.parseInt(gotoMatch[1], 10);
      if (this.labels.has(targetLabel)) {
        this.ip = this.labels.get(targetLabel);
        return false;
      }
      this.ip += 1;
      return false;
    }
    if (/^(M30|M02|M2|M99)\b/i.test(line)) {
      return true;
    }
    if (this._handleModbus(line)) {
      this.ip += 1;
      return false;
    }
    if (/^#/.test(line)) {
      this._handleAssignment(line);
      this.ip += 1;
      return false;
    }
    const words = tokenizeWords(line);
    if (words.length === 0) {
      this.ip += 1;
      return false;
    }
    if (words.every((w) => w.letter === "N")) {
      this.ip += 1;
      return false;
    }
    const wm = {};
    const gcodes = [];
    const mcodes = [];
    for (const word of words) {
      if (word.letter === "G") {
        const value = Number.parseFloat(word.value);
        if (Number.isFinite(value)) gcodes.push(value);
      } else if (word.letter === "M") {
        const value = Number.parseFloat(word.value);
        if (Number.isFinite(value)) mcodes.push(value);
      } else if (word.letter !== "N") {
        wm[word.letter] = this._evaluateExpression(word.value);
      }
    }
    const waitForInput = (m, pin, pinName, target2) => {
      if (getVirtualInput(pinName) === target2) {
        this._setStatus(`M${m} ${pinName} is ${target2 ? "ON" : "OFF"} (cleared)`, true);
        return false;
      }
      if (this._traceSink) {
        injectVirtualInput(pinName, target2);
        return false;
      }
      this._setStatus(`M${m} waiting for ${pinName} to be ${target2 ? "ON" : "OFF"}...`, true);
      this._setWaitPin({ pin, pinName, target: target2 });
      if (this.autoAnswer) this._scheduleAutoAnswer(pinName, target2);
      return true;
    };
    const ATC_WAITS = {
      300: ["IN_SPINDLE_STOPPED", true],
      // M300 wait spindle stopped
      302: ["IN_TOOL_LOCKED", true],
      // M302 wait tool locked
      303: ["IN_TOOL_OPEN", true],
      // M303 wait tool open (collet released)
      304: ["IN_TOOL_CLOSED", true]
      // M304 wait tool closed
    };
    let waiting = false;
    for (const m of mcodes) {
      if (m === 6) {
        if (wm.T != null && Number.isFinite(wm.T)) {
          this.vars.set(1504, Math.round(wm.T));
          this.vars.set(1300, Math.round(wm.T));
          this._setStatus(`M6 \u2192 target tool #1504 = ${Math.round(wm.T)}`, true);
        }
      } else if (m === 3 || m === 4) {
        setVirtualOutput("OUT_SPINDLE", true);
      } else if (m === 5) {
        setVirtualOutput("OUT_SPINDLE", false);
      } else if (m === 154 || m === 155) {
        setVirtualOutput("OUT_TOOL_RELEASE", m === 154);
        this._setStatus(`M${m} \u2192 drawbar ${m === 154 ? "RELEASE" : "LOCK"}`, true);
      } else if (m === 305 || m === 306) {
        setVirtualOutput("OUT_DUST_COVER", m === 305);
        this._setStatus(`M${m} \u2192 dust cover ${m === 305 ? "OPEN" : "CLOSE"}`, true);
      } else if (ATC_WAITS[m]) {
        const [pinName, target2] = ATC_WAITS[m];
        if (waitForInput(m, null, pinName, target2)) waiting = true;
      } else if (m === 10 || m === 11) {
        if (wm.P != null) {
          const pinName = resolveVirtualPin(wm.P, "OUT");
          setVirtualOutput(pinName, m === 10);
          this._setStatus(`M${m} \u2192 ${pinName} = ${m === 10 ? "ON" : "OFF"}`, true);
        }
      } else if (m === 31 || m === 33) {
        if (wm.P != null) {
          if (waitForInput(m, wm.P, resolveVirtualPin(wm.P, "IN"), m === 31)) waiting = true;
        }
      } else if (m === 101 || m === 102) {
        this._probeArmed = m === 101;
      }
    }
    if (waiting) {
      this._nextDelayMs = 50;
      return false;
    }
    this._setWaitPin(null);
    if (gcodes.includes(4) && wm.P != null && Number.isFinite(wm.P) && wm.P > 0) {
      const ms = wm.P / (this.simSpeed > 0 ? this.simSpeed : 1);
      this._nextDelayMs = Math.max(8, Math.min(1e4, ms));
      this._setStatus(`G4 dwell ${wm.P} ms`, true);
      this.ip += 1;
      return false;
    }
    for (const g of gcodes) {
      if (g === 20) this.unitScale = 25.4;
      else if (g === 21) this.unitScale = 1;
      else if (g === 90) this.absolute = true;
      else if (g === 91) this.absolute = false;
      else if (g === 17) this.plane = 17;
      else if (g === 18) this.plane = 18;
      else if (g === 19) this.plane = 19;
      else if ([0, 1, 2, 3].includes(g)) this.motion = g;
    }
    if (wm.F != null && Number.isFinite(wm.F)) {
      this.feedVal = wm.F;
    }
    const hasAxis = wm.X != null || wm.Y != null || wm.Z != null;
    const hasArcArg = wm.I != null || wm.J != null || wm.K != null || wm.R != null;
    if (!hasAxis && !hasArcArg) {
      this.ip += 1;
      return false;
    }
    const g53 = gcodes.includes(53);
    const target = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    let bad = false;
    const setAxis = (key, field2) => {
      if (wm[key] == null) return;
      const value = wm[key];
      if (!Number.isFinite(value)) {
        bad = true;
        return;
      }
      target[field2] = g53 ? value * this.unitScale - (this._wcsOffset[field2] || 0) : this.absolute ? value * this.unitScale : this.pos[field2] + value * this.unitScale;
    };
    setAxis("X", "x");
    setAxis("Y", "y");
    setAxis("Z", "z");
    if (bad) {
      this.stats.skipped += 1;
      this.ip += 1;
      return false;
    }
    const isProbe = gcodes.includes(31) || this._probeArmed;
    const effMotion = isProbe ? 1 : this.motion;
    if (effMotion === 0 || effMotion === 1) {
      let touchName = null;
      if (isProbe) {
        this.stats.probe += 1;
        const PROBE_STATUS_VAR = { x: 1920, y: 1921, z: 1922 };
        const scannedAxes = [];
        if (wm.X != null) scannedAxes.push("x");
        if (wm.Y != null) scannedAxes.push("y");
        if (wm.Z != null) scannedAxes.push("z");
        for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 1);
        const probePort = wm.P;
        const probes = typeof window !== "undefined" && window.ddcsGetSettings ? window.ddcsGetSettings().probes : null;
        let boxMin = null;
        let boxMax = null;
        let cavMin = null, cavMax = null;
        if (probes && probePort === probes.setterPin) {
          boxMin = { x: probes.setterX - probes.setterW / 2, y: probes.setterY - probes.setterH / 2, z: probes.setterZ - 0.01 };
          boxMax = { x: probes.setterX + probes.setterW / 2, y: probes.setterY + probes.setterH / 2, z: probes.setterZ + 0.01 };
        } else if (this.stock && (this.stock.x > 0 || this.stock.y > 0 || this.stock.z > 0)) {
          boxMin = { x: 0, y: 0, z: -this.stock.z };
          boxMax = { x: this.stock.x, y: this.stock.y, z: 0 };
          if (this.stock.shape === "pocket") {
            const w = Math.max(8, Math.min(this.stock.x, this.stock.y) * 0.25);
            cavMin = { x: w, y: w, z: -this.stock.z };
            cavMax = { x: this.stock.x - w, y: this.stock.y - w, z: 0 };
          }
        }
        const O = this._stockOffset || { x: 0, y: 0, z: 0 };
        if (boxMin && boxMax) {
          const aStart = { x: O.x + this.pos.x, y: O.y + this.pos.y, z: O.z + this.pos.z };
          const bEnd = { x: O.x + target.x, y: O.y + target.y, z: O.z + target.z };
          const dir = { x: target.x - this.pos.x, y: target.y - this.pos.y, z: target.z - this.pos.z };
          let tt = null;
          const consider = (t) => {
            if (t != null && t > 1e-6 && t <= 1 && (tt == null || t < tt)) tt = t;
          };
          const ro = this._rayBox(aStart, bEnd, boxMin, boxMax);
          if (ro.hit) {
            if (ro.tEnter > 1e-6) consider(ro.tEnter);
            else if (ro.tExit > 1e-6 && ro.tExit <= 1) consider(ro.tExit);
          }
          if (cavMin && cavMax) {
            const rc = this._rayBox(aStart, bEnd, cavMin, cavMax);
            if (rc.hit && rc.tEnter <= 1e-6 && rc.tExit > 1e-6) consider(rc.tExit);
          }
          if (tt != null) {
            target.x = this.pos.x + dir.x * tt;
            target.y = this.pos.y + dir.y * tt;
            target.z = this.pos.z + dir.z * tt;
            triggerProbeCollision();
            const touchPin = Number.isFinite(probePort) ? probePort : probes ? probes.probePin : null;
            if (touchPin != null && Number.isFinite(touchPin)) {
              touchName = resolveVirtualPin(touchPin, "IN");
            }
            for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 2);
            this.vars.set(1925, O.x + target.x);
            this.vars.set(1926, O.y + target.y);
            this.vars.set(1927, O.z + target.z);
          }
        }
        if (this._traceSink) {
          for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 2);
          this.vars.set(1925, O.x + target.x);
          this.vars.set(1926, O.y + target.y);
          this.vars.set(1927, O.z + target.z);
        }
      } else if (effMotion === 0) {
        this.stats.feed += 1;
      }
      const rapid = effMotion === 0 && !isProbe;
      if (this._traceSink) {
        this._traceSink.push({
          x1: this.pos.x,
          y1: this.pos.y,
          z1: this.pos.z,
          x2: target.x,
          y2: target.y,
          z2: target.z,
          rapid,
          probe: isProbe,
          type: isProbe ? "probe" : rapid ? "rapid" : "feed",
          feed: this.feedVal,
          line: step.lineIndex
          // source line → lets the preview seek the tool to a clicked code line
        });
        this.pos = target;
        this.ip += 1;
        return false;
      }
      {
        const d = Math.hypot(target.x - this.pos.x, target.y - this.pos.y, target.z - this.pos.z);
        const rate = rapid ? this.rapidRate : this.feedVal > 0 ? this.feedVal : 600;
        const realMs = rate > 0 ? d / rate * 6e4 : 0;
        const speed = this.simSpeed > 0 ? this.simSpeed : 1;
        if (realMs / speed > 50) {
          this._move = { from: { ...this.pos }, to: target, durMs: realMs, elapsed: 0, last: null, touchName };
          const kind = isProbe ? "G31 probe" : rapid ? "G0 rapid" : "G1 feed";
          this._setStatus(`${kind} ${d.toFixed(1)} mm at F${rate} \u2014 ${(realMs / 1e3).toFixed(1)} s${speed !== 1 ? ` @ ${speed}\xD7` : ""}`, true);
          this._nextDelayMs = 16;
          this.ip += 1;
          return false;
        }
        this._nextDelayMs = Math.max(12, realMs / speed);
        if (touchName) this._touchPulse(touchName);
      }
      this.pos = target;
      if (typeof this.onPositionChange === "function") {
        this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
      }
    } else if (this._traceSink) {
      const off = { I: wm.I, J: wm.J, K: wm.K, R: wm.R };
      const anyNull = ["I", "J", "K", "R"].some((k) => wm[k] != null && !Number.isFinite(wm[k]));
      if (anyNull) {
        this.stats.skipped += 1;
      } else {
        const pts = arcPoints(this.pos, target, off, effMotion, this.plane, this.unitScale);
        let prev = this.pos;
        for (let i = 1; i < pts.length; i++) {
          this._traceSink.push({
            x1: prev.x,
            y1: prev.y,
            z1: prev.z,
            x2: pts[i].x,
            y2: pts[i].y,
            z2: pts[i].z,
            rapid: false,
            probe: false,
            type: "feed",
            feed: this.feedVal,
            line: step.lineIndex
          });
          prev = pts[i];
        }
        this.pos = target;
      }
    } else {
      this.stats.skipped += 1;
    }
    this.ip += 1;
    return false;
  }
  // MSETDATA / MGETDATA — the real DDCS Expert Modbus channel (controllers/expert-m350/FINDINGS.md):
  // a 6-arg register transfer [X1 startVar, X2 slave#, X3 regAddr, X4 byteLen, X5 funcCode, X6 excVar].
  // MSETDATA pushes vars #X1..#(X1+X4-1) to the slave (one decimal byte each); MGETDATA pulls them back.
  // There is no real Modbus slave in the browser sim, so we TRACE the transfer (it is NOT a digital-output
  // command — that was the old, wrong interpretation) and set the exception var to 0 (OK).
  _handleModbus(line) {
    const m = line.match(/\b(MSETDATA|MGETDATA)\s*\[([^\]]*)\]/i);
    if (!m) return false;
    const op = m[1].toUpperCase();
    const args = m[2].split(",").map((a) => a.trim()).filter((a) => a !== "");
    if (args.length !== 6) {
      this._setStatus(`${op} needs 6 args [X1..X6], got ${args.length}`, true);
      return true;
    }
    const [startVar, slave, reg, byteLen, fn, excVar] = args.map((a) => this._evaluateExpression(a));
    if (op === "MSETDATA") {
      const bytes = [];
      if (Number.isFinite(startVar) && Number.isFinite(byteLen)) {
        for (let i = 0; i < byteLen; i++) bytes.push(this.vars.get(Math.round(startVar + i)) ?? 0);
      }
      if (Number.isFinite(excVar)) this.vars.set(Math.round(excVar), 0);
      this._setStatus(`MSETDATA push -> slave ${slave} reg ${reg} fn ${fn}: [${bytes.join(",")}]`, true);
    } else {
      if (Number.isFinite(excVar)) this.vars.set(Math.round(excVar), 0);
      this._setStatus(`MGETDATA pull <- slave ${slave} reg ${reg} fn ${fn} (no slave in sim; vars unchanged)`, true);
    }
    return true;
  }
  _handleAssignment(line) {
    const assignMatch = line.match(/^#(\[.*?\]|\d+)\s*=\s*(.+)$/);
    if (!assignMatch) return;
    const lhs = assignMatch[1].trim();
    const rhs = assignMatch[2].trim();
    let idx = null;
    if (lhs.startsWith("[") && lhs.endsWith("]")) {
      idx = this._evaluateExpression(lhs.slice(1, -1));
    } else {
      idx = Number.parseInt(lhs, 10);
    }
    const value = this._evaluateExpression(rhs);
    if (idx != null && Number.isFinite(idx) && value != null) {
      this.vars.set(Math.round(idx), value);
    }
  }
  _evaluateCondition(expression) {
    return evaluateCondition(expression, this.vars, { unsetValue: 0 });
  }
  _evaluateExpression(str) {
    return evalExpr(str, this.vars, { unsetValue: 0 });
  }
};

// ../DDCS-Studio/web/engine/trace.js
function traceToolpath(text, opts = {}) {
  const eng = new GcodeExecutionEngine({
    autoAnswer: true,
    // hands-free: virtual sensors/probes satisfy so loops terminate
    stock: opts.stock || null,
    stockOffset: opts.start || null,
    wcsOffset: opts.wcsOffset || null,
    // work origin in MACHINE coords → G53 moves draw in the part frame
    createVarStore: opts.createVarStore || null
  });
  return eng.trace(String(text || ""));
}

// ../DDCS-Studio/web/viz/toolpath2d.js
var COL = { rapid: "#5a6b7d", feed: "#33b1c9", probe: "#e35c5c" };
var typeOf = (s) => s.probe ? "probe" : s.rapid ? "rapid" : s.type || "feed";
function strokeSegs(ctx, segs, from, to, tx, ty, style) {
  ctx.globalAlpha = style.alpha;
  for (let i = from; i < to; i++) {
    const s = segs[i], t = typeOf(s);
    ctx.strokeStyle = COL[t] || "#888";
    ctx.lineWidth = t === "rapid" ? style.width * 0.6 : style.width;
    ctx.setLineDash(t === "rapid" ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(tx(s.x1), ty(s.y1));
    ctx.lineTo(tx(s.x2), ty(s.y2));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}
function drawToolpath2d(canvas, segs, k) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!segs.length) return;
  let a = Infinity, b2 = Infinity, c2 = -Infinity, d = -Infinity;
  segs.forEach((s) => {
    a = Math.min(a, s.x1, s.x2);
    c2 = Math.max(c2, s.x1, s.x2);
    b2 = Math.min(b2, s.y1, s.y2);
    d = Math.max(d, s.y1, s.y2);
  });
  const pad = 22, sc = Math.min((W - 2 * pad) / Math.max(1, c2 - a), (H - 2 * pad) / Math.max(1, d - b2));
  const tx = (v) => pad + (v - a) * sc, ty = (v) => H - pad - (v - b2) * sc;
  if (k == null) {
    strokeSegs(ctx, segs, 0, segs.length, tx, ty, { alpha: 1, width: 2 });
    return;
  }
  const n = Math.max(0, Math.min(k, segs.length));
  strokeSegs(ctx, segs, n, segs.length, tx, ty, { alpha: 0.22, width: 1.5 });
  strokeSegs(ctx, segs, 0, n, tx, ty, { alpha: 1, width: 2.6 });
  const head = segs[n - 1] || segs[0];
  const hx = tx(n > 0 ? head.x2 : head.x1), hy = ty(n > 0 ? head.y2 : head.y1);
  ctx.fillStyle = "#ffd24a";
  ctx.beginPath();
  ctx.arc(hx, hy, 4, 0, Math.PI * 2);
  ctx.fill();
}
function createToolpath2d(canvas) {
  let segs = [];
  const anim = { playing: false, k: 0, raf: null };
  const draw = (k) => drawToolpath2d(canvas, segs, k);
  function redraw() {
    draw(anim.playing ? Math.floor(anim.k) : null);
  }
  function setSegments(next) {
    segs = next || [];
    redraw();
  }
  function setGcode(text) {
    setSegments(traceToolpath(text).segments);
  }
  function stop() {
    if (anim.playing) {
      anim.playing = false;
      if (anim.raf) cancelAnimationFrame(anim.raf);
      anim.raf = null;
    }
    redraw();
  }
  function loop() {
    if (!anim.playing) return;
    anim.k += 1.2;
    if (anim.k >= segs.length) anim.k = 0;
    draw(Math.floor(anim.k));
    anim.raf = requestAnimationFrame(loop);
  }
  function play() {
    if (anim.playing || !segs.length) return;
    anim.playing = true;
    anim.k = 0;
    loop();
  }
  function toggle() {
    if (anim.playing) {
      stop();
      return false;
    }
    play();
    return anim.playing;
  }
  function seek(k) {
    anim.playing = true;
    anim.k = k;
    draw(Math.floor(k));
  }
  return {
    setGcode,
    setSegments,
    redraw,
    draw,
    play,
    stop,
    toggle,
    seek,
    get playing() {
      return anim.playing;
    },
    get count() {
      return segs.length;
    }
  };
}

// ../DDCS-Studio/web/ui/stockEditor.js
var _pop = null;
var _anchor = null;
var esc = (v) => String(v).replace(/[<>&]/g, (c2) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c2]);
function tplLabel(t) {
  const dims = t.shape === "cylinder" ? `\xD8${t.y}\xD7${t.x}` : `${t.x}\xD7${t.y}\xD7${t.z}`;
  return `${esc(t.name)} \u2014 ${dims}`;
}
function allTpls() {
  const user = getSettings().stockTemplates || [];
  return STOCK_TEMPLATES.map((t) => ({ t, builtin: true })).concat(user.map((t) => ({ t, builtin: false })));
}
function toggleStockEditor(anchor) {
  if (_pop) {
    closeStockEditor();
    return;
  }
  openStockEditor(anchor);
}
function openStockEditor(anchor) {
  closeStockEditor();
  _anchor = anchor || null;
  const s = getSettings().stock || {};
  const pop = document.createElement("div");
  pop.className = "stock-editor-pop";
  pop.style.cssText = "position:fixed; left:50%; top:13%; transform:translateX(-50%); z-index:10050;background:rgba(20,22,28,0.98); border:1px solid rgba(255,255,255,0.14); border-radius:8px;padding:12px 14px; color:#e6ecf2; font-size:12px; width:300px; box-shadow:0 10px 34px rgba(0,0,0,0.55);";
  pop.innerHTML = `
        <style>
            .stock-editor-pop input, .stock-editor-pop select { width:100%; box-sizing:border-box; background:#11141a; color:#e6ecf2; border:1px solid #3a414d; border-radius:4px; padding:3px 5px; }
            .stock-editor-pop label.col { display:flex; flex-direction:column; gap:2px; }
        </style>
        <div class="stock-editor-head" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-weight:bold; letter-spacing:1px; color:#9fb4cc;">STOCK</span>
            <button id="se_close" class="toolbar-btn" style="padding:1px 8px;" title="Close">\u2715</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:10px;">
            <label class="col">Template
                <select id="se_tpl">
                    <option value="">\u2014 template \u2014</option>
                </select>
            </label>
            <div style="display:flex; gap:6px;">
                <button id="se_tpl_save" class="toolbar-btn" style="flex:1; padding:3px 5px; font-size:11px;" title="Save current settings as a template">\u2B50 Save template</button>
                <button id="se_tpl_del" class="toolbar-btn" style="flex:1; padding:3px 5px; font-size:11px; display:none;" title="Delete selected template">\u{1F5D1} Delete</button>
            </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px;">
            <label class="col">X<input id="se_x" type="number" min="0" step="1"></label>
            <label class="col">Y<input id="se_y" type="number" min="0" step="1"></label>
            <label class="col">Z<input id="se_z" type="number" min="0" step="1"></label>
        </div>
        <label class="col" style="margin-bottom:10px;">Shape
            <select id="se_shape">
                <option value="boss">Boss \u2014 probe the outside</option>
                <option value="pocket">Pocket \u2014 probe the inside</option>
                <option value="cylinder">Cylinder \u2014 rotary stock</option>
            </select>
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; width:auto;"><input id="se_show" type="checkbox" style="width:auto;"> Show stock in 3D</label>
        <div style="margin-top:10px; color:#7f8a99; font-size:11px;">Cylinder lies along the rotary axis (Y = diameter, X = length).</div>
    `;
  document.body.appendChild(pop);
  _pop = pop;
  makeDraggable(pop, pop.querySelector(".stock-editor-head"));
  const q = (id) => pop.querySelector("#" + id);
  q("se_x").value = s.x ?? "";
  q("se_y").value = s.y ?? "";
  q("se_z").value = s.z ?? "";
  q("se_shape").value = s.shape || "boss";
  q("se_show").checked = s.show !== false;
  const updateTplDel = () => {
    const sel = q("se_tpl");
    const del2 = q("se_tpl_del");
    if (!sel || !del2) return;
    const i = sel.value === "" ? -1 : parseInt(sel.value, 10);
    const list2 = allTpls();
    del2.style.display = i >= 0 && list2[i] && !list2[i].builtin ? "" : "none";
  };
  const rebuildTplDropdown = (selIdx) => {
    const sel = q("se_tpl");
    if (!sel) return;
    const list2 = allTpls();
    sel.innerHTML = '<option value="">\u2014 template \u2014</option>' + list2.map((e, i) => `<option value="${i}">${e.builtin ? "" : "\u2B50 "}${tplLabel(e.t)}</option>`).join("");
    sel.value = selIdx != null ? String(selIdx) : "";
    updateTplDel();
  };
  rebuildTplDropdown();
  const commit = () => applySettings({ stock: {
    x: parseFloat(q("se_x").value) || 0,
    y: parseFloat(q("se_y").value) || 0,
    z: parseFloat(q("se_z").value) || 0,
    shape: q("se_shape").value,
    show: q("se_show").checked
  } });
  ["se_x", "se_y", "se_z", "se_shape", "se_show"].forEach((id) => {
    q(id).addEventListener("input", commit);
    q(id).addEventListener("change", commit);
  });
  q("se_tpl").addEventListener("change", () => {
    const i = q("se_tpl").value === "" ? -1 : parseInt(q("se_tpl").value, 10);
    const all = allTpls();
    updateTplDel();
    if (i < 0 || !all[i]) return;
    const t = all[i].t;
    q("se_x").value = t.x;
    q("se_y").value = t.y;
    q("se_z").value = t.z;
    q("se_shape").value = t.shape || "boss";
    commit();
  });
  q("se_tpl_save").addEventListener("click", () => {
    const name = (prompt("Save current stock as a template \u2014 name?") || "").trim();
    if (!name) return;
    const currentTemplates = getSettings().stockTemplates || [];
    const newTemplate = {
      name,
      x: parseFloat(q("se_x").value) || 0,
      y: parseFloat(q("se_y").value) || 0,
      z: parseFloat(q("se_z").value) || 0,
      shape: q("se_shape").value || "boss"
    };
    const updated = [...currentTemplates, newTemplate];
    applySettings({ stockTemplates: updated });
    rebuildTplDropdown(STOCK_TEMPLATES.length + updated.length - 1);
  });
  q("se_tpl_del").addEventListener("click", () => {
    const sel = q("se_tpl");
    const i = sel.value === "" ? -1 : parseInt(sel.value, 10);
    const list2 = allTpls();
    if (i < 0 || !list2[i] || list2[i].builtin) return;
    const userIdx = i - STOCK_TEMPLATES.length;
    const currentTemplates = getSettings().stockTemplates || [];
    const updated = [...currentTemplates];
    updated.splice(userIdx, 1);
    applySettings({ stockTemplates: updated });
    rebuildTplDropdown();
  });
  q("se_close").addEventListener("click", closeStockEditor);
  pop.addEventListener("pointerdown", (e) => e.stopPropagation());
  setTimeout(() => document.addEventListener("pointerdown", _onDoc, true), 0);
}
function _onDoc(e) {
  if (!_pop) return;
  if (_pop.contains(e.target)) return;
  if (_anchor && (e.target === _anchor || _anchor.contains(e.target))) return;
  closeStockEditor();
}
function closeStockEditor() {
  if (_pop) {
    _pop.remove();
    _pop = null;
    _anchor = null;
    document.removeEventListener("pointerdown", _onDoc, true);
  }
}

// ../DDCS-Studio/web/viz/createPreviewPanel.js
var stockForViz = () => {
  const s = window.ddcsGetSettings && window.ddcsGetSettings().stock || null;
  return s && s.show ? s : null;
};
var wcsForViz = () => {
  const m = window.ddcsGetSettings && window.ddcsGetSettings().machine || null;
  return m && m.workOrigin ? m.workOrigin : null;
};
var machineForViz = () => window.ddcsGetSettings && window.ddcsGetSettings().machine || null;
var previewPrefs = () => window.ddcsGetSettings && window.ddcsGetSettings().preview || {};
var ICON_PLAY = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><path d="M4.5 3 12.5 8 4.5 13Z"/></svg>';
var ICON_STOP = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5"/></svg>';
var ICON_STEP = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><path d="M3.5 3 10 8 3.5 13Z"/><rect x="11" y="3" width="2.4" height="10" rx="1"/></svg>';
var ICON_COPY = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" style="vertical-align:middle" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1"/></svg>';
var ICON_JOG = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><path d="M8 2 6 4.5h4z"/><path d="M8 14 6 11.5h4z"/><path d="M2 8 4.5 6v4z"/><path d="M14 8 11.5 6v4z"/></svg>';
var ICON_LOOP = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>';
var ICON_FOLLOW = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle" aria-hidden="true"><path d="M2 5.5V4a2 2 0 0 1 2-2h1.5"/><path d="M10.5 2H12a2 2 0 0 1 2 2v1.5"/><path d="M14 10.5V12a2 2 0 0 1-2 2h-1.5"/><path d="M5.5 14H4a2 2 0 0 1-2-2v-1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>';
var PANEL_HTML = `
  <canvas class="pp-2d" aria-hidden="true" style="position:absolute;top:0;left:0;width:100%;height:100%;display:none;background:#0d1117;z-index:1"></canvas>
  <div class="pp-statusbar">
    <button class="pp-copy viz3d-status-copy" type="button" title="Copy this status line to the clipboard" aria-label="Copy status">${ICON_COPY}</button>
    <div class="pp-status viz3d-status"></div>
  </div>
  <div class="viz3d-controls">
    <button class="pp-mtoggle viz3d-2dtoggle" type="button" title="Toggle 2D / 3D view">3D</button>
    <button class="pp-stock" type="button" title="Stock \u2014 set the workpiece (dimensions, shape, show, templates)" aria-label="Stock">\u{1F4E6}</button>
    <button class="pp-speed" type="button" title="Simulation speed \u2014 tap to cycle 1\xD7 2\xD7 5\xD7 10\xD7" aria-label="Simulation speed">1\xD7</button>
    <button class="pp-run" type="button" title="Run the program \xB7 while running, click to stop and reset to the start">${ICON_PLAY}</button>
    <button class="pp-step" type="button" title="Execute one line at a time (pauses a running program)">${ICON_STEP}</button>
    <button class="pp-loop" type="button" title="Loop: restart the program when it completes" aria-label="Loop">${ICON_LOOP}</button>
    <button class="pp-follow" type="button" title="Follow-cam \u2014 keep the tool centred while playing (Settings \u2192 Preview to set damping)" aria-label="Follow cam" style="display:none">${ICON_FOLLOW}</button>
    <button class="pp-jog" type="button" title="Jog the start marker (X/Y/Z step buttons)" aria-label="Jog" style="display:none">${ICON_JOG}</button>
    <button class="pp-io" type="button" title="Show/hide the virtual I/O panel (sensors and outputs)">I/O</button>
  </div>
  <div class="viz3d-legend"></div>
  <div class="viz3d-hint">drag orbit \xB7 wheel zoom \xB7 right/middle-drag pan</div>
`;
function createPreviewPanel(container, opts = {}) {
  const get = (k) => typeof opts[k] === "function" ? opts[k]() : opts[k];
  container.classList.add("preview-panel");
  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  container.insertAdjacentHTML("beforeend", PANEL_HTML);
  const q = (sel) => container.querySelector(sel);
  const cv2d = q(".pp-2d");
  const statusEl = q(".pp-status");
  const t2 = createToolpath2d(cv2d);
  let viz = null;
  let mode = previewPrefs().defaultView === "2d" ? "2d" : "3d", active = false, segs = [], fitted = false;
  let lastVizMode = mode === "io" ? "3d" : mode;
  let lastRunCode = null, loopOn = false, loopTimer = null, autoStarted = false;
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => {
      if (mode === "2d") t2.redraw();
    }).observe(container);
  }
  const setStatus = (text, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("has-error", !!isError);
    const cp = q(".pp-copy");
    if (cp) cp.classList.toggle("visible", !!(text && text.length));
  };
  const SPEEDS = [1, 2, 5, 10];
  let speedIx = Math.max(0, SPEEDS.indexOf(Number(previewPrefs().defaultSpeed) || 1));
  const simSpeed = () => SPEEDS[speedIx] || 1;
  function applyPreviewSettings() {
    if (!viz) return;
    const pv = previewPrefs();
    const damp = Number.isFinite(pv.followDamp) ? pv.followDamp : 50;
    if (viz.setFollowLerp) viz.setFollowLerp(0.32 - damp / 100 * 0.3);
    if (viz.setShowRapids) viz.setShowRapids(pv.showRapids !== false);
  }
  const nearest2d = (pos) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], dx = s.x2 - pos.x, dy = s.y2 - pos.y, dd = dx * dx + dy * dy;
      if (dd < bd) {
        bd = dd;
        bi = i;
      }
    }
    return bi + 1;
  };
  function ensureViz() {
    if (viz) return viz;
    try {
      viz = new GcodeViz3D(container);
      viz._gizmoPx = 36;
      viz._animOn = false;
      viz.setStock(stockForViz());
      viz.setMachine(machineForViz());
      applyPreviewSettings();
    } catch (e) {
      console.warn("preview 3D unavailable \u2014 using 2D", e);
      viz = null;
      setMode("2d");
    }
    return viz;
  }
  let engine = null;
  function ensureEngine() {
    if (engine) return engine;
    engine = new GcodeExecutionEngine({
      autoAnswer: window.ioPanel ? window.ioPanel.isAutoSensors() : true,
      stock: stockForViz(),
      wcsOffset: wcsForViz(),
      simSpeed: simSpeed(),
      createVarStore: opts.createVarStore || null,
      onLineChange: ({ lineIndex, raw }) => {
        if (typeof opts.onLine === "function") opts.onLine(lineIndex);
        if (raw) setStatus(`Executing line ${lineIndex + 1}: ${raw.trim()}`);
      },
      onPositionChange: (pos) => {
        if (viz && viz.setToolPosition) viz.setToolPosition(pos);
        if (mode === "2d" && segs.length) t2.seek(nearest2d(pos));
      },
      onStatus: ({ message }) => setStatus(message),
      onWait: (wait) => {
        if (!window.ioPanel) return;
        if (mode !== "io" && wait) window.ioPanel.show();
        window.ioPanel.setWait(wait);
      },
      // docked I/O view already shows it; else float
      onFinish: () => {
        updateRunBtn();
        if (typeof opts.onLine === "function") opts.onLine(null);
        if (loopOn) {
          clearTimeout(loopTimer);
          loopTimer = setTimeout(() => {
            lastRunCode = get("getGcode") || lastRunCode;
            engine.run(lastRunCode);
            updateRunBtn();
          }, 800);
        }
      }
    });
    return engine;
  }
  function updateRunBtn() {
    const b2 = q(".pp-run");
    if (!b2) return;
    const running = !!(engine && engine.running), paused = !!(engine && engine.paused);
    b2.classList.toggle("on", running && !paused);
    b2.innerHTML = running && !paused ? ICON_STOP : ICON_PLAY;
  }
  function setGcode(text) {
    const code = text != null ? text : get("getGcode") || "";
    const st = get("getStart");
    let parsed;
    try {
      parsed = traceToolpath(code, { stock: stockForViz(), start: st, wcsOffset: wcsForViz() });
    } catch (e) {
      console.warn("trace failed", e);
      parsed = { segments: [], stats: {} };
    }
    segs = parsed.segments || [];
    t2.setSegments(segs);
    if (mode === "3d") {
      const v = ensureViz();
      if (v) {
        v.setActive(true);
        if (st && v.starts) v.starts[0] = { x: +st.x || 0, y: +st.y || 0, z: +st.z || 0 };
        v.setSegments(parsed, !fitted);
        fitted = true;
      }
    }
    const s = parsed.stats || {};
    setStatus(!s.drawable ? "No drawable moves" : [s.feed && `${s.feed} cuts`, s.probe && `${s.probe} probes`, s.rapid && `${s.rapid} rapids`].filter(Boolean).join(" \xB7 "));
    syncJog();
    renderLegend(parsed);
  }
  const refresh = () => setGcode();
  function syncJog() {
    const j = q(".pp-jog");
    if (j) j.style.display = mode === "3d" && viz && viz.jogPendant && viz.starts && viz.starts.length > 0 ? "" : "none";
    const f = q(".pp-follow");
    if (f) f.style.display = mode === "3d" && viz ? "" : "none";
  }
  const LEGEND = [
    // colours match the 3D view (gcodeViz3d line groups)
    { key: "feed", label: "Cut", color: "#35d0ff" },
    { key: "probe", label: "Probe", color: "#3b82f6" },
    { key: "probeSlow", label: "Probe slow", color: "#93c5fd" },
    { key: "retract", label: "Retract", color: "#33cc55" },
    { key: "jog", label: "Jog", color: "#ff9a0d" },
    { key: "rapid", label: "Rapid", color: "#ffcc00" }
  ];
  function renderLegend(parsed) {
    const el2 = q(".viz3d-legend");
    if (!el2) return;
    const ss = parsed && parsed.segments || [];
    let maxProbeFeed = 0;
    for (const s of ss) {
      if ((s.type === "probe" || s.probe) && (s.feed || 0) > maxProbeFeed) maxProbeFeed = s.feed;
    }
    const present = /* @__PURE__ */ new Set();
    for (const s of ss) {
      const type = s.type || (s.probe ? "probe" : s.rapid ? "rapid" : "feed");
      if (type === "rapid") present.add("rapid");
      else if (type === "retract") present.add("retract");
      else if (type === "probe") present.add((s.feed || 0) > 0 && (s.feed || 0) < maxProbeFeed ? "probeSlow" : "probe");
      else present.add("feed");
    }
    if (viz && viz.starts && viz.starts.length > 1) present.add("jog");
    el2.innerHTML = LEGEND.filter((x) => present.has(x.key)).map((x) => `<span style="color:${x.color}">${x.label}</span>`).join("");
    el2.style.display = el2.childElementCount ? "" : "none";
  }
  function setMode(next) {
    const ioBtn = q(".pp-io");
    if (next !== "io") lastVizMode = next;
    mode = next;
    stopPlay();
    if (mode === "io") {
      if (cv2d) cv2d.style.display = "none";
      if (viz) {
        viz.setActive(false);
        if (viz.renderer) viz.renderer.domElement.style.display = "none";
      }
      if (window.ioPanel) window.ioPanel.show(container);
      if (ioBtn) ioBtn.classList.add("on");
      syncJog();
      return;
    }
    if (window.ioPanel && window.ioPanel.isVisible()) window.ioPanel.hide();
    if (ioBtn) ioBtn.classList.remove("on");
    const mt = q(".pp-mtoggle");
    if (mt) mt.textContent = mode === "2d" ? "2D" : "3D";
    if (cv2d) cv2d.style.display = mode === "2d" ? "" : "none";
    if (mode === "2d") {
      if (viz) {
        viz.setActive(false);
        if (viz.renderer) viz.renderer.domElement.style.display = "none";
      }
    } else {
      const v = ensureViz();
      if (v) {
        if (v.renderer) v.renderer.domElement.style.display = "";
        v.setActive(true);
      }
    }
    if (active) setGcode();
    if (mode === "2d") t2.redraw();
  }
  function play() {
    const eng = ensureEngine();
    eng.simSpeed = simSpeed();
    eng.autoAnswer = window.ioPanel ? window.ioPanel.isAutoSensors() : true;
    eng.stock = stockForViz();
    eng._stockOffset = get("getStart") || { x: 0, y: 0, z: 0 };
    eng._wcsOffset = wcsForViz() || { x: 0, y: 0, z: 0 };
    if (mode === "3d") ensureViz();
    if (viz) viz.setAnimate(false);
    lastRunCode = get("getGcode") || "";
    eng.run(lastRunCode);
    updateRunBtn();
  }
  function stopPlay() {
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
    if (engine && engine.running) engine.stop();
    t2.stop();
    if (viz) viz.setAnimate(false);
    if (typeof opts.onLine === "function") opts.onLine(null);
    updateRunBtn();
  }
  function seekLine(i) {
    if (!segs.length || i == null) return;
    let best = null;
    for (const s of segs) {
      if (s.line != null && s.line <= i) best = s;
    }
    const pos = best ? { x: best.x2, y: best.y2, z: best.z2 } : { x: segs[0].x1, y: segs[0].y1, z: segs[0].z1 };
    if (mode === "3d") {
      const v = ensureViz();
      if (v && v.setToolPosition) v.setToolPosition(pos);
    } else t2.seek(nearest2d(pos));
  }
  function renderStock() {
    if (viz) viz.setStock(stockForViz());
    if (engine) engine.stock = stockForViz();
  }
  q(".pp-stock").addEventListener("click", (e) => toggleStockEditor(e.currentTarget));
  q(".pp-mtoggle").addEventListener("click", () => setMode(mode === "io" ? lastVizMode : mode === "2d" ? "3d" : "2d"));
  q(".pp-run").addEventListener("click", () => {
    const eng = ensureEngine();
    if (eng.running && !eng.paused) stopPlay();
    else if (eng.running && eng.paused) {
      eng.resume();
      updateRunBtn();
    } else play();
  });
  q(".pp-step").addEventListener("click", () => {
    const eng = ensureEngine();
    if (viz && !eng.running) viz.setAnimate(false);
    eng.step(get("getGcode") || "");
    updateRunBtn();
  });
  q(".pp-loop").addEventListener("click", () => {
    loopOn = !loopOn;
    q(".pp-loop").classList.toggle("on", loopOn);
    if (!loopOn && loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
  });
  q(".pp-speed").addEventListener("click", () => {
    speedIx = (speedIx + 1) % SPEEDS.length;
    q(".pp-speed").textContent = SPEEDS[speedIx] + "\xD7";
    if (engine) engine.simSpeed = simSpeed();
  });
  q(".pp-copy").addEventListener("click", () => {
    if (statusEl && statusEl.textContent && navigator.clipboard) navigator.clipboard.writeText(statusEl.textContent);
  });
  q(".pp-jog").addEventListener("click", () => {
    const v = ensureViz();
    if (!v || !v.jogPendant) return;
    const grid = v.jogPendant.querySelector(".jog-grid-wrap");
    if (!grid) return;
    const open = grid.style.display === "none";
    grid.style.display = open ? "" : "none";
    q(".pp-jog").classList.toggle("on", open);
  });
  q(".pp-io").addEventListener("click", () => setMode(mode === "io" ? lastVizMode : "io"));
  q(".pp-follow").addEventListener("click", () => {
    const v = ensureViz();
    if (!v || !v.setFollowCam) return;
    const on = !v.followCam;
    v.setFollowCam(on);
    q(".pp-follow").classList.toggle("on", on);
  });
  window.addEventListener("ddcs:stop-previews", stopPlay);
  window.addEventListener("ddcs:settings-changed", () => {
    renderStock();
    if (viz) viz.setMachine(machineForViz());
    applyPreviewSettings();
    if (active) setGcode();
  });
  function setActive(on) {
    active = !!on;
    if (!active) {
      stopPlay();
      autoStarted = false;
      if (viz) viz.setActive(false);
      return;
    }
    if (mode === "3d") {
      const v = ensureViz();
      if (v) v.setActive(true);
    }
    setGcode();
    autoStartOnOpen();
  }
  function autoStartOnOpen() {
    if (autoStarted || !active) return;
    const pv = previewPrefs();
    if (mode === "3d" && pv.followDefault !== false) {
      const v = ensureViz();
      if (v && v.setFollowCam) {
        v.setFollowCam(true);
        const fb = q(".pp-follow");
        if (fb) fb.classList.add("on");
      }
    }
    if (!segs.length) return;
    autoStarted = true;
    if (pv.autoLoop !== false) {
      loopOn = true;
      const lb = q(".pp-loop");
      if (lb) lb.classList.add("on");
      play();
    }
  }
  return { setGcode, refresh, setActive, setView: setMode, stop: stopPlay, seekLine, get viz() {
    return viz;
  }, get engine() {
    return engine;
  }, el: container };
}

// web/src/previewApp.js
var __seq = 0;
["log", "warn", "error"].forEach((lvl) => {
  const orig = console[lvl].bind(console);
  console[lvl] = (...args) => {
    orig(...args);
    try {
      const text = args.map((a) => typeof a === "string" ? a : (() => {
        try {
          return JSON.stringify(a);
        } catch (_) {
          return String(a);
        }
      })()).join(" ");
      if (window.vscode) window.vscode.postMessage({ type: "log", text: "[preview] #" + ++__seq + " [" + lvl + "] " + text.slice(0, 1500) });
    } catch (_) {
    }
  };
});
var currentGcode = "";
var currentStart = null;
var panel = null;
document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("[DDCS preview] init; localStorage keys=" + Object.keys(localStorage).join(","));
  } catch (_) {
  }
  try {
    panel = createPreviewPanel(document.getElementById("preview-host"), {
      getGcode: () => currentGcode,
      getStart: () => currentStart
    });
    panel.setActive(true);
    console.log("[DDCS preview] panel created");
    if (currentGcode) {
      panel.setGcode(currentGcode);
    }
  } catch (err) {
    console.error("[DDCS preview] createPreviewPanel failed: " + (err && err.message ? err.message : err));
  }
  try {
    if (window.vscode) window.vscode.postMessage({ type: "previewReady" });
  } catch (_) {
  }
});
window.addEventListener("message", (e) => {
  const m = e.data;
  if (m && m.type === "gcode") {
    currentGcode = m.text || "";
    if (m.start !== void 0 && m.start !== null) {
      currentStart = m.start;
    }
    console.log("[DDCS preview] gcode received, len=" + currentGcode.length + " start=" + JSON.stringify(currentStart));
    if (panel) {
      try {
        panel.setGcode(currentGcode);
        console.log("[DDCS preview] setGcode done");
      } catch (err) {
        console.error("[DDCS preview] setGcode failed: " + (err && err.message ? err.message : err));
      }
    }
  }
});
