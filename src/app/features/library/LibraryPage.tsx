import * as Tabs from "@radix-ui/react-tabs";
import { useSearchParams } from "react-router-dom";
import { Page, PageHeader } from "../../components/PageHeader";
import { useSystem } from "../../state/system";
import { ActivityTemplates } from "./ActivityTemplates";
import { BlocksEditor } from "./BlocksEditor";
import { EventTemplates } from "./EventTemplates";
import { t } from "../../i18n";

const TABS = [
  { value: "activities", label: "library.tab.activities" },
  { value: "events", label: "library.tab.events" },
  { value: "blocks", label: "library.tab.blocks" },
] as const;

export function LibraryPage() {
  const { state } = useSystem();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  // Acepta también los valores antiguos en español (?tab=bloques)
  const legacy: Record<string, string> = {
    actividades: "activities",
    eventos: "events",
    bloques: "blocks",
  };
  const normalized = requested ? (legacy[requested] ?? requested) : null;
  const tab = TABS.some((item) => item.value === normalized)
    ? (normalized as string)
    : "activities";

  const counts: Record<string, number> = {
    activities: state.global.activityTemplates.length,
    events: state.global.eventTemplates.length,
    blocks: state.global.timeBlocks.filter((block) => !block.isDefault).length,
  };

  return (
    <Page width="narrow">
      <PageHeader title={t("nav.library")} subtitle={t("library.subtitle")} />
      <Tabs.Root
        value={tab}
        onValueChange={(value) =>
          setParams(value === "activities" ? {} : { tab: value }, { replace: true })
        }
        className="mt-6"
      >
        <Tabs.List
          aria-label={t("library.sections")}
          className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
        >
          {TABS.map((item) => (
            <Tabs.Trigger
              key={item.value}
              value={item.value}
              className="relative -mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-2.5 text-base font-medium text-ink-2 transition-colors hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink"
            >
              {t(item.label)}
              <span className="tabular rounded bg-hover px-1.5 text-xs text-ink-2">
                {counts[item.value]}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="activities" className="pt-5 outline-none">
          <ActivityTemplates />
        </Tabs.Content>
        <Tabs.Content value="events" className="pt-5 outline-none">
          <EventTemplates />
        </Tabs.Content>
        <Tabs.Content value="blocks" className="pt-5 outline-none">
          <BlocksEditor />
        </Tabs.Content>
      </Tabs.Root>
    </Page>
  );
}
