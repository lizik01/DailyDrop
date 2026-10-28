import { generateText, Output, stepCountIs, type ToolSet } from 'ai'
import type { z } from 'zod'
import { db, llmCalls } from '@/lib/db'
import { models } from './models'

export type StructuredCall<T> = {
  /** Shows up in llm_calls.purpose, e.g. "profile" or "editor". */
  purpose: string
  schema: z.ZodType<T>
  instructions: string
  prompt: string
  model?: string
  tools?: ToolSet
  /** Upper bound on agent steps (model turn + tool calls). 1 = no tools. */
  maxSteps?: number
  maxAttempts?: number
  /** Checks Zod can't express (e.g. "refs must exist"). Return a message to reject and retry. */
  validate?: (value: T) => string | null
  subscriberId?: string
}

export type StructuredResult<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Every LLM call in DailyDrop goes through here:
 *  1. The output must parse against a Zod schema (and pass `validate`).
 *  2. If it doesn't, retry once with the error added to the prompt so the model can fix it.
 *  3. Every attempt is logged to llm_calls (tokens, latency, steps, error).
 * It never throws. Callers decide what the fallback is when `ok` is false.
 */
export async function generateStructured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
  const model = call.model ?? models.smart
  const maxAttempts = call.maxAttempts ?? 2
  let lastError = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now()
    const prompt =
      attempt === 1
        ? call.prompt
        : `${call.prompt}\n\nYour previous answer was rejected: ${lastError}\nReturn a corrected answer.`

    try {
      const result = await generateText({
        model,
        instructions: call.instructions,
        prompt,
        output: Output.object({ schema: call.schema }),
        tools: call.tools,
        stopWhen: stepCountIs(call.maxSteps ?? 1),
      })
      const value = result.output as T
      const problem = call.validate?.(value) ?? null

      await logCall({ purpose: call.purpose, subscriberId: call.subscriberId }, {
        model,
        attempt,
        ok: !problem,
        error: problem,
        inputTokens: result.totalUsage.inputTokens ?? null,
        outputTokens: result.totalUsage.outputTokens ?? null,
        steps: result.steps.length,
        latencyMs: Date.now() - startedAt,
      })
      if (!problem) return { ok: true, value }
      lastError = problem
    } catch (error) {
      // Schema parse failures, provider errors, and timeouts all land here.
      lastError = error instanceof Error ? error.message.slice(0, 500) : String(error)
      await logCall({ purpose: call.purpose, subscriberId: call.subscriberId }, { model, attempt, ok: false, error: lastError, latencyMs: Date.now() - startedAt })
    }
  }

  return { ok: false, error: lastError }
}

type LlmCallRow = typeof llmCalls.$inferInsert

async function logCall(
  context: Pick<LlmCallRow, 'purpose' | 'subscriberId'>,
  row: Omit<LlmCallRow, 'purpose' | 'subscriberId'>,
) {
  try {
    await db.insert(llmCalls).values({ ...context, ...row })
  } catch (error) {
    // Logging must never break the pipeline.
    console.error('llm_calls insert failed', error)
  }
}
