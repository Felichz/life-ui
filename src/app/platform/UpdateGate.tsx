import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { t } from "../i18n";
import {
  canUpdate,
  findUpdate,
  getAutoUpdate,
  onAutoUpdate,
  setAutoUpdate,
  type Available,
} from "./updates";

/** While the app runs, a new version is looked for this often. */
const EVERY = 6 * 60 * 60 * 1000;

/**
 * Updates of the desktop app (ADR-014), in a card in the corner rather than a
 * dialog, so it never stands in front of the model setup or the chat:
 * - the first time, it asks once whether the app may update itself;
 * - with a yes, a version found when the app opens is installed at once (the
 *   app starts again on it), and one found while it runs waits for a click.
 */
export function UpdateGate() {
  const choice = useSyncExternalStore(onAutoUpdate, getAutoUpdate);
  const [able, setAble] = useState(false);
  const [found, setFound] = useState<Available | null>(null);
  const [installing, setInstalling] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [later, setLater] = useState(false);
  const checkedAtLaunch = useRef(false);

  useEffect(() => {
    void canUpdate().then(setAble);
  }, []);

  const install = async (update: Available) => {
    setInstalling(0);
    setFailed(false);
    try {
      await update.install((share) => setInstalling(share));
    } catch {
      setInstalling(null);
      setFailed(true);
    }
  };

  useEffect(() => {
    if (!able || choice !== "on") return;
    let stopped = false;
    const look = async (atLaunch: boolean) => {
      try {
        const update = await findUpdate();
        if (stopped || !update) return;
        // At launch nothing is under way yet: it installs now. Later it waits for the person.
        if (atLaunch) void install(update);
        else setFound(update);
      } catch {
        // offline, or GitHub did not answer: the next look tries again
      }
    };
    if (!checkedAtLaunch.current) {
      checkedAtLaunch.current = true;
      void look(true);
    }
    const timer = window.setInterval(() => void look(false), EVERY);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [able, choice]);

  if (!able) return null;

  let body: React.ReactNode = null;
  if (installing !== null) {
    body = (
      <p className="flex items-center gap-2 text-sm text-ink">
        <Loader2 className="size-4 animate-spin text-ink-3" />
        {t("updates.installing", { share: String(Math.round(installing * 100)) })}
      </p>
    );
  } else if (choice === null) {
    body = (
      <>
        <p className="text-base font-medium text-ink">{t("updates.ask.title")}</p>
        <p className="mt-1 text-sm text-ink-2">{t("updates.ask.body")}</p>
        <div className="mt-3 flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setAutoUpdate("off")}>
            {t("updates.ask.no")}
          </Button>
          <Button size="sm" variant="primary" onClick={() => setAutoUpdate("on")}>
            {t("updates.ask.yes")}
          </Button>
        </div>
      </>
    );
  } else if (found && !later) {
    body = (
      <>
        <p className="text-base font-medium text-ink">
          {t("updates.ready", { version: found.version })}
        </p>
        <p className="mt-1 text-sm text-ink-2">
          {t(failed ? "updates.failed" : "updates.ready.body")}
        </p>
        <div className="mt-3 flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setLater(true)}>
            {t("updates.later")}
          </Button>
          <Button size="sm" variant="primary" onClick={() => void install(found)}>
            <Download />
            {t("updates.now")}
          </Button>
        </div>
      </>
    );
  }
  if (!body) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 w-[320px] max-w-[calc(100vw-32px)] animate-entry-in rounded-lg border border-line bg-panel px-4 py-3 shadow-lg"
    >
      {body}
    </div>
  );
}
