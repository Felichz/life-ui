# ADR-007: Conversations that fit the model

- Status: accepted
- Date: 2026-11-11
- Builds on: ADR-002 (the agent), ADR-004 (local model runtime)

## Context

The chat is the way into the app (ADR-002), and the models it runs on are small: 8 GB of VRAM holds a 9B model with 8K to 16K tokens of context. Until now the chat ignored that limit. It sent the last 24 messages whatever their size, kept one conversation, and had none of what people expect from a chat with a model: several conversations, going back to a message, attaching a file.

The author asked for a chat that knows its context, shows it, compacts itself with the loaded model, and adapts when a conversation made with a large context is opened with a smaller one.

## Decision

### 1. The context is a budget the person can see

Every request carries a fixed part (the agent's prompt, its tools and the day's snapshot, about 3.4K tokens) and the conversation. The chat header shows both together against the model's context ("3,2K / 16K") with a small bar; its menu explains what the number is and holds "Compact now".

Tokens are estimated at 3.2 characters per token, because the app has no tokenizer for every model. Each reply from the runtime carries the real count of the request, and the ratio between the two corrects the estimate from then on (kept between 0.6 and 1.8).

The 24-message cut is gone: the whole conversation is sent, and it is kept within the budget by compaction.

### 2. Compaction uses the loaded model, one part at a time

When the conversation passes 85% of the context it is compacted before the next call to the model; the person can also ask for it at any time.

- The last turns are kept word for word: as many as fit in a quarter of the room, and always at least the last one. A compaction asked for by hand keeps only the last turn. The kept part always starts on a message the person wrote, because a tool result without its call is an API error.
- Everything older is turned into plain lines and split into parts of at most 45% of the context, and never more than 4,000 tokens, because small models summarize a small part better than a large one. The number of parts is whatever the conversation needs: a 100K conversation on a 16K model becomes about 25 parts.
- Each part is summarized in its own call, with a compaction skill (`COMPACT_GUIDE`) that says what to keep: what the person wants and why, decisions, changes made to the day with exact names, times and numbers, and open questions.
- The notes are joined. When together they are still longer than 12% of the context, the notes themselves are split and summarized again, up to three more times.
- The notes replace the old messages for the model: they go in the system message under "Earlier in this conversation". In the chat they show as one line ("Conversation compacted · 12,3K → 1,8K") that opens to read them.
- An empty summary is an error and the conversation is left as it was.

A later compaction folds the earlier notes into the first part, so nothing is summarized from memory.

### 3. A conversation larger than the loaded model has to be compacted

A conversation written with a 32K model can be opened with an 8K one. When what would be sent is larger than the context, the composer is blocked and a notice says so, with the button to compact. Short of that the person does nothing: the next message compacts first.

### 4. Several conversations, branches and edits

- Conversations are kept (`lifeui.chats`) and listed in the chat column, the latest first. The earlier single conversation (`lifeui.chat`) is moved over once.
- **Branch** from an answer: a new conversation with everything up to that answer; the original stays as it is.
- **Edit** a message: a new conversation that stops right before it, with the message's text back in the composer. It is a branch, not a rewrite, so nothing is lost.
- Neither undoes what the agent already changed in the day: the day is real, the conversation is only how it was talked about. A message can be branched from or edited while its part of the history has not been compacted away.
- **Copy** on every message.

### 5. Attachments follow what the model can read

Text files (`.txt`, `.md`, `.csv`, `.json`, `.log`, `.yaml`) are put inside the message and work with any model; one file may take a quarter of the context at most. Images are offered only when the runtime says the model reads them (`vision`), are scaled to 1,280 px, and travel as image parts of the message. When storage is full the conversations are saved without the images.

### 6. Requests are shaped for strict chat templates

Two messages in a row from the person (a message after an undo note, for example) are merged before sending, because templates such as Gemma's reject them.

## Consequences

- A long conversation costs a few model calls now and then; the person sees "Compacting, part 2 of 5…" and can stop it.
- A summary loses detail. The person can read it, and a branch made before the compaction keeps the full text.
- The token count is an estimate until the first reply; it can be off by a fifth in either direction on a first message.
- Images in `localStorage` are heavy. A few dozen are fine; a real file store is future work if attachments become common.
