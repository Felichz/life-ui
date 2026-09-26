---
name: Qualia Control
description: Una interfaz para tu día real. A calm, Linear-grade HUD for one running activity, one honest close, and tempos that only go up.
colors:
  canvas: "#fcfcfd"
  sidebar: "#f4f4f7"
  panel: "#ffffff"
  subtle: "#f7f7f9"
  hover: "#efeff3"
  line: "#e6e6ec"
  line-strong: "#d4d4dc"
  ink: "#16161a"
  ink-2: "#5a5c68"
  ink-3: "#747682"
  on-accent: "#ffffff"
  accent: "#5854d6"
  accent-hover: "#4c48c7"
  accent-ink: "#4844be"
  accent-fill: "#5854d6"
  accent-fill-hover: "#4c48c7"
  tempo: "#f59e0b"
  tempo-ink: "#a85e00"
  live: "#148054"
  success: "#188050"
  danger: "#d63a3a"
  danger-fill: "#c83232"
  objective: "#4078f0"
  flexible: "#129e8e"
  timebox: "#9254d6"
  event: "#d66e30"
  shadow: "#10101c"
  canvas-dark: "#0e0f12"
  sidebar-dark: "#0a0b0d"
  panel-dark: "#15161a"
  subtle-dark: "#1a1b20"
  hover-dark: "#212228"
  line-dark: "#26272e"
  line-strong-dark: "#34353e"
  ink-dark: "#ededf0"
  ink-2-dark: "#a5a7b2"
  ink-3-dark: "#848692"
  accent-dark: "#7c78f2"
  accent-hover-dark: "#8c89f7"
  accent-ink-dark: "#a4a1ff"
  accent-fill-dark: "#605bde"
  accent-fill-hover-dark: "#6863e4"
  tempo-dark: "#f5b544"
  tempo-ink-dark: "#f5bc58"
  live-dark: "#3cc88a"
  success-dark: "#48c88c"
  danger-dark: "#f06262"
  danger-fill-dark: "#c83232"
  objective-dark: "#5a86ee"
  flexible-dark: "#1fa898"
  timebox-dark: "#9e6be4"
  event-dark: "#f08c50"
  shadow-dark: "#000000"
typography:
  clock:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: "56px"
    letterSpacing: "-0.035em"
    fontFeature: "'tnum', 'cv11'"
  display:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.025em"
    fontFeature: "'cv11', 'ss01', 'ss03'"
  headline:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "30px"
    letterSpacing: "-0.02em"
    fontFeature: "'cv11', 'ss01', 'ss03'"
  title:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.01em"
    fontFeature: "'cv11', 'ss01', 'ss03'"
  section:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "22px"
    fontFeature: "'cv11', 'ss01', 'ss03'"
  body:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    fontFeature: "'cv11', 'ss01', 'ss03'"
  input-touch:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    fontFeature: "'cv11', 'ss01', 'ss03'"
  caption:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    fontFeature: "'cv11', 'ss01', 'ss03'"
  micro:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "14px"
    letterSpacing: "0.01em"
    fontFeature: "'cv11', 'ss01', 'ss03'"
rounded:
  focus: "4px"
  default: "7px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  hairline: "1px"
  control-gap: "8px"
  stack: "12px"
  panel-padding: "20px"
  panel-padding-wide: "24px"
  section-gap: "32px"
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "40px"
  sidebar-width: "232px"
  rail-width: "320px"
  mobile-nav-height: "64px"
  page-max-wide: "1240px"
  page-max-narrow: "880px"
