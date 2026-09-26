import * as Tabs from "@radix-ui/react-tabs";
import { useSearchParams } from "react-router-dom";
import { Page, PageHeader } from "../../components/PageHeader";
import { useSystem } from "../../state/system";
import { ActivityTemplates } from "./ActivityTemplates";
import { BlocksEditor } from "./BlocksEditor";
import { EventTemplates } from "./EventTemplates";

const TABS = [
  { value: "actividades", label: "Actividades" },
  { value: "eventos", label: "Eventos" },
  { value: "bloques", label: "Bloques horarios" },
] as const;

export function LibraryPage() {
  const { state } = useSystem();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some((item) => item.value === requested) ? (requested as string) : "actividades";

  const counts: Record<string, number> = {
    actividades: state.global.activityTemplates.length,
    eventos: state.global.eventTemplates.length,
    bloques: state.global.timeBlocks.filter((block) => !block.isDefault).length,
  };

  return (
    <Page width="narrow">
      <PageHeader
        title="Biblioteca"
        subtitle="Lo que reutilizas cada día: actividades, eventos y la forma de tu jornada."
      />
      <Tabs.Root
        value={tab}
        onValueChange={(value) =>
          setParams(value === "actividades" ? {} : { tab: value }, { replace: true })
        }
        className="mt-6"
      >
        <Tabs.List
          aria-label="Secciones de la biblioteca"
          className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
        >
          {TABS.map((item) => (
            <Tabs.Trigger
              key={item.value}
              value={item.value}
              className="relative -mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-2.5 text-base font-medium text-ink-2 transition-colors hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink"
            >
              {item.label}
              <span className="tabular rounded bg-hover px-1.5 text-xs text-ink-2">
                {counts[item.value]}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="actividades" className="pt-5 outline-none">
          <ActivityTemplates />
        </Tabs.Content>
        <Tabs.Content value="eventos" className="pt-5 outline-none">
          <EventTemplates />
        </Tabs.Content>
        <Tabs.Content value="bloques" className="pt-5 outline-none">
          <BlocksEditor />
        </Tabs.Content>
      </Tabs.Root>
    </Page>
  );
}
