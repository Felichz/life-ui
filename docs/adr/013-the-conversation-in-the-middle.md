# ADR-013: The conversation in the middle, the day beside it

- Status: accepted
- Date: 2026-11-15
- Builds on: ADR-002 (the agent-mediated app), ADR-009 (the coach), ADR-011 (a roadmap owns its sessions), ADR-012 (the coach's notes)

## Context

Since ADR-002 every change to the day is said in a chat, and since ADR-009 to ADR-012 the agent is a coach that plans goals, looks things up and keeps notes. The screens were still the ones from before: a sidebar with a day card, a Today page made of a focus panel and the plan in one column and the tempos and the log in a second one, and the chat squeezed into a 400px column on the right. On a 1920px screen that was four columns of interface, and the same facts appeared three times: "nothing running" in the focus panel and in the sidebar card, the tempos in the right rail and in the sidebar card, the next item in the focus panel and again in the plan. The page also looked operable (a list/board switch, rows that looked clickable) though nothing on it could be done there. The author called it what it was: two interfaces competing for the same narrow space, and the coach, which is now the product, in a corner.

## Decision

1. **The conversation is in the middle of every screen.** From 1024px it is the middle column of the shell, at a reading width (640px of text, 15px/24px for the coach), and the composer is the largest control on the screen. On a phone it is a screen of its own (`/`), the first tab.
2. **A HUD above it answers "what now?" everywhere.** A thin bar (`NowBar`) shows what is running (title, elapsed clock, the kind status sentence, its progress as the bar's bottom edge) or what comes next ("Siguiente · 15:00"), and the day's tempos. It is the only place running state is shown outside the day itself, so the sidebar's day card and the phone's running pill are gone. Its buttons do not act: they write in the chat for the person (ADR-002). "Empezar" and "Empezar el día" send the sentence; "Terminar" puts "Terminé X. " in the composer, because the close is the person saying how it went.
3. **One context panel beside it, and the rail beside the panel.** The right column shows one place at a time: the day by default (`/`, also `/today` for a phone), Metas, Biblioteca, Resumen or Ajustes. A narrow rail of places (icons with their names) at the right edge switches it: the rail sits next to what it changes. The person sets the panel's width by dragging the edge between it and the conversation, and folds it away (the rail's toggle, Ctrl/Cmd B, or the place already shown) to give the conversation the whole window. The places respond to the panel's width with container queries, not to the window's. Light or dark is one click away on the rail (on the HUD on a phone).
4. **The plan and the log are one line of time.** They were two columns about one day. The day is now what was done (with its tempos) and logged, a mark for now, what is running with its notes open, and what is still planned, block by block. No board view, no boxes around blocks, nothing that looks like a control: a lock says a block is not open yet.
5. **The visual system stays.** Inter, the neutral surfaces, indigo for what can be done or is selected, green for what is running, amber for tempos (DESIGN.md). The problem was structure. A tint of the screen by time of day was considered and dropped: amber and indigo already mean tempos and action, and a third meaning for the same hues would blur both.

## Consequences

- The goals strip on Today, the day strip in Today's log, the list/board switch, the sidebar day card, the running pill and the floating chat button are gone. The day strip stays in Resumen and in the blocks editor.
- On a phone, Resumen is reached from the day's last line and from the tempos; the tab bar holds Coach, Hoy, Metas, Biblioteca and Ajustes.
- The product film in `video/` shows the earlier shell. It stays true to what the app did, not to how it looks now; a new film is a separate decision.
- DESIGN.md's Layout, HUD, Chat and Do's sections describe the new shell.
