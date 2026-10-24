import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { beforeEach, describe, expect, test } from "bun:test"
import { CLI, read, ROOT, tempDir, write } from "./helpers.ts"

let home: string

beforeEach(() => {
  home = path.join(tempDir("learnt-install-"), "home")
  fs.mkdirSync(home)
})

const install = (...args: Array<string>) => {
  const env = { ...process.env }
  delete env.CODEX_HOME
  delete env.XDG_CONFIG_HOME
  const result = spawnSync("bun", [path.join(ROOT, "src/install.ts"), "--home", home, ...args], { encoding: "utf8", env })
  expect(result.status).toBe(0)
  return result
}

describe("installer", () => {
  test("Codex install keeps the operator's other hooks and running it twice adds one entry", () => {
    const hooks = path.join(home, ".codex/hooks.json")
    const other = { hooks: [{ type: "command", command: "bash other.sh", timeout: 10 }] }
    write(hooks, JSON.stringify({ hooks: { SessionStart: [other] } }))
    install("codex")
    install("codex")
    const groups = JSON.parse(read(hooks)).hooks.SessionStart
    expect(groups).toHaveLength(2)
    expect(groups[0]).toEqual(other)
    expect(groups[1].hooks[0].command).toContain(CLI)
  })

  test("Codex skill copies drop the Claude-only flag Codex rejects, and keep every guide", () => {
    install("codex")
    const skill = path.join(home, ".codex/skills/learnt")
    expect(read(path.join(skill, "SKILL.md"))).not.toContain("disable-model-invocation")
    for (const file of ["teaching.md", "topics.md", "onboarding.md", "notes.md", "agents/openai.yaml", "scripts/learnt.mjs"]) {
      expect(fs.existsSync(path.join(skill, file))).toBe(true)
    }
  })

  test("uninstall restores other hooks and backs up outside folders agents scan", () => {
    const hooks = path.join(home, ".codex/hooks.json")
    const other = { hooks: [{ type: "command", command: "bash other.sh" }] }
    write(hooks, JSON.stringify({ hooks: { SessionStart: [other] } }))
    install("codex")
    install("--uninstall", "codex")
    expect(JSON.parse(read(hooks)).hooks.SessionStart).toEqual([other])
    expect(fs.existsSync(path.join(home, ".codex/skills/learnt"))).toBe(false)
    expect(fs.existsSync(path.join(home, ".learnt-install-backups"))).toBe(true)
  })

  test("opencode gets a linked plugin and commands with real paths, so rebuilds apply without reinstall", () => {
    install("opencode")
    const config = path.join(home, ".config/opencode")
    const plugin = path.join(config, "plugins/learnt.js")
    expect(fs.realpathSync(plugin)).toBe(path.join(ROOT, "adapters/opencode/learnt.js"))
    for (const name of ["learnt", "learnt-reset"]) {
      const command = read(path.join(config, `commands/${name}.md`))
      expect(command).toContain(path.join(ROOT, `skills/${name}/SKILL.md`))
      expect(command).not.toContain("{{")
    }
    install("--uninstall", "opencode")
    expect(fs.existsSync(plugin)).toBe(false)
  })

  test("dry run changes nothing", () => {
    install("--dry-run", "codex", "opencode")
    expect(fs.readdirSync(home)).toEqual([])
  })
})
