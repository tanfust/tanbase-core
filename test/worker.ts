export default {
  fetch() {
    return new Response("Test worker")
  },
} satisfies ExportedHandler<Env>
