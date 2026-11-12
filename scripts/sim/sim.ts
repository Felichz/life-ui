import { sessionDir } from "./storage";
import fs from "fs";
import path from "path";
import { SystemCore } from "../../src/system";
import { Agent, type ChatFn, type ChatStore, type SavedChats } from "../../src/app/agent/agent";
import { chat, type ChatMessage, type ToolCall } from "../../src/app/agent/llm";
import { setLocale } from "../../src/app/i18n";
import { runRoadmapPlanner } from "../../src/app/agent/roadmapAgent";

/**
 * A conversation with the app's real agent and a real local model, one message
 * per run, from the terminal:
 *
 *   npm run -s sim -- <session> reset
 *   echo "quiero volver a entrenar" | npm run -s sim -- <session> say
 *   npm run -s sim -- <session> state
 *
 * Everything the app would do happens here too: the same prompt, tools,
 * planner and client. Each change the agent proposes is accepted, as a person
 * tapping "yes" would, and shown. The session (the day, the library, the
 * conversations) is kept in .sim/<session>/ between runs.
 *
 * SIM_URL, SIM_MODEL, SIM_CONTEXT, SIM_MODE (confirm|auto), SIM_WEB (on|off)
 * and SIM_REASONING (on|off) change the defaults below.
 */

const [, , session = "default", command = "state", ...rest] = process.argv;
const endpoint = {
  baseUrl: process.env.SIM_URL ?? "http://127.0.0.1:1234/v1",
  model: process.env.SIM_MODEL ?? "qwen/qwen3.5-9b",
  context: Number(process.env.SIM_CONTEXT ?? 12288),
};

