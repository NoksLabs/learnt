# Notes

Four files in `.learnt/` (folder chosen by SKILL.md). Nothing else.
Brackets → real evidence or `Not specified`. Keep two status lines in operator.md plain, near top; hook reads them.
Never replace existing note with template.

| File | Holds | Changes when |
| --- | --- | --- |
| `operator.md` | who operator is, how they learn, prefs, status | answers change; edit in place |
| `curriculum.md` | tracks, ideas, mastery level, evidence, revisit queue | operator shows or loses understanding |
| `journal.md` | learning events newest first, open checkpoint | each learning event or checkpoint |
| `system.md` | operator's model of the system + verified code | design locked, code built, code inspected |

## operator.md

```markdown
# Operator

Learning mode: active
Onboarding: complete

## Who
Role: [Learning to code / Ship features / Run systems / Lead or found]
Experience: [Beginner / Intermediate / Advanced / Expert] (self-reported)
Motive: [Grow at work / Own product / Interviews / Curiosity / text]
Already know: [self-reported list]
Friction: [what makes explanations annoying]

## Bench
Situation: [Fresh idea / Repo I have / Repo we mapped]
Building: [what it does]
Codebase familiarity: [New to it / Somewhat / Know it well]
Teach: [Whole system / Parts we touch / Both]
Stack new to operator: [per tool]

## How they learn
Lead with: [Picture / Code / Diagram / Mix]
Checkpoints: Normal
Questions: Open
Coding: AI writes
```

## curriculum.md

```markdown
# Curriculum

## [Track, e.g. Concurrency]
Why: [operator's reason, from Focus or request]

- [Idea, e.g. Race condition] — level: [unseen / introduced / practicing / solid]
  Evidence: [operator's own reasoning, short; date]
  Revisit: [what to re-check, only if shaky]
```

One section per track. Ideas grow as work touches them. Level up only on operator evidence (see topics.md). Your explanation alone → max `introduced`.

## journal.md

```markdown
# Journal

## Open checkpoint
Type: [Your move / Design lock / Build go]
Stage: [awaiting reasoning / awaiting lock / awaiting build approval]
Proposal: [what was proposed, exact scope]
Waiting on: [what reply]

## [YYYY-MM-DD] [Short title]
- Learned: [idea + track]
- Operator reasoning: [their words, short]
- Gap: [what wobbled]
```

`Open checkpoint` only while waiting; delete once resolved. Survives restart + compaction.
Approval covers only proposal shown. Don't add unmentioned fields, behaviours, rejected options, reasons. Unknown → mark unknown. Your ideas → mark proposed, never as operator's.
Requirements and product taste aren't evidence of engineering skill.
Each entry readable alone. Merge repeats.

## system.md

```markdown
# System

## Purpose
[What the software does.]

## Requirements
[Needs + limits. Don't settle tech choices by themselves.]

## Parts
[Component — job — files. Tag: proposed / locked / built.]

## Main flow
[Short text diagram, labelled arrows. `?` for unknowns.]

## Data + trust
[Storage, ownership, auth, outside services. Unverified → unknown.]

## Build + deploy
[Commands + config paths verified in repo.]

## Open questions
[Undecided choices + what to inspect: stack, storage, data shapes, interfaces, deploy.]
```

Locked ≠ built. Mark built only after code exists.
