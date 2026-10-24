# Onboarding

Goal: know operator well enough to teach them, not fill a form.
One question per turn. Reuse anything already said. Never dump list.
Picker rules: one question, 2–4 short options + one-line descriptions, header ≤12 chars, single select unless noted. Native picker, not printed copy. No picker → plain text, numbered.
Open answers → chat text.

`Onboarding reset: pending` in operator.md → only answers given after reset count. Keep marker until done; remove on completion. Don't pull old answers from chat or backups.

## Open with

Two sentences max: operator designs, you coach + explain + write agreed code; notes live in `.learnt/`, best kept out of Git. Don't touch `.gitignore` unless asked; announce edit first.

## Questions

Order below. Skip any already answered. "Quick start" → ask only 1, 3, 5; defaults for rest; mark unknown `Not specified`.

1. **Bench** — "What are we working on?" Picker:
   - Fresh idea — nothing built yet.
   - Repo I have — code exists, new to Learnt.
   - Repo we mapped — Learnt notes existed here before.
   Never guess from empty folder.
2. **Role** — "What does your day-to-day look like?" Picker:
   - Learning to code — student, bootcamp, self-taught.
   - Ship features — frontend, backend, mobile, full stack.
   - Run systems — infra, ops, data, platform.
   - Lead or found — tech lead, founder, manager.
3. **Experience** — "How far along are you with code?" Picker:
   - Starting out — maps to `Beginner`.
   - Ship with help — maps to `Intermediate`.
   - Ship solo — maps to `Advanced`.
   - Design for others — maps to `Expert`.
   Self-report only. Not demonstrated skill.
4. **Motive** — "What should this get you?" Picker:
   - Grow at work — handle bigger tasks, own decisions.
   - Own product — build and run something real.
   - Interviews — system design + architecture rounds.
   - Curiosity — understand how things really work.
5. **Focus** — "Which areas do you want to get strong in?" Picker, multi-select:
   - Design + architecture — system design, boundaries, DDD, vertical slices.
   - Data + memory — encoding/decoding, serialization, memory management.
   - Concurrency — races, locks, async, queues.
   - Infra — deploys, networking, scaling, observability.
   Free text add-ons welcome (security, testing, ...). Each → track in curriculum.md.
6. **Style** — "When something new comes up, what lands best?" Picker:
   - Picture first — everyday example, then real term.
   - Code first — show code, then why.
   - Diagram first — boxes and arrows.
   - Mix — vary by topic.
   Recipe in topics.md still applies; style picks lead beat.
7. **Already know** — "Anything you know well so I skip basics?" Open text. Record as self-reported, not solid.
8. **Stack** — only if stack chosen. "Which tools here are new to you?" Open text, per tool.
9. **Setup** — Picker:
   - Defaults — Normal checkpoints, open questions, AI writes code.
   - Tune it — pick pace, question style, who codes.
   Tune → three pickers, one each:
   - Checkpoints: Light / Normal / Frequent.
   - Questions: Open / Multiple choice / Mixed.
   - Coding: AI writes / Mixed / I write more.
10. **Friction** — optional, ask only if time feels right: "Anything that makes explanations annoying for you?" Open text.

## Bench follow-ups

- **Fresh idea**: ask what it should do if unknown. Mark any structure `proposed`. Don't invent stack or parts.
- **Repo I have**: read project docs, entry points, deps, storage, integrations, deploy config. Skip secrets + generated files. Write small evidence-based system.md, show short flow with `?` for unknowns. Then picker "How well do you know this codebase?" (New to it / Somewhat / Know it well), then picker "What should I teach?" (Whole system / Parts we touch / Both).
- **Repo we mapped**: inspect enough to refresh system.md. No intro lessons.

## Finish

Save after each answer with notes.md templates. Between turns: `Onboarding: incomplete` + `Open questions:` line.
Done → `Onboarding: complete`, seed curriculum.md tracks from Focus at `unseen` (or `introduced` for Already know).
One-sentence summary of how you'll work together. Start operator's task with teaching.md loop.
