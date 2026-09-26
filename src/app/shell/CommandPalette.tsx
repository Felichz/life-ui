import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck2,
  CircleStop,
  CornerDownLeft,
  Flag,
  Languages,
  Library,
  Monitor,
  Moon,
  Play,
  Plus,
  Search,
  Settings,
  Sun,
  Sunrise,
} from "lucide-react";
import { LOCALES, LOCALE_NAMES, t, useLocale } from "../i18n";
import { TypeIcon } from "../components/TypeIcon";
import { Kbd } from "../components/ui/Kbd";
import { cn } from "../lib/cn";
import { blockStatus, contractOf, planItem, sortBlocks, templateMap } from "../lib/domain";
import { minutesOfDay } from "../lib/format";
import { useDayActions } from "../state/actions";
import { useClosingFlow } from "../state/closing";
import { useSystem } from "../state/system";
import { useTheme } from "../state/theme";
import { useShell } from "./ShellContext";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  keywords?: string;
  shortcut?: string[];
  run: () => void;
}

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const commands = useCommands();

  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return commands;
    return commands.filter((command) => {
      const haystack = normalize(`${command.label} ${command.group} ${command.keywords ?? ""}`);
      return words.every((word) => haystack.includes(word));
    });
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    onOpenChange(false);
    // Deja que el diálogo se cierre antes de abrir otro
    requestAnimationFrame(() => command.run());
  };

  let lastGroup = "";

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[rgb(var(--shadow)/0.28)] data-[state=open]:animate-fade-in dark:bg-black/55" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12dvh] z-50 flex max-h-[min(560px,76dvh)] w-[calc(100vw-24px)] max-w-[600px] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-dialog data-[state=open]:animate-pop-in"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((value) => Math.min(filtered.length - 1, value + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((value) => Math.max(0, value - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(filtered[cursor]);
            }
          }}
        >
          <RadixDialog.Title className="sr-only">{t("palette.title")}</RadixDialog.Title>
          <div className="flex items-center gap-2.5 border-b border-line px-4">
            <Search className="size-[18px] shrink-0 text-ink-3" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("palette.placeholder")}
              aria-label={t("palette.searchLabel")}
              aria-controls="command-list"
              aria-activedescendant={
                filtered[cursor] ? `command-${filtered[cursor].id}` : undefined
              }
              className="h-12 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3"
            />
            <Kbd className="hidden sm:inline-flex">Esc</Kbd>
          </div>
          <div
            ref={listRef}
            id="command-list"
            role="listbox"
            className="min-h-0 flex-1 overflow-y-auto p-1.5"
          >
            {filtered.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-ink-2">
                {t("palette.noResults", { query })}
              </p>
            )}
            {filtered.map((command, index) => {
              const header = command.group !== lastGroup ? command.group : null;
              lastGroup = command.group;
              const active = index === cursor;
              return (
                <div key={command.id}>
                  {header && (
                    <p className="px-2.5 pb-1 pt-2.5 text-xs font-medium text-ink-3">{header}</p>
                  )}
                  <div
                    id={`command-${command.id}`}
                    data-index={index}
                    role="option"
                    aria-selected={active}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => run(command)}
                    className={cn(
                      "flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-base coarse:h-11",
                      active ? "bg-hover text-ink" : "text-ink-2"
                    )}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-ink-2 [&_svg]:size-4">
                      {command.icon}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", active && "text-ink")}>
                      {command.label}
                    </span>
                    {command.hint && (
                      <span className="shrink-0 text-sm text-ink-3">{command.hint}</span>
                    )}
                    {command.shortcut && (
                      <span className="hidden gap-0.5 sm:flex">
                        {command.shortcut.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </span>
                    )}
                    {active && !command.shortcut && (
                      <CornerDownLeft className="hidden size-3.5 text-ink-3 sm:block" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function useCommands(): Command[] {
  const { state, core } = useSystem();
  const { startInstance, startTemplate, logEvent } = useDayActions();
  const { requestClose } = useClosingFlow();
  const { openAddActivity, openTemplateEditor } = useShell();
  const { setPreference } = useTheme();
  const navigate = useNavigate();
  const { locale, setLocale } = useLocale();

  return useMemo(() => {
    const list: Command[] = [];
    const day = state.currentDay;
    const templates = templateMap(state);
    const nowMinutes = minutesOfDay(new Date());

    if (day) {
      const activeId = day.activeActivityInstanceId;
      if (activeId) {
        const active = day.activityInstances.find((item) => item.id === activeId);
        const title = active ? templates.get(active.templateId)?.title : undefined;
        list.push({
          id: "close-active",
          group: t("palette.group.running"),
          label: t("palette.finish", { title: title ?? t("activity.fallbackName") }),
          icon: <CircleStop />,
          keywords: t("palette.kw.finish"),
          run: () => requestClose(),
        });
      }

      list.push({
        id: "add",
        group: t("palette.group.plan"),
        label: t("palette.addActivity"),
        icon: <Plus />,
        shortcut: ["N"],
        keywords: t("palette.kw.add"),
        run: () => openAddActivity(),
      });

      for (const block of sortBlocks(core.getTimeBlocks())) {
        const status = blockStatus(block, nowMinutes);
        if (status !== "always" && status !== "now") continue;
        for (const instance of day.activityInstances.filter((item) => item.blockId === block.id)) {
          if (instance.id === activeId) continue;
          const item = planItem(instance, templates);
          list.push({
            id: `start-${instance.id}`,
            group: t("palette.group.startPlan"),
            label: item.title,
            hint: item.contract?.label,
            icon: <Play />,
            keywords: t("palette.kw.start"),
            run: () => startInstance(instance.id),
          });
        }
      }

      for (const template of state.global.activityTemplates) {
        list.push({
          id: `start-template-${template.id}`,
          group: t("palette.group.startNow"),
          label: template.title,
          hint: contractOf(template.type, template)?.label,
          icon: <TypeIcon type={template.type} />,
          keywords: t("palette.kw.startLibrary"),
          run: () => startTemplate(template.id),
        });
      }

      for (const event of state.global.eventTemplates) {
        list.push({
          id: `event-${event.id}`,
          group: t("palette.group.logEvent"),
          label: event.name,
          icon: <Flag />,
          keywords: t("palette.kw.event"),
          run: () => logEvent(event.id),
        });
      }
    } else {
      list.push({
        id: "start-day",
        group: t("palette.group.day"),
        label: t("start.cta"),
        icon: <Sunrise />,
        keywords: t("palette.kw.startDay"),
        run: () => {
          core.startDay();
          navigate("/");
        },
      });
    }

    list.push(
      {
        id: "go-today",
        group: t("palette.group.goTo"),
        label: t("nav.today"),
        icon: <CalendarCheck2 />,
        shortcut: ["G", "H"],
        run: () => navigate("/"),
      },
      {
        id: "go-library",
        group: t("palette.group.goTo"),
        label: t("nav.library"),
        icon: <Library />,
        shortcut: ["G", "B"],
        run: () => navigate("/library"),
      },
      {
        id: "go-blocks",
        group: t("palette.group.goTo"),
        label: t("library.tab.blocks"),
        icon: <Library />,
        keywords: t("palette.kw.blocks"),
        run: () => navigate("/library?tab=blocks"),
      },
      {
        id: "go-review",
        group: t("palette.group.goTo"),
        label: t("nav.review"),
        icon: <BarChart3 />,
        shortcut: ["G", "R"],
        run: () => navigate("/review"),
      },
      {
        id: "go-settings",
        group: t("palette.group.goTo"),
        label: t("nav.settings"),
        icon: <Settings />,
        shortcut: ["G", "A"],
        run: () => navigate("/settings"),
      },
      {
        id: "new-template",
        group: t("palette.group.library"),
        label: t("palette.newTemplate"),
        icon: <Plus />,
        keywords: t("palette.kw.template"),
        run: () => openTemplateEditor(),
      },
      {
        id: "theme-system",
        group: t("palette.group.appearance"),
        label: t("palette.themeSystem"),
        icon: <Monitor />,
        keywords: t("palette.kw.theme"),
        run: () => setPreference("system"),
      },
      {
        id: "theme-light",
        group: t("palette.group.appearance"),
        label: t("palette.themeLight"),
        icon: <Sun />,
        keywords: t("palette.kw.theme"),
        run: () => setPreference("light"),
      },
      {
        id: "theme-dark",
        group: t("palette.group.appearance"),
        label: t("palette.themeDark"),
        icon: <Moon />,
        keywords: t("palette.kw.theme"),
        run: () => setPreference("dark"),
      },
      ...LOCALES.filter((option) => option !== locale).map((option) => ({
        id: `locale-${option}`,
        group: t("palette.group.language"),
        label: LOCALE_NAMES[option],
        icon: <Languages />,
        keywords: t("palette.kw.language"),
        run: () => setLocale(option),
      }))
    );

    return list;
  }, [
    core,
    logEvent,
    navigate,
    openAddActivity,
    openTemplateEditor,
    requestClose,
    setPreference,
    locale,
    setLocale,
    startInstance,
    startTemplate,
    state,
  ]);
}
