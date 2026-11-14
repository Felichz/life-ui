import type { ChatMessage, ChatOptions, ModelReply } from "./llm";
import { linksIn, openChoice, samePage } from "./brief";

/**
 * A second reading of the coach's answer, while the person reads it (ADR-012,
 * section 4e). The model that wrote the answer is asked a few closed questions
 * about it, each one to be backed by a sentence copied from it; the code keeps
 * only what it can find and, where it can, check itself. What survives becomes
 * a short correction after the answer: the answer itself is never rewritten
 * under the eyes of the one reading it.
 *
 * Asked "is your answer right?", a 9B model says yes, or finds faults that are
 * not there. Asked whether a number differs from a tool's answer, with the
 * sentence that says it, it can be held to what it claims.
 */

type Chat = (
  messages: ChatMessage[],
  tools: unknown[],
  signal?: AbortSignal,
  options?: ChatOptions
) => Promise<ModelReply>;

export type ProblemKind =
  | "contradicts_tool"
  | "open_choice"
  | "not_their_words"
  | "missed_question"
  | "unsafe"
  | "unknown_source"
  | "invented_link";

export interface Problem {
  kind: ProblemKind;
  /** The sentence it is about: from the answer, or the question from the person's message. */
  quote: string;
  /** What is right, as the reviewer put it. */
  fix: string;
}

const KINDS: Record<Exclude<ProblemKind, "invented_link">, string> = {
  contradicts_tool:
    "A number, date, time or name in the reply that differs from what a TOOL RESULT says. Not for numbers the tools never gave.",
  open_choice:
    'The reply leaves the person to choose between two loads, weights or times for the same thing ("5 or 10 kg") where the coach should give one.',
  not_their_words:
    'The reply says "you told me", "as you said" or the like about something that is NOT in THEIR MESSAGES.',
  unknown_source:
    "The reply names a source (a site, a blog, an organisation, a study) as something it found, and that name is NOT in the TOOL RESULTS.",
  missed_question:
    "A question in the person's LAST MESSAGE that the reply does not answer at all. quote: the question, copied from their message.",
  unsafe:
    "The reply gives a diagnosis, a medication or a dose of one, or tells them to keep going through sharp or worsening pain.",
};

const REVIEW = {
  type: "function" as const,
  function: {
    name: "review_reply",
    description:
      "Real mistakes in the coach's reply. Empty when there are none: most replies have none.",
    parameters: {
      type: "object",
      properties: {
        problems: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: Object.keys(KINDS) },
              quote: {
                type: "string",
                description: "The exact sentence, copied word for word, that shows the mistake.",
              },
              fix: { type: "string", description: "What is right instead, in one sentence." },
            },
            required: ["kind", "quote", "fix"],
          },
        },
      },
      required: ["problems"],
    },
  },
};

