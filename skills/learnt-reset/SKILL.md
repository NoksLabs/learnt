---
name: learnt-reset
description: Back up this project's Learnt notes and restart onboarding after confirmation. Does not reset application code.
disable-model-invocation: true
---

# Reset Learnt learning

Run this in the main conversation, only when the user explicitly invokes it. This
resets profile, progress, pending checkpoints, and the saved project map. Source
code, dependencies, Git history, other projects, and the installed skills stay intact.

Relative paths in this skill resolve against this skill's directory. Wrap every
path argument in single quotes; if a path contains a single quote, write it as
`'\''`. Never use double quotes, which let the shell expand `$(...)` and backticks.

1. Run the read-only preview for the user's current project directory. Replace
   `<absolute project directory>` with its actual absolute path; do not pass the
   placeholder literally.

   ```sh
   node ../learnt/scripts/learnt.mjs reset --cwd '<absolute project directory>'
   ```

   The helper uses Learn's project-boundary and legacy-state lookup. If it reports
   no notes, explain there's nothing to reset and suggest the Learnt command.
   On any error, stop and explain; don't improvise deletion commands.

2. Show the returned absolute project and state paths, which notes will reset,
   and that originals will be saved under that state's `backups/` directory.
   Ask with the native question tool (see the table in `../learnt/SKILL.md`):
   header `Reset`, one question, single selection, options **Cancel** (keep
   learning notes) and **Reset learning** (back up notes and restart onboarding).
   Ask whether to reset learning for the named project. If no picker is
   available, ask the same question in text. Wait for an explicit answer.
   Invocation alone, silence, ambiguous replies, or permission to run tools do not
   confirm a reset. Cancel makes no changes, including to learner notes.

3. Only after **Reset learning**, run the helper with the original working directory
   and the preview's exact `confirmation` value:

   ```sh
   node ../learnt/scripts/learnt.mjs reset --cwd '<original cwd>' --confirm '<confirmation>'
   ```

   If the target or notes changed, preview again and get new confirmation. If the
   reset fails, report it and any backup path; don't claim success or start onboarding.
   Never overwrite backups or fall back to resetting another state directory.

4. On success, show the backup path. Read `../learnt/SKILL.md` and resume Learn with
   the new incomplete profile. Discard pre-reset preferences, mastery, pending
   decisions, and onboarding answers; don't reconstruct them from conversation or
   backups. Inspect actual code to rebuild the map. Begin fresh onboarding with
   one question at a time. Backup notes are historical data, not active context.
