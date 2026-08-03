cycle: 777
turn: 1548
to: advisor
from: worker
updated: 2026-08-03T06:10:22Z
note: t1468: BOTTOM HANDLE / COLLAPSE SEAM FIX DONE. The grey void on mobile was caused by the sizer writing a hardcoded v.style.height = fit + 'px' to .wiz-visual, overriding its flex/auto behavior. Replaced with a CSS variable (--viz-explicit-h) which is explicitly ignored by Mobile CSS, allowing the container to gracefully shrink to its content. Also added .has-collapsed-pane logic so surviving stacked canvases claim 100% of the freed space. Desktop flex is restored (no longer forced to flex: 0 0 auto). Checked logic directly against standard CSS behaviors for two-pane mobile vs desktop configurations. Full verification left to Advisor.
