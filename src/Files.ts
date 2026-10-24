import { Context, Data, Effect, FileSystem, Layer } from "effect"

export class FileError extends Data.TaggedError("FileError")<{
  readonly operation: string
  readonly path: string
  readonly cause: unknown
}> {}

export type Kind = "missing" | "file" | "directory" | "symlink" | "other"

export class Files extends Context.Service<Files, {
  kind(path: string): Effect.Effect<Kind>
  exists(path: string): Effect.Effect<boolean>
  readBytes(path: string): Effect.Effect<Uint8Array, FileError>
  writeBytes(path: string, data: Uint8Array): Effect.Effect<void, FileError>
  makeDirectory(path: string, mode: number): Effect.Effect<void, FileError>
  makeTempDirectory(directory: string, prefix: string): Effect.Effect<string, FileError>
  replace(source: string, target: string): Effect.Effect<void, FileError>
}>()("learnt/Files") {
  static readonly layer = Layer.effect(Files, Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const kind = (path: string) =>
      fs.readLink(path).pipe(
        Effect.as<Kind>("symlink"),
        Effect.catch(() =>
          fs.stat(path).pipe(
            Effect.map(({ type }): Kind => type === "File" ? "file" : type === "Directory" ? "directory" : "other"),
            Effect.orElseSucceed((): Kind => "missing")
          )
        )
      )
    const attempt = <A>(operation: string, path: string, run: Effect.Effect<A, unknown>) =>
      Effect.mapError(run, (cause) => new FileError({ operation, path, cause }))
    return Files.of({
      kind,
      exists: (path) => Effect.map(kind(path), (found) => found !== "missing"),
      readBytes: (path) => attempt("read", path, fs.readFile(path)),
      writeBytes: (path, data) => attempt("write", path, fs.writeFile(path, data)),
      makeDirectory: (path, mode) => attempt("mkdir", path, fs.makeDirectory(path, { mode, recursive: false })),
      makeTempDirectory: (directory, prefix) =>
        attempt("mkdtemp", directory, fs.makeTempDirectory({ directory, prefix })),
      replace: (source, target) => attempt("replace", target, fs.rename(source, target))
    })
  }))
}
