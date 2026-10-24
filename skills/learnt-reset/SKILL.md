---
name: learnt-reset
description: Reset part or all of this project's Learnt notes after confirmation. Shows a learning retro first, backs up notes, then re-baselines. Never touches app code.
disable-model-invocation: true
---

# Learnt reset

Reset = learning milestone, not delete button. Show what operator learned, back up, restart only chosen part, re-baseline.
Only when operator invokes it. Main conversation. App code, deps, Git history, other projects, installed skills: untouched.

Paths relative to this file's folder. Every path arg in single quotes; quote inside path → `'\''`. Never double quotes (shell expands `$(...)`, backticks).

## Scopes

| Scope | Resets | Keeps | Use when |
| --- | --- | --- | --- |
| `onboarding` | `operator.md` | curriculum, journal, system | role, goals, or style changed |
| `progress` | `curriculum.md`, `journal.md` | operator, system | want fresh start on skills, new focus |
| `everything` | all four notes | nothing active | new operator or full restart |

## Steps

1. **Pick scope.** Picker, header `Reset`: **Redo onboarding**, **Restart progress**, **Everything**, **Cancel**. Wait. Cancel → stop, change nothing.

2. **Preview.** Read-only. Real absolute path, not placeholder.

   ```sh
   node ../learnt/scripts/learnt.mjs reset --cwd '<absolute project directory>' --scope '<scope>'
   ```

   `no_notes` → nothing to reset; suggest Learnt command. Any error → stop, explain. Never improvise delete commands.

3. **Retro** (scope `progress` or `everything`). Read curriculum.md. Show operator, plain sentences, short:
   - Solid: ideas they own now.
   - Practicing: ideas in progress.
   - Revisit: shaky ones.
   One line on biggest jump since start, from journal evidence. No praise, just facts.
   Retro is shown, not saved; old notes live in backup.

4. **Confirm.** Show project path, notes folder, `reset` list, `kept` list, backup goes under `backup_parent`. Picker, header `Reset`: **Cancel** (keep notes as is), **Reset <scope>** (back up, reset listed notes). Wait for explicit pick. Invocation, silence, vague reply, tool permission ≠ confirmation.

5. **Run.** Only after **Reset <scope>**. Same cwd, same scope, preview's exact `confirmation`:

   ```sh
   node ../learnt/scripts/learnt.mjs reset --cwd '<original cwd>' --scope '<scope>' --confirm '<confirmation>'
   ```

   Changed target/scope/notes error → preview again, confirm again. Failure → report it + backup path; don't claim success. Never overwrite backups or reset another folder.

6. **Re-baseline.** Show backup path. Read `../learnt/SKILL.md`, resume Learnt:
   - `onboarding`: ask open questions in operator.md only. Keep curriculum; tune teaching to it.
   - `progress`: seed tracks from operator Focus at `unseen`. Offer quick baseline: one short applied question per track on operator's own system; set level from answer. Skip baseline if operator declines.
   - `everything`: full onboarding, then inspect code to rebuild system.md.

   Backups = history, not active context. Don't copy old levels, answers, or open checkpoints back.
