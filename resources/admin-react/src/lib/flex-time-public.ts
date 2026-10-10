// Entry for public/assets/flex-time.js. Themes load it once; plugin scripts import it from the same URL.
import { autoStart } from "./flex-time"

export * from "./flex-time"

if (typeof document !== "undefined") autoStart(document)
