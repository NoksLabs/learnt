import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach } from "bun:test"

export const ROOT = path.resolve(import.meta.dir, "..")
export const CLI = path.join(ROOT, "skills/learnt/scripts/learnt.mjs")

const temps: Array<string> = []
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

/** A fresh temporary directory (real path), removed after each test. */
export const tempDir = (prefix: string) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)))
  temps.push(dir)
  return dir
}

export const write = (file: string, text: string | Uint8Array) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

export const read = (file: string) => fs.readFileSync(file, "utf8")

/** Map of file name to bytes for every entry in a directory. */
export const snapshot = (dir: string) =>
  Object.fromEntries(fs.readdirSync(dir).sort().map((name) => [name, fs.readFileSync(path.join(dir, name)).toString("hex")]))

/** Run the bundled CLI with a controlled environment. */
export const cli = (args: Array<string>, options: { home: string; input?: string; cwd?: string }) => {
  const result = spawnSync("node", [CLI, ...args], {
    input: options.input ?? "", encoding: "utf8", cwd: options.cwd ?? options.home, timeout: 10_000,
    env: { PATH: process.env.PATH ?? "", HOME: options.home }
  })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

export const gitInit = (dir: string) => {
  fs.mkdirSync(dir, { recursive: true })
  spawnSync("git", ["init", "-q", dir])
  return dir
}

export const hasGit = spawnSync("git", ["--version"]).status === 0
