#!/usr/bin/env node
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect, Option, Schema, Stdio, Stream } from "effect"
import { Command, Flag } from "effect/cli"
import { installCommand, uninstallCommand } from "./install.ts"
import { besideBundle, Live } from "./Live.ts"
import { reset, SCOPE_NAMES } from "./Reset.ts"
import { absoluteDirectory, context, status } from "./State.ts"

declare const LEARNT_VERSION: string

const GUIDE = besideBundle("..", "SKILL.md")

const SessionStart = Schema.fromJsonString(Schema.Struct({
  hook_event_name: Schema.Literal("SessionStart"),
  cwd: Schema.String
}))

const cwd = Flag.String("cwd").pipe(Flag.withDescription("Absolute path of the project directory"))

const hook = Command.make("hook", {}, () =>
  Effect.gen(function*() {
    const stdio = yield* Stdio.Stdio
    const raw = (yield* Stream.mkString(Stream.decodeText(stdio.stdin))).slice(0, 65536)
    const event = Schema.decodeUnknownOption(SessionStart)(raw)
    if (Option.isNone(event)) return
    const directory = yield* absoluteDirectory(event.value.cwd)
    if (directory === undefined) return
    const text = yield* context(directory, yield* GUIDE)
    if (text === undefined) return
    yield* Console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } }))
  }).pipe(
    Effect.orElseSucceed(() => undefined)
  )).pipe(Command.withDescription("Restore learning context from a SessionStart hook event on stdin"))

const contextCommand = Command.make("context", { cwd }, ({ cwd }) =>
  Effect.gen(function*() {
    const directory = yield* absoluteDirectory(cwd)
    if (directory === undefined) return
    const text = yield* context(directory, yield* GUIDE)
    if (text !== undefined) yield* Console.log(text)
  }).pipe(Effect.orElseSucceed(() => undefined))).pipe(
    Command.withDescription("Print the restoration message for a project, or nothing")
  )

const statusCommand = Command.make("status", { cwd }, ({ cwd }) =>
  Effect.gen(function*() {
    const directory = yield* absoluteDirectory(cwd)
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
    scope: Flag.Literals("scope", SCOPE_NAMES).pipe(
      Flag.withDescription("onboarding: operator.md; progress: curriculum.md and journal.md; everything: all notes")
    ),
    confirm: Flag.String("confirm").pipe(
      Flag.withDescription("Token from a preview; pass only after the operator confirms"),
      Flag.optional
    )
  },
  ({ cwd, scope, confirm }) =>
    Effect.gen(function*() {
      const result = yield* reset(cwd, scope, Option.getOrUndefined(confirm))
      yield* Console.log(JSON.stringify(result))
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          const message = error._tag === "ResetError" ? error.message : `${error.operation} ${error.path} failed`
          yield* Console.log(JSON.stringify({ status: "error", message }))
          yield* Effect.sync(() => void (process.exitCode = 1))
        })
      )
    )
).pipe(Command.withDescription("Preview a scoped reset of the notes, or reset with a preview's token"))

const learnt = Command.make("learnt").pipe(
  Command.withDescription("Learnt: learning-first development helper"),
  Command.withSubcommands([installCommand, uninstallCommand, hook, contextCommand, statusCommand, resetCommand])
)

learnt.pipe(
  Command.run({ version: LEARNT_VERSION }),
  Effect.provide(Live),
  NodeRuntime.runMain
)
