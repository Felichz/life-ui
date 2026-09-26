import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Download, Monitor, Moon, Sun, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UtilityService } from "../../../system/utilityService";
import { Page, PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Field";
import { Kbd } from "../../components/ui/Kbd";
import { Segmented } from "../../components/ui/Segmented";
import { modKeyLabel } from "../../lib/useHotkey";
import { errorMessage, useSystem } from "../../state/system";
import { useTheme, type ThemePreference } from "../../state/theme";
import { useToast } from "../../state/toast";
import { LOCALES, LOCALE_NAMES, t, useLocale, type Locale } from "../../i18n";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-line py-7 first:border-t-0 first:pt-2 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-md font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  return (
    <Page width="narrow">
      <PageHeader title={t("nav.settings")} />
      <div className="mt-6">
        <TargetSection />
        <AppearanceSection />
        <LanguageSection />
        <Section title={t("settings.shortcuts")} description={t("settings.shortcutsHint")}>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2.5 text-base">
            {[
              [[modKeyLabel, "K"], t("settings.shortcut.palette")],
              [["N"], t("palette.addActivity")],
              [["E"], t("settings.shortcut.event")],
              [["T"], t("settings.shortcut.finish")],
              [["G", "H"], t("settings.shortcut.goTo")],
              [["0–9"], t("settings.shortcut.score")],
            ].map(([keys, label]) => (
              <div key={label as string} className="contents">
                <dt className="flex gap-1">
                  {(keys as string[]).map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </dt>
                <dd className="text-ink-2">{label as string}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <DataSection />
      </div>
    </Page>
  );
}

function TargetSection() {
  const { state, core } = useSystem();
  const toast = useToast();
  const current = state.global.userPreferences.dailyTempoTarget ?? 100;
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  const divisor = UtilityService.SCORE_DIVISOR;

  const save = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError(t("settings.target.error"));
      return;
    }
    try {
      core.updateDailyTempoTarget(parsed);
      setError(null);
      toast({
        title: t("settings.target.updated"),
        description: t("settings.target.updatedDetail", { n: parsed }),
      });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <Section title={t("settings.target.title")} description={t("settings.target.description")}>
      <form onSubmit={save} className="flex flex-col gap-2">
        <label htmlFor="target" className="text-sm font-medium text-ink">
          {t("settings.target.label")}
        </label>
        <div className="flex gap-2">
          <Input
            id="target"
            type="number"
            inputMode="numeric"
            min={1}
            value={value}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            className="tabular w-32"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={value === String(current)}
            className="h-9 coarse:h-11"
          >
            {t("common.save")}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
      <div className="mt-5 rounded-lg bg-subtle px-4 py-3.5 text-sm text-ink-2">
        <p className="font-medium text-ink">{t("settings.formula.title")}</p>
        <p className="tabular mt-1.5">{t("settings.formula.expression", { divisor })}</p>
        <p className="mt-1.5">{t("settings.formula.explanation", { divisor })}</p>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  return (
    <Section title={t("palette.group.appearance")} description={t("settings.appearanceHint")}>
      <Segmented<ThemePreference>
        label={t("settings.theme")}
        value={preference}
        onChange={setPreference}
        options={[
          { value: "system", label: t("settings.theme.system"), icon: <Monitor /> },
          { value: "light", label: t("settings.theme.light"), icon: <Sun /> },
          { value: "dark", label: t("settings.theme.dark"), icon: <Moon /> },
        ]}
      />
    </Section>
  );
}

function LanguageSection() {
  const { locale, setLocale } = useLocale();
  return (
    <Section title={t("settings.language")} description={t("settings.languageHint")}>
      <Segmented<Locale>
        label={t("settings.language")}
        value={locale}
        onChange={setLocale}
        options={LOCALES.map((option) => ({ value: option, label: LOCALE_NAMES[option] }))}
      />
    </Section>
  );
}

function DataSection() {
  const { core, state } = useSystem();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; json: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const exportData = () => {
    const blob = new Blob([core.exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lifeui-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: t("settings.data.downloaded") });
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPendingImport({ name: file.name, json: await file.text() });
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    try {
      core.importData(pendingImport.json);
      toast({ title: t("settings.data.imported") });
      setPendingImport(null);
      navigate("/");
    } catch (caught) {
      toast({
        tone: "error",
        title: t("error.import"),
        description: errorMessage(caught, t("settings.data.invalidFile")),
      });
      setPendingImport(null);
    }
  };

  const confirmClear = () => {
    core.clearState();
    setClearing(false);
    setConfirmText("");
    toast({ title: t("settings.data.cleared"), description: t("settings.data.clearedHint") });
    navigate("/");
  };

  return (
    <Section title={t("settings.data.title")} description={t("settings.data.description")}>
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel shadow-xs">
        <Row
          title={t("settings.data.export")}
          body={t("settings.data.exportBody", {
            days: state.global.days.length,
            closes: state.global.completedActivityRecords.length,
          })}
          action={
            <Button variant="secondary" onClick={exportData}>
              <Download />
              {t("settings.data.download")}
            </Button>
          }
        />
        <Row
          title={t("settings.data.import")}
          body={t("settings.data.importBody")}
          action={
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onFile}
              />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload />
                {t("settings.data.chooseFile")}
              </Button>
            </>
          }
        />
        <Row
          title={t("settings.data.clear")}
          body={t("settings.data.clearBody")}
          action={
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => setClearing(true)}
            >
              <Trash2 />
              {t("settings.data.clearShort")}
            </Button>
          }
        />
      </div>

      <Dialog
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {t("settings.data.importConfirm", { name: pendingImport?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("settings.data.importWarning")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingImport(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={confirmImport}>
              {t("settings.data.importAndReplace")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={clearing}
        onOpenChange={(open) => {
          setClearing(open);
          if (!open) setConfirmText("");
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("settings.data.clearConfirm")}</DialogTitle>
            <DialogDescription>
              {t("settings.data.clearHint", { word: t("settings.data.clearWord") })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="pb-4">
            <Input
              autoFocus
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              aria-label={t("settings.data.clearTypeLabel", { word: t("settings.data.clearWord") })}
              placeholder={t("settings.data.clearWord")}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setClearing(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={confirmText.trim().toLowerCase() !== t("settings.data.clearWord")}
              onClick={confirmClear}
            >
              {t("settings.data.clear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function Row({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-base font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-2">{body}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
