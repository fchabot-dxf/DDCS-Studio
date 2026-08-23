# Recovered tracer sources — **reference, not the deliverable**

The wordmark tracing pipeline was written, run, and lost with its session; only a prose recipe survived.
These three files were recovered **verbatim** from the session transcript
*(human, 2026-08-22: "no way im sure you can retreive it" — they were right)*.

⛔ **They are not the working material.** They are one-off exploration scripts: heredocs that also emit
comparison HTML, hardcode paths into a temp directory, and carry constants inline. Do not run them, do not
tidy them, do not extend them.

⭐ **What they are is the KERNEL** — the ~15 lines of transform maths that would have been expensive to
re-derive, preserved exactly as it actually ran:

```python
sh = -math.tan(math.radians(slant_deg))          # ⛔ NEGATIVE — the y-flip below runs first
t = (Identity.translate(0, BASELINE_Y)
             .transform((1, 0, sh, 1, 0, 0))     # shear
             .scale(s * xscale, -s)              # ⛔ this flip is why sh must be negative
             .translate(penx, 0))
pen = SVGPathPen(gs); gs[gn].draw(TransformPen(pen, t))
penx += hmtx[gn][0]                              # advance width, unscaled
```

with `TARGET_W, FONT_SIZE, BASELINE_Y = 146.0, 26.0, 23.0`, and the natural-width measurement that derives
the stretch factor:

```python
nat = sum(hmtx[cmap[ord(c)]][0] for c in text if ord(c) in cmap) * s
xs  = TARGET / nat
```

| file | what it traced |
|---|---|
| `tracer-google-fonts.txt` | the ORGANIC route — Sniglet/Fredoka/Nunito from fetched WOFF2 subsets |
| `tracer-system-fonts.txt` | the other four — Arial Black + Georgia read from `C:/Windows/Fonts` |
| `tracer-shear-fix.txt` | the moment the shear sign was corrected, with the reasoning in-comment |

## What to build from them

`brand/wordmarks.json` — every constant above, declared, one entry per mark.
`brand/trace-wordmark.py` — a dumb interpreter of that file, holding no parameters of its own.

⚠ **Delete this folder once those two exist.** Its only job is to survive the gap between losing the script
and rebuilding it properly. Keeping recovered scaffolding alongside a real declaration is how a project ends
up with two competing sources for the same numbers.
