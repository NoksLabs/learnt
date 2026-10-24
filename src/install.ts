import { Config, Console, Effect, FileSystem, Option, Path, Schema } from "effect"
import { Argument, Command, Flag } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { Files } from "./Files.ts"
import { besideBundle } from "./Live.ts"

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
  readonly root: string
  readonly home: string
  readonly dryRun: boolean
  readonly uninstall: boolean
}

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`

const installer = Effect.fnUntraced(function*({ root: ROOT, home, dryRun, uninstall }: Options) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const files = yield* Files
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const xdgConfigHome = yield* Effect.option(Config.String("XDG_CONFIG_HOME"))
  const codexHomeEnv = yield* Effect.option(Config.String("CODEX_HOME"))
  const present = files.exists
  const say = (message: string) => Console.log((dryRun ? "[dry run] " : "") + message)
  const act = (message: string, run: Effect.Effect<void, unknown>) =>
    Effect.gen(function*() {
      yield* say(message)
      if (dryRun) return
      yield* Effect.mapError(run, (cause) => new InstallError({ message: `${message}: ${String(cause)}` }))
    })

  const command = (...args: [string, ...Array<string>]) =>
    act(
      `$ ${args.join(" ")}`,
      Effect.gen(function*() {
        const status = yield* spawner.exitCode(
          ChildProcess.make(args[0], args.slice(1), { stdin: "inherit", stdout: "inherit", stderr: "inherit" })
        ).pipe(Effect.mapError(() => `${args[0]} is not on PATH; install it first.`))
        if (status !== 0) return yield* Effect.fail(`exited with ${status}`)
      })
    )

  const backup = (target: string) =>
    Effect.gen(function*() {
      if (!(yield* present(target))) return
      const relative = path.relative(home, target)
      const saved = path.join(home, ".learnt-install-backups", STAMP,
        relative.startsWith("..") ? target.slice(1) : relative)
      if (yield* present(saved)) return
      yield* act(
        `back up ${target} -> ${saved}`,
        Effect.gen(function*() {
          yield* fs.makeDirectory(path.dirname(saved), { recursive: true })
          if ((yield* files.kind(target)) === "symlink") yield* fs.symlink(yield* fs.readLink(target), saved)
          else yield* fs.copy(target, saved)
        })
      )
    })

  const remove = (target: string) =>
    Effect.gen(function*() {
      if (!(yield* present(target))) return
      yield* backup(target)
      yield* act(`remove ${target}`, fs.remove(target, { recursive: true }))
    })

  const write = (target: string, text: string) =>
    Effect.gen(function*() {
      yield* backup(target)
      yield* act(
        `write ${target}`,
        Effect.andThen(fs.makeDirectory(path.dirname(target), { recursive: true }), fs.writeFileString(target, text))
      )
    })

  const steps: Record<Agent, Effect.Effect<void, InstallError>> = {
    claude: Effect.gen(function*() {
      if (uninstall) {
        yield* command("claude", "plugin", "uninstall", "learnt@learnt")
        yield* command("claude", "plugin", "marketplace", "remove", "learnt")
      } else {
        yield* command("claude", "plugin", "marketplace", "add", ROOT)
        yield* command("claude", "plugin", "install", "learnt@learnt")
      }
    }),

    pi: command("pi", uninstall ? "remove" : "install", ROOT),

    omp: uninstall ? command("omp", "plugin", "uninstall", "learnt") : command("omp", "plugin", "link", ROOT),

    opencode: Effect.gen(function*() {
      const config = path.join(Option.getOrElse(xdgConfigHome, () => path.join(home, ".config")), "opencode")
      const plugin = path.join(config, "plugins", "learnt.js")
      yield* remove(plugin)
      for (const name of SKILLS) yield* remove(path.join(config, "commands", `${name}.md`))
      if (uninstall) return
      const bundle = path.join(ROOT, "adapters/opencode/learnt.js")
      yield* act(
        `link ${plugin} -> ${bundle}`,
        Effect.andThen(fs.makeDirectory(path.dirname(plugin), { recursive: true }), fs.symlink(bundle, plugin))
      )
      for (const name of SKILLS) {
        const template = yield* fs.readFileString(path.join(ROOT, "adapters/opencode/commands", `${name}.md`)).pipe(
          Effect.mapError((cause) => new InstallError({ message: String(cause) }))
        )
        yield* write(path.join(config, "commands", `${name}.md`), template.replaceAll("{{LEARNT_ROOT}}", ROOT))
      }
    }),

    codex: Effect.gen(function*() {
      const codexHome = Option.getOrElse(codexHomeEnv, () => path.join(home, ".codex"))
      for (const name of SKILLS) {
        const target = path.join(codexHome, "skills", name)
        yield* remove(target)
        if (uninstall) continue
        const skill = path.join(target, "SKILL.md")
        yield* act(
          `copy ${path.join(ROOT, "skills", name)} -> ${target}`,
          Effect.gen(function*() {
            yield* fs.copy(path.join(ROOT, "skills", name), target)
            const text = yield* fs.readFileString(skill)
            yield* fs.writeFileString(skill, text.replace(/^disable-model-invocation:.*\n/m, ""))
          })
        )
      }
      yield* codexHook(path.join(codexHome, "hooks.json"))
    })
  }

  const codexHook = (file: string) =>
    Effect.gen(function*() {
      const raw = (yield* present(file))
        ? yield* fs.readFileString(file).pipe(Effect.mapError((cause) => new InstallError({ message: String(cause) })))
        : "{}"
      if (Option.isNone(Schema.decodeUnknownOption(HooksFile)(raw))) {
        return yield* new InstallError({ message: `${file} is not a hooks file this installer understands; edit it by hand.` })
      }
      const config = JSON.parse(raw)
      config.hooks ??= {}
      type Hook = { readonly command?: string; readonly [key: string]: unknown }
      type Group = { readonly hooks?: ReadonlyArray<Hook>; readonly [key: string]: unknown }
      const groups: ReadonlyArray<Group> = config.hooks.SessionStart ?? []
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
})

const NODE = "^24.22.1 || >=26.12.1"

const patchedNode = (version: string) => {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number)
  const atLeast = (m: number, p: number) => minor > m || (minor === m && patch >= p)
  return (major === 24 && atLeast(22, 1)) || (major === 26 && atLeast(12, 1)) || major > 26
}

const run = (uninstall: boolean) =>
  ({ agents, dryRun, home }: {
    readonly agents: ReadonlyArray<Agent | "all">
    readonly dryRun: boolean
    readonly home: Option.Option<string>
  }) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      if (!patchedNode(process.versions.node)) {
        return yield* new InstallError({
          message: `Learnt needs Node.js ${NODE} (fixes CVE-2026-111497); this is ${process.versions.node}.`
        })
      }
      const root = yield* besideBundle("..", "..", "..")
      if (!(yield* fs.exists(path.join(root, ".claude-plugin", "marketplace.json")))) {
        return yield* new InstallError({ message: `Run install from the Learnt checkout; ${root} is not one.` })
      }
      const fallback = yield* Effect.orElseSucceed(Config.String("HOME"), () => "")
      const homeDirectory = Option.getOrElse(home, () => fallback)
      if (homeDirectory === "") return yield* new InstallError({ message: "Set HOME or pass --home." })
      const steps = yield* installer({ root, home: homeDirectory, dryRun, uninstall })
      const selected = agents.includes("all") ? AGENTS : AGENTS.filter((agent) => agents.includes(agent))
      for (const agent of selected) {
        yield* Console.log(`== ${agent}`)
        yield* steps[agent]
      }
    }).pipe(
      Effect.catch((error) =>
        Effect.andThen(Console.error(error.message), Effect.sync(() => void (process.exitCode = 1)))
      )
    )

const params = {
  agents: Argument.Literals("agent", ["all", ...AGENTS]).pipe(
    Argument.variadic({ min: 1 }),
    Argument.withDescription("Agents to set up: claude, codex, opencode, pi, omp, or all")
  ),
  dryRun: Flag.Boolean("dry-run").pipe(Flag.withDescription("Print every change without making it"), Flag.withDefault(false)),
  home: Flag.String("home").pipe(Flag.withDescription("Home directory to install into (default: $HOME)"), Flag.optional)
}

export const installCommand = Command.make("install", params, run(false)).pipe(
  Command.withDescription("Install Learnt into the named agents, backing up anything it replaces")
)

export const uninstallCommand = Command.make("uninstall", params, run(true)).pipe(
  Command.withDescription("Remove Learnt from the named agents, backing up anything it removes")
)
