# Learnt

**You design. AI writes. You learn.** Learning-first development for five coding
agents: Claude Code, Codex, opencode, pi and omp.

The agent asks how you would build each piece, pushes on your reasoning, and
explains new ideas with an everyday picture mapped onto your own code. You lock
the design; the agent writes it, then shows what it built and why.

## What you learn

Tracks grow from what you pick at onboarding and what you ask for later:

| Track | Example from a shop app |
| --- | --- |
| System design | Lemonade stand too busy → split checkout from the email worker |
| Software architecture | Kitchen drawers → `checkout` only calls `payments.charge()` |
| DDD and vertical slicing | "Order" means a food ticket in the kitchen, money owed at billing |
| Encoding and decoding | Secret letter with the wrong code book → `cafÃ©` |
| Memory management | Dumping every toy on the floor vs one handful → streaming 2 M rows |
| Concurrency | Two kids, one cookie → two checkouts sell the last item |
| Infrastructure | Post office front desk → load balancer and health checks |

Each idea moves `unseen → introduced → practicing → solid`, and only your own
reasoning moves it past `introduced`. Shaky ideas go on a revisit list.

## Notes

Kept in `.learnt/` in your project. Add it to `.gitignore`.

| File | Holds |
| --- | --- |
| `operator.md` | Who you are, why you're learning, how you like things explained, pace |
| `curriculum.md` | Tracks, ideas, level, evidence, what to revisit |
| `journal.md` | Learning events, newest first, and any open checkpoint |
| `system.md` | Your model of the system: parts, flow, data, trust, unknowns |

## Layout

| Path | What it is |
| --- | --- |
| `skills/learnt/` | The skill: `SKILL.md`, `teaching.md`, `topics.md`, `onboarding.md`, `notes.md` |
| `skills/learnt-reset/` | Scoped reset with a learning retro |
| `src/` | Logic in [Effect](https://effect.website) 4: find notes, build the restore message, reset |
| `skills/learnt/scripts/learnt.mjs` | Bundled CLI: `hook`, `context`, `status`, `reset` |
| `adapters/pi/learnt.js`, `adapters/opencode/learnt.js` | Bundled in-process extensions |

## Install

Needs [Bun](https://bun.sh) to build and install, and Node.js 18+ on `PATH` at
runtime. Bundles are committed, so agents need no `node_modules`.

```sh
cd ~/.local/share/ai-learnings/learnt
bun install
bun src/install.ts --dry-run all
bun src/install.ts claude codex opencode pi omp
```

Name only the agents you want. `--uninstall` reverses. Config files are backed up
under `~/.learnt-install-backups/<time>/` before any change.

| Agent | Installer does | Start | Reset |
| --- | --- | --- | --- |
| Claude Code | `claude plugin marketplace add` this folder, `claude plugin install learnt@learnt` | `/learnt:learnt` | `/learnt:learnt-reset` |
| Codex | Copies skills to `~/.codex/skills/`, merges a SessionStart hook into `~/.codex/hooks.json` | `$learnt` | `$learnt-reset` |
| opencode | Links the plugin into `~/.config/opencode/plugins/`, writes two commands | `/learnt` | `/learnt-reset` |
| pi | `pi install` this folder | `/skill:learnt` | `/skill:learnt-reset` |
| omp | `omp plugin link` this folder | `/skill:learnt` | `/skill:learnt-reset` |

Restart each agent after install.

- **Codex:** trust the hook in `/hooks`. Re-run `bun src/install.ts codex` after
  rebuilding, since Codex uses copies. For pickers in Default mode set
  `[features] default_mode_request_user_input = true` in `~/.codex/config.toml`.
- **pi:** no picker tool, so choices come as numbered text.

## Restoring learning mode

| Agent | How | Covers |
| --- | --- | --- |
| Claude Code | `SessionStart` hook in `hooks/hooks.json` | startup, resume, clear, compact, fork |
| Codex | `SessionStart` hook in `~/.codex/hooks.json` | startup, resume, clear, compact |
| opencode | `experimental.chat.system.transform` | every request |
| pi | `before_agent_start` named prompt section | every turn |
| omp | `before_agent_start` appends to the prompt | every turn |

The restore message names the note files and never copies them, so it stays the
same size and can't carry text planted in a note.

Skills only start when you ask: `disable-model-invocation: true` (Claude Code, pi,
omp), `allow_implicit_invocation: false` (Codex), commands instead of skills
(opencode).

## Reset

Reset is a milestone, not a delete button. Pick a scope:

| Scope | Resets | Keeps |
| --- | --- | --- |
| `onboarding` | `operator.md` | skills, journal, system map |
| `progress` | `curriculum.md`, `journal.md` | operator, system map |
| `everything` | all four | nothing |

For `progress` and `everything` the agent first shows a short retro (solid,
practicing, revisit). Then it previews, asks you to confirm, backs up every note
to `.learnt/backups/<scope>-<time>-*/`, and resets. Afterwards it re-baselines:
open onboarding questions only, or one applied question per track on your own
system to place your level again.

The confirmation token covers the folder, the scope and the exact note contents,
so a token can't widen the scope, hit another project, or wipe notes edited since
the preview.

## Safety

- Notes Git tracks are not loaded automatically; they may have come with a clone.
- The search for notes stops at the Git or worktree root, or at home outside Git;
  outside home only the current folder counts.
- Symlinked notes, note folders and backup folders are refused.
- Skills single-quote every shell path, so `$(...)` in a folder name can't run.
- Learning mode turns on only with an explicit `Learning mode: active` line;
  `paused` anywhere wins.

## Development

`just` lists every recipe (`i`, `ck`, `b`, `t`, `check`, `validate`,
`install`, `install-dry`, `uninstall`). The raw commands:

```sh
bun run typecheck
bun run build          # src/ -> the three committed bundles
bun test
bun run check          # all of the above, fails if a bundle differs from a rebuild
claude plugin validate .claude-plugin/plugin.json
claude plugin validate .claude-plugin/marketplace.json
```

Review `src/`, not the bundles. Bundles are unminified and reproducible from the
same source and `bun.lock`.

Tests cover note lookup and its safety rules, the Claude Code hook run exactly as
`hooks.json` registers it, every reset scope and failure path, the installers in a
temporary home, and both adapter bundles loaded in Node. They don't show that a
model teaches well.

## Licence

[MIT](LICENSE).
