/**
 * Learnt restoration for opencode, bundled to adapters/opencode/learnt.js.
 *
 * Before every model request, check in-process whether this project has active
 * learning notes and, if so, append the restoration message to the system prompt.
 * This covers new sessions, resumed sessions and compaction.
 *
 * opencode treats every export of a plugin file as a plugin, so this module
 * exports only the plugin function.
 */
import { realpathSync } from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { Live } from "./Live.ts"
import { context } from "./State.ts"

const GUIDE = path.join(
  path.dirname(realpathSync(fileURLToPath(import.meta.url))), "..", "..", "skills", "learnt", "SKILL.md"
)

export const Learnt = async ({ directory }: { directory: string }) => ({
  "experimental.chat.system.transform": async (_input: unknown, output: { system: Array<string> }) => {
    // Learning must never block a coding session; any failure stays silent.
    const text = await Effect.runPromise(
      context(directory, GUIDE).pipe(Effect.provide(Live), Effect.orElseSucceed(() => undefined))
    )
    if (text) output.system.push(text)
  }
})
