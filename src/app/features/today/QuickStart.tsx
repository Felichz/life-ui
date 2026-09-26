import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import type { ActivityTemplate } from "../../../types";
import { LiveDot, TypeIcon } from "../../components/TypeIcon";
import { SectionTitle } from "../../components/PageHeader";
import { contractOf } from "../../lib/domain";
import { cn } from "../../lib/cn";
import { useDayActions } from "../../state/actions";

/** Actividades ancladas: empezar con un toque, sin configurar nada. */
export function QuickStart({
  templates,
  hasLibrary,
  runningTemplateId,
}: {
  templates: ActivityTemplate[];
  hasLibrary: boolean;
  runningTemplateId?: string;
}) {
  const { startTemplate } = useDayActions();

  if (templates.length === 0) {
    if (!hasLibrary) return null;
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-ink-2">
        Ancla tus actividades frecuentes en la{" "}
        <Link to="/biblioteca" className="font-medium text-accent-ink hover:underline">
          Biblioteca
        </Link>{" "}
        y aparecerán aquí para empezarlas con un toque.
      </p>
    );
  }

  return (
    <section aria-labelledby="quick-title">
      <SectionTitle>
        <span id="quick-title">Accesos rápidos</span>
      </SectionTitle>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {templates.map((template) => {
          const running = template.id === runningTemplateId;
          const contract = contractOf(template.type, template);
          return (
            <button
              key={template.id}
              type="button"
              disabled={running}
              onClick={() => startTemplate(template.id)}
              className={cn(
                "group inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border bg-panel pl-2.5 pr-3 text-base shadow-xs transition-[border-color,background-color,box-shadow] duration-150 coarse:h-11",
                running
                  ? "border-live/40 bg-live/5"
                  : "border-line hover:border-line-strong hover:shadow-sm active:bg-subtle"
              )}
            >
              {running ? <LiveDot className="mx-1" /> : <TypeIcon type={template.type} />}
              <span className="font-medium text-ink">{template.title}</span>
              {contract && <span className="tabular text-sm text-ink-3">{contract.label}</span>}
              {!running && (
                <Play
                  className="size-3.5 fill-current text-ink-3 transition-colors group-hover:text-accent-ink"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
