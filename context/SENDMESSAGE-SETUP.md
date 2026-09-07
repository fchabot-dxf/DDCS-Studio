# Cross-session messaging between seats — setup + gotchas

How to get **live two-way `SendMessage`** between seats on different machines (Ranchy ↔ ASUS ↔ Fairy),
instead of only the async git channel. Learned the hard way 2026-09-07; source: Claude Code docs
`cross-session-messaging.md` + `remote-control.md`.

## The one requirement: Remote Control in **CONNECTED** mode (not server mode)
Both modes are called "Remote Control," but only one enables cross-machine peer messaging:

| mode | command | what it does | cross-machine `ListAgents`/`SendMessage`? |
|---|---|---|---|
| **server** | `claude remote-control` | serves THIS session to your phone/browser | ❌ no |
| **connected** | `claude --remote-control` **or** `/remote-control` | signs into claude.ai, connects OUTBOUND | ✅ **yes** |

A session in *server* mode has **no `ListAgents` tool at all**, and its `SendMessage` reaches only subagents it
spawned. A session in *connected* mode gets `ListAgents` populated with your account's sessions on other
machines + cloud, and `SendMessage` that routes to them "over Remote Control."

## To enable it (on the seat that can't send)
⛔ **You must START A FRESH session in connected mode — a `/remote-control` toggle on an already-running
session does NOT work.** Confirmed empirically 2026-09-07: toggling RC on a running session leaves `SendMessage`
subagents-only and adds no `ListAgents` at all — **the cross-session tools are fixed at STARTUP and cannot be
retrofitted mid-session.** So:
```
claude --remote-control "<Session Name>"
```
Launch that as a NEW session (connected from the first moment) and continue the work there. Toggling
`/remote-control` inside an existing session is a dead end for this.

Then **verify**: run **`/list-agents`** (or the `ListAgents` tool). You should see "Remote Control sessions on
other machines." If you see the peer, `SendMessage` to it works.

## Prerequisites (usually already true)
- Signed into claude.ai (`claude /login`) — Pro/Max/Team/Enterprise sub, **not** API-key auth.
- No `ANTHROPIC_BASE_URL` override (no gateway/proxy).
- No telemetry blockers set: `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`,
  `DISABLE_GROWTHBOOK`.
- Workspace trust accepted (run `claude` once in the project dir).
- Version ≥ **v2.1.234** (native Windows) / **v2.1.224** (macOS/Linux/WSL2).

## ⚠ Gotchas that cost us real time
1. ⛔ **`{"success":true}` from `SendMessage` means "ROUTED," not "delivered + read."** Confirm with a reply.
2. ⛔ **A session can RECEIVE cross-session pushes even in server mode, but can't SEND back** unless connected.
   That's the "it worked once, now one-way" trap: sender connected, receiver not.
3. ⛔ **Stale ref.** A restarted session gets a NEW `[ref]`. Messaging an OLD ref returns `success:true` and
   **never delivers** (routes into the void). ALWAYS re-run `ListAgents` for the current ref before messaging —
   don't reuse a ref from an earlier listing.
4. `ListAgents` labels rows by KIND (Remote Control / interactive / cloud), **not by machine** — you can't tell
   which box a session is on from the list alone; go by its name.

## The two channels, and when to use each
- **Live `SendMessage`** (both seats in connected mode) — for the interactive back-and-forth of active work
  (e.g. shard setup). Fast, but ephemeral.
- **`context/SHARD-COMMS.md`** (git commits, pull to read) — the DURABLE async log + the fallback when a seat
  isn't connected. The repo is always the reliable channel; the human is the nudge ("pull now").

⭐ **And: both seats must be on the SAME BRANCH/commit.** Everything is merged to `main` — track `main`, not any
feature branch — or a sharded run's merged report is garbage (see `HANDOFF-TO-ASUS.md` same-commit discipline).