const out: string[] = [];
const say = (line = "") => {
  out.push(line);
  console.log(line);
};
const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}… [+${text.length - max}]` : text;

/** The system prompt is AGENT.md, from the rule on (see src/app/agent/prompt.ts). */
function prompt(): string {
  const source = fs.readFileSync(path.resolve("AGENT.md"), "utf8");
  const rule = /^---\s*$/m;
  return rule.test(source) ? source.slice(source.search(rule)).replace(rule, "").trim() : source;
}

const store: ChatStore = {
  load() {
    const raw = localStorage.getItem("lifeui.chats");
    return raw ? (JSON.parse(raw) as SavedChats) : null;
  },
  save(all) {
    localStorage.setItem("lifeui.chats", JSON.stringify(all));
  },
};

function describeState(core: SystemCore) {
  const state = core.getState();
  const templates = core.getActivityTemplates();
  const title = (id: string) => templates.find((tpl) => tpl.id === id)?.title ?? "?";
  say("## Biblioteca");
  for (const tpl of templates.filter((one) => !one.isSystemActivity)) {
    const minutes =
      tpl.clearObjectiveSettings?.estimatedDurationMinutes ??
      tpl.flexibleDurationSettings?.maximumDurationMinutes ??
      "?";
    say(`- ${tpl.title} (${tpl.type}, ${minutes} min)`);
  }
  say("\n## Plan de hoy");
  const today = (state as unknown as { currentDay?: { activityInstances?: unknown[] } }).currentDay;
  for (const raw of today?.activityInstances ?? []) {
    const item = raw as {
      templateId: string;
      status?: string;
      scheduledStart?: number;
      notes?: string;
    };
    const at =
      item.scheduledStart !== undefined
        ? ` · ${String(Math.floor(item.scheduledStart / 60)).padStart(2, "0")}:${String(item.scheduledStart % 60).padStart(2, "0")}`
        : "";
    say(`- ${title(item.templateId)}${at} [${item.status ?? ""}]`);
    if (item.notes) say(`    notas: ${clip(item.notes.replace(/\n/g, " ⏎ "), 400)}`);
  }
  say("\n## Próximos días");
  const byDate = new Map<string, string[]>();
  const notes = new Map<string, string>();
  for (const item of core.getPlannedActivities()) {
    const at =
      item.time !== undefined
        ? ` ${String(Math.floor(item.time / 60)).padStart(2, "0")}:${String(item.time % 60).padStart(2, "0")}`
        : "";
    byDate.set(item.date, [...(byDate.get(item.date) ?? []), `${title(item.templateId)}${at}`]);
    if (item.notes) notes.set(`${title(item.templateId)} · ${item.notes}`, item.date);
  }
  const weekday = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short" });
  for (const [date, items] of [...byDate.entries()].sort()) {
    say(`- ${weekday(date)} ${date}: ${items.join(" | ")}`);
  }
  say(`  (${core.getPlannedActivities().length} programadas en ${byDate.size} días)`);
  if (notes.size > 0) {
    say("\n### Notas distintas de lo programado (con la primera fecha en que aparecen)");
    const first = new Map<string, string>();
    for (const item of core.getPlannedActivities()) {
      if (!item.notes) continue;
      const key = `${title(item.templateId)} · ${item.notes}`;
      if (!first.has(key) || item.date < first.get(key)!) first.set(key, item.date);
    }
    for (const [key, date] of [...first.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
      say(`- desde ${date}: ${clip(key.replace(/\n/g, " ⏎ "), 700)}`);
    }
  }
  say("\n## Hojas de ruta");
  for (const progress of core.getRoadmapProgress()) {
    say(
      `- ${progress.roadmap.title} — por qué: ${progress.roadmap.why ?? "(nada)"} — ${Math.round(progress.fraction * 100)}%`
    );
    for (const entry of progress.milestones) {
      say(`    ${entry.milestone.title} [${entry.status}] ${entry.milestone.note ?? ""}`);
      for (const step of entry.steps) {
        say(
          `      · ${title(step.step.templateId)}: ${step.done}/${step.step.amount} ${step.step.unit} · programadas ${step.plannedAhead}`
        );
      }
    }
  }
  say("\n## Vida ideal");
  say(core.getIdealLife()?.text ?? "(nada escrito)");
}

async function main() {
  setLocale("es");
  if (command === "reset") {
    localStorage.clear();
    localStorage.setItem("lifeui.locale", "es");
    localStorage.setItem("lifeui.web", process.env.SIM_WEB ?? "on");
    const fresh = new SystemCore();
    fresh.startDay();
    say(`Sesión "${session}" en blanco, con el día empezado.`);
    return;
  }
  const core = new SystemCore();
  core.bringPlannedActivities();
  if (command === "state") {
    describeState(core);
    return;
  }
  if (command === "plan") {
    // The roadmap planner alone, with a request as the coach would write it
    const request = rest.join(" ").trim() || fs.readFileSync(0, "utf8").trim();
    const started = Date.now();
    const run = await runRoadmapPlanner({
      core,
      language: "Spanish",
      now: new Date(),
      reasoning: process.env.SIM_REASONING === "on",
      request,
      chat: async (messages, tools, signal, options) => {
        const at = Date.now();
        const reply = await chat(endpoint, messages, tools, signal, options);
        say(
          `[planificador ${((Date.now() - at) / 1000).toFixed(1)}s] ` +
            (reply.toolCalls.length > 0
              ? reply.toolCalls
                  .map((call) => `${call.function.name} ${clip(call.function.arguments, 2400)}`)
                  .join(" ; ")
              : `dice: ${clip(reply.content, 400)}`)
        );
        const last = messages[messages.length - 1];
        if (last.role === "tool") say(`    (antes: ${clip(String(last.content), 360)})`);
        return reply;
      },
    });
    say(
      `--- ${((Date.now() - started) / 1000).toFixed(0)} s · cambió: ${run.draft.changed} · error: ${run.lastError ?? "-"}`
    );
    say(`RESPUESTA AL COACH: ${run.reply}`);
    if (run.draft.changed) {
      const card = run.draft.describe();
      say(`TARJETA: ${card.text}`);
      card.details.forEach((detail) => say(`  - ${detail}`));
      say(`RESULTADO: ${JSON.stringify(run.draft.commit(), null, 1)}`);
      describeState(core);
    }
    return;
  }
  if (command !== "say") throw new Error(`unknown command "${command}": reset, say, plan or state`);

  const message = rest.join(" ").trim() || fs.readFileSync(0, "utf8").trim();
  if (!message) throw new Error("no message: pass it as arguments or on stdin");

  const planner: string[] = [];
  const real: ChatFn = async (messages, tools, signal, options) => {
    const isPlanner = String(messages[0].content).startsWith("You are the roadmap planner");
    const isNotes = String(messages[0].content).startsWith("You keep a coach's notes");
    const at = Date.now();
    const reply = await chat(endpoint, messages, tools, signal, options);
    // Each call as it ends, on stderr: a turn that takes minutes shows where the time went
    console.error(
      `  · ${isPlanner ? "planificador" : isNotes ? "notas" : "coach"} ${((Date.now() - at) / 1000).toFixed(1)}s, ${reply.usage?.completion ?? "?"} tokens${
        reply.toolCalls.length > 0
          ? ` → ${reply.toolCalls.map((call) => call.function.name).join(", ")}`
          : ""
      }`
    );
    if (isNotes) {
      planner.push(
        `    [notas ${((Date.now() - at) / 1000).toFixed(1)}s] ${reply.toolCalls[0]?.function.arguments ?? reply.content}`
      );
    }
    if (isPlanner) {
      const last = messages[messages.length - 1];
      if (last.role === "tool")
        planner.push(`      (respuesta: ${clip(String(last.content), 300)})`);
      planner.push(
        `    [planificador ${((Date.now() - at) / 1000).toFixed(1)}s] ` +
          (reply.toolCalls.length > 0
            ? reply.toolCalls
                .map((call) => `${call.function.name} ${clip(call.function.arguments, 1600)}`)
                .join(" ; ")
            : `dice: ${clip(reply.content, 300)}`)
      );
    }
    return reply;
  };

  const agent = new Agent({
    core,
    prompt: prompt(),
    chat: real,
    store,
    language: () => "es",
    context: () => endpoint.context,
    vision: () => false,
    titles: () => false,
    notes: () => process.env.SIM_NOTES !== "off",
    reasoning: () => process.env.SIM_REASONING === "on",
    web: {
      setting: () => (localStorage.getItem("lifeui.web") === "off" ? "off" : "on"),
      allow: () => localStorage.setItem("lifeui.web", "on"),
      http: (input, init) => fetch(input, init),
    },
  });
  agent.mode = process.env.SIM_MODE === "auto" ? "auto" : "confirm";

  // The person taps "yes" on every card: what was asked is shown below
  const asked = new Set<string>();
  agent.subscribe(() => {
    for (const entry of agent.entries) {
      if (entry.kind === "tool" && entry.status === "pending" && !asked.has(entry.id)) {
        asked.add(entry.id);
        setTimeout(() => agent.decide(entry.id, true), 0);
      }
    }
  });

  const before = agent.entries.length;
  const historyBefore = (store.load()?.chats.find((one) => one.id === store.load()?.activeId)
    ?.history.length ?? 0) as number;
  const started = Date.now();
  say(`\n### TÚ\n${message}\n`);
  await agent.send(message);

  const saved = store.load();
  const active = saved?.chats.find((one) => one.id === saved.activeId);
  const history = (active?.history ?? []) as ChatMessage[];
  const calls = new Map<string, ToolCall>();
  const results: Array<{ call?: ToolCall; content: string }> = [];
  for (const item of history.slice(historyBefore)) {
    if (item.role === "assistant") item.tool_calls?.forEach((call) => calls.set(call.id, call));
    if (item.role === "tool")
      results.push({ call: calls.get(item.tool_call_id), content: item.content });
  }

  for (const entry of agent.entries.slice(before + 1)) {
    if (entry.kind === "assistant") {
      say(
        `### COACH${entry.stats ? ` (${entry.stats.tokens} tokens, ${entry.stats.speed} t/s)` : ""}`
      );
      say(`${entry.text}\n`);
    } else if (entry.kind === "tool") {
      say(
        `> **${entry.name}** [${entry.status}${asked.has(entry.id) ? ", confirmado" : ""}] ${entry.summary}`
      );
      for (const detail of entry.details ?? []) say(`>   - ${detail}`);
    } else if (entry.kind === "compact") {
      say(`> (compactado: ${entry.before} → ${entry.after} tokens)`);
    } else if (entry.kind === "error") {
      say(`> ERROR: ${entry.text}`);
    }
  }
  say("--- llamadas y resultados de este turno");
  for (const { call, content } of results) {
    say(`  ${call?.function.name ?? "?"} ${clip(call?.function.arguments ?? "", 1800)}`);
    say(`    → ${clip(content, call?.function.name === "get_guide" ? 80 : 900)}`);
  }
  planner.forEach((line) => say(line));
  const usage = agent.usage();
  say(
    `--- ${((Date.now() - started) / 1000).toFixed(0)} s · contexto ${usage.used}/${usage.context} tokens`
  );
  fs.appendFileSync(path.join(sessionDir, "transcript.md"), `${out.join("\n")}\n`, "utf8");
}

main().catch((caught) => {
  console.error(caught);
  process.exitCode = 1;
});