components:
  button-primary:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.accent-fill-hover}"
  button-primary-lg:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.subtle}"
  button-ghost:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.danger-fill}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.default}"
    padding: "0 12px"
    height: "32px"
  icon-button:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.default}"
    size: "32px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.default}"
    padding: "0 10px"
    height: "36px"
  segmented:
    backgroundColor: "{colors.hover}"
    rounded: "{rounded.md}"
    padding: "2px"
  segmented-option:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    padding: "0 12px"
    height: "28px"
  segmented-option-selected:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "6px"
  switch-on:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.full}"
    width: "36px"
    height: "20px"
  switch-off:
    backgroundColor: "{colors.line-strong}"
    rounded: "{rounded.full}"
    width: "36px"
    height: "20px"
  nav-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "32px"
  nav-item-active:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink}"
  mobile-nav-item-active:
    textColor: "{colors.accent-ink}"
    typography: "{typography.micro}"
  tab-active:
    textColor: "{colors.ink}"
    height: "40px"
  focus-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.xl}"
    padding: "16px 20px 20px"
  focus-panel-footer:
    backgroundColor: "{colors.subtle}"
    padding: "10px 12px"
  quick-start-chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 12px 0 10px"
    height: "40px"
  plan-row:
    textColor: "{colors.ink}"
    padding: "0 8px"
    height: "44px"
  tempo-badge:
    textColor: "{colors.tempo-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.default}"
    padding: "2px 6px"
  score-option:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    height: "40px"
  score-option-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  kbd:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink-2}"
    typography: "{typography.micro}"
    rounded: "4px"
    height: "18px"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  menu:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.lg}"
    padding: "4px"
  menu-item-highlighted:
    backgroundColor: "{colors.hover}"
    rounded: "{rounded.default}"
    height: "32px"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
  toast:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.lg}"
    padding: "12px 8px 12px 12px"
---

# Design System: Qualia Control

## Overview

**Creative North Star: "The Quiet HUD"**

Qualia Control is a heads-up display for a real day, built to the standard of a modern tool like Linear. It shows only what matters right now (what is running, for how long, and how many tempos the day has earned) and stays out of the way of everything else. The screen is mostly cool, near-white or near-black neutral surfaces separated by 1px lines. Color is scarce and every hue has one job, so a glance tells the user what kind of thing they are looking at: indigo is something you can do, green is something happening, amber is something earned.

Density is moderate and deliberately calm. The user has ADHD, so each surface leads with one obvious next action, keeps running state always visible, and avoids piles of cards and metrics. The Today screen is a focus panel, not a dashboard: a large title and a tabular clock, one filled "Terminar" button, and supporting lists below. Numbers are set in Inter with tabular figures so running values never jitter.

The system follows the operating system's light or dark preference (overridable in Ajustes) and both themes are first-class: the same token names resolve to different RGB channel values under `[data-theme="dark"]`. Nothing in the system reads as a report card; progress is shown as what was reached, never as what is missing.

**Key Characteristics:**

- Cool neutrals with a very slight blue-violet tint; one indigo accent for action and selection.
- Reserved semantic hues: amber for tempos, green for "en marcha", three type colors, orange for events.
- Inter Variable with tabular numerals for every changing number; weights 400/500/600 only.
- 1px borders first, soft small shadows second; radii from 7px (controls) to 14px (panels, dialogs).
- Sidebar at 1024px and up, bottom tab bar below; right rail for tempos and log at 1280px and up.
- Keyboard-first on desktop (Ctrl/Cmd K, N, T, G then H/B/R/A); 36-44px touch targets on coarse pointers.

## Colors

A cool, almost colorless neutral field with one indigo voice and a handful of hues that each mean exactly one thing. All tokens are stored as RGB channel triples on `:root` / `[data-theme="dark"]` in `src/app/styles.css` (for example `--accent: 88 84 214`) and consumed through Tailwind as `rgb(var(--token) / <alpha-value>)`, so any token can be tinted with opacity (`accent/10`, `tempo/15`). The frontmatter lists light values under the plain name and dark values with a `-dark` suffix.

### Primary

