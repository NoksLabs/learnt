/**
 * Learnt restoration for pi and omp, bundled to adapters/pi/learnt.js.
 *
 * Before every prompt, check in-process whether this project has active learning
 * notes. If so, add the restoration message to that turn's system prompt. Running
 * per turn covers startup, resume, /new, /clear, fork and compaction without
 * tracking each event, and picks up notes that onboarding creates mid-session.
 *
 * pi exposes structured prompt sections; omp passes the system prompt as a string
 * array. No agent packages are imported, so one bundle serves both.
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

// Learning must never block a coding session; any failure stays silent.
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
      // pi: edit the named section so pi can send a transcript delta.
      if (text) sections.learnt = text
      else delete sections.learnt
      return
    }
    if (!text) return
    // omp: the result replaces the prompt for this turn, chained across extensions.
    if (Array.isArray(event.systemPrompt)) return { systemPrompt: [...event.systemPrompt, text] }
    if (typeof event.systemPrompt === "string") return { systemPrompt: `${event.systemPrompt}\n\n${text}` }
  })
}
