# DDCS V4.1 bench-kit — S5, no-motion verify (t1538)

**This kit CANNOT move the machine.** Every file here is plain variable arithmetic, one comparison, or a
work-coordinate redefinition (`G92` — which *renames* the current position, it does not move to one). There is
no `G0`/`G1`/`G2`/`G3`, no spindle-start, no tool change, anywhere in this folder.

**`S5b_coordword.nc` is the ONLY file in this kit that writes any controller state.** The other five compute
into scratch registers and touch nothing else. See the extra step under `S5b` in section 2 before running it.

## 1. Copy the files over

Copy all 6 `.nc` files to the controller's **work disk** share: `\\10.0.0.50\cncdisk` (the G-code share —
`sysdisk` is the system/config folder, used below for reading results, not for programs).

## 2. Run them in this order, ONE AT A TIME

For each file: select it on the panel, press **Start**, wait for it to finish, read the result (step 3), *then*
move to the next file.

| # | File | Tests |
|---|---|---|
| 1 | `S5a_spaced.nc` | Studio's SPACED multi-word style (vs the factory's unspaced) |
| 2 | `S5b_coordword.nc` | An expression inside a coordinate word (`G92 Z[...]`) — ⚠ **writes controller state, see below** |
| 3 | `S5c_ifgoto.nc` | IF/GOTO actually branches (not just parses) |
| 4 | `S5d_while.nc` | WHILE/DO/END — ⚠ if the screen hangs >15s, that's a finding: press STOP/RESET |
| 5 | `S5e_sqrt.nc` | SQRT — the prize, run before S5f |
| 6 | `S5f_atan.nc` | ATAN — the prize |

### Before running `S5b_coordword.nc` — one extra step

This file's self-restore only works **if the register it reads genuinely is work-Z**, which is an assumption,
not a certainty. **Write down the current work-Z reading from the controller's own screen before running it.**
After it finishes, compare:

- **Work-Z unchanged AND `#190 = 100`** — the strongest pass available: it confirms both that the form parsed
  *and* that the register really is work-Z.
- **Work-Z changed** (`#190 = 100` either way) — the form parsed, but the register is **not** work-Z. This is a
  real finding, more valuable than the parse result — write down both values, then **reset work-Z yourself**
  back to what you noted before running the file.
- **Syntax error, sentinel unchanged** — the form was rejected; work-Z was never touched.

## 3. Reading the result — register `#190`

**A syntax error IS a usable answer, not a failure of the test.** If the controller stops with a parse/syntax
error instead of finishing, note the **line number** it names and move on to the next file — that means the
tested form is rejected, loud, and nothing in the file ran.

If it finishes normally, read `#190` (each file's own comment says what value means PASS). Two ways to read it:

- **On-screen variable/parameter page** (the standard DDCS way) — not specifically confirmed for V4.1 in this
  repo, but expected to work the same as every other DDCS-family controller.
- **CONFIRMED fallback, over the same SMB connection** (per `../FINDINGS.md`): the controller flushes its
  variables to `\\10.0.0.50\sysdisk\uservar` at the end of every run. `#190` lives at **slot 90** (byte offset
  `90 × 8 = 720`), an 8-byte little-endian float64. `#191` (used only by `S5c`/`S5d` internally) is slot 91,
  offset 728. This channel is proven — it's how the SMB capture that grounds this whole dialect was taken.

`#190`/`#191` were chosen because the dialect (`ddcs-v41.js`) already declares them the verified-free scratch
band — outside the range V4.1's own firmware executable macros write (`#0-148`, `#490-536`) — and inside the
range `uservar` covers (`#100-499`), so the readback above is grounded, not assumed.

## 4. When you're done

Write the six outcomes back to whoever gave you this kit — a number, a "syntax error at line N", or a "hung,
had to reset" for each file is exactly what's needed. No ruling gets made from this kit; it only measures.