- **Focus Indigo** (`accent`): the only action and selection color. Filled primary buttons, the selected score in the closing ritual, the selected switch, active tab underline, the "now" line in the day strip, the elapsed bar in the focus panel's progress track, focus rings, text selection (22% alpha), and the pinned-state icon in the library.
- **Indigo Hover** (`accent-hover`): hover and pressed state of filled indigo surfaces. Darker in light mode, lighter in dark mode.
- **Indigo Ink** (`accent-ink`): indigo used as text or icon on neutral or tinted ground: the active item in the mobile tab bar, the "Ahora" chip, filled-but-unselected score steps, play icons on hover.

### Secondary

- **Tempo Amber** (`tempo`): fills that represent earned tempos: the tempo meter bar, the emphasized bar in the trend chart, and tinted backgrounds for reward badges (`tempo/15`) and the reward callout (`tempo/10` with a `tempo/25` inset ring).
- **Tempo Ink** (`tempo-ink`): tempo numbers as text: "79 tempos hoy", "+60", the Tempos stat, the average in the trend chart.

### Tertiary

- **Live Green** (`live`): "en marcha" only. The pulsing live dot, the "En marcha" label, the running row tint (`live/5`) and the running quick-start chip border (`live/40`).
- **Objective Blue** (`objective`), **Flexible Teal** (`flexible`), **Timebox Violet** (`timebox`): the three activity duration contracts. Used for the type icon (Target, Waves, Timer), the boxed type icon background (13% mix), day-strip segments and the time-by-type bar. Always paired with an icon or label, never color alone.
- **Event Orange** (`event`): point-in-time events only, drawn as a small rotated square (diamond) with a half-opacity stem in the day strip and as the diamond bullet in event lists.

### Neutral

- **Canvas** (`canvas`): page background.
- **Sidebar** (`sidebar`): the desktop sidebar, one step darker than the canvas in both themes.
- **Panel** (`panel`): cards, lists, dialogs, menus, toasts, inputs, secondary buttons.
- **Subtle** (`subtle`): recessed areas inside panels (focus panel footer at 60%, day-strip track, disabled inputs, board columns at 70%, secondary-button hover).
- **Hover** (`hover`): hover fill for rows and ghost controls, active sidebar item, segmented-control track, empty progress tracks, neutral count pills.
- **Line** (`line`) and **Line Strong** (`line-strong`): 1px dividers and borders at rest; `line-strong` on hover and for the off switch.
- **Ink** (`ink`), **Ink 2** (`ink-2`), **Ink 3** (`ink-3`): primary text; secondary text and descriptions; metadata, placeholders, units and axis ticks.
- **Shadow** (`shadow`): the tint used inside every shadow and the modal scrim (`shadow/0.36` in light; `black/60` in dark).
- **Success** (`success`) and **Danger** (`danger`): confirmation (the "Antes de tiempo" chip, success toasts, "dentro" in the review table) and errors or destructive actions (delete buttons, invalid fields, destructive menu items, error toasts).

### Named Rules

**The Reserved Hues Rule.** Indigo means "you can act or this is selected". Amber means tempos and nothing else. Green means "running right now" and nothing else. Blue, teal and violet mean activity type. Orange means event. If a new element does not belong to one of those meanings, it is neutral.

**The Anchor-Not-Debt Rule.** Progress toward the daily reference fills in amber and is labeled as a reached percentage ("79% de tu referencia diaria"). Going past 100% just shows a full amber bar. Nothing renders the missing part as a colored or labeled deficit.

**The No-Red-For-Time Rule.** `danger` is for errors and destructive actions only. Overtime renders as a lighter indigo extension (`accent/35`) of the progress bar. Interrupted activities render as hatched type color or a neutral "Sin terminar" pill. Low scores stay neutral.

**The Fill Contrast Rule.** White labels never sit on `accent` or `danger` directly: solid primary and destructive buttons (and the selected score step) use `accent-fill` / `accent-fill-hover` and `danger-fill`, tuned for at least 4.5:1 in both themes. `accent` and `danger` stay for text, rings, tints and dots. Light `live` and `success` are darkened enough to work as small text on `panel`.

