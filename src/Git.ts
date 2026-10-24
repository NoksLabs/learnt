import { execFile } from "node:child_process"
import { Context, Effect, Layer } from "effect"

export class Git extends Context.Service<Git, {
  tracks(directory: string, name: string): Effect.Effect<boolean>
}>()("learnt/Git") {
  static readonly layer = Layer.succeed(Git, Git.of({
    tracks: (directory, name) =>
      Effect.callback<boolean>((resume) => {
        const child = execFile(
          "git",
          ["-C", directory, "ls-files", "-z", "--", name],
          { timeout: 3000, encoding: "utf8" },
          (error, stdout) => resume(Effect.succeed(!error && stdout.length > 0))
        )
        return Effect.sync(() => child.kill())
      })
  }))
}
