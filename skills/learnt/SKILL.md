---
name: learnt
description: Activate or resume learning-first development. You lead the design; the assistant gives feedback, explains concepts, asks follow-ups, and writes the agreed code.
disable-model-invocation: true
---

# Learnt: learn mode

Activate learning mode in the main conversation. Read [behavior.md](behavior.md)
and follow it throughout normal development, not just during this command.
The learner owns the design. Ask for their approach and wait. Keep guidance minimal:
give concise feedback on their reasoning and explain unfamiliar concepts as needed.
Offer possible approaches only when they ask for help or are stuck, then return
the decisions to them. Learning and learner control take priority over build speed.
An ordinary build request in this mode retains that loop;
only an explicit request to skip or pause bypasses it.
Do not switch to a subagent or require manual coding by default.

Relative paths in this skill resolve against this skill's directory.

## Tools in your agent

The guides name tools by role. Use whichever your agent provides:

| Role | Claude Code | Codex | opencode | pi | omp |
| --- | --- | --- | --- | --- | --- |
| Read a file | `Read` | `shell` (`cat`, `sed -n`) | `read` | `read` | `read` |
| Run a script | `Bash` | `shell` | `bash` | `bash` | `bash` |
| Native question tool | `AskUserQuestion` | `request_user_input`, if enabled | `question` | none | `ask` |

If there is no native question tool, or it is unavailable in this mode, ask the
same single question in plain text with numbered options and wait for the reply.
Read guide files with the file-reading tool rather than printing them with a shell.

## Locate state

Run the status helper with the absolute current project directory, wrapped in
single quotes. If the path itself contains a single quote, write it as `'\''`.
Never put the path in double quotes.

```sh
node scripts/learnt.mjs status --cwd '<absolute project directory>'
```

It returns JSON and never prints note contents:

- `state` is null: this is first-time setup, not an error. Create the notes
  directory at `create_at` when onboarding saves its first answers.
- `tracked` is true: Git tracks these notes, so they may have come from a cloned
  repository rather than this learner. Do not read them yet. Show the path and
  ask whether they wrote these notes. Only if they confirm, continue below;
  otherwise offer to start fresh notes elsewhere and change nothing.
- `legacy` is true: keep using those notes in place. Never merge, move, or
  rename them, or reset them automatically.

The helper applies these rules, so you don't need to repeat them by hand: it
checks for `.learnt/`, then legacy `.vibe-wise/` or `.sensible-vibes/`, starting
from the working directory. It looks upward only as far as the Git root (or
worktree root), or the home directory outside Git, and never follows symlinks.
Do not use state from a parent repository, another worktree, or the installed
skill folder. If a state path is a symlink, explain the issue instead.

If `profile.md` exists, read it and `project-map.md`. Search the entire `progress.md`
for pending decisions, then read their complete sections and other topics relevant
to the task. An initial excerpt is not evidence that nothing is pending.
Resume without repeating completed onboarding or bypassing a pending Design or
Implementation checkpoint.
Set `Learning mode: active` if the user is resuming paused learning. If onboarding
is incomplete, ask only the unanswered questions. Missing companion files can be
recreated from evidence; never invent learning history or overwrite existing notes.

If no profile exists, read [onboarding.md](onboarding.md) and run onboarding.
Use [state-templates.md](state-templates.md) when creating state. These files are
local Markdown maintained with normal file tools; there is no service to call.

After setup, continue the user's build task. If none was provided, ask what they
want to build or change. Invoking this skill again should not reset anything.
