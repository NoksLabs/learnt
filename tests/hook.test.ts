/** Exercise the registered hook command in isolated new and existing projects. */
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { beforeEach, describe, expect, test } from "bun:test"
import { read, ROOT, snapshot, tempDir, write } from "./helpers.ts"

const CONFIG = JSON.parse(read(path.join(ROOT, "hooks/hooks.json")))
const REGISTRATION = CONFIG.hooks.SessionStart[0]

let root: string
let project: string

beforeEach(() => {
  root = tempDir("learnt-test-")
  project = path.join(root, "project with spaces")
  fs.mkdirSync(path.join(project, ".git"), { recursive: true })
})

const state = (dir = project, mode = "active") => {
  const directory = path.join(dir, ".learnt")
  fs.mkdirSync(directory)
  write(path.join(directory, "profile.md"),
    `# Learner Profile\nLearning mode: ${mode}\nOnboarding: complete\n` +
      "Checkpoint frequency: Light\nQuestion style: Open-ended\n" +
      "Implementation style: AI writes code\n" +
      "Strong concepts: HTTP request flow\n")
  write(path.join(directory, "project-map.md"), "# Project Map\nCLI → service.py → SQLite\n")
  write(path.join(directory, "progress.md"),
    "# Learning Progress\n## Transactions\n" +
      "Demonstrated understanding: two writes must succeed together.\n" +
      "## Queues\nNeeds reinforcement: retries.\n")
  return directory
}

const runHook = (options: { cwd?: string; source?: string; raw?: string } = {}) => {
  const payload = options.raw ?? JSON.stringify({
    hook_event_name: "SessionStart", source: options.source ?? "startup", cwd: options.cwd ?? project
  })
  const result = spawnSync(REGISTRATION.hooks[0].command, {
    shell: true, input: payload, encoding: "utf8", timeout: 10_000, cwd: root,
    // The hook needs Node and its plugin location, not the developer's environment.
    env: { PATH: process.env.PATH ?? "", CLAUDE_PLUGIN_ROOT: ROOT, HOME: root }
  })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  return result.stdout ? JSON.parse(result.stdout) : null
}

const context = (options: Parameters<typeof runHook>[0] = {}): string => {
  const output = runHook(options).hookSpecificOutput
  expect(output.hookEventName).toBe("SessionStart")
  return output.additionalContext
}