## Typography

**Display Font:** Inter Variable (with Inter, system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Inter Variable (same stack)
**Label/Mono Font:** none distinct; keyboard hints use the sans at 11px.

**Character:** A single neutral grotesk tuned toward legibility: `cv11` (single-story a), `ss01` and `ss03` are on globally, and `.tabular` switches to `tnum` for numbers. Hierarchy comes from size and weight, with tighter negative tracking as size grows.

### Hierarchy

- **Clock** (600, 56px/56px, -0.035em, tabular): the elapsed time in the running focus panel from 640px up. On phones it drops to 40px/44px (-0.03em).
- **Display** (600, 30px/36px, -0.025em): the running activity's title from 640px up, the tempo total in the tempo meter, and the "+N tempos" figure in the reward callout.
- **Headline** (600, 24px/30px, -0.02em): page titles (Hoy, Biblioteca, Resumen, Ajustes), the running title on phones, and review stat values.
- **Title** (600, 17px/24px, -0.01em): dialog and sheet titles, real/estimated values in the closing ritual. The idle focus panel heading uses 20px/28px (-0.015em).
- **Section** (600, 15px/22px): section titles such as "Accesos rápidos", "Plan del día" and "Registro", with an optional 13px `ink-3` tabular count beside them.
- **Body** (400 or 500, 14px/20px): the base size for rows, list titles (500), nav items (500) and inputs. On coarse pointers, form fields render at 16px to prevent iOS zoom.
- **Label** (500, 13px/18px): buttons, field labels, meta lines and descriptions (400 in `ink-2`).
- **Caption** (400 or 500, 12px/16px): metadata, badges, tooltip text and menu group labels.
- **Micro** (500, 11px/14px, +0.01em): keyboard hints, day-strip hour ticks and block names, mobile tab-bar labels.

### Named Rules

**The Tabular Numbers Rule.** Every number that changes or is compared (clocks, minutes, tempos, percentages, counts, times of day, scores) uses tabular figures. A number that shifts width while ticking is a bug.

**The Three Weights Rule.** Only 400, 500 and 600 are used. Emphasis comes from 600 plus a step in size, never from bold 700 or from uppercase.

## Layout

**Shell.** At 1024px and up (`lg`), a sticky full-height sidebar (232px, `sidebar` background, 1px right border) holds the logo and wordmark, a search button that opens the command palette (with Ctrl/Cmd K hints), four nav items (Hoy, Biblioteca, Resumen, Ajustes) and, pinned to the bottom, a day card with the compact tempo meter and the running activity with its clock. Below 1024px the sidebar disappears and a fixed bottom tab bar takes over: 64px tall plus the safe-area inset, `panel` at 95% with a medium backdrop blur, four equal columns capped at 448px, 22px icons over 11px labels. `main` reserves that height at the bottom.

**Page.** Content is centered at 1240px max (880px for narrow pages) with side gutters of 16px, then 24px from 640px, then 40px from 1024px. Top padding is 20px (32px from 1024px) and bottom padding is 40px. Page headers put the title and subtitle on the left and actions on the right, bottom-aligned from 640px.

**Today grid.** A single column below 1280px. At 1280px and up (`xl`) it becomes `minmax(0, 1fr) 320px` with a 40px gap: the main column holds the focus panel, quick-start chips and the plan; the right rail holds the tempo meter and the day log. Below 1280px the tempo meter moves above the focus panel and the log moves below the plan.

**Rhythm.** Built on Tailwind's 4px grid. Sections in a column are 32px apart. A section title sits 12px above its content. Panels pad 20px (24px from 640px), dialogs pad 20px, and control clusters use 8px gaps. Lists are hairline-divided rows inside one bordered panel, not stacks of separate cards.

**Responsive devices.** The `coarse:` variant (pointer: coarse) raises control heights: 28 to 36px, 32 to 40px, 36 to 44px, 40 to 44px; plan rows go to 52px. Horizontal lists (quick-start chips, library tabs) scroll edge to edge on phones with hidden scrollbars and wrap from 640px. Board columns are fixed at 288px and scroll horizontally. Dialogs become bottom sheets on small screens (see Components).

### Named Rules

**The Always-Visible-Now Rule.** Whatever is running stays visible on every screen: the focus panel on Hoy; the sidebar's running link at 1024px and up; on phones outside Hoy, a floating running pill above the tab bar; a live dot on the Hoy nav item; and the clock in the browser tab title.

**The One Next Action Rule.** Each panel or dialog has at most one filled indigo button, and it is the obvious next step (Terminar, Guardar, Empezar on the first suggestion, Añadir). Everything else is secondary or ghost.

## Elevation & Depth

The system is a hybrid. Structure comes from 1px `line` borders and tonal steps (canvas → subtle → panel, with the sidebar one step darker), while shadows are small and mostly ambient. Resting surfaces carry at most `xs` or `sm`. Only floating layers (menus, popovers, tooltips, toasts, the running pill, a dragged row) get `pop`, and only dialogs and sheets get `dialog`. Every shadow is tinted by the `--shadow` token (cool near-black in light mode, pure black in dark mode), so shadows almost vanish in dark mode and the borders carry the structure.

### Shadow Vocabulary

- **Hairline lift** (`box-shadow: 0 1px 1px rgb(var(--shadow) / 0.04)`): secondary buttons, inputs, list panels, quick-start chips, idle focus panel.
- **Resting card** (`box-shadow: 0 1px 2px rgb(var(--shadow) / 0.06), 0 1px 1px rgb(var(--shadow) / 0.04)`): the running focus panel, the selected segment, the selected score, the switch thumb, and quick-start chips on hover.
- **Pop** (`box-shadow: 0 1px 2px rgb(var(--shadow) / 0.08), 0 8px 24px -6px rgb(var(--shadow) / 0.18)`): menus, the event popover, tooltips, toasts, the running pill, and rows while dragging.
- **Dialog** (`box-shadow: 0 2px 6px rgb(var(--shadow) / 0.08), 0 24px 64px -12px rgb(var(--shadow) / 0.32)`): modal dialogs and sheets, over a scrim of `rgb(var(--shadow) / 0.36)` in light mode and `black / 0.6` in dark mode.

### Named Rules

**The Border-First Rule.** Separate things with a 1px `line` border or a tonal step before reaching for a shadow. A shadow bigger than `sm` means the element floats above the page.

## Shapes

Gently rounded and tool-like. Controls use 7px, panels use 10-14px, and pills and dots are fully round. Radii nest: the corner shrinks as you go inward so inner edges stay parallel. The scale: panels and dialogs at 14px (`xl`), list panels, menus, toasts and chips at 10px (`lg`), segmented tracks, sidebar items, boxed type icons and score steps at 8px (`md`), buttons, inputs and menu items at 7px (`default`), the selected segment inside its track at 6px, keyboard hints at 4px, and day-strip segments at 3px. Progress bars, switches and live dots are fully round. Mobile bottom sheets round only their top corners (14px).

Borders are always 1px, except the 2px active-tab underline and the 2px focus outline. Empty drop zones use a dashed 1px `line` border. Interrupted activity segments use a 135° hatch of their type color.

## Components

The primitives in `src/app/components/ui/` are refined and restrained: quiet at rest, and hover changes only a fill or border tone. Every interactive element shares one focus treatment: a 2px `accent` outline with a 2px offset (inputs use the field ring instead). Transitions on color, border and shadow run for 150ms. Custom keyframes use the expressive ease-out `cubic-bezier(0.16, 1, 0.3, 1)`. `prefers-reduced-motion` clamps all animation and transition durations to 1ms.

### Buttons

- **Shape:** gently rounded (7px); 8px for the large size.
- **Sizes:** sm 28px (36 on touch), md 32px (40 on touch), lg 40px (44 on touch). Horizontal padding is 10, 12 or 16px. 16px icons with an 8px gap. Label type is 13px/500 (15px for lg).
- **Primary:** `accent` fill, white label, hairline-lift shadow. Hover and active use `accent-hover`. Disabled uses `accent/45` with 80% white text. An optional inline keyboard hint sits inside on a `white/20` chip (for example "Terminar T", "Añadir N").
- **Secondary (default):** `panel` fill, 1px `line` border, `ink` label, hairline lift. On hover the border becomes `line-strong` and the fill `subtle`.
- **Ghost:** no fill, `ink-2` label; `hover` fill and `ink` label on hover. Used for tertiary actions such as "Ajustar" and "No la terminé".
- **Subtle:** `hover/70` fill with an `ink` label.
- **Danger:** `danger-fill` fill, white label; only for confirmed destructive actions.
- **Loading:** a spinning loader icon leads the label and the button disables.
- **Icon button:** 28 or 32px square (36 or 40 on touch), ghost, secondary or primary, always with an `aria-label`.

### Chips

- **Quick-start chip:** a 40px (44 on touch) `panel` pill with a 10px radius, 1px `line` border and hairline lift. It holds the type icon, a 14px/500 title, the contract label in 13px `ink-3` tabular type, and a small play icon that turns `accent-ink` on hover. The running template's chip shows a live dot with a `live/40` border and `live/5` fill, and is disabled.
- **Status pills:** 12px/500, 7px radius, 1-2px vertical and 6px horizontal padding. "Ahora" is `accent/10` fill with `accent-ink` text. "Sin terminar" is a neutral `hover` fill with `ink-2` text, or plain `ink-3` text in the log. "Antes de tiempo" is `success/10` fill with `success` text and a check icon. Tempo badges ("+14") are `tempo/15` fill with `tempo-ink` 12px/600 tabular text.
- **Count pill:** tabular 12px `ink-2` on `hover`, next to tab labels.

### Cards / Containers

- **Corner Style:** 14px for primary panels (focus panel, trend chart, review stats); 10px for list panels, board columns, the sidebar day card and callouts.
- **Background:** `panel`, with recessed zones in `subtle`.
- **Shadow Strategy:** `xs` at rest, `sm` for the running focus panel (see Elevation & Depth).
- **Border:** 1px `line`, always.
- **Internal Padding:** 20px (24px from 640px) for primary panels, 12px for the sidebar card, 12-16px for callouts.
- **Grouped facts:** stat groups (the closing ritual's real/estimated pair, the review stats) are one bordered container split by 1px `line` gaps, not separate cards.

### Inputs / Fields

- **Style:** 36px tall (44 on touch), `panel` fill, 1px `line` border, 7px radius, 10px horizontal padding, 14px text, `ink-3` placeholder, hairline lift. The border becomes `line-strong` on hover.
- **Focus:** the border becomes `accent` and gains a 3px `accent/20` ring.
- **Error:** `aria-invalid` switches the border to `danger` with a `danger/20` ring. The message below is 13px `danger`, linked through `aria-describedby`.
- **Disabled:** `subtle` fill with `ink-3` text.
- **Field:** a 13px/500 label, the control, and a 13px `ink-2` hint or `danger` error, stacked 6px apart.
- **Minutes input:** a stepper with −/+ zones (32px, 44 on touch) around a tabular value and an "min" suffix; the focus ring wraps the whole group.
- **Segmented control:** a `hover/80` track with 8px radius and 2px padding. The selected option is a `panel` chip with 6px radius and the `sm` shadow; others are `ink-2` and turn `ink` on hover. It is a radiogroup with arrow-key movement.
- **Switch:** 36×20px, `accent` when on and `line-strong` when off, with a 16px white thumb that slides over 200ms.

### Navigation

- **Sidebar items:** 32px tall, 8px radius, 16px icon plus a 14px/500 label. Inactive items are `ink-2` and get a `hover/70` fill on hover; the active item is `hover` with `ink`. Indigo appears in the sidebar only in the logo and in the "Empezar el día" button shown when no day is running; the live dot on Hoy is green.
- **Mobile tab bar:** icon over label, `ink-3` when inactive and `accent-ink` when active. A live dot sits on the Hoy icon while something is running.
- **Tabs (Biblioteca):** 40px tall, 14px/500 labels in `ink-2` with a count pill. The active tab is `ink` with a 2px `accent` underline sitting on the 1px `line` baseline.
- **Command palette:** Ctrl/Cmd K, plus G then H/B/R/A to jump between sections, "N" to add an activity and "T" to finish the running one. Shortcuts show as 18px `Kbd` hints (`subtle` fill, 1px `line`, 4px radius, 11px/500) and are hidden below 640px.

### Menus, Tooltips, Toasts

- **Menu:** `panel` with a 1px `line` border, 10px radius, 4px padding, `pop` shadow, at least 200px wide, 140ms pop-in. Items are 32px tall (40 on touch) with 7px radius and a `hover` highlight. Destructive items use `danger` text over a `danger/10` highlight. Group labels are 12px/500 `ink-3`.
- **Tooltip:** inverted, with `ink` fill, `canvas` text, 12px/500, 8px radius and `pop` shadow, plus optional inverse keyboard hints.
- **Toast:** a `panel` card with 10px radius, `pop` shadow and 220ms rise-in, up to 384px wide. The leading mark is a `tempo/15` "+N" badge for rewards, a `success/10` check for confirmations, or a `danger/10` alert for errors. Toasts pause on hover.

### Dialogs and Sheets

- **Center dialog:** at 640px and up, a centered modal with 14px radius and a width of 420, 520 or 640px, entering over 200ms with a slight scale and rise. Below 640px it is a bottom sheet with top-rounded corners that slides up over 220ms and stops at 92% of the viewport height.
- **Sheet:** at 768px and up, a 460px right-side panel inset 8px from the viewport edges, entering over 220ms. Below 768px it is a bottom sheet.
- **Anatomy:** header with a 17px/600 title and a 13px `ink-2` description, a scrollable body, and a footer with a top border. On mobile the footer stacks in reverse so the primary action sits on top. A 32px close button sits top right.

### Focus Panel (signature)

The heart of Hoy. **Running:** a 14px `panel` card with the `sm` shadow. The meta line reads "● En marcha · type · block · desde HH:MM", with the live dot and label in `live`. Below it, the title (display size) and the elapsed clock (clock size, tabular) share a baseline. An 8px-tall progress track follows: the `accent` fill shows elapsed time against the contract, an `accent/15` band marks a flexible range, `ink/50` ticks mark the estimate, minimum and maximum, and overtime extends in `accent/35`. A single kind status sentence sits under the track. The footer, on `subtle/60` behind a 1px line, holds a ghost "Ajustar" button and a large primary "Terminar" button (at least 132px wide). **Idle:** "Nada en marcha" with up to three suggestions. Only the first suggestion gets indigo treatment (an `accent/40` border, `accent/5` fill and a filled "Empezar" button); the rest are neutral rows.

### Tempo Meter (signature)

The full variant shows the total at display size in `tempo-ink` next to "tempos hoy", then "N% de tu referencia diaria · target" in 13px, over a 6px round amber bar on a `hover` track. The compact variant, used in the sidebar, is 13px over a 4px bar. The number plays a 520ms scale bump (1 to 1.12 to 1) only when the total rises, and the bar width eases over 700ms.

### Closing Ritual (signature)

A center dialog. It shows the real/estimated fact pair, an 11-step 0-10 score scale (40px steps, 44 on touch, 8px radius), a one-line reading of the score ("7/10 — Lo hice. Eso es lo que cuenta."), and the amber reward callout with the formula in small tabular type. Score steps up to the selection fill `accent/10` with `accent-ink` text; the selected step is solid `accent` with the `sm` shadow; steps above it are neutral `hover/70`. Scale anchors read "no cuenta", "100%" (under 7) and "máximo". The footer holds a ghost "No la terminé", a secondary "Seguir con ella" and a primary "Guardar · +N tempos" with an Enter hint. Closing the dialog keeps the activity running.

### Plan Rows and Day Strip

- **Plan row:** 44px tall (52 on touch), hairline-divided inside one bordered 10px list panel. It contains a drag handle that appears on hover, the type icon, a 14px/500 title that underlines on hover and opens the editor, the contract label, and a play icon button (indigo tint on hover). The running row gets a `live/5` tint and a green "En marcha" label. Rows in past or future blocks show a lock icon instead of play, and past block titles are `ink-2`. A dragged row lifts with the `pop` shadow. Board mode uses 288px `subtle/70` columns, with the current block's column bordered in `accent/40`.
- **Day strip:** a 28px track (40px in Resumen) on `subtle` with an inset 1px `line` ring. Alternating block bands sit behind segments colored by activity type (hatched when interrupted, softly pulsing while running). Events are orange diamonds, the current time is a 1px `accent` line with a dot, and 11px tabular hour ticks run below. The strip is decorative (`aria-hidden`); the list beside or below it carries the data.

### Copy in Components

The UI is Spanish and addresses the user as tú. Copy is always kind: the reference is an anchor ("79% de tu referencia diaria"), never a debt ("te faltan…"). Interruptions and overruns carry no judgment ("No la terminé", "Sin problema: ciérrala cuando termines.", "Más larga que de costumbre. Está bien."). Idle time is framed as free ("Tiempo libre es tiempo libre."). Empty states tell the user the next step ("Nada aquí todavía. Arrastra algo o añade con +."). Use the product vocabulary exactly: día, foco / en marcha, biblioteca, plantilla, bloque, "Por hacer", evento, tempos, referencia diaria, cierre, satisfacción. PRODUCT.md is the source for voice; this section records only how it lands in UI strings.

## Do's and Don'ts

### Do:

- **Do** use `accent` for the one next action per panel or dialog, and for selection and focus. Nothing else gets indigo fill.
- **Do** show tempos in `tempo` / `tempo-ink` only, as reached amounts and percentages ("+60", "79%").
- **Do** mark anything running with the live dot and `live`, and keep it visible on every screen (sidebar link, mobile running pill, tab title).
- **Do** pair every activity-type color with its icon (Target, Waves, Timer) or its label.
- **Do** set every changing number with tabular figures (`.tabular`).
- **Do** build surfaces from `panel` plus a 1px `line` border, with `xs`/`sm` shadows at rest and `pop`/`dialog` only for floating layers.
- **Do** keep radii nested: 14px panels, 10px lists and menus, 8px segments and tracks, 7px controls.
- **Do** give every control a `coarse:` height of 36-44px and keep form fields at 16px on touch devices.
- **Do** define new colors as RGB channel triples on both `:root` and `[data-theme="dark"]` and expose them through `tailwind.config.js`; never hard-code hex values in components.

### Don't:

- **Don't** use amber for anything that is not tempos, or green for anything that is not "en marcha" (success confirmations use the separate `success` token).
- **Don't** render the daily reference as a deficit: no "remaining" bars, no red, no "te faltan".
- **Don't** use `danger` for overtime, low satisfaction, or interrupted activities.
- **Don't** put more than one filled indigo button in a single panel or dialog.
- **Don't** turn Hoy into a grid of metric cards; focus panel first, supporting lists after, and three metrics (tempos, % of reference, satisfaction).
- **Don't** use bold 700, uppercase labels, or letter-spaced eyebrow text above headings.
- **Don't** add large or colored shadows to resting cards.
- **Don't** add streaks, attention rewards or other celebratory effects beyond the single tempo bump when the total rises.
