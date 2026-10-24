/** Reset only confirmed project notes, preserving recoverable originals. */
import * as fs from "node:fs"
import * as path from "node:path"
import { beforeEach, describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { FileError, Files } from "../src/Files.ts"
import { Live } from "../src/Live.ts"
import { reset } from "../src/Reset.ts"
import { cli, tempDir, write } from "./helpers.ts"

let root: string
let project: string

beforeEach(() => {
  root = tempDir("learnt-reset-")
  project = path.join(root, "project with spaces")
  fs.mkdirSync(path.join(project, ".git"), { recursive: true })
})

const ORIGINALS: Record<string, string> = {
  "profile.md": "Learning mode: paused\nOnboarding: complete\nAdvanced\n",
  "progress.md": "## Pending decision\nAwaiting implementation approval\n",
  "project-map.md": "# Project Map\nCLI -> service -> SQLite\n"
}

const notes = (dir = project, legacy = false) => {
  const state = path.join(dir, legacy ? ".sensible-vibes" : ".learnt")
  fs.mkdirSync(state, { recursive: true })
  for (const [name, text] of Object.entries(ORIGINALS)) write(path.join(state, name), text)
  return state
}

type Run = (cwd: string, confirmation?: string) => Promise<any>
const runWith = (layer: Layer.Layer<Files>): Run => (cwd, confirmation) =>
  Effect.runPromise(reset(cwd, confirmation).pipe(Effect.provide(layer)))
const run = runWith(Live)

const preview = (cwd = project) => run(cwd)
const confirm = async (cwd = project, runner: Run = run) => runner(cwd, (await preview(cwd)).confirmation)

const expectOriginals = (dir: string) => {
  for (const [name, text] of Object.entries(ORIGINALS)) expect(fs.readFileSync(path.join(dir, name), "utf8")).toBe(text)
}

const liveFiles = Effect.runSync(Effect.gen(function*() {
  return yield* Files
}).pipe(Effect.provide(Files.layer)))

/** The real Files service with one operation replaced, for failure injection. */
const failing = (override: Partial<Files["Service"]>) => Layer.succeed(Files, Files.of({ ...liveFiles, ...override }))

describe("reset", () => {
  test("preview through the CLI leaves notes untouched", () => {
    const state = notes()
    const result = cli(["reset", "--cwd", project], { home: root })
    expect(result.code).toBe(0)
    const output = JSON.parse(result.stdout)
    expect(output.status).toBe("preview")
    expect(output.state).toBe(state)
    expect(output.project).toBe(project)
    expectOriginals(state)
    expect(fs.readdirSync(state).sort()).toEqual(Object.keys(ORIGINALS).sort())
  })

  test("reset backs up only notes and restarts onboarding", async () => {
    const state = notes()
    write(path.join(project, "app.py"), "important source\n")
    write(path.join(state, "custom.md"), "keep this\n")
    const sibling = path.join(root, "another-project")
    const other = notes(sibling)
    const result = await confirm()
    expect(result.status).toBe("reset")
    expect(path.dirname(result.backup)).toBe(path.join(state, "backups"))
    expectOriginals(result.backup)
    expect(fs.readdirSync(result.backup).sort()).toEqual(Object.keys(ORIGINALS).sort())
    const profile = fs.readFileSync(path.join(state, "profile.md"), "utf8")
    expect(profile).toContain("Learning mode: active")
    expect(profile).toContain("Onboarding: incomplete")
    expect(profile).toContain("Onboarding reset: pending")
    expect(profile).not.toContain("Advanced")
    expect(fs.readFileSync(path.join(state, "progress.md"), "utf8")).not.toContain("Pending decision")
    expect(fs.readFileSync(path.join(state, "project-map.md"), "utf8")).not.toContain("SQLite")
    expect(fs.readFileSync(path.join(project, "app.py"), "utf8")).toBe("important source\n")
    expect(fs.readFileSync(path.join(state, "custom.md"), "utf8")).toBe("keep this\n")
    expectOriginals(other)
    expect(fs.statSync(path.join(project, ".git")).isDirectory()).toBe(true)
    const hook = cli(["hook"], {
      home: root, input: JSON.stringify({ hook_event_name: "SessionStart", source: "compact", cwd: project })
    })
    const text = JSON.parse(hook.stdout).hookSpecificOutput.additionalContext
    expect(text).toContain(state)
    expect(text).toContain("Read profile.md and project-map.md")
    expect(text).toContain("If onboarding is incomplete")
    expect(text).not.toContain("Awaiting implementation approval")
  })

  test("nested directory and legacy notes", async () => {
    const state = notes(project, true)
    const nested = path.join(project, "src")
    fs.mkdirSync(nested)
    const result = await confirm(nested)
    expect(result.state).toBe(state)
    expectOriginals(result.backup)
    expect(fs.existsSync(path.join(project, ".learnt"))).toBe(false)
  })

  test("preferred state resets without touching legacy", async () => {
    const state = notes()
    const legacy = notes(project, true)
    expect((await confirm()).state).toBe(state)
    expectOriginals(legacy)
  })

  test("nearest state and worktree boundaries", async () => {
    const parent = notes()
    const nested = path.join(project, "package")
    const state = notes(nested, true)
    expect((await confirm(nested)).state).toBe(state)
    expectOriginals(parent)
    for (const [name, worktree] of [["nested-repo", false], ["worktree", true]] as const) {
      const child = path.join(project, name)
      if (worktree) write(path.join(child, ".git"), "gitdir: /another/repo/.git/worktrees/test")
      else fs.mkdirSync(path.join(child, ".git"), { recursive: true })
      expect((await preview(child)).status).toBe("no_notes")
    }
  })

  test("no state and empty state do not create files", async () => {
    expect((await preview()).status).toBe("no_notes")
    expect(fs.readdirSync(project)).toEqual([".git"])
    const state = path.join(project, ".learnt")
    fs.mkdirSync(state)
    expect((await preview()).status).toBe("no_notes")
    expect(fs.readdirSync(state)).toEqual([])
  })

  test("partial state and repeated resets preserve each backup", async () => {
    const state = notes()
    fs.unlinkSync(path.join(state, "progress.md"))
    fs.unlinkSync(path.join(state, "project-map.md"))
    const first = (await confirm()).backup
    expect(fs.readdirSync(first)).toEqual(["profile.md"])
    expect(fs.readFileSync(path.join(first, "profile.md"), "utf8")).toBe(ORIGINALS["profile.md"]!)
    const second = (await confirm()).backup
    expect(second).not.toBe(first)
    expect(fs.readFileSync(path.join(first, "profile.md"), "utf8")).toBe(ORIGINALS["profile.md"]!)
  })

  test("stale confirmation is rejected before writes", async () => {
    const state = notes()
    const token = (await preview()).confirmation
    write(path.join(state, "progress.md"), "new understanding\n")
    await expect(run(project, token)).rejects.toThrow(/changed/)
    expect(fs.readFileSync(path.join(state, "progress.md"), "utf8")).toBe("new understanding\n")
    expect(fs.existsSync(path.join(state, "backups"))).toBe(false)
  })

  test("confirmation cannot target a different project", async () => {
    notes()
    const other = path.join(root, "another-project")
    const state = notes(other)
    await expect(run(other, (await preview()).confirmation)).rejects.toThrow(/changed/)
    expectOriginals(state)
    expect(fs.existsSync(path.join(state, "backups"))).toBe(false)
  })

  test("symlinked state is not followed", async () => {
    const outside = path.join(root, "outside")
    const target = notes(outside)
    fs.symlinkSync(target, path.join(project, ".learnt"))
    expect((await preview()).status).toBe("no_notes")
    expectOriginals(target)
  })

  test("non-regular notes are rejected", async () => {
    const state = notes()
    const profile = path.join(state, "profile.md")
    fs.unlinkSync(profile)
    fs.symlinkSync(path.join(state, "progress.md"), profile)
    await expect(preview()).rejects.toThrow(/non-regular/)
    fs.unlinkSync(profile)
    fs.mkdirSync(profile)
    await expect(preview()).rejects.toThrow(/non-regular/)
    expect(fs.existsSync(path.join(state, "backups"))).toBe(false)
  })

  test("symlinked backup directory is rejected before notes change", async () => {
    const state = notes()
    const outside = path.join(root, "outside")
    fs.mkdirSync(outside)
    fs.symlinkSync(outside, path.join(state, "backups"))
    await expect(confirm()).rejects.toThrow(/Backup path/)
    expectOriginals(state)
    expect(fs.readdirSync(outside)).toEqual([])
  })

  test("backup failure does not modify active notes", async () => {
    const state = notes()
    const broken = failing({
      writeBytes: (file, data) =>
        path.basename(file) === "progress.md"
          ? Effect.fail(new FileError({ operation: "write", path: file, cause: new Error("simulated disk failure") }))
          : liveFiles.writeBytes(file, data)
    })
    await expect(confirm(project, runWith(broken))).rejects.toThrow(/did not complete/)
    expectOriginals(state)
  })

  test("replacement failure keeps a complete backup and reports failure", async () => {
    const state = notes()
    const broken = failing({
      replace: (source, target) =>
        path.basename(target) === "progress.md"
          ? Effect.fail(new FileError({ operation: "replace", path: target, cause: new Error("simulated write failure") }))
          : liveFiles.replace(source, target)
    })
    await expect(confirm(project, runWith(broken))).rejects.toThrow(/Backup location/)
    const backups = fs.readdirSync(path.join(state, "backups"))
    expect(backups.length).toBe(1)
    expectOriginals(path.join(state, "backups", backups[0]!))
  })

  test("CLI reports errors as JSON with a non-zero exit", () => {
    const result = cli(["reset", "--cwd", "relative/path"], { home: root })
    expect(result.code).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({ status: "error", message: "Use an existing absolute project working directory." })
  })
})
