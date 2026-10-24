import { realpathSync } from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { Live } from "./Live.ts"
import { context } from "./State.ts"

const GUIDE = path.join(
  path.dirname(realpathSync(fileURLToPath(import.meta.url))), "..", "..", "skills", "learnt", "SKILL.md"
)

const restoration = (cwd: string) =>
  Effect.runPromise(context(cwd, GUIDE).pipe(Effect.provide(Live), Effect.orElseSucceed(() => undefined)))

interface BeforeAgentStart {
  systemPrompt?: string | Array<string>
  systemPromptOptions?: { sections?: Record<string, string> }
}

export default function learnt(pi: {
  on(event: "before_agent_start", handler: (event: BeforeAgentStart, ctx: { cwd: string }) => Promise<unknown>): void
}) {
  pi.on("before_agent_start", async (event, ctx) => {
    const text = await restoration(ctx.cwd)
    const sections = event.systemPromptOptions?.sections
    if (sections) {
      if (text) sections.learnt = text
      else delete sections.learnt
      return
    }
    if (!text) return
    if (Array.isArray(event.systemPrompt)) return { systemPrompt: [...event.systemPrompt, text] }
    if (typeof event.systemPrompt === "string") return { systemPrompt: `${event.systemPrompt}\n\n${text}` }
  })
}
