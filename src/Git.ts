import { Context, Effect, Layer, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

export class Git extends Context.Service<Git, {
  tracks(directory: string, name: string): Effect.Effect<boolean>
}>()("learnt/Git") {
  static readonly layer = Layer.effect(Git, Effect.gen(function*() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    return Git.of({
      tracks: (directory, name) =>
        Effect.scoped(Effect.gen(function*() {
          const child = yield* spawner.spawn(ChildProcess.make("git", ["-C", directory, "ls-files", "-z", "--", name], {
            stdin: "ignore",
            stderr: "ignore"
          }))
          const [stdout, code] = yield* Effect.all([Stream.mkString(Stream.decodeText(child.stdout)), child.exitCode], {
            concurrency: 2
          })
          return code === 0 && stdout.length > 0
        })).pipe(
          Effect.timeout("3 seconds"),
          Effect.orElseSucceed(() => false)
        )
    })
  }))
}
