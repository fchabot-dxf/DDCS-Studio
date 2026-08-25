# COMMENT CHARACTERS — what actually appears inside a comment, derived from the dumps

**Measured on `CNC-FAIRY` 2026-08-25**, answering the blocking question in
[`../HANDOFF-FROM-FAIRY.md`](../HANDOFF-FROM-FAIRY.md) §1: *"the safe comment-character list, derived from real
dumps rather than reasoning."* Cross-dialect, so it lives here beside the other cross-controller docs rather
than inside one controller's `FINDINGS.md`.

⭐ **METHOD, so the vetting is checkable** — the ask was explicit that a vetted list nobody can check is a
longer guess. Every `.nc`/`.ngc`/`.tap`/`.cnc` under each corpus was read as **bytes**, flat `(…)` spans
extracted, and every non-alphanumeric byte inside them counted with a first-example file. **Corpora were kept
separate by PROVENANCE**, because that is the whole point: a file the vendor ships is evidence about the
parser; a file we wrote and copied to the machine is evidence about us.

| corpus | provenance | files | comments |
|---|---|---|---|
| Expert SYSDISK (`capture/*/SYSDISK`) | ⭐ the controller's OWN system macros | 104 | 1157 |
| Expert OEM firmware (`USB-READY/install`) | ⭐ vendor install payload | 40 | 296 |
| Expert OEM CAM packs (`assets/cam-menu`) | ⭐ vendor macro packs | 98 | 748 |
| V4.1 OEM firmware + system backup | ⭐ vendor / off the real V4.1 | 85 | 64 |
| DM500 OEM install | ⭐ vendor | 8 | 47 |
| LinuxCNC corpus | upstream samples (a different dialect) | 248 | 4656 |
| Expert CNCDISK (`capture/*/CNCDISK`) | ⚠ **OURS** — Studio output copied to the machine | 47 | 551 |

⛔ **The CNCDISK row is NOT evidence about the parser.** Those files are ours; sitting on the disk proves they
were transferred, not that the controller accepted them. It is listed only because it is where the
counter-examples live (§1).

---

## 1. ⭐⭐ THE HEADLINE — the constraint is NESTING, and it is universal

**Across 2,248 vendor comments on three DDCS controllers, plus 4,656 LinuxCNC comments: `(` never once opens
inside an open comment.** Not one vendor, in any dialect, nests.

```
Expert factory SYSDISK      0 nested
Expert OEM firmware         0 nested
Expert OEM CAM packs        0 nested
V4.1 OEM + system backup    0 nested
DM500 OEM install           0 nested
LinuxCNC (248 files)        0 nested   <- in GENUINE upstream files
```

⚠ **Every nesting instance found anywhere in this repo is in a file WE wrote** — 4 on the Expert's CNCDISK
(`G53_TEST.nc`, `g90_absolute.nc`, `SET575.nc`) and 1 LinuxCNC file whose own header says *"Translated from:
DDCS-Studio cornerWizard.js"*. `[CONFIRMED]`

⇒ This corroborates the memory that recorded it — *"`( … ( … ) )` throws a DDCS bracket error and rejects the
line"* — and it puts the fix where it already is: **the app's export path (`917f8856`)**, not a character
blacklist.

---

## 2. THE LIST — characters that DEMONSTRABLY appear in vendor comments

Counts are the Expert vendor corpora combined (SYSDISK + OEM firmware + OEM CAM packs).
⭐ = recommended replacement candidate · ⚠ = attested but misleading · ⛔ = do not use.

| char | n | verdict | evidence / why |
|---|---|---|---|
| ⭐ `-` | 1488 | **best candidate** | `(KEY-6: 3D CORNER PROBE FOR G55)`, `(e.g. -1 for stock allowance)` — by far the most used, no structural meaning |
| ⭐ `.` | 1083 | **safe** | `(v1.1)`, `(mm, e.g. 1.0)` |
| ⭐ `:` | 408 | **safe** | `(KEY-6: 3D CORNER PROBE FOR G55)`, `(inner: span + probe dia)` |
| ⭐ `=` | 373 | **safe inside a comment** | `(=== QUICK SETUP IF NOT CONFIGURED ===)` — the vendor's own divider rule |
| ⭐ `!` | 161 | **safe** | `(Surface found!)` |
| ⭐ `,` | 148 | **safe** | `(Find hole 1 center, set zero, save for angle)` |
| `/` | 39 | safe **mid-line** | `(Enter clearance/retract height …)`, `(mm/min)` — ⚠ never at line start (block-delete); the vendor never starts a line with it |
| `?` | 16 | safe, thin | `(… - Continue?)` |
| `_` | 12 | safe, thin | `(Use save_park_position.nc)` — 12 uses, all one file |
| ⚠ `%` | 335 | **context-dependent — §2a** | inert in an ordinary comment; **LIVE inside a `#1505=` message** |
| ⚠ `[` `]` | 288 / 288 | **legal but misleading** | the vendor uses them, but DDCS uses `[ ]` for EXPRESSIONS and nests them (`#70=[805+[#72*5]]`), so `see fixture [B]` reads as a computed address. The handoff already ruled them poor — **confirmed legal, still not recommended** |
| ⚠ `#` | 25 | **legal but misleading** | `(uses #130-133)` — `#` is the macro-variable sigil; a replacement that looks like a variable is its own hazard |
| ⚠ `;` | 5 | legal, ambiguous | appears only *inside* paren comments as a trailing marker: `(#7 = #882 ;…)`. Too thin and too ambiguous to recommend |
| `+` | 4 | thin | `(inner: span + probe dia)` — 4 uses, one file |
| `"` | 2 | thin | 2 uses, one file |
| ⛔ `(` `)` | — | **structurally illegal** | they delimit — this is the character the setting exists to replace |

