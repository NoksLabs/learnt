# Learnt

**You build. AI writes.** Learning-first development for five coding agents:
Claude Code, Codex, opencode, pi and omp.

The agent asks for your approach first, helps you examine trade-offs, and explains
unfamiliar concepts. You own the design and decide when it is ready to implement.
The agent writes the agreed code, then explains what changed and why.

Learnt is a port of [VibeWise](https://github.com/nykooi1/vibe-wise) by Noah Kim
(MIT). The teaching behaviour (`skills/learnt/behavior.md`, `onboarding.md`,
`state-templates.md`) is the original text with agent-specific tool names made
neutral. The rest is reworked so one copy of the skills runs in every agent.

## How it works

| Piece | What it does |
| --- | --- |
| `skills/learnt/` | The Learn skill: guide, behaviour, onboarding and note templates (Agent Skills `SKILL.md` format). |
| `skills/learnt-reset/` | Backs up notes and restarts onboarding, only after you confirm. |
| `src/` | The logic, written with [Effect](https://effect.website) 4. It finds the notes, builds a short restoration message (never the notes' contents) and performs confirmed resets. |
| `skills/learnt/scripts/learnt.mjs` | Bundled command line for hooks and skills: `hook`, `context`, `status`, `reset`. |
| `adapters/pi/learnt.js`, `adapters/opencode/learnt.js` | Bundled in-process extensions, so pi, omp and opencode spawn nothing per prompt. |

Notes live in `.learnt/` in your project: `profile.md`, `progress.md` and
`project-map.md`. Existing `.vibe-wise/` or `.sensible-vibes/` notes from the
original plugin are used in place, so you can switch agents mid-project and keep
your progress. Add `.learnt/` to your `.gitignore`.

## Install

You need [Bun](https://bun.sh) to build and install, and Node.js 18 or later on
`PATH` at runtime: the Claude Code and Codex hooks, and the skills' `status` and
`reset` steps, run `node`. The bundles are committed, so the agents need no
`node_modules`.

```sh
cd ~/.local/share/ai-learnings/learnt
bun install                            # dev tools: effect, typescript
bun src/install.ts --dry-run all       # show what would change
bun src/install.ts claude codex opencode pi omp
```

To install for some agents only, name just those. `--uninstall` reverses an install.
Before changing or removing any of your config files, the installer saves a copy
under `~/.learnt-install-backups/<time>/`.

| Agent | What the installer does | Start learning | Reset |
| --- | --- | --- | --- |
| Claude Code | `claude plugin marketplace add` this folder, then `claude plugin install learnt@learnt` | `/learnt:learnt` | `/learnt:learnt-reset` |
| Codex | Copies both skills to `~/.codex/skills/` and adds a SessionStart hook to `~/.codex/hooks.json`, keeping your other hooks | `$learnt` | `$learnt-reset` |
| opencode | Symlinks the plugin into `~/.config/opencode/plugins/` and writes two commands | `/learnt` | `/learnt-reset` |
| pi | `pi install` this folder | `/skill:learnt` | `/skill:learnt-reset` |
| omp | `omp plugin link` this folder | `/skill:learnt` | `/skill:learnt-reset` |

Restart each agent afterwards. Extra steps:

- **Codex:** open `/hooks` and trust the Learnt hook; Codex skips untrusted hooks.
  Re-run `bun src/install.ts codex` after rebuilding, since Codex uses copies.
- **Codex pickers:** Codex only offers its multiple-choice tool (`request_user_input`)
  in Default mode when `[features] default_mode_request_user_input = true` is set in
  `~/.codex/config.toml`. Without it, questions are asked in plain text.
- **pi:** pi has no built-in question tool, so choices are asked in plain text.

## How each agent restores learning mode

| Agent | Mechanism | Covers |
| --- | --- | --- |
| Claude Code | `SessionStart` hook in `hooks/hooks.json` | startup, resume, clear, compact, fork |
| Codex | `SessionStart` hook in `~/.codex/hooks.json` | startup, resume, clear, compact |
| opencode | `experimental.chat.system.transform` plugin hook, before every request | every turn, including after compaction |
| pi | `before_agent_start` sets a named system-prompt section | every turn |
| omp | `before_agent_start` appends to the turn's system prompt | every turn, including `/clear`, which fires no event in omp |

The skills stay out of the model's automatic skill list wherever the agent allows
it, so learning mode only starts when you ask:

- **Claude Code, pi, omp:** `disable-model-invocation: true`.
- **Codex:** `agents/openai.yaml` with `allow_implicit_invocation: false`.
- **opencode:** ignores that flag, so it gets commands instead of discoverable skills.

## Security changes from the original

1. **Notes that Git tracks are not loaded automatically.** Learning notes are
   personal and normally ignored. If they are tracked, they may have arrived with a
   cloned repository, so the agent asks whether you wrote them before reading them.
   This closes a route for prompt injection through committed notes.
2. **The search for notes is bounded.** Inside Git it stops at the repository or
   worktree root, as before. Outside Git it now stops at your home directory, and
   outside home it checks only the current folder. This stops another user's
   `/tmp/.learnt` from being picked up.
3. **Shell arguments are single-quoted.** The skills tell the agent to wrap paths in
   single quotes, so a folder name containing `$(...)` cannot run a command.

Kept from the original:
- Symlinked notes or state folders are rejected.
- Restoration messages point to files rather than copying notes.
- Resets need an explicit confirmation token and back up the originals first.

## Development

```sh
bun run typecheck      # tsc --noEmit
bun run build          # bun build: src/ -> the three committed bundles
bun test               # 51 tests
bun run check          # all of the above, and fails if a bundle differs from a rebuild
claude plugin validate .claude-plugin/plugin.json
claude plugin validate .claude-plugin/marketplace.json
claude plugin validate skills
```

Review `src/`, not the bundles. The bundles are generated, unminified and
reproducible (the same source and `bun.lock` give byte-identical files), and
`bun run check` fails when a committed bundle doesn't match a fresh build. That
catches hand edits and forgotten rebuilds. Our own code is at the end of each
bundle; everything before it is Effect 4.0.0 and `@effect/platform-node` 4.0.0, both pinned exactly.

| Bundle | Size | Why |
| --- | --- | --- |
| `learnt.mjs` (CLI) | about 1.0 MB | Built with `effect/cli` and `@effect/platform-node`, and uses `Schema` to validate the untrusted hook input on stdin. Starts in about 60 ms; runs once per session. |
| pi/omp and opencode adapters | about 230 KB each | No CLI or `Schema`; errors use `Data.TaggedError`. Run on every prompt. |

The tests cover:
- the original 37 hook and reset cases, with the hook tests running the exact
  `hooks.json` command against the built bundle;
- the security changes above;
- reset failure paths, by swapping in a `Files` layer that fails on demand;
- the Codex and opencode installers, in a temporary home;
- both adapter bundles, loaded in Node with stand-in agent objects.

They do not show that a model teaches well.

## Licence

[MIT](LICENSE). The original copyright notice is kept, as the licence requires.
