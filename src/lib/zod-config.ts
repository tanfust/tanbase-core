import { config } from "zod/v4/core"
import en from "zod/v4/locales/en.js"

// Neither the Worker nor the page CSP allows eval. Zod probes for eval, with
// `new Function`, when it builds its first object schema unless its JIT is
// off, and the browser reports that probe as a CSP violation. Import this
// module in every module that builds a schema the browser loads, so the
// setting comes first whichever module loads first.
//
// Schemas the browser loads are built with `zod/mini`, which leaves out
// Zod's English messages. Setting them here gives a rule without a message of
// its own the same wording in the browser and on the Worker.
config({ jitless: true, ...en() })
