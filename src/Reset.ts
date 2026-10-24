import { Crypto, Data, Effect, Path } from "effect"
import { Hex } from "effect/encoding"
import { Files } from "./Files.ts"
import { absoluteDirectory, CURRICULUM, JOURNAL, NOTES, OPERATOR, stateDirectory, SYSTEM } from "./State.ts"

export class ResetError extends Data.TaggedError("ResetError")<{
  readonly message: string
}> {}

export const SCOPES = {
  onboarding: [OPERATOR],
  progress: [CURRICULUM, JOURNAL],
  everything: NOTES
} as const satisfies Record<string, ReadonlyArray<string>>
export type Scope = keyof typeof SCOPES
export const SCOPE_NAMES = ["onboarding", "progress", "everything"] as const satisfies ReadonlyArray<Scope>

export const fresh = (scope: Scope, day: string, backup: string): Readonly<Record<string, string>> => ({
  [OPERATOR]: "# Operator\n\nLearning mode: active\nOnboarding: incomplete\nOnboarding reset: pending\n\n" +
    "Open questions: bench, role, experience, motive, focus tracks, learning style, stack, pace.\n",
  [CURRICULUM]: "# Curriculum\n\nNo tracks started. Seed tracks from the operator's focus.\n",
  [JOURNAL]: `# Journal\n\n## ${day} Reset: ${scope}\n` +
    `Old notes saved in ${backup}. History only: do not copy old levels or answers. ` +
    "Re-check skills by asking.\n",
  [SYSTEM]: "# System\n\nNot mapped yet. Inspect the project.\n"
})

export type ResetResult =
  | { readonly status: "no_notes"; readonly cwd: string }
  | {
    readonly status: "preview"
    readonly scope: Scope
    readonly project: string
    readonly state: string
    readonly reset: ReadonlyArray<string>
    readonly kept: ReadonlyArray<string>
    readonly backup_parent: string
    readonly confirmation: string
  }
  | {
    readonly status: "reset"
    readonly scope: Scope
    readonly project: string
    readonly state: string
    readonly reset: ReadonlyArray<string>
    readonly backup: string
  }

const snapshot = (cwd: string, scope: Scope) =>
  Effect.gen(function*() {
    const files = yield* Files
    const path = yield* Path.Path
    const crypto = yield* Crypto.Crypto
    const state = yield* stateDirectory(cwd)
    if (state === undefined) return undefined
    const notes = new Map<string, Uint8Array>()
    for (const name of NOTES) {
      const note = path.join(state, name)
      const kind = yield* files.kind(note)
      if (kind === "missing") continue
      if (kind !== "file") {
        return yield* new ResetError({ message: `Refusing to reset non-regular note: ${note}` })
      }
      notes.set(name, yield* files.readBytes(note))
    }
    let digest = JSON.stringify([state, scope])
    for (const name of NOTES) {
      const data = notes.get(name)
      digest += JSON.stringify([name, data === undefined ? null : Hex.encode(data)])
    }
    const fingerprint = yield* Effect.orDie(crypto.digest("SHA-256", new TextEncoder().encode(digest)))
    return { state, notes, fingerprint: Hex.encode(fingerprint) }
  })

export const reset = (rawCwd: string, scope: Scope, confirmation?: string) =>
  Effect.gen(function*() {
    const files = yield* Files
    const path = yield* Path.Path
    const cwd = yield* absoluteDirectory(rawCwd)
    if (cwd === undefined) {
      return yield* new ResetError({ message: "Use an existing absolute project working directory." })
    }
    const before = yield* snapshot(cwd, scope)
    const notes = before?.notes.size ? before : undefined
    if (confirmation !== undefined && (notes === undefined || confirmation !== notes.fingerprint)) {
      return yield* new ResetError({ message: "Target, scope or notes changed. Preview and confirm again; nothing reset." })
    }
    if (notes === undefined) return { status: "no_notes", cwd } satisfies ResetResult
    const { state, fingerprint } = notes
    const targets: ReadonlyArray<string> = SCOPES[scope]
    const backupParent = path.join(state, "backups")
    if (confirmation === undefined) {
      return {
        status: "preview",
        scope,
        project: path.dirname(state),
        state,
        reset: targets.filter((name) => notes.notes.has(name)),
        kept: [...notes.notes.keys()].filter((name) => !targets.includes(name)),
        backup_parent: backupParent,
        confirmation: fingerprint
      } satisfies ResetResult
    }

    const parentKind = yield* files.kind(backupParent)
    if (parentKind !== "missing" && parentKind !== "directory") {
      return yield* new ResetError({ message: "Backup path must be a real directory; nothing reset." })
    }
    if (parentKind === "missing") yield* files.makeDirectory(backupParent, 0o700)
    const now = new Date().toISOString()
    const stamp = now.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
    const backup = yield* files.makeTempDirectory(backupParent, `${scope}-${stamp}-`)
    const replacements = fresh(scope, now.slice(0, 10), backup)

    yield* Effect.gen(function*() {
      for (const [name, data] of notes.notes) yield* files.writeBytes(path.join(backup, name), data)
      for (const name of targets) {
        yield* files.writeBytes(path.join(backup, `.new-${name}`), new TextEncoder().encode(replacements[name]))
      }
      if ((yield* snapshot(cwd, scope))?.fingerprint !== fingerprint) {
        return yield* new ResetError({ message: "Notes changed during backup; active notes were not reset." })
      }
      for (const name of targets) yield* files.replace(path.join(backup, `.new-${name}`), path.join(state, name))
    }).pipe(
      Effect.mapError((error) =>
        new ResetError({
          message: `Reset did not complete. Backup location: ${backup}. ` +
            `Check active notes before continuing. ${error._tag === "ResetError" ? error.message : String(error.cause)}`
        })
      )
    )
    return { status: "reset", scope, project: path.dirname(state), state, reset: targets, backup } satisfies ResetResult
  })
