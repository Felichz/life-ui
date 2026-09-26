import { useEffect, useMemo, useRef, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { ArrowLeft, Pin, Plus, Search } from "lucide-react";
import type { ActivityTemplate, UUID } from "../../../types";
import { t, tr } from "../../i18n";
import { Button } from "../../components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "../../components/ui/Dialog";
import { Kbd } from "../../components/ui/Kbd";
import { TypeIcon } from "../../components/TypeIcon";
import {
  TYPE_META,
  blockName,
  blockStatus,
  contractOf,
  settingsOf,
  type Settings,
} from "../../lib/domain";
import { cn } from "../../lib/cn";
import { minutesOfDay } from "../../lib/format";
import { useDayActions } from "../../state/actions";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { TemplateForm, draftFrom, templatePayload } from "../library/TemplateForm";
import { BlockPicker } from "./BlockPicker";
import {
  DurationFields,
  defaultSettings,
  settingsForType,
  validateSettings,
} from "./DurationFields";

type Step =
  | { kind: "pick" }
  | { kind: "create"; title: string }
  | { kind: "configure"; templateId: UUID };

interface AddActivityDialogProps {
  open: boolean;
  initialBlockId?: UUID;
  /** Salta directo a configurar esta plantilla */
  initialTemplateId?: UUID;
  onOpenChange: (open: boolean) => void;
}

/**
 * Añadir al plan del día: elegir de la biblioteca (o crear en el momento),
 * ajustar bloque y duración para hoy, y añadir o empezar ya.
 */
export function AddActivityDialog({
  open,
  initialBlockId,
  initialTemplateId,
  onOpenChange,
}: AddActivityDialogProps) {
  const [step, setStep] = useState<Step>({ kind: "pick" });

  useEffect(() => {
    if (open)
      setStep(
        initialTemplateId ? { kind: "configure", templateId: initialTemplateId } : { kind: "pick" }
      );
  }, [open, initialTemplateId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        aria-describedby={undefined}
        className="sm:h-[min(620px,86dvh)]"
        hideClose={step.kind === "pick"}
      >
        {step.kind === "pick" && (
          <PickStep
            onPick={(templateId) => setStep({ kind: "configure", templateId })}
            onCreate={(title) => setStep({ kind: "create", title })}
          />
        )}
        {step.kind === "create" && (
          <CreateStep
            initialTitle={step.title}
            onBack={() => setStep({ kind: "pick" })}
            onCreated={(template) => setStep({ kind: "configure", templateId: template.id })}
          />
        )}
        {step.kind === "configure" && (
          <ConfigureStep
            templateId={step.templateId}
            initialBlockId={initialBlockId}
            onBack={() => setStep({ kind: "pick" })}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function PickStep({
  onPick,
  onCreate,
}: {
  onPick: (id: UUID) => void;
  onCreate: (title: string) => void;
}) {
  const { state } = useSystem();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const templates = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return [...state.global.activityTemplates]
      .filter((template) =>
        words.every((word) => normalize(`${template.title} ${template.description}`).includes(word))
      )
      .sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          a.title.localeCompare(b.title, "es")
      );
  }, [query, state.global.activityTemplates]);

  const createLabel = query.trim();
  const total = templates.length + 1;

  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const choose = (index: number) => {
    if (index < templates.length) onPick(templates[index].id);
    else onCreate(createLabel);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setCursor((value) => Math.min(total - 1, value + 1));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setCursor((value) => Math.max(0, value - 1));
        } else if (event.key === "Enter") {
          event.preventDefault();
          choose(cursor);
        }
      }}
    >
      <DialogTitle className="sr-only">{t("palette.addActivity")}</DialogTitle>
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-[18px] shrink-0 text-ink-3" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("add.searchPlaceholder")}
          aria-label={t("add.searchLabel")}
          className="h-[52px] flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3"
        />
        <RadixDialog.Close asChild>
          <button type="button" className="text-sm text-ink-3 hover:text-ink">
            <Kbd>Esc</Kbd>
          </button>
        </RadixDialog.Close>
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label={t("add.listLabel")}
        className="min-h-0 flex-1 overflow-y-auto p-1.5"
      >
        {state.global.activityTemplates.length === 0 && (
          <div className="px-4 pb-2 pt-6 text-center">
            <p className="text-base font-medium text-ink">{t("add.emptyTitle")}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">{t("add.emptyBody")}</p>
          </div>
        )}
        {templates.map((template, index) => (
          <TemplateOption
            key={template.id}
            template={template}
            index={index}
            active={cursor === index}
            onHover={() => setCursor(index)}
            onClick={() => choose(index)}
          />
        ))}
        <div
          role="option"
          aria-selected={cursor === templates.length}
          data-index={templates.length}
          onMouseMove={() => setCursor(templates.length)}
          onClick={() => choose(templates.length)}
          className={cn(
            "mt-1 flex h-11 cursor-default items-center gap-3 rounded-md px-2.5 text-base",
            cursor === templates.length ? "bg-hover text-ink" : "text-ink-2"
          )}
        >
          <span className="flex size-7 items-center justify-center rounded-md border border-dashed border-line-strong">
            <Plus className="size-4" />
          </span>
          {createLabel ? (
            <span>
              {tr("add.createNamed", {
                name: <span className="font-medium text-ink">{createLabel}</span>,
              })}
            </span>
          ) : (
            <span>{t("template.new")}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateOption({
  template,
  index,
  active,
  onHover,
  onClick,
}: {
  template: ActivityTemplate;
  index: number;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const contract = contractOf(template.type, template);
  return (
    <div
      role="option"
      aria-selected={active}
      data-index={index}
      onMouseMove={onHover}
      onClick={onClick}
      className={cn(
        "flex h-11 cursor-default items-center gap-3 rounded-md px-2.5",
        active && "bg-hover"
      )}
    >
      <TypeIcon type={template.type} boxed />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-base font-medium text-ink">{template.title}</span>
          {template.pinned && <Pin className="size-3 shrink-0 text-ink-3" aria-label="Anclada" />}
        </span>
      </span>
      <span className="shrink-0 text-sm text-ink-2">{TYPE_META[template.type].short}</span>
      {contract && (
        <span className="tabular w-[72px] shrink-0 text-right text-sm text-ink-3">
          {contract.label}
        </span>
      )}
    </div>
  );
}

function StepHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-3 pr-14">
      <button
        type="button"
        onClick={onBack}
        aria-label={t("common.back")}
        className="flex size-8 items-center justify-center rounded text-ink-2 hover:bg-hover hover:text-ink"
      >
        <ArrowLeft className="size-[18px]" />
      </button>
      <div className="min-w-0">
        <DialogTitle className="truncate text-md">{title}</DialogTitle>
        {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
      </div>
    </div>
  );
}

function CreateStep({
  initialTitle,
  onBack,
  onCreated,
}: {
  initialTitle: string;
  onBack: () => void;
  onCreated: (template: ActivityTemplate) => void;
}) {
  const { core } = useSystem();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <StepHeader title={t("template.new")} subtitle={t("add.createSubtitle")} onBack={onBack} />
      <DialogBody className="py-5">
        <TemplateForm
          id="create-template-form"
          initial={draftFrom(undefined, initialTitle)}
          error={error}
          onSubmit={(draft) => {
            try {
              onCreated(
                core.createActivityTemplate({ ...templatePayload(draft), isSystemActivity: false })
              );
            } catch (caught) {
              setError(errorMessage(caught));
            }
          }}
        />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onBack}>
          {t("common.back")}
        </Button>
        <Button variant="primary" type="submit" form="create-template-form">
          {t("add.createAndContinue")}
        </Button>
      </DialogFooter>
    </>
  );
}

function ConfigureStep({
  templateId,
  initialBlockId,
  onBack,
  onDone,
}: {
  templateId: UUID;
  initialBlockId?: UUID;
  onBack: () => void;
  onDone: () => void;
}) {
  const { state, core } = useSystem();
  const { startTemplate, blockForNow } = useDayActions();
  const toast = useToast();
  const template = state.global.activityTemplates.find((item) => item.id === templateId);
  const blocks = core.getTimeBlocks();
  const [blockId, setBlockId] = useState<UUID>(
    () => initialBlockId ?? blockForNow() ?? blocks[0]?.id
  );
  const [settings, setSettings] = useState<Settings>(() =>
    template ? { ...defaultSettings(template.type), ...settingsOf(template) } : {}
  );
  const [touched, setTouched] = useState(false);

  if (!template) return null;
  const block = blocks.find((item) => item.id === blockId);
  const status = block ? blockStatus(block, minutesOfDay(new Date())) : "later";
  const canStartNow = status === "always" || status === "now";
  const error = touched ? validateSettings(template.type, settings) : null;
  const running = Boolean(state.currentDay?.activeActivityInstanceId);

  const submit = (startNow: boolean) => {
    setTouched(true);
    if (validateSettings(template.type, settings)) return;
    const clean = settingsForType(template.type, settings);
    onDone();
    if (startNow) {
      startTemplate(template.id, { blockId, settings: clean });
      return;
    }
    try {
      core.createActivityInstance(template.id, blockId, clean);
      toast({
        title: t("add.added", { title: template.title }),
        description: t("add.addedIn", { block: block ? blockName(block) : t("add.thePlan") }),
      });
    } catch (caught) {
      toast({ tone: "error", title: t("error.add"), description: errorMessage(caught) });
    }
  };

  return (
    <>
      <StepHeader
        title={template.title}
        subtitle={TYPE_META[template.type].label}
        onBack={onBack}
      />
      <DialogBody className="flex flex-col gap-5 py-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">{t("add.when")}</h3>
          <BlockPicker blocks={blocks} value={blockId} onChange={setBlockId} />
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">{t("add.forToday")}</h3>
          <div className="rounded-lg border border-line bg-subtle/60 p-3.5">
            <DurationFields
              type={template.type}
              value={settings}
              onChange={(next) => setSettings({ ...settings, ...next })}
              error={error}
            />
          </div>
        </section>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={() => submit(false)}>
          {t("add.addToPlan")}
        </Button>
        <Button
          variant="primary"
          onClick={() => submit(true)}
          disabled={!canStartNow}
          title={canStartNow ? undefined : t("add.blockUnavailable")}
        >
          {running ? t("add.addAndSwitch") : t("add.addAndStart")}
        </Button>
      </DialogFooter>
    </>
  );
}
