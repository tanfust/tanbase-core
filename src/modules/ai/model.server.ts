import type { AiConfig } from "./config.server"
import {
  breakdownSystemPrompt,
  breakdownUserPrompt,
  parseSubtasks,
  subtaskJsonSchema,
} from "./subtasks"

/**
 * Asks the configured model for subtasks through AI Gateway and returns the
 * validated titles. Invalid output throws, so the calling step retries.
 */
export async function generateSubtasks(
  task: { id: string; title: string; notes: string | null },
  { ai, model, gatewayId }: Pick<AiConfig, "ai" | "model" | "gatewayId">
): Promise<string[]> {
  const result = (await ai.run(
    model as keyof AiModels,
    {
      messages: [
        { role: "system", content: breakdownSystemPrompt },
        { role: "user", content: breakdownUserPrompt(task) },
      ],
      response_format: { type: "json_schema", json_schema: subtaskJsonSchema },
      max_tokens: 600,
      temperature: 0.3,
    },
    {
      gateway: {
        id: gatewayId,
        // Identical tasks should still get a fresh breakdown.
        skipCache: true,
        metadata: { feature: "task-breakdown", taskId: task.id },
      },
    }
  )) as { response?: unknown }

  return parseSubtasks(result.response)
}
