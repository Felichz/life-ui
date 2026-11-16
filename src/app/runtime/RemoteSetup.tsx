import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "../components/ui/Button";
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
import { t } from "../i18n";
import {
  DEFAULT_REMOTE_CONTEXT,
  PROVIDERS,
  REMOTE_CONTEXTS,
  listRemoteModels,
  providerById,
  testRemote,
  type RemoteModel,
  type RemoteModelInfo,
} from "./providers";

/**
 * A model through an API (ADR-005): a provider, a key, a model and how much of
 * the conversation it reads. It is tried once before it is kept, so a wrong key
 * or a typo shows here and not in the chat.
 */
export function RemoteSetup({
  initial,
  onSave,
  onLocal,
  onSkip,
  onRemove,
}: {
  initial: RemoteModel | null;
  onSave: (remote: RemoteModel) => void;
  /** The desktop app's way back to its local models. */
  onLocal?: () => void;
  onSkip: () => void;
  onRemove?: () => void;
}) {
  const [provider, setProvider] = useState(initial?.provider ?? "openrouter");
  const known = providerById(provider);
  const custom = provider === "custom";
  const [baseUrl, setBaseUrl] = useState(custom ? (initial?.baseUrl ?? "") : "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [context, setContext] = useState(initial?.context ?? DEFAULT_REMOTE_CONTEXT);
  const [models, setModels] = useState<RemoteModelInfo[] | null>(null);
  const [listing, setListing] = useState(false);
  const [listFailed, setListFailed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listAbort = useRef<AbortController | null>(null);

  const url = custom ? baseUrl.trim() : (known?.baseUrl ?? "");
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

  // A saved choice opens with its list already there
  useEffect(() => {
    if (initial) void loadModels(initial.provider, initial.baseUrl, initial.apiKey);
    return () => listAbort.current?.abort();
  }, []);

  const pickProvider = (id: string) => {
    if (id === provider) return;
    setProvider(id);
    setModel("");
    setModels(null);
    setListFailed(false);
    setError(null);
    const next = providerById(id);
    if (next && next.id !== "custom") void loadModels(id, next.baseUrl, apiKey.trim());
  };

  const info = useMemo(() => models?.find((one) => one.id === model.trim()), [models, model]);
  // A model that reads less than an option offers cannot be given it
  const contexts = REMOTE_CONTEXTS.filter((size) => !info?.context || size * 0.95 <= info.context);
  useEffect(() => {
    if (contexts.length > 0 && !contexts.includes(context)) setContext(contexts.at(-1)!);
  }, [contexts, context]);

  const save = async () => {
    if (!ready || testing) return;
    const remote: RemoteModel = {
      provider,
      baseUrl: url.replace(/\/$/, ""),
      apiKey: apiKey.trim(),
      model: model.trim(),
      context,
    };
    setTesting(true);
    setError(null);
    try {
      await testRemote(remote);
      onSave(remote);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setTesting(false);
    }
  };

  const openKeyPage = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isDesktop() || !known?.keyUrl) return;
    event.preventDefault();
    void openExternal(known.keyUrl);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("remote.title")}</DialogTitle>
        <DialogDescription>
          {t(isDesktop() ? "remote.body.desktop" : "remote.body.web")}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4 pb-4">
        <div role="radiogroup" aria-label={t("remote.provider")} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t("remote.provider")}</span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {PROVIDERS.map((one) => (
              <button
                key={one.id}
                type="button"
                role="radio"
                aria-checked={provider === one.id}
                onClick={() => pickProvider(one.id)}
                className={cn(
                  "h-9 truncate rounded-md border px-2.5 text-left text-sm transition-colors duration-150 coarse:h-11",
                  provider === one.id
                    ? "border-accent/60 bg-accent/10 font-medium text-ink"
                    : "border-line bg-panel text-ink-2 hover:border-line-strong hover:text-ink"
                )}
              >
                {one.name || t("remote.custom")}
              </button>
            ))}
          </div>
        </div>

        {custom && (
          <Field label={t("remote.baseUrl")} hint={t("remote.baseUrl.hint")}>
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
              {t(isDesktop() ? "remote.key.hint.desktop" : "remote.key.hint.web")}
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
        {onRemove && (
          <Button variant="ghost" onClick={onRemove} className="mr-auto">
            {t("remote.remove")}
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
