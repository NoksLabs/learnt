/** Preview by default; reset only a confirmed snapshot of local learning notes. */
import { createHash } from "node:crypto"
import * as path from "node:path"
import { Data, Effect } from "effect"
import { Files } from "./Files.ts"
import { absoluteDirectory, stateDirectory } from "./State.ts"

export class ResetError extends Data.TaggedError("ResetError")<{
  readonly message: string
}> {}

export const FRESH: Readonly<Record<string, string>> = {
  "profile.md": "# Learner Profile\n\nLearning mode: active\nOnboarding: incomplete\n" +
    "Onboarding reset: pending\n\n" +
    "Remaining onboarding: Project situation, experience, stack familiarity, " +
    "goals, and preferences.\n",
  "progress.md": "# Learning Progress\n\nNo learning events recorded yet.\n",
  "project-map.md": "# Project Map\n\nNot mapped yet. Inspect the current project.\n"
}
const NAMES = Object.keys(FRESH)

export type ResetResult =
  | { readonly status: "no_notes"; readonly cwd: string }
  | {
    readonly status: "preview"
    readonly project: string
    readonly state: string
    readonly files: ReadonlyArray<string>
    readonly backup_parent: string
    readonly confirmation: string
  }
  | { readonly status: "reset"; readonly project: string; readonly state: string; readonly backup: string }

const snapshot = (cwd: string) =>
  Effect.gen(function*() {
    const files = yield* Files
    const state = yield* stateDirectory(cwd)
    if (state === undefined) return undefined
    const notes = new Map<string, Uint8Array>()
    for (const name of NAMES) {
      const note = path.join(state, name)
      const kind = yield* files.kind(note)
      if (kind === "missing") continue
      if (kind !== "file") {
        return yield* new ResetError({ message: `Refusing to reset non-regular note: ${note}` })
      }
      notes.set(name, yield* files.readBytes(note))
    }
    // Include identity, missing files, and content so confirmation cannot drift
    // to another project or silently discard notes updated by another session.
    const digest = createHash("sha256").update(state)
    for (const name of NAMES) {
      const data = notes.get(name)
      digest.update(JSON.stringify([name, data === undefined ? null : Buffer.from(data).toString("hex")]))
    }
    return { state, notes, fingerprint: digest.digest("hex") }
  })

export const reset = (rawCwd: string, confirmation?: string) =>
  Effect.gen(function*() {
    const files = yield* Files
    const cwd = absoluteDirectory(rawCwd)
    if (cwd === undefined) {
      return yield* new ResetError({ message: "Use an existing absolute project working directory." })
    }
    const before = yield* snapshot(cwd)
    const notes = before?.notes.size ? before : undefined
    if (confirmation !== undefined && (notes === undefined || confirmation !== notes.fingerprint)) {
      return yield* new ResetError({ message: "Target or notes changed. Preview and confirm again; nothing reset." })
    }
    if (notes === undefined) return { status: "no_notes", cwd } satisfies ResetResult
    const { state, fingerprint } = notes
    const backupParent = path.join(state, "backups")
    if (confirmation === undefined) {
      return {
        status: "preview",
        project: path.dirname(state),
        state,
        files: [...notes.notes.keys()],
        backup_parent: backupParent,
        confirmation: fingerprint
      } satisfies ResetResult
    }

    const parentKind = yield* files.kind(backupParent)
    if (parentKind !== "missing" && parentKind !== "directory") {
      return yield* new ResetError({ message: "Backup path must be a real directory; nothing reset." })
    }
    if (parentKind === "missing") yield* files.makeDirectory(backupParent, 0o700)
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
    const backup = yield* files.makeTempDirectory(path.join(backupParent, `reset-${stamp}-`))

    yield* Effect.gen(function*() {
      // Finish all backups and prepare replacements before touching active notes.
      for (const [name, data] of notes.notes) yield* files.writeBytes(path.join(backup, name), data)
      for (const name of NAMES) {
        yield* files.writeBytes(path.join(backup, `.new-${name}`), new TextEncoder().encode(FRESH[name]))
      }
      if ((yield* snapshot(cwd))?.fingerprint !== fingerprint) {
        return yield* new ResetError({ message: "Notes changed during backup; active notes were not reset." })
      }
      for (const name of NAMES) yield* files.replace(path.join(backup, `.new-${name}`), path.join(state, name))
    }).pipe(
      Effect.mapError((error) =>
        new ResetError({
          message: `Reset did not complete. Backup location: ${backup}. ` +
            `Check active notes before continuing. ${error._tag === "ResetError" ? error.message : String(error.cause)}`
        })
      )
    )
    return { status: "reset", project: path.dirname(state), state, backup } satisfies ResetResult
  })
