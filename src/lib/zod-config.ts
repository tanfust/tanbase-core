import { config } from "zod/v4/core"

// Neither the Worker nor the page CSP allows eval. Zod probes for eval, with
// `new Function`, when it builds its first object schema unless its JIT is
// off, and the browser reports that probe as a CSP violation. Import this
// module in every module that builds a schema the browser loads, so the
// setting comes first whichever module loads first.
config({ jitless: true })
