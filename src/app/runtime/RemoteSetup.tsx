import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button, IconButton } from "../components/ui/Button";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/Dialog";
import { Field, Input } from "../components/ui/Field";
import { Segmented } from "../components/ui/Segmented";
import { cn } from "../lib/cn";
import { isDesktop, openExternal } from "../platform/desktop";
import { t, useLocale } from "../i18n";
import {
  DEFAULT_REMOTE_CONTEXT,
  GROUP_ORDER,
  REMOTE_CONTEXTS,
  listRemoteModels,
  newConnectionId,
  offeredProviders,
  providerById,
  providerName,
  testRemote,
  withConnection,
  withoutConnection,
  type Connections,
  type RemoteModel,
  type RemoteModelInfo,
} from "./providers";

/**
 * The models through an API (ADR-005): the connections kept, one in use, and a
 * form to add or change one (a provider, a key, a model and how much of the
 * conversation it reads). A connection is tried once before it is kept, so a
 * wrong key or a typo shows here and not in the chat.
 */
export function RemoteSetup({
  connections,
  onChange,
  onLocal,
  onSkip,
}: {
  connections: Connections;
  /** The connections changed; `close` when one was chosen to be in use. */
  onChange: (next: Connections, close: boolean) => void;
  /** The desktop app's way back to its local models. */
  onLocal?: () => void;
  onSkip: () => void;
}) {
  const [editing, setEditing] = useState<RemoteModel | "new" | null>(
    connections.list.length === 0 ? "new" : null
  );
  // The last connection removed: the form for a first one opens
  useEffect(() => {
    if (connections.list.length === 0 && editing === null) setEditing("new");
  }, [connections.list.length, editing]);

  if (editing !== null) {
    return (
      <ConnectionForm
        initial={editing === "new" ? null : editing}
        onBack={connections.list.length > 0 ? () => setEditing(null) : undefined}
        onSaved={(saved) => {
          onChange(withConnection(connections, saved, true), true);
        }}
        onLocal={onLocal}
        onSkip={onSkip}
      />
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("remote.connections")}</DialogTitle>
        <DialogDescription>
          {t(isDesktop() ? "remote.body.desktop" : "remote.body.web")}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="pb-4">
        <ul className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto">
          {connections.list.map((one) => {
            const inUse = one.id === connections.active;
            return (
              <li
                key={one.id}
                className={cn(
                  "flex items-center gap-1 rounded-lg border pr-1.5",
                  inUse ? "border-accent/60 bg-accent/5" : "border-line bg-panel"
                )}
              >
                <button
                  type="button"
                  onClick={() => onChange({ ...connections, active: one.id }, true)}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left hover:bg-subtle"
                >
                  <span className="block truncate text-base font-medium text-ink">{one.label}</span>
                  <span className="tabular block truncate text-xs text-ink-2">
                    {[providerName(one), one.model, `${one.context / 1024}K`].join(" · ")}
                  </span>
                </button>
                {inUse && (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent-ink">
                    <Check className="size-3.5" strokeWidth={2.5} />
                    {t("remote.active")}
                  </span>
                )}
                <IconButton label={t("remote.edit")} size="sm" onClick={() => setEditing(one)}>
                  <Pencil />
                </IconButton>
                <IconButton
                  label={t("remote.delete")}
                  size="sm"
                  onClick={() => onChange(withoutConnection(connections, one.id), false)}
                >
                  <Trash2 />
                </IconButton>
              </li>
            );
          })}
        </ul>
      </DialogBody>
      <DialogFooter className="flex-wrap">
        <Button variant="secondary" onClick={() => setEditing("new")} className="mr-auto">
          <Plus />
          {t("remote.add")}
        </Button>
        {onLocal && (
          <Button variant="ghost" onClick={onLocal}>
            {t("remote.local")}
          </Button>
        )}
        <Button variant="ghost" onClick={onSkip}>
          {t("common.close")}
        </Button>
      </DialogFooter>
    </>
  );
}

