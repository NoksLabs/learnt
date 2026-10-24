/**
 * Install or remove Learnt for one or more coding agents.
 *
 *   bun src/install.ts claude codex opencode pi omp     # or: all
 *   bun src/install.ts --uninstall codex
 *   bun src/install.ts --dry-run all
 *
 * Claude Code, pi and omp are installed through their own CLIs, pointing at this
 * folder, so they pick up rebuilt bundles. Codex gets copies of the skills (its
 * plugin validator rejects `disable-model-invocation: true`; agents/openai.yaml
 * gives the same effect), so re-run the Codex install after rebuilding. Every
 * file this script changes or removes is first saved under
 * ~/.learnt-install-backups/<time>/, so backups never land inside a folder an
 * agent scans for skills or plugins.
 */
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Option, Schema } from "effect"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SKILLS = ["learnt", "learnt-reset"] as const
const HOOK_MARKER = "/skills/learnt/scripts/learnt.mjs' hook"
const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "")
const AGENTS = ["claude", "codex", "opencode", "pi", "omp"] as const
type Agent = typeof AGENTS[number]

class InstallError extends Schema.TaggedError<InstallError>()("InstallError", {
  message: Schema.String
}) {}

const HookGroup = Schema.Struct({
  hooks: Schema.Array(Schema.Struct({ command: Schema.optional(Schema.String) }))
})
const HooksFile = Schema.fromJsonString(Schema.Struct({
  hooks: Schema.optional(Schema.Struct({ SessionStart: Schema.optional(Schema.Array(HookGroup)) }))
}))

interface Options {
  readonly home: string
  readonly dryRun: boolean
  readonly uninstall: boolean
}

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
const present = (target: string) => {
  try {
    fs.lstatSync(target)
    return true
  } catch {
    return false
  }
}

