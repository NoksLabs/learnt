import * as fs from "node:fs"
import * as path from "node:path"
import { beforeEach, describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { FileError, Files } from "../src/Files.ts"
import { Live } from "../src/Live.ts"
import { reset, type Scope } from "../src/Reset.ts"
import { cli, NOTE_TEXT, notes, read, tempDir, write } from "./helpers.ts"

let root: string
let project: string

beforeEach(() => {
  root = tempDir("learnt-reset-")
  project = path.join(root, "shop with spaces")
  fs.mkdirSync(path.join(project, ".git"), { recursive: true })
})

type Run = (cwd: string, scope: Scope, confirmation?: string) => Promise<any>
const runWith = (layer: Layer.Layer<Files>): Run => (cwd, scope, confirmation) =>
  Effect.runPromise(reset(cwd, scope, confirmation).pipe(Effect.provide(layer), Effect.provide(Live)))
const run = runWith(Live)
const confirm = async (scope: Scope, cwd = project, runner: Run = run) =>
  runner(cwd, scope, (await run(cwd, scope)).confirmation)

const unchanged = (state: string, names = Object.keys(NOTE_TEXT)) => {
  for (const name of names) expect(read(path.join(state, name))).toBe(NOTE_TEXT[name]!)
}

const liveFiles = Effect.runSync(Effect.gen(function*() {
  return yield* Files
}).pipe(Effect.provide(Live)))
const failing = (override: Partial<Files["Service"]>) => Layer.succeed(Files, Files.of({ ...liveFiles, ...override }))

describe("scopes reset only what the operator chose", () => {
  test("onboarding redoes the operator profile but keeps earned skills and the system map", async () => {
    const state = notes(project)
    const result = await confirm("onboarding")
    expect(result.reset).toEqual(["operator.md"])
    const operator = read(path.join(state, "operator.md"))
    expect(operator).toContain("Learning mode: active")
    expect(operator).toContain("Onboarding: incomplete")
    expect(operator).toContain("Onboarding reset: pending")
    expect(operator).not.toContain("Ship features")
    unchanged(state, ["curriculum.md", "journal.md", "system.md"])
  })

  test("progress clears skill levels and open checkpoints but keeps who the operator is", async () => {
    const state = notes(project)
    const result = await confirm("progress")
    expect(result.reset).toEqual(["curriculum.md", "journal.md"])
    expect(read(path.join(state, "curriculum.md"))).not.toContain("solid")
    const journal = read(path.join(state, "journal.md"))
    expect(journal).not.toContain("Open checkpoint")
    expect(journal).toContain("Reset: progress")
    expect(journal).toContain(result.backup)
    expect(journal).toContain("do not copy old levels")
    unchanged(state, ["operator.md", "system.md"])
  })

  test("everything restarts all four notes and onboarding", async () => {
    const state = notes(project)
    const result = await confirm("everything")
    expect(result.reset).toEqual(["operator.md", "curriculum.md", "journal.md", "system.md"])
    expect(read(path.join(state, "operator.md"))).toContain("Onboarding reset: pending")
    expect(read(path.join(state, "system.md"))).not.toContain("checkout")
  })

  test("preview lists reset and kept notes and changes nothing, so the operator decides with full facts", () => {
    const state = notes(project)
    const result = cli(["reset", "--cwd", project, "--scope", "progress"], { home: root })
    expect(result.code).toBe(0)
    const preview = JSON.parse(result.stdout)
    expect(preview).toMatchObject({
      status: "preview", scope: "progress", project, state,
      reset: ["curriculum.md", "journal.md"], kept: ["operator.md", "system.md"],
      backup_parent: path.join(state, "backups")
    })
    unchanged(state)
    expect(fs.existsSync(path.join(state, "backups"))).toBe(false)
  })

  test("an unknown scope is refused by the CLI, so a typo can't widen a reset", () => {
    notes(project)
    const result = cli(["reset", "--cwd", project, "--scope", "all"], { home: root })
    expect(result.code).toBe(1)
  })
})

describe("nothing is lost", () => {
  test("every note is backed up, even kept ones, and app code and other files stay", async () => {
    const state = notes(project)
    write(path.join(project, "checkout.ts"), "export const sell = 1\n")
    write(path.join(state, "scratch.md"), "mine\n")
    const result = await confirm("onboarding")
    expect(path.dirname(result.backup)).toBe(path.join(state, "backups"))
    expect(path.basename(result.backup)).toStartWith("onboarding-")
    unchanged(result.backup)
    expect(read(path.join(project, "checkout.ts"))).toBe("export const sell = 1\n")
    expect(read(path.join(state, "scratch.md"))).toBe("mine\n")
  })

  test("repeated resets keep each backup", async () => {
    notes(project)
    const first = (await confirm("progress")).backup
    const second = (await confirm("progress")).backup
    expect(second).not.toBe(first)
    unchanged(first)
  })

  test("a failed backup leaves active notes untouched", async () => {
    const state = notes(project)
    const broken = failing({
      writeBytes: (file, data) =>
        path.basename(file) === "journal.md"
          ? Effect.fail(new FileError({ operation: "write", path: file, cause: new Error("disk full") }))
          : liveFiles.writeBytes(file, data)
    })
    await expect(confirm("everything", project, runWith(broken))).rejects.toThrow(/did not complete/)
    unchanged(state)
  })

  test("a failed swap reports the backup path, so the operator can recover by hand", async () => {
    const state = notes(project)
    const broken = failing({
      replace: (source, target) =>
        path.basename(target) === "journal.md"
          ? Effect.fail(new FileError({ operation: "replace", path: target, cause: new Error("io") }))
          : liveFiles.replace(source, target)
    })
    await expect(confirm("progress", project, runWith(broken))).rejects.toThrow(/Backup location/)
    const [backup] = fs.readdirSync(path.join(state, "backups"))
    unchanged(path.join(state, "backups", backup!))
  })
})

describe("confirmation is bound to what was previewed", () => {
  test("notes edited after preview invalidate the token, so newer learning isn't wiped", async () => {
    const state = notes(project)
    const token = (await run(project, "progress")).confirmation
    write(path.join(state, "curriculum.md"), "new evidence\n")
    await expect(run(project, "progress", token)).rejects.toThrow(/changed/)
    expect(read(path.join(state, "curriculum.md"))).toBe("new evidence\n")
  })

  test("a token for a narrow scope can't confirm a wider one", async () => {
    const state = notes(project)
    const token = (await run(project, "onboarding")).confirmation
    await expect(run(project, "everything", token)).rejects.toThrow(/scope/)
    unchanged(state)
  })

  test("a token for one project can't reset another", async () => {
    notes(project)
    const other = path.join(root, "other")
    fs.mkdirSync(path.join(other, ".git"), { recursive: true })
    const otherState = notes(other)
    await expect(run(other, "everything", (await run(project, "everything")).confirmation)).rejects.toThrow(/changed/)
    unchanged(otherState)
  })
})

describe("refuses unsafe targets", () => {
  test("no notes or an empty folder reports no_notes and creates nothing", async () => {
    expect((await run(project, "everything")).status).toBe("no_notes")
    fs.mkdirSync(path.join(project, ".learnt"))
    expect((await run(project, "everything")).status).toBe("no_notes")
    expect(fs.readdirSync(path.join(project, ".learnt"))).toEqual([])
  })

  test("symlinked notes folder is not followed", async () => {
    const real = notes(path.join(root, "outside"))
    fs.symlinkSync(real, path.join(project, ".learnt"))
    expect((await run(project, "everything")).status).toBe("no_notes")
    unchanged(real)
  })

  test("a symlinked or folder-shaped note is refused before any write", async () => {
    const state = notes(project)
    const operator = path.join(state, "operator.md")
    fs.unlinkSync(operator)
    fs.symlinkSync(path.join(state, "system.md"), operator)
    await expect(run(project, "progress")).rejects.toThrow(/non-regular/)
    fs.unlinkSync(operator)
    fs.mkdirSync(operator)
    await expect(run(project, "progress")).rejects.toThrow(/non-regular/)
    expect(fs.existsSync(path.join(state, "backups"))).toBe(false)
  })

  test("a symlinked backups folder is refused, so backups can't be written outside the project", async () => {
    const state = notes(project)
    const outside = path.join(root, "elsewhere")
    fs.mkdirSync(outside)
    fs.symlinkSync(outside, path.join(state, "backups"))
    await expect(confirm("everything")).rejects.toThrow(/Backup path/)
    unchanged(state)
    expect(fs.readdirSync(outside)).toEqual([])
  })

  test("CLI errors come back as one JSON object with a non-zero exit, so the skill can always parse them", () => {
    const result = cli(["reset", "--cwd", "relative/path", "--scope", "everything"], { home: root })
    expect(result.code).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({ status: "error", message: "Use an existing absolute project working directory." })
  })
})
