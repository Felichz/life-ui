// The agent's system prompt is AGENT.md at the repository root, bundled as text
import source from "../../../AGENT.md?raw";

/**
 * The file opens with a note for whoever maintains it, closed by a rule
 * ("---" on its own line). Only what comes after that rule is sent to the model.
 */
const RULE = /^---\s*$/m;
const prompt = RULE.test(source)
  ? source.slice(source.search(RULE)).replace(RULE, "").trim()
  : source;

export default prompt;
