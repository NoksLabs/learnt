import * as fs from "node:fs"
import { Context, Data, Effect, Layer } from "effect"

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
  makeTempDirectory(prefix: string): Effect.Effect<string, FileError>
  replace(source: string, target: string): Effect.Effect<void, FileError>
}>()("learnt/Files") {
  static readonly layer = Layer.succeed(Files, Files.of({
    kind: (path) =>
      Effect.sync((): Kind => {
        let stat: fs.Stats
        try {
          stat = fs.lstatSync(path)
        } catch {
          return "missing"
        }
        if (stat.isSymbolicLink()) return "symlink"
        if (stat.isFile()) return "file"
        if (stat.isDirectory()) return "directory"
        return "other"
      }),
    exists: (path) =>
      Effect.sync(() => {
        try {
          fs.lstatSync(path)
          return true
        } catch {
          return false
        }
      }),
    readBytes: (path) => attempt("read", path, () => new Uint8Array(fs.readFileSync(path))),
    writeBytes: (path, data) => attempt("write", path, () => fs.writeFileSync(path, data)),
    makeDirectory: (path, mode) =>
      attempt("mkdir", path, () => {
        fs.mkdirSync(path, { mode, recursive: false })
      }),
    makeTempDirectory: (prefix) => attempt("mkdtemp", prefix, () => fs.mkdtempSync(prefix)),
    replace: (source, target) => attempt("replace", target, () => fs.renameSync(source, target))
  }))
}

const attempt = <A>(operation: string, path: string, run: () => A) =>
  Effect.try({ try: run, catch: (cause) => new FileError({ operation, path, cause }) })
