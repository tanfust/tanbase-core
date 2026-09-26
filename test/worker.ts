import { processReminderBatch } from "../src/modules/jobs/queue.server"

// Durable Object and Workflow classes bound in wrangler.jsonc must be exported
// by the main module the test pool runs.
export { TaskBreakdownWorkflow } from "../src/modules/ai/breakdown-workflow.server"
export { BoardRoom } from "../src/modules/realtime/board-room.server"

export default {
  fetch() {
    return new Response("Test worker")
  },
  // The test configuration binds EMAIL_QUEUE with this Worker as consumer.
  async queue(batch) {
    await processReminderBatch(batch)
  },
} satisfies ExportedHandler<Env>
