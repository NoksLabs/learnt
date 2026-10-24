/**
 * Learnt command line, bundled to skills/learnt/scripts/learnt.mjs.
 *
 *   learnt hook                        Read a SessionStart JSON event on stdin (Claude
 *                                      Code, Codex); print hookSpecificOutput JSON or nothing.
 *   learnt context --cwd DIR           Print the restoration message as text, or nothing.
 *   learnt status --cwd DIR            Print JSON describing the notes (used by the Learn skill).
 *   learnt reset --cwd DIR [--confirm TOKEN]
 *                                      Preview a reset, or reset with a preview's token.
 */
import { readFileSync, realpathSync } from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect, Layer, Option, Schema } from "effect"
import { Command, Flag } from "effect/cli"
import { Live } from "./Live.ts"
import { reset } from "./Reset.ts"
import { absoluteDirectory, context, status } from "./State.ts"

const GUIDE = path.join(path.dirname(realpathSync(fileURLToPath(import.meta.url))), "..", "SKILL.md")

const SessionStart = Schema.fromJsonString(Schema.Struct({
  hook_event_name: Schema.Literal("SessionStart"),
  cwd: Schema.String
}))

const cwd = Flag.String("cwd").pipe(Flag.withDescription("Absolute path of the project directory"))

const hook = Command.make("hook", {}, () =>
  Effect.gen(function*() {
    // This 64 KiB limit bounds the incoming event, not the learner's notes.
    const raw = yield* Effect.try(() => readFileSync(0, "utf8").slice(0, 65536))
    const event = Schema.decodeUnknownOption(SessionStart)(raw)
    if (Option.isNone(event)) return
    const directory = absoluteDirectory(event.value.cwd)
    if (directory === undefined) return
    const text = yield* context(directory, GUIDE)
    if (text === undefined) return
    // stdout is the hook's JSON protocol; print nothing else.
    yield* Console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } }))
  }).pipe(
    // Learning must never prevent a coding session from starting.
    Effect.orElseSucceed(() => undefined)
  )).pipe(Command.withDescription("Restore learning context from a SessionStart hook event on stdin"))

const contextCommand = Command.make("context", { cwd }, ({ cwd }) =>
  Effect.gen(function*() {
    const directory = absoluteDirectory(cwd)
    if (directory === undefined) return
    const text = yield* context(directory, GUIDE)
    if (text !== undefined) yield* Console.log(text)
  }).pipe(Effect.orElseSucceed(() => undefined))).pipe(
    Command.withDescription("Print the restoration message for a project, or nothing")
  )

const statusCommand = Command.make("status", { cwd }, ({ cwd }) =>
  Effect.gen(function*() {
    const directory = absoluteDirectory(cwd)
    if (directory === undefined) {
      yield* Console.log(JSON.stringify({ error: "Use an existing absolute project directory." }))
      return yield* Effect.sync(() => void (process.exitCode = 1))
    }
    yield* Console.log(JSON.stringify(yield* status(directory)))
  })).pipe(Command.withDescription("Describe a project's notes as JSON, without their contents"))

const resetCommand = Command.make(
  "reset",
  {
    cwd,
    confirm: Flag.String("confirm").pipe(
      Flag.withDescription("Token from a preview; pass only after the user confirms"),
      Flag.optional
    )
  },
  ({ cwd, confirm }) =>
    Effect.gen(function*() {
      const result = yield* reset(cwd, Option.getOrUndefined(confirm))
      yield* Console.log(JSON.stringify(result))
    }).pipe(
      // The skill reads one JSON object from stdout, success or failure.
      Effect.catch((error) =>
        Effect.gen(function*() {
          const message = error._tag === "ResetError" ? error.message : `${error.operation} ${error.path} failed`
          yield* Console.log(JSON.stringify({ status: "error", message }))
          yield* Effect.sync(() => void (process.exitCode = 1))
        })
      )
    )
).pipe(Command.withDescription("Preview a reset of the notes, or reset with a preview's token"))

const learnt = Command.make("learnt").pipe(
  Command.withDescription("Learnt: learning-first development helper"),
  Command.withSubcommands([hook, contextCommand, statusCommand, resetCommand])
)

learnt.pipe(
  Command.run({ version: "0.1.0" }),
  Effect.provide(Layer.mergeAll(Live, NodeServices.layer)),
  NodeRuntime.runMain
)
