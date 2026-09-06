// submit.js — submit a job. Every job delivers the same way (PROTOCOL §3/§4).
//
// t2649 (BACKLOG #78) — was "Beacons ON (default) => instrument client-side (tracked, has map); beacons OFF
// => deliver-only (no map)" plus a settings block (count/pacing/var/marker) and an import of the now-deleted
// `/shared/js/instrument/instrument.js`. The beacon mechanism is REMOVED (owner-directed 2026-09-04, never
// demonstrably ran end-to-end) — every job is now what "deliver-only" already was, so this form drops the
// checkbox and its settings entirely rather than leaving them wired to a module that no longer exists.
import { el, toast } from "../util.js";

export default {
  id: "submit",
  label: "Submit",

  mount(ctx) {
    let file = { name: "", text: "" };

    const drop = el("div", { class: "drop" }, "⤓  Drop a .nc here, or click to choose");
    const input = el("input", { type: "file", accept: ".nc,.tap,.txt,.gcode", style: "display:none" });
    const nameField = el("input", { type: "text", placeholder: "job name (e.g. bracket_v3.nc)", style: "flex:1" });

    const btn = el("button", { class: "primary", disabled: "" }, "Submit");
    const info = el("div", { class: "hint" });

    const load = (f) => {
      const r = new FileReader();
      r.onload = () => {
        file = { name: f.name, text: String(r.result) };
        nameField.value = f.name;
        drop.textContent = `✓ ${f.name} (${file.text.length} bytes)`;
        btn.disabled = false;
      };
      r.readAsText(f);
    };
    drop.onclick = () => input.click();
    input.onchange = (e) => e.target.files[0] && load(e.target.files[0]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); e.dataTransfer.files[0] && load(e.dataTransfer.files[0]); };

    btn.onclick = async () => {
      const name = (nameField.value || file.name || "job.nc").trim();
      btn.disabled = true;
      try {
        const r = await ctx.client.submitJob(name, file.text);
        toast("Queued " + r.jobId);
        info.textContent = `Queued ${r.jobId}`;
      } catch (e) {
        toast("Submit failed: " + e.message, true);
      } finally {
        btn.disabled = false;
      }
    };

    ctx.root.append(el("section", { class: "block" },
      el("div", { class: "section-label" }, "Submit a job"),
      drop, input,
      el("div", { class: "row", style: "margin-top:12px" }, nameField, btn),
      info,
      el("div", { class: "wiz-usage" },
        "The job is delivered to the controller; the operator presses Cycle Start at the machine.")));
  },
};
