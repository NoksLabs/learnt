import { Effect } from "effect"
import { besideBundle, Live } from "./Live.ts"
import { context } from "./State.ts"

export const Learnt = async ({ directory }: { directory: string }) => ({
  "experimental.chat.system.transform": async (_input: unknown, output: { system: Array<string> }) => {
    const text = await Effect.runPromise(
      besideBundle("..", "..", "skills", "learnt", "SKILL.md").pipe(
        Effect.flatMap((guide) => context(directory, guide)),
        Effect.provide(Live),
        Effect.orElseSucceed(() => undefined)
      )
    )
    if (text) output.system.push(text)
  }
})
