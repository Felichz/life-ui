import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { getWebSetting, onWebSetting, setWebSetting, type WebSetting } from "../../agent/web";
import { Download, Monitor, Moon, Sun, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { useAgent } from "../../agent/AgentProvider";
import { useTheme, type ThemePreference } from "../../state/theme";
import { useToast } from "../../state/toast";
import { LOCALES, LOCALE_NAMES, t, useLocale, type Locale } from "../../i18n";
import { isDesktop } from "../../platform/desktop";
import {
  appVersion,
  canUpdate,
  findUpdate,
  getAutoUpdate,
  onAutoUpdate,
  setAutoUpdate,
  type Available,
} from "../../platform/updates";
import { Switch } from "../../components/ui/Switch";
import { ModelBadge } from "../../runtime/ModelBadge";

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
    <section className="grid gap-4 border-t border-line py-7 first:border-t-0 first:pt-2 @3xl:grid-cols-[240px_minmax(0,1fr)] @3xl:gap-10">
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
        <ModelSection />
        <AppearanceSection />
        <LanguageSection />
        <WebSection />
        <Section title={t("settings.shortcuts")} description={t("settings.shortcutsHint")}>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2.5 text-base">
            {[
              [[modKeyLabel, "K"], t("settings.shortcut.palette")],
              [["G", "H"], t("settings.shortcut.goTo")],
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
        {isDesktop() && <UpdatesSection />}
        <DataSection />
      </div>
    </Page>
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

/** The model the agent runs on (ADR-004), and the way to change it. */
function ModelSection() {
  return (
    <Section title={t("settings.model.title")} description={t("settings.model.description")}>
      <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
        <ModelBadge />
      </div>
    </Section>
  );
}

/** Updates of the desktop app (ADR-014): automatic or by hand, and a look right now. */
function UpdatesSection() {
  const choice = useSyncExternalStore(onAutoUpdate, getAutoUpdate);
  const [able, setAble] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "looking" }
    | { kind: "latest" }
    | { kind: "found"; update: Available }
    | { kind: "installing"; share: number }
    | { kind: "failed" }
  >({ kind: "idle" });
  useEffect(() => {
    void canUpdate().then(setAble);
    void appVersion().then(setVersion);
  }, []);

  const look = async () => {
    setState({ kind: "looking" });
    try {
      const update = await findUpdate();
      setState(update ? { kind: "found", update } : { kind: "latest" });
    } catch {
      setState({ kind: "failed" });
    }
  };
  const install = async (update: Available) => {
    setState({ kind: "installing", share: 0 });
    try {
      await update.install((share) => setState({ kind: "installing", share }));
    } catch {
      setState({ kind: "failed" });
    }
  };

  return (
    <Section
      title={t("settings.updates.title")}
      description={version ? t("settings.updates.version", { version }) : undefined}
    >
      {able === false ? (
        <p className="max-w-md text-sm text-ink-2">{t("settings.updates.portable")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex max-w-md items-start justify-between gap-4">
            <span>
              <span className="block text-base font-medium text-ink">
                {t("settings.updates.auto")}
              </span>
              <span className="block text-sm text-ink-2">{t("settings.updates.autoHint")}</span>
            </span>
            <Switch
              checked={choice === "on"}
              label={t("settings.updates.auto")}
              onChange={(on) => setAutoUpdate(on ? "on" : "off")}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {state.kind === "found" ? (
              <Button size="sm" variant="primary" onClick={() => void install(state.update)}>
                <Download />
                {t("settings.updates.install", { version: state.update.version })}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={state.kind === "looking" || state.kind === "installing"}
                onClick={() => void look()}
              >
                {t("settings.updates.check")}
              </Button>
            )}
            <span className="text-sm text-ink-2" role="status">
              {state.kind === "looking"
                ? t("settings.updates.looking")
                : state.kind === "latest"
                  ? t("settings.updates.latest")
                  : state.kind === "installing"
                    ? t("updates.installing", { share: String(Math.round(state.share * 100)) })
                    : state.kind === "failed"
                      ? t("updates.failed")
                      : ""}
            </span>
          </div>
        </div>
      )}
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

/** Whether the agent may look things up on the web (ADR-009). */
function WebSection() {
  const setting = useSyncExternalStore(onWebSetting, getWebSetting);
  return (
    <Section title={t("settings.web.title")} description={t("settings.web.description")}>
      <Segmented<WebSetting>
        label={t("settings.web.title")}
        value={setting}
        onChange={setWebSetting}
        options={[
          { value: "ask", label: t("settings.web.ask") },
          { value: "on", label: t("settings.web.on") },
          { value: "off", label: t("settings.web.off") },
        ]}
      />
      <p className="mt-2.5 max-w-md text-sm text-ink-2">{t("settings.web.detail")}</p>
    </Section>
  );
}

function DataSection() {
  const { core, state } = useSystem();
  const { agent } = useAgent();
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
      // The conversation was about the data that was just replaced
      agent.clear();
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
    agent.clear();
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
    <div className="flex flex-col gap-3 px-4 py-3.5 @lg:flex-row @lg:items-center @lg:justify-between">
      <div className="min-w-0">
        <p className="text-base font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-2">{body}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