const bare = (words: string) =>
  words
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[*_`#>"“”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Whether a quote is really in the text: whole, or its longest part of at least 24 characters. */
export function quoted(quote: string, text: string): boolean {
  const q = bare(quote);
  const t = bare(text);
  if (q.length < 8) return false;
  if (t.includes(q)) return true;
  // A model copies a sentence and drops a mark or a word at its edges: a long enough piece counts
  return q
    .split(/[.;:!?¿¡()\n]+/)
    .map((part) => part.trim())
    .some((part) => part.length >= 24 && t.includes(part));
}

/** Words that say something is the person's: "you told me", "como dijiste". */
const ATTRIBUTED =
  /\b(dijiste|me dijiste|comentaste|mencionaste|me contaste|contaste|como (?:tienes|quieres|prefieres)|seg[uú]n (?:me )?dijiste|you said|you told|you mentioned|as you)\b/i;
/** Words that present a name as a source. */
const SOURCE_CUE =
  /\b(blogs?|sitios?|web|gu[ií]as?|fuentes?|seg[uú]n|estudios?|art[ií]culos?|p[aá]ginas?|sources?|sites?|articles?|stud(?:y|ies)|according)\b/i;

// "Una" and "one" are left out: far more often an article than a count
const NUMBER_WORDS: Record<string, number> = {
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/** The numbers a text says, in digits or in words. */
export function numbersIn(text: string): number[] {
  const found = [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
  for (const word of bare(text).split(/[^a-z]+/)) {
    if (word in NUMBER_WORDS) found.push(NUMBER_WORDS[word]);
  }
  return found;
}

/** Proper names in a quote, as bare words: capitalised words that do not open a sentence. */
function namesIn(quote: string): string[] {
  return [...quote.matchAll(/(?<![.!?¿¡]\s|^)\b([A-Z][A-Za-z0-9]{2,})\b/g)].map((m) => bare(m[1]));
}

/** Links in the reply that no search returned and the person never wrote. */
export function inventedLinks(reply: string, known: string[]): string[] {
  return linksIn(reply).filter((url) => !known.some((one) => samePage(one, url)));
}

/**
 * Which of the reviewer's problems stand: the quote is where it says it is,
 * and what the code can check is checked.
 */
export function confirmed(
  found: Problem[],
  context: { reply: string; last: string; theirs: string; tools: string }
): Problem[] {
  return found.filter((problem) => {
    switch (problem.kind) {
      case "missed_question":
        // The question is theirs, and a question; and the reply does not hold its main words
        return quoted(problem.quote, context.last) && /\?|¿/.test(problem.quote);
      case "open_choice":
        return quoted(problem.quote, context.reply) && openChoice(problem.quote) !== null;
      case "contradicts_tool": {
        // A number the reply says that the tools never gave: a number they did
        // give is right, whatever the reviewer thinks ("Monday the 16th" was
        // "corrected" to the 20th, a Friday, with the 16th in the tool's answer)
        if (!quoted(problem.quote, context.reply) || !context.tools) return false;
        const given = new Set(numbersIn(context.tools));
        return numbersIn(problem.quote).some((n) => !given.has(n));
      }
      case "not_their_words":
        // Something put in their mouth: said as theirs, and not something they wrote
        return (
          quoted(problem.quote, context.reply) &&
          ATTRIBUTED.test(problem.quote) &&
          !quoted(problem.quote, context.theirs)
        );
      case "unknown_source":
        // A name given as a source, in none of the results nor in their messages
        return (
          quoted(problem.quote, context.reply) &&
          SOURCE_CUE.test(problem.quote) &&
          namesIn(problem.quote).some(
            (name) => !bare(context.tools).includes(name) && !bare(context.theirs).includes(name)
          )
        );
      case "unsafe":
        return quoted(problem.quote, context.reply);
      default:
        return false;
    }
  });
}

const textOf = (content: ChatMessage["content"]): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => (part.type === "text" ? part.text : "")).join(" ")
      : "";

/**
 * The reply's problems: invented links found by the code, the rest asked of
 * the model and confirmed. Empty when nothing stands, or when anything fails.
 */
export async function reviewReply(options: {
  chat: Chat;
  /** The conversation, the reply last. */
  history: ChatMessage[];
  reply: string;
  /** Links the coach may give: from its searches, or written by the person. */
  links: string[];
  signal?: AbortSignal;
}): Promise<Problem[]> {
  const { history, reply } = options;
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const last = lastUser ? textOf(lastUser.content) : "";
  const theirs = history
    .filter((m) => m.role === "user" && !textOf(m.content).startsWith("[Automatic note"))
    .map((m) => textOf(m.content))
    .join("\n")
    .slice(-3000);
  // What the tools answered in this turn: the facts the reply has to agree with
  const turnStart = history.lastIndexOf(lastUser as ChatMessage);
  const toolTexts = history
    .slice(Math.max(0, turnStart))
    .filter((m) => m.role === "tool")
    .map((m) => textOf(m.content));
  // The reviewer reads a part; the code checks against all of it
  const tools = toolTexts
    .map((text) => text.slice(0, 900))
    .join("\n")
    .slice(0, 2500);
  const allTools = toolTexts.join("\n");

  const problems: Problem[] = inventedLinks(reply, options.links).map((url) => ({
    kind: "invented_link" as const,
    quote: url,
    fix: "this link did not come from a search: it may not exist",
  }));

  try {
    const answer = await options.chat(
      [
        {
          role: "system",
          content: `You check a coach's reply for real mistakes, of these kinds only:\n${Object.entries(
            KINDS
          )
            .map(([kind, what]) => `- ${kind}: ${what}`)
            .join(
              "\n"
            )}\nReport a mistake only when you can copy the sentence that shows it. Style, length, tone and missing extras are not mistakes. When in doubt, leave it out: an empty list is the usual answer.`,
        },
        {
          role: "user",
          content: `<their_messages>\n${theirs}\n</their_messages>\n<last_message>\n${last.slice(0, 1500)}\n</last_message>\n<tool_results>\n${tools || "(none)"}\n</tool_results>\n<reply>\n${reply.slice(0, 6000)}\n</reply>`,
        },
      ],
      [REVIEW],
      options.signal,
      { reasoning: false, maxTokens: 500, toolChoice: "required" }
    );
    const call = answer.toolCalls.find((one) => one.function.name === "review_reply");
    if (!call) return problems;
    const raw = JSON.parse(call.function.arguments || "{}") as { problems?: unknown };
    const found = (Array.isArray(raw.problems) ? raw.problems : [])
      .filter(
        (one): one is Problem =>
          typeof one === "object" &&
          one !== null &&
          typeof (one as Problem).kind === "string" &&
          typeof (one as Problem).quote === "string" &&
          typeof (one as Problem).fix === "string"
      )
      .slice(0, 3);
    return [...problems, ...confirmed(found, { reply, last, theirs, tools: allTools })];
  } catch {
    return problems;
  }
}

/**
 * The correction the person reads after the answer: a few sentences that say
 * what was wrong and what is right, written by the model from the problems.
 */
export async function writeCorrection(options: {
  chat: Chat;
  reply: string;
  last: string;
  problems: Problem[];
  language: string;
  signal?: AbortSignal;
}): Promise<string> {
  const answer = await options.chat(
    [
      {
        role: "system",
        content: `You are the coach. You just sent the reply below, and found these mistakes in it. Write a short follow-up message to the person, in ${options.language}: one to three sentences that put right the mistakes listed, plainly (for a question you did not answer, answer it), and nothing else. Start with "${
          /^span/i.test(options.language) ? "Una corrección:" : "A correction:"
        }". No apology beyond that, no repeating the whole reply, no new plan, no question to them, no mention of a review.${
          options.problems.some((p) => p.kind === "invented_link")
            ? " A link that did not come from a search: say it may not work and give no other."
            : ""
        }${
          options.problems.some((p) => p.kind === "unknown_source")
            ? " A source you named that was not among what you found: say so, and that what you said rests only on the sources you did find."
            : ""
        }`,
      },
      {
        role: "user",
        content: `<their_message>\n${options.last.slice(0, 1500)}\n</their_message>\n<your_reply>\n${options.reply.slice(0, 5000)}\n</your_reply>\n<mistakes>\n${options.problems
          .map((p) => `- ${p.kind}: "${p.quote}" → ${p.fix}`)
          .join("\n")}\n</mistakes>`,
      },
    ],
    [],
    options.signal,
    { reasoning: false, maxTokens: 400 }
  );
  return answer.content.trim();
}

const KEY = "lifeui.review";
const listeners = new Set<() => void>();

/**
 * Whether the coach reads its answer again while the person reads it. Off by
 * default: one more call of the model after every answer, on the GPU.
 */
export function getReview(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setReview(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // kept for this session only: the listeners below still hear it
  }
  listeners.forEach((listener) => listener());
}

export function onReview(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
