import { Layer } from "effect"
import { Files } from "./Files.ts"
import { Git } from "./Git.ts"

/** Real file system and Git, for every entry point. Tests swap these out. */
export const Live = Layer.mergeAll(Files.layer, Git.layer)