function ConnectionForm({
  initial,
  onBack,
  onSaved,
  onLocal,
  onSkip,
}: {
  initial: RemoteModel | null;
  onBack?: () => void;
  onSaved: (saved: RemoteModel) => void;
  onLocal?: () => void;
  onSkip: () => void;
}) {
  const { locale } = useLocale();
  const desktop = isDesktop();
  const offered = useMemo(() => offeredProviders(desktop), [desktop]);
  const [provider, setProvider] = useState(initial?.provider ?? "openrouter");
  const known = providerById(provider);
  const custom = provider === "custom";
  const [name, setName] = useState(
    initial && initial.label !== providerName(initial) ? initial.label : ""
  );
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? known?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [model, setModel] = useState(initial?.model ?? known?.models?.[0] ?? "");
  const [context, setContext] = useState(initial?.context ?? DEFAULT_REMOTE_CONTEXT);
  const [models, setModels] = useState<RemoteModelInfo[] | null>(null);
  const [listing, setListing] = useState(false);
  const [listFailed, setListFailed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listAbort = useRef<AbortController | null>(null);

  const editableUrl = custom || Boolean(known?.local);
  const url = (editableUrl ? baseUrl.trim() : (known?.baseUrl ?? "")).replace(/\/$/, "");
  const keyNeeded = !known?.keyOptional;
  const ready = Boolean(url && model.trim() && (apiKey.trim() || !keyNeeded));

  /** The provider's models, read again whenever the provider or the key changes. */
  const loadModels = async (forProvider: string, forUrl: string, key: string) => {
    listAbort.current?.abort();
    if (!forUrl || (!key && !providerById(forProvider)?.keyOptional)) {
      setModels(null);
      return;
    }
    const abort = new AbortController();
    listAbort.current = abort;
    setListing(true);
    setListFailed(false);
    try {
      const found = await listRemoteModels(forProvider, forUrl, key, abort.signal);
      if (!abort.signal.aborted) setModels(found);
    } catch {
      if (!abort.signal.aborted) {
        setModels(null);
        setListFailed(true);
      }
    } finally {
      if (!abort.signal.aborted) setListing(false);
    }
  };

  // A saved connection opens with its list already there
  useEffect(() => {
    if (initial) void loadModels(initial.provider, initial.baseUrl, initial.apiKey);
    return () => listAbort.current?.abort();
  }, []);

  const pickProvider = (id: string) => {
    if (id === provider) return;
    const next = providerById(id);
    setProvider(id);
    setBaseUrl(next?.baseUrl ?? "");
    setModel(next?.models?.[0] ?? "");
    setModels(null);
    setListFailed(false);
    setError(null);
    if (next && next.id !== "custom" && next.baseUrl) {
      void loadModels(id, next.baseUrl, apiKey.trim());
    }
  };

  const info = useMemo(() => models?.find((one) => one.id === model.trim()), [models, model]);
  // A model that reads less than an option offers cannot be given it
  const contexts = REMOTE_CONTEXTS.filter((size) => !info?.context || size * 0.95 <= info.context);
  useEffect(() => {
    if (contexts.length > 0 && !contexts.includes(context)) setContext(contexts.at(-1)!);
  }, [contexts, context]);

  const save = async () => {
    if (!ready || testing) return;
    const connection: RemoteModel = {
      id: initial?.id ?? newConnectionId(),
      label: "",
      provider,
      baseUrl: url,
      apiKey: apiKey.trim(),
      model: model.trim(),
      context,
    };
    connection.label = name.trim() || providerName(connection);
    setTesting(true);
    setError(null);
    try {
      await testRemote(connection);
      onSaved(connection);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setTesting(false);
    }
  };

  const openKeyPage = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!desktop || !known?.keyUrl) return;
    event.preventDefault();
    void openExternal(known.keyUrl);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("remote.title")}</DialogTitle>
        <DialogDescription>
          {t(desktop ? "remote.body.desktop" : "remote.body.web")}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4 pb-4">
        <div role="radiogroup" aria-label={t("remote.provider")} className="flex flex-col gap-3">
          <span className="text-sm font-medium text-ink">{t("remote.provider")}</span>
          {GROUP_ORDER.map((group) => {
            const items = offered.filter((one) => one.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-3">
                  {t(`remote.group.${group}`)}
                </span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {items.map((one) => {
                    // Only the desktop app can reach a provider that does not answer a web page
                    const blocked = !one.browser && !desktop;
                    return (
                      <button
                        key={one.id}
                        type="button"
                        role="radio"
                        aria-checked={provider === one.id}
                        disabled={blocked}
                        title={blocked ? t("remote.desktopOnly") : undefined}
                        onClick={() => pickProvider(one.id)}
                        className={cn(
                          "h-9 truncate rounded-md border px-2.5 text-left text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 coarse:h-11",
                          provider === one.id
                            ? "border-accent/60 bg-accent/10 font-medium text-ink"
                            : "border-line bg-panel text-ink-2 hover:border-line-strong hover:text-ink"
                        )}
                      >
                        {one.name || t("remote.custom")}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {known && (
            <p className="text-sm text-ink-2" aria-live="polite">
              {known.description[locale === "es" ? "es" : "en"]}
              {!known.browser && !desktop && ` ${t("remote.desktopOnly")}.`}
            </p>
          )}
        </div>

        <Field label={t("remote.name")} hint={t("remote.name.hint")}>
          {(id, describedBy) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={name}
              placeholder={known?.name || t("remote.custom")}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        {editableUrl && (
          <Field
            label={t("remote.baseUrl")}
            hint={t(custom ? "remote.baseUrl.hint" : "remote.baseUrl.local")}
          >
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={baseUrl}
                placeholder="https://…/v1"
                spellCheck={false}
                onChange={(event) => setBaseUrl(event.target.value)}
                onBlur={() => void loadModels(provider, baseUrl.trim(), apiKey.trim())}
              />
            )}
          </Field>
        )}

        <Field
          label={t(keyNeeded ? "remote.key" : "remote.key.optional")}
          hint={
            <span className="flex flex-wrap items-center gap-x-2">
              {t(desktop ? "remote.key.hint.desktop" : "remote.key.hint.web")}
              {known?.keyUrl && (
                <a
                  href={known.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={openKeyPage}
                  className="inline-flex items-center gap-1 text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
                >
                  {t("remote.key.get", { provider: known.name })}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </span>
          }
        >
          {(id, describedBy) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              onBlur={() => void loadModels(provider, url, apiKey.trim())}
            />
          )}
        </Field>

        <Field
          label={t("remote.model")}
          hint={
            listing
              ? t("remote.model.loading")
              : listFailed
                ? t("remote.model.listFailed")
                : models
                  ? t("remote.model.count", { count: String(models.length) })
                  : t("remote.model.hint")
          }
        >
          {(id, describedBy) => (
            <>
              <Input
                id={id}
                aria-describedby={describedBy}
                list={`${id}-models`}
                value={model}
                placeholder={t("remote.model.placeholder")}
                spellCheck={false}
                onChange={(event) => setModel(event.target.value)}
              />
              <datalist id={`${id}-models`}>
                {(models ?? []).map((one) => (
                  <option key={one.id} value={one.id} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        {info?.tools === false && (
          <p className="flex gap-2 rounded-md bg-hover px-3 py-2 text-sm text-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ink-3" />
            {t("remote.noTools")}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t("remote.context")}</span>
          <Segmented
            label={t("remote.context")}
            size="sm"
            value={String(context)}
            onChange={(value) => setContext(Number(value))}
            options={REMOTE_CONTEXTS.map((size) => ({
              value: String(size),
              label: `${size / 1024}K`,
              disabled: !contexts.includes(size),
            }))}
          />
          <p className="text-sm text-ink-2">{t("remote.context.hint")}</p>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-ink">
            {t("remote.failed", { error })}
          </p>
        )}
      </DialogBody>
      <DialogFooter className="flex-wrap">
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="mr-auto">
            {t("remote.back")}
          </Button>
        )}
        {onLocal && (
          <Button variant="ghost" onClick={onLocal}>
            {t("remote.local")}
          </Button>
        )}
        <Button variant="ghost" onClick={onSkip}>
          {t("model.skip")}
        </Button>
        <Button variant="primary" disabled={!ready || testing} onClick={() => void save()}>
          {testing && <Loader2 className="animate-spin" />}
          {t(testing ? "remote.testing" : "remote.save")}
        </Button>
      </DialogFooter>
    </>
  );
}
