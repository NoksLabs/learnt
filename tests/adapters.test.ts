import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { beforeEach, describe, expect, test } from "bun:test"
import { GUIDE, notes, ROOT, tempDir } from "./helpers.ts"

let home: string
let project: string
let empty: string

beforeEach(() => {
  home = path.join(tempDir("learnt-adapters-"), "home")
  project = path.join(home, "shop")
  empty = path.join(home, "empty")
  fs.mkdirSync(path.join(project, ".git"), { recursive: true })
  fs.mkdirSync(path.join(empty, ".git"), { recursive: true })
  notes(project)
})

const node = (source: string) => {
  const result = spawnSync("node", ["--input-type=module", "-e", source], {
    encoding: "utf8", timeout: 30_000,
    env: { PATH: process.env.PATH ?? "", HOME: home, PROJECT: project, EMPTY: empty }
  })
  expect(result.stderr).toBe("")
  return JSON.parse(result.stdout)
}

describe("in-process adapters", () => {
  test("pi sets a named prompt section and removes it when learning is off, so it never goes stale", () => {
    const out = node(`
      const mod = await import(${JSON.stringify(path.join(ROOT, "adapters/pi/learnt.js"))});
      let handler;
      mod.default({ on: (name, fn) => { if (name === "before_agent_start") handler = fn; } });
      const on = { systemPrompt: "base", systemPromptOptions: { sections: { learnt: "stale" } } };
      const result = await handler(on, { cwd: process.env.PROJECT });
      const off = { systemPrompt: "base", systemPromptOptions: { sections: { learnt: "stale" } } };
      await handler(off, { cwd: process.env.EMPTY });
      console.log(JSON.stringify({ result: result ?? null, section: on.systemPromptOptions.sections.learnt,
        offHas: "learnt" in off.systemPromptOptions.sections }));
    `)
    expect(out.result).toBeNull()
    expect(out.section).toContain(`Notes folder: ${path.join(project, ".learnt")}`)
    expect(out.section).toContain(GUIDE)
    expect(out.offHas).toBe(false)
  })

  test("omp gets the message appended to its prompt array, and nothing when learning is off", () => {
    const out = node(`
      const mod = await import(${JSON.stringify(path.join(ROOT, "adapters/pi/learnt.js"))});
      let handler;
      mod.default({ on: (name, fn) => { if (name === "before_agent_start") handler = fn; } });
      const on = await handler({ systemPrompt: ["base"] }, { cwd: process.env.PROJECT });
      const off = await handler({ systemPrompt: ["base"] }, { cwd: process.env.EMPTY });
      console.log(JSON.stringify({ on, off: off ?? null }));
    `)
    expect(out.on.systemPrompt[0]).toBe("base")
    expect(out.on.systemPrompt[1]).toContain("Learnt learning mode is on")
    expect(out.off).toBeNull()
  })

  test("opencode exports only the plugin function, since opencode loads every export as a plugin", () => {
    const out = node(`
      const mod = await import(${JSON.stringify(path.join(ROOT, "adapters/opencode/learnt.js"))});
      const run = async (directory) => {
        const hooks = await mod.Learnt({ directory });
        const output = { system: ["base"] };
        await hooks["experimental.chat.system.transform"]({}, output);
        return output.system;
      };
      console.log(JSON.stringify({ exports: Object.keys(mod), on: await run(process.env.PROJECT), off: await run(process.env.EMPTY) }));
    `)
    expect(out.exports).toEqual(["Learnt"])
    expect(out.on).toHaveLength(2)
    expect(out.on[1]).toContain(path.join(project, ".learnt"))
    expect(out.off).toEqual(["base"])
  })
})
