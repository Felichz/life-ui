import { estimateTokens } from "./context";
import prompt from "./prompt";
import { toolSchemas } from "./tools";

/**
 * What every request carries before a word of conversation: the agent's
 * prompt, its tools and the day (about 400 tokens for a busy one). It is the
 * part of the context the person cannot use, so the model dialog shows it.
 */
export function agentBaseTokens(): number {
  return estimateTokens(prompt) + estimateTokens(JSON.stringify(toolSchemas())) + 400;
}
