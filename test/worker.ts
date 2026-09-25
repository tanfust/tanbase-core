// Durable Object classes bound in wrangler.jsonc must be exported by the main
// module the test pool runs.
export { BoardRoom } from "../src/modules/realtime/board-room.server"

export default {
  fetch() {
    return new Response("Test worker")
  },
} satisfies ExportedHandler<Env>