describe("SessionStart hook", () => {
  test("fresh project is inactive and hook writes nothing", () => {
    expect(runHook()).toBeNull()
    expect(fs.readdirSync(project)).toEqual([".git"])
  })

  test("restores on every registered session lifecycle", () => {
    state()
    for (const source of ["startup", "resume", "clear", "compact", "fork"]) {
      expect(new RegExp(`^(?:${REGISTRATION.matcher})$`).test(source)).toBe(true)
      const text = context({ source })
      expect(text).toContain(path.join(ROOT, "skills/learnt/SKILL.md"))
      expect(text).toContain(path.join(project, ".learnt"))
      expect(text).toContain("Read profile.md and project-map.md")
      expect(text).toContain("Search the entire progress.md")
      expect(text).not.toContain("Checkpoint frequency: Light")
      expect(text).not.toContain("two writes must succeed together")
    }
  })

  test("existing repo restores from nested working directory", () => {
    state()
    const nested = path.join(project, "src", "services")
    write(path.join(nested, "service.py"), "def run():\n    return 'ok'\n")
    expect(context({ cwd: nested })).toContain(path.join(project, ".learnt"))
  })

  test("project without Git restores", () => {
    const fresh = path.join(root, "fresh-no-git")
    fs.mkdirSync(fresh)
    state(fresh)
    expect(context({ cwd: fresh })).toContain(path.join(fresh, ".learnt"))
  })

  test("legacy notes restore without migration", () => {
    const legacy = path.join(project, ".sensible-vibes")
    fs.renameSync(state(), legacy)
    const before = snapshot(legacy)
    const text = context({ source: "compact" })
    expect(text).toContain("Learnt learning mode is active")
    expect(text).toContain(legacy)
    expect(text).toContain("Read profile.md and project-map.md")
    expect(fs.existsSync(path.join(project, ".learnt"))).toBe(false)
    expect(snapshot(legacy)).toEqual(before)
  })

  test("new notes take precedence over legacy at the same location", () => {
    fs.renameSync(state(), path.join(project, ".sensible-vibes"))
    state(project, "paused")
    expect(runHook()).toBeNull()
  })

  test("nearest legacy notes take precedence over parent notes", () => {
    state()
    const child = path.join(project, "package")
    fs.mkdirSync(child)
    fs.renameSync(state(child, "paused"), path.join(child, ".sensible-vibes"))
    expect(runHook({ cwd: child })).toBeNull()
  })

  test("legacy notes respect the worktree boundary", () => {
    fs.renameSync(state(), path.join(project, ".sensible-vibes"))
    const child = path.join(project, "worktree")
    write(path.join(child, ".git"), "gitdir: /another/repo/.git/worktrees/test")
    expect(runHook({ cwd: child })).toBeNull()
  })

  test("symlinked new state does not fall back to legacy", () => {
    fs.renameSync(state(), path.join(project, ".sensible-vibes"))
    fs.symlinkSync(path.join(root, "missing"), path.join(project, ".learnt"))
    expect(runHook()).toBeNull()
  })

  test("nested repository and worktree do not borrow the parent profile", () => {
    state()
    for (const [name, gitIsFile] of [["nested-repo", false], ["worktree", true]] as const) {
      const child = path.join(project, name)
      if (gitIsFile) write(path.join(child, ".git"), "gitdir: /some/other/repo/.git/worktrees/test")
      else fs.mkdirSync(path.join(child, ".git"), { recursive: true })
      expect(runHook({ cwd: child })).toBeNull()
    }
  })

  test("nearest state wins", () => {
    state()
    const child = path.join(project, "package")
    fs.mkdirSync(child)
    state(child, "paused")
    expect(runHook({ cwd: child })).toBeNull()
  })

  test("paused state is not reactivated by compaction", () => {
    state(project, "paused")
    expect(runHook({ source: "compact" })).toBeNull()
  })

  test("incomplete onboarding survives restart", () => {
    const directory = state()
    write(path.join(directory, "profile.md"),
      "Learning mode: active\nOnboarding: incomplete\nRemaining onboarding: stack familiarity\n")
    const text = context()
    expect(text).toContain(directory)
    expect(text).toContain("If onboarding is incomplete")
    expect(text).toContain("ask only unanswered questions")
  })

  test("missing map and progress do not discard preferences", () => {
    const directory = state()
    fs.unlinkSync(path.join(directory, "project-map.md"))
    fs.unlinkSync(path.join(directory, "progress.md"))
    const text = context()
    expect(text).toContain(directory)
    expect(text).toContain("Discover optional files before reading")
    expect(text).toContain("Recreate missing notes only from evidence")
  })

  test("large notes do not change the bootstrap or hide pending restore", () => {
    const directory = state()
    const before = context({ source: "compact" })
    fs.appendFileSync(path.join(directory, "profile.md"), "a".repeat(100_000))
    write(path.join(directory, "project-map.md"), "b".repeat(100_000))
    write(path.join(directory, "progress.md"),
      "## Earlier learning\n" + "Older summary.\n".repeat(10_000) +
        "## Pending decision\nAwaiting approval to implement SQLite.\n")
    const text = context({ source: "compact" })
    expect(text.length).toBeLessThan(10_000)
    expect(text).toBe(before)
    expect(text).toContain("Search the entire progress.md")
    expect(text).toContain("read their complete sections")
    expect(text).not.toContain("Earlier learning")
    expect(text).not.toContain("SQLite")
  })

  test("paused mode beyond the old profile cutoff is respected", () => {
    const directory = state()
    write(path.join(directory, "profile.md"), "# Profile\n" + "Older preference.\n".repeat(1000) + "Learning mode: paused\n")
    expect(runHook({ source: "compact" })).toBeNull()
  })

  test("legacy profile without a mode still restores", () => {
    const directory = state()
    write(path.join(directory, "profile.md"), "# Learner Profile\nExperience: Beginner\n")
    expect(context()).toContain(directory)
  })

  test("malformed inputs exit cleanly", () => {
    for (const raw of ["", "{", "[]", "null", "42", '{"cwd": 4}', '{"hook_event_name":"SessionStart","cwd":"relative"}']) {
      expect(runHook({ raw })).toBeNull()
    }
  })

  test("unreadable or empty profile does not activate", () => {
    const directory = state()
    for (const content of [new Uint8Array(), new TextEncoder().encode(" \n\t"), new Uint8Array([0xff, 0xfe])]) {
      write(path.join(directory, "profile.md"), content)
      expect(runHook()).toBeNull()
    }
  })

  test("symlinked profile is not read", () => {
    const directory = state()
    const outside = path.join(root, "outside.md")
    write(outside, "Learning mode: active\nPRIVATE")
    fs.unlinkSync(path.join(directory, "profile.md"))
    fs.symlinkSync(outside, path.join(directory, "profile.md"))
    expect(runHook()).toBeNull()
  })

  test("symlinked state directory is not read", () => {
    const directory = state()
    const alternate = path.join(root, "alternate")
    fs.mkdirSync(alternate)
    fs.symlinkSync(directory, path.join(alternate, ".learnt"))
    expect(runHook({ cwd: alternate })).toBeNull()
  })

  test("hook never changes state", () => {
    const directory = state()
    const before = snapshot(directory)
    runHook({ source: "compact" })
    expect(snapshot(directory)).toEqual(before)
  })

  test("compaction points to a pending decision without inventing approval", () => {
    const directory = state()
    fs.appendFileSync(path.join(directory, "progress.md"),
      "## Pending decision\nUse SQLite. Awaiting Implement or a question.\n" +
        "- Pending decision: JSON storage; waiting for Implement.\n")
    const text = context({ source: "compact" })
    expect(text).toContain("Search the entire progress.md for pending decisions")
    expect(text).toContain("before coding")
    expect(text).toContain("await implementation approval")
    expect(text).toContain("Restarting or compacting is not approval")
    expect(text).not.toContain("Use SQLite")
    expect(text).not.toContain("JSON storage")
  })
})
