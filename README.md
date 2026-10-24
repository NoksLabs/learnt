# Learnt

**You design. AI writes. You learn.**

Learnt turns your coding agent into a coach. Before it writes code, it asks how
you would build the next piece and pushes on your reasoning. It explains new
ideas with an everyday picture mapped onto your own code. Once you lock the
design, it writes the code, then shows what it built and why.

Works with Claude Code, Codex, opencode, pi and omp.

## Quick start

Needs Node.js 24.22.1+ (LTS) or 26.12.1+. Older releases miss the fix for the
Brotli flaw CVE-2026-111497, and the installer refuses them.

```sh
git clone https://github.com/NoksLabs/learnt.git ~/.local/share/learnt
npm install -g ~/.local/share/learnt   # puts `learnt` on PATH, linked to the clone
learnt install --dry-run all           # preview changes
learnt install claude                  # or: codex opencode pi omp, or all
```

`learnt --help` lists every command; `learnt install --help` explains the flags.
Update with `git -C ~/.local/share/learnt pull`, then run the same
`learnt install` again. Remove with `learnt uninstall <agents>`, then
`npm uninstall -g learnt`.

Without the `learnt` command, run the bundle through Node instead:
`node ~/.local/share/learnt/skills/learnt/scripts/learnt.mjs install claude`.

Restart your agent, open a project, and run:

| Agent | Start | Reset |
| --- | --- | --- |
| Claude Code | `/learnt:learnt` | `/learnt:learnt-reset` |
| Codex | `$learnt` | `$learnt-reset` |
| opencode | `/learnt` | `/learnt-reset` |
| pi, omp | `/skill:learnt` | `/skill:learnt-reset` |

Learnt only starts when you run that command. It never switches itself on.

Claude Code only, without the CLI (needs read access to this repo). Pass a
local checkout path instead of `NoksLabs/learnt` to use your clone:

```sh
claude plugin marketplace add NoksLabs/learnt
claude plugin install learnt@learnt
```

## What a session looks like

```text
You:    Add checkout to the shop.

Learnt: ◆ Your move: stock on checkout
        Two people can press "Buy" on the last item at the same moment.
        How would you stop both orders from going through?

You:    Check stock first, then save the order?

Learnt: ◆ Concept: race condition
        Two kids see one cookie in the jar. Both reach in. Both think they
        got it. In your app, two POST /checkout requests both read stock = 1
        and both sell. "Check, then save" leaves a gap between the two steps.
        How could you close that gap in your orders table?

You:    Make the database do the check and the update in one step.

Learnt: ◆ Build go: atomic stock update
        UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0,
        and fail checkout if no row changed. Build this step, or discuss?
```

The idea goes into your curriculum as `practicing`. It becomes `solid` once you
use it on your own and can explain it back.

## What you learn

Your tracks come from the topics you pick at onboarding and anything you ask
about later.

| Track | Everyday picture → your system |
| --- | --- |
| System design | Lemonade stand too busy → split checkout from the email worker |
| Software architecture | Kitchen drawers → `checkout` only calls `payments.charge()` |
| DDD and vertical slicing | "Order" is a food ticket in the kitchen, money owed at billing |
| Encoding and decoding | Secret letter, wrong code book → `cafÃ©` |
| Memory management | All toys on the floor vs one handful → streaming 2 M rows |
| Concurrency | Two kids, one cookie → two checkouts sell the last item |
| Infrastructure | Post office front desk → load balancer and health checks |

Each idea moves through `unseen → introduced → practicing → solid`. Only your
own reasoning moves it past `introduced`. Ideas you're shaky on go on a revisit
list, and the agent asks you to apply them before explaining them again.

## Your notes

Learnt keeps notes in `.learnt/` in your project, as plain Markdown. Add the
folder to `.gitignore`.

