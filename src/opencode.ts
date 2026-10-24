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
    const text = await Effect.runPromise(
      context(directory, GUIDE).pipe(Effect.provide(Live), Effect.orElseSucceed(() => undefined))
    )
    if (text) output.system.push(text)
  }
})
