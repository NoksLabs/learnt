import { Layer } from "effect"
import { Files } from "./Files.ts"
import { Git } from "./Git.ts"

export const Live = Layer.mergeAll(Files.layer, Git.layer)