| File | Holds |
| --- | --- |
| `operator.md` | Who you are, why you're learning, how you like explanations, your pace |
| `curriculum.md` | Your tracks and ideas, each with a level, evidence and a revisit flag |
| `journal.md` | Learning events, newest first, and any checkpoint still waiting on you |
| `system.md` | Your model of the system: parts, flow, data, trust, unknowns |

Learning mode comes back after restarts, `/clear` and compaction, and the agent
picks up any open checkpoint where you left it.

## Reset

A reset marks a milestone. Pick a scope:

| Scope | Resets | Keeps |
| --- | --- | --- |
| `onboarding` | `operator.md` | curriculum, journal, system map |
| `progress` | `curriculum.md`, `journal.md` | operator, system map |
| `everything` | all four notes | nothing |

For `progress` and `everything`, the agent first shows a short retro of your
solid, practicing and revisit ideas. Then it asks you to confirm and backs up
every note to `.learnt/backups/`. After the reset it re-baselines: one applied
question per track, set in your own system.

## Agents

| Agent | Installer does | Learning mode restored by |
| --- | --- | --- |
| Claude Code | Adds this folder as a plugin marketplace, installs `learnt@learnt` | `SessionStart` hook: startup, resume, clear, compact, fork |
| Codex | Copies skills to `~/.codex/skills/`, merges a hook into `~/.codex/hooks.json` | `SessionStart` hook: startup, resume, clear, compact |
| opencode | Links the plugin into `~/.config/opencode/plugins/`, writes two commands | System prompt transform, every request |
| pi | `pi install` this folder | Named prompt section, every turn |
| omp | `omp plugin link` this folder | Prompt append, every turn |

`learnt uninstall <agents>` reverses an install. The installer backs up config files to `~/.learnt-install-backups/<time>/` before
changing them.

- **Codex:** trust the hook in `/hooks`. Codex uses copies of the skills, so run
  `learnt install codex` again after updating. To get pickers in Default mode, set
  `[features] default_mode_request_user_input = true` in `~/.codex/config.toml`.
- **pi:** has no picker tool, so choices come as numbered text.

## Safety

- The restore message only names your note files and never copies their text.
  It stays the same size and can't carry instructions planted in a note.
- Learnt doesn't auto-load notes tracked by Git, since a cloned repo could have
  planted them.
- The search for notes stops at the Git or worktree root. Outside Git it stops at
  your home folder, and outside home it checks only the current folder.
- Symlinked notes, note folders and backup folders are refused.
- Skills single-quote every shell path, so `$(...)` in a folder name can't run.
- Learning mode needs an explicit `Learning mode: active` line. `paused`
  anywhere in the file wins.
- A reset token covers the folder, the scope and the exact note contents. It
  can't widen the scope, hit another project, or wipe notes edited since the
  preview.

## Development

| Path | What it is |
| --- | --- |
| `skills/learnt/` | The skill: `SKILL.md`, `teaching.md`, `topics.md`, `onboarding.md`, `notes.md` |
| `skills/learnt-reset/` | Scoped reset with a retro |
| `src/` | Logic in [Effect](https://effect.website) 4: find notes, build the restore message, reset, install |
| `skills/learnt/scripts/learnt.mjs` | Bundled CLI: `hook`, `context`, `status`, `reset` |
| `adapters/pi/learnt.js`, `adapters/opencode/learnt.js` | Bundled in-process extensions |

```sh
just ck          # typecheck
just b           # build src/ into the three committed bundles
just t           # tests
just check       # all of the above; fails if a bundle differs from a rebuild
just validate    # claude plugin validate
```

Review `src/`, not the bundles. The bundles are unminified and rebuild
byte-for-byte from the same source and `bun.lock`.

The tests cover note lookup and its safety rules, the Claude Code hook run
exactly as `hooks.json` registers it, every reset scope and failure path, the
installers in a temporary home, and both adapter bundles loaded in Node. They
don't show that a model teaches well.

## Licence

[MIT](LICENSE) © 2026 NoksLabs LTD