const installer = ({ home, dryRun, uninstall }: Options) => {
  const say = (message: string) => Effect.sync(() => console.log((dryRun ? "[dry run] " : "") + message))
  const act = (message: string, run: () => void) =>
    Effect.gen(function*() {
      yield* say(message)
      if (dryRun) return
      yield* Effect.try({
        try: run,
        catch: (cause) => new InstallError({ message: `${message}: ${String(cause)}` })
      })
    })

  const command = (...args: [string, ...Array<string>]) =>
    act(`$ ${args.join(" ")}`, () => {
      const result = spawnSync(args[0], args.slice(1), { stdio: "inherit" })
      if (result.error) throw new Error(`${args[0]} is not on PATH; install it first.`)
      if (result.status !== 0) throw new Error(`exited with ${result.status}`)
    })

  const backup = (target: string) =>
    Effect.gen(function*() {
      if (!present(target)) return
      const relative = path.relative(home, target)
      const saved = path.join(home, ".learnt-install-backups", STAMP,
        relative.startsWith("..") ? target.slice(1) : relative)
      // Already saved earlier in this run: keep the original copy.
      if (present(saved)) return
      yield* act(`back up ${target} -> ${saved}`, () => {
        fs.mkdirSync(path.dirname(saved), { recursive: true })
        fs.cpSync(target, saved, { recursive: true, verbatimSymlinks: true })
      })
    })

  const remove = (target: string) =>
    Effect.gen(function*() {
      if (!present(target)) return
      yield* backup(target)
      yield* act(`remove ${target}`, () => fs.rmSync(target, { recursive: true }))
    })

  const write = (target: string, text: string) =>
    Effect.gen(function*() {
      yield* backup(target)
      yield* act(`write ${target}`, () => {
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, text)
      })
    })

  const steps: Record<Agent, Effect.Effect<void, InstallError>> = {
    // Claude Code: a local marketplace pointing at this folder.
    claude: Effect.gen(function*() {
      if (uninstall) {
        yield* command("claude", "plugin", "uninstall", "learnt@learnt")
        yield* command("claude", "plugin", "marketplace", "remove", "learnt")
      } else {
        yield* command("claude", "plugin", "marketplace", "add", ROOT)
        yield* command("claude", "plugin", "install", "learnt@learnt")
      }
    }),

    // pi: a local package; package.json "pi" lists the extension and skills.
    pi: command("pi", uninstall ? "remove" : "install", ROOT),

    // omp: link this folder; package.json "omp" lists the extension and the
    // sibling skills/ folder is discovered automatically.
    omp: uninstall ? command("omp", "plugin", "uninstall", "learnt") : command("omp", "plugin", "link", ROOT),

    // opencode: a symlinked plugin bundle and two commands. Skills are not
    // installed: opencode ignores disable-model-invocation, so the model could
    // otherwise start learning mode by itself.
    opencode: Effect.gen(function*() {
      const config = path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "opencode")
      const plugin = path.join(config, "plugins", "learnt.js")
      yield* remove(plugin)
      for (const name of SKILLS) yield* remove(path.join(config, "commands", `${name}.md`))
      if (uninstall) return
      const bundle = path.join(ROOT, "adapters/opencode/learnt.js")
      yield* act(`link ${plugin} -> ${bundle}`, () => {
        fs.mkdirSync(path.dirname(plugin), { recursive: true })
        fs.symlinkSync(bundle, plugin)
      })
      for (const name of SKILLS) {
        const template = fs.readFileSync(path.join(ROOT, "adapters/opencode/commands", `${name}.md`), "utf8")
        yield* write(path.join(config, "commands", `${name}.md`), template.replaceAll("{{LEARNT_ROOT}}", ROOT))
      }
    }),

    // Codex: copy skills without the Claude-only flag, and merge a SessionStart hook.
    codex: Effect.gen(function*() {
      const codexHome = process.env.CODEX_HOME ?? path.join(home, ".codex")
      for (const name of SKILLS) {
        const target = path.join(codexHome, "skills", name)
        yield* remove(target)
        if (uninstall) continue
        yield* act(`copy ${path.join(ROOT, "skills", name)} -> ${target}`, () => {
          fs.cpSync(path.join(ROOT, "skills", name), target, { recursive: true })
          const skill = path.join(target, "SKILL.md")
          fs.writeFileSync(skill, fs.readFileSync(skill, "utf8").replace(/^disable-model-invocation:.*\n/m, ""))
        })
      }
      yield* codexHook(path.join(codexHome, "hooks.json"))
    })
  }

  const codexHook = (file: string) =>
    Effect.gen(function*() {
      const raw = present(file) ? fs.readFileSync(file, "utf8") : "{}"
      if (Option.isNone(Schema.decodeUnknownOption(HooksFile)(raw))) {
        return yield* new InstallError({ message: `${file} is not a hooks file this installer understands; edit it by hand.` })
      }
      // Keep the original JSON (including fields the schema doesn't name) and edit
      // only the SessionStart list.
      const config = JSON.parse(raw)
      config.hooks ??= {}
      type Hook = { readonly command?: string; readonly [key: string]: unknown }
      type Group = { readonly hooks?: ReadonlyArray<Hook>; readonly [key: string]: unknown }
      const groups: ReadonlyArray<Group> = config.hooks.SessionStart ?? []
      // Drop any earlier Learnt entry, keeping every other hook untouched.
      const kept: Array<Group> = groups.flatMap((group) => {
        const hooks = (group.hooks ?? []).filter((hook) => !hook.command?.includes(HOOK_MARKER))
        return hooks.length > 0 ? [{ ...group, hooks }] : []
      })
      if (!uninstall) {
        kept.push({
          matcher: "startup|resume|clear|compact",
          hooks: [{
            type: "command",
            command: `node ${quote(path.join(ROOT, "skills/learnt/scripts/learnt.mjs"))} hook`,
            timeout: 5
          }]
        })
      }
      if (JSON.stringify(kept) === JSON.stringify(groups)) return
      config.hooks.SessionStart = kept
      yield* write(file, JSON.stringify(config, null, 2) + "\n")
      if (!uninstall) yield* say("Codex asks you to review new hooks: run /hooks in Codex and trust it.")
    })

  return steps
}

const usage = "usage: bun src/install.ts [--uninstall] [--dry-run] (all | claude codex opencode pi omp ...)"

const main = Effect.gen(function*() {
  const args = process.argv.slice(2)
  const homeIndex = args.indexOf("--home")
  const home = homeIndex >= 0 ? args[homeIndex + 1] ?? "" : os.homedir()
  // Agent names are every argument except flags and the value after --home.
  const names = args.filter((arg, index) => !arg.startsWith("--") && (homeIndex < 0 || index !== homeIndex + 1))
  const unknown = names.filter((name) => name !== "all" && !AGENTS.includes(name as Agent))
  if (names.length === 0 || unknown.length > 0 || home === "") {
    return yield* new InstallError({ message: unknown.length ? `unknown agent: ${unknown.join(", ")}\n${usage}` : usage })
  }
  const steps = installer({ home, dryRun: args.includes("--dry-run"), uninstall: args.includes("--uninstall") })
  const selected = names.includes("all") ? AGENTS : AGENTS.filter((agent) => names.includes(agent))
  for (const agent of selected) {
    yield* Effect.sync(() => console.log(`== ${agent}`))
    yield* steps[agent]
  }
})

process.exitCode = await Effect.runPromise(
  main.pipe(
    Effect.as(0),
    Effect.catch((error) => Effect.sync(() => (console.error(error.message), 1)))
  )
)
