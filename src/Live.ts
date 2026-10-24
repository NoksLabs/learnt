import { NodeServices } from "@effect/platform-node"
import { Effect, FileSystem, Layer, Path } from "effect"
import { Files } from "./Files.ts"
import { Git } from "./Git.ts"

export const Live = Layer.mergeAll(Files.layer, Git.layer).pipe(Layer.provideMerge(NodeServices.layer))

export const besideBundle = (...segments: ReadonlyArray<string>) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const bundle = yield* fs.realPath(yield* path.fromFileUrl(new URL(import.meta.url)))
    return path.join(path.dirname(bundle), ...segments)
  })