**⛔ NOT ATTESTED in any vendor comment.** These appear ONLY in our own CNCDISK files and must not be presented
as vetted: `|` `~` `@` `{` `}` `*` `'` `<` `>`.

### 2a. ⭐ NEW FINDING — `%` is not always inert

`#1505=<n>(message)` is the DDCS **operator-message** mechanism, and inside *that* comment `%` is a live printf
format specifier the controller substitutes:

```
#1505=1(3D Probe: Ball R=%.2f/%.2f Search=%.1f Clear=%.1f - Continue?)
#1505=-5000(G55 corner probed! X=%.3f Y=%.3f Z=%.3f)
```

In an ordinary comment it is a plain percent sign, and the vendor uses it that way far more often:

```
#401 = 30        (Park acceleration % - gentler for bare gantry)
#2004 = 50       (Set max velocity to 50% for park move)
```

**Measured: 335 vendor comments contain `%` — 36 attached to a `#1505=` message line, 299 not.** `[CONFIRMED]`

⇒ `%` is safe as a literal in a normal comment and **unsafe as a blind replacement character**: substituting it
into a message comment would silently change what the operator is shown. ⚠ A replacement setting that does not
know about `#1505` should not offer it.

---

## 3. ⭐ NON-ASCII IS ACCEPTED — the comment body is not restricted to ASCII

The vendor's own macros carry **GBK-encoded Chinese inside comments**, in quantity:

| corpus | high bytes (>0x7F) inside comments | distinct byte values |
|---|---|---|
| Expert SYSDISK | 6664 | 87 |
| Expert OEM firmware | 3332 | 87 |
| Expert OEM CAM packs | 6728 | 90 |
| V4.1 OEM / backup | 756 | 67 |
| DM500 OEM install | 1014 | 73 |

⇒ **The parser tolerates arbitrary high bytes in a comment body** — the constraint is the delimiters, not the
character set. `[CONFIRMED]`

⚠ The encoding is **GBK, not UTF-8**. Anything round-tripping these files must not assume UTF-8, or it will
corrupt vendor macros.

---

## 4. DOES IT DIFFER PER DIALECT? — the honest answer

**The nesting rule: no. It is universal** across everything measured (§1).

**The character list: the evidence is Expert-only, and thin everywhere else.** Stated plainly rather than
padded out:

| dialect | vendor comments | verdict |
|---|---|---|
| **Expert / M350** | 2201 | ⭐ **§2 is grounded here.** `[CONFIRMED]` |
| **V4.1** | 64, only 3 distinct punctuation (`#` `:` `,`) | ⚠ **far too thin to derive a list.** Same DDCS parser family, so Expert's list is the best available — `[HYPOTHESIS]`, not confirmed |
| **V3 / DM500** | 47, only 4 distinct (`#` `-` `,` `:`) | ⚠ same — `[HYPOTHESIS]` |
| **LinuxCNC / RS274NGC** | 4656, 26 distinct | a different dialect with a richer set (`<` `>` `{` `}` `'` `|` all appear upstream). ⛔ **Do not transfer a list either way** |
| **grbl** | 0 files in repo | ⛔ **not answerable from dumps.** grbl ignores parenthesised comments entirely (handoff §1); untested here |
| **centroid / mach3 / mach4 / uccnc** | 0–1 files | ⛔ no corpus. Not answerable |

---

## 5. ⇒ WHAT THIS MEANS FOR THE SETTING

1. **Replacement candidates, ranked by vendor evidence:** `-` · `.` · `:` · `=` · `!` · `,` — all heavily used
   by the vendor, none structurally meaningful, none misleading.
2. ⛔ **Do not offer `[` `]` or `#`.** Legal and attested, but they read as expressions and variables to a
   human standing at the controller. Legal-but-misleading is its own kind of unsafe.
3. ⚠ **Do not offer `%`** unless the writer knows whether it is emitting a `#1505=` message (§2a).
4. ⚠ **`/` is fine mid-comment, never at line start.**
5. ⭐ **The governing constraint is nesting, and that fix already shipped** (`917f8856`). A character-replacement
   setting is a *separate, smaller* feature than the one that was being designed — it does not have to carry
   the nesting problem.

---

## 6. RE-RUN IT

Nothing here needs the machine powered on — it is one pass over the corpora. From `bridge/controllers/`: walk
each corpus, extract flat `(…)` spans as bytes, count non-alphanumeric bytes, and probe nesting by scanning
each line for a second `(` before its `)`. **Provenance is the part that must not be skipped** — folding our
own CNCDISK files into the vendor counts is exactly what would turn this back into a guess.
