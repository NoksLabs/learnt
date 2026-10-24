# Learnt

Instructions for any coding agent (Claude Code, Codex, opencode, pi, omp) working
on this repository. `CLAUDE.md` imports this file for Claude Code.

## What this is

A learning-first development plugin shipped to five agents from one copy of the
skills. See `README.md` for the full picture.

- `src/` — the logic, written with Effect 4. Review and edit this, never the bundles.
- `skills/learnt/scripts/learnt.mjs`, `adapters/pi/learnt.js`,
  `adapters/opencode/learnt.js` — generated bundles, committed. Rebuild, don't hand-edit.
- `skills/` — Agent Skills (`SKILL.md`). `behavior.md`, `onboarding.md` and
  `state-templates.md` are the original VibeWise text; keep edits minimal.
- `.claude-plugin/`, `hooks/hooks.json` — Claude Code plugin and marketplace.
- `src/install.ts` — per-agent installer.

## Commands

Use Bun.

```sh
bun install            # dev dependencies
bun run typecheck      # tsc --noEmit
bun run build          # regenerate the three bundles from src/
bun test
bun run check          # typecheck + build + bundle drift check + tests
claude plugin validate .claude-plugin/plugin.json
claude plugin validate .claude-plugin/marketplace.json
```

After any change to `src/`, run `bun run build` and commit the bundles with the
source. `bun run check` fails if a committed bundle differs from a fresh build.

## Rules

- Make the smallest change that solves the task; match the surrounding style.
- Keep the security properties listed in `README.md` (tracked notes not
  auto-loaded, bounded state search, single-quoted shell paths, no symlinked
  state, confirmed resets with backups). Add a test when touching them.
- Restoration messages point to note files; never copy note contents into them.
- Skills must stay agent-neutral: name tools by role, as in the table in
  `skills/learnt/SKILL.md`.
- Pin dependency versions exactly; bundles must stay reproducible.
- Report failures and skipped steps plainly.
