import { getRequestHeaders } from "@tanstack/react-start/server"

import { getSessionFromHeaders } from "@/modules/auth/session.server"

import {
  getAiStatus,
  getTaskBreakdown,
  startTaskBreakdown,
} from "./breakdown.server"
import type { AiStatus, BreakdownState } from "./contracts"

async function requireUserId() {
  const session = await getSessionFromHeaders(getRequestHeaders())
  if (!session) throw new Error("Unauthorized")
  return session.user.id
}

export async function getAiStatusImpl(): Promise<AiStatus> {
  return getAiStatus(await requireUserId())
}

export async function startTaskBreakdownImpl(input: {
  taskId: string
}): Promise<{ instanceId: string }> {
  return startTaskBreakdown(await requireUserId(), input.taskId)
}

export async function getTaskBreakdownImpl(input: {
  instanceId: string
}): Promise<BreakdownState> {
  return getTaskBreakdown(await requireUserId(), input.instanceId)
}
