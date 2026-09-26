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
      <PageHeader title="Ajustes" />
      <div className="mt-6">
        <TargetSection />
        <AppearanceSection />
        <Section title="Atajos de teclado" description="Para moverte sin soltar el teclado.">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2.5 text-base">
            {[
              [[modKeyLabel, "K"], "Buscar o ejecutar cualquier cosa"],
              [["N"], "Añadir actividad al plan"],
              [["E"], "Registrar un evento"],
              [["T"], "Terminar la actividad en marcha"],
              [["G", "H"], "Ir a Hoy (G + B, R, A para el resto)"],
              [["0–9"], "Elegir satisfacción en el cierre"],
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
      setError("Tiene que ser un número entero mayor que 0.");
      return;
    }
    try {
      core.updateDailyTempoTarget(parsed);
      setError(null);
      toast({ title: "Referencia actualizada", description: `${parsed} tempos al día.` });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <Section
      title="Referencia diaria"
      description="Un ancla para orientarte, no una meta que debas. Súbela cuando la superes con naturalidad."
    >
      <form onSubmit={save} className="flex flex-col gap-2">
        <label htmlFor="target" className="text-sm font-medium text-ink">
          Tempos por día
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
            Guardar
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
      <div className="mt-5 rounded-lg bg-subtle px-4 py-3.5 text-sm text-ink-2">
        <p className="font-medium text-ink">Cómo se calculan los tempos</p>
        <p className="tabular mt-1.5">
          minutos × satisfacción ÷ {divisor}, redondeado hacia arriba.
        </p>
        <p className="mt-1.5">
          Los minutos son tu estimado si lo hay, o el tiempo real si no. Un {divisor}/10 equivale al
          100%: una tarea de 30 minutos da 30 tempos. Un 0 no suma, y el tiempo libre nunca resta.
        </p>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  return (
    <Section title="Apariencia" description="Sigue a tu sistema o fija un tema.">
      <Segmented<ThemePreference>
        label="Tema"
        value={preference}
        onChange={setPreference}
        options={[
          { value: "system", label: "Sistema", icon: <Monitor /> },
          { value: "light", label: "Claro", icon: <Sun /> },
          { value: "dark", label: "Oscuro", icon: <Moon /> },
        ]}
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
    link.download = `qualia-control-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Copia descargada" });
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
      toast({ title: "Datos importados" });
      setPendingImport(null);
      navigate("/");
    } catch (caught) {
      toast({
        tone: "error",
        title: "No se pudo importar",
        description: errorMessage(caught, "El archivo no es una copia válida"),
      });
      setPendingImport(null);
    }
  };

  const confirmClear = () => {
    core.clearState();
    setClearing(false);
    setConfirmText("");
    toast({ title: "Datos borrados", description: "Empiezas de cero." });
    navigate("/");
  };

  return (
    <Section
      title="Tus datos"
      description="Todo vive en este navegador. Descarga una copia de vez en cuando."
    >
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel shadow-xs">
        <Row
          title="Exportar"
          body={`${state.global.days.length} días, ${state.global.completedActivityRecords.length} cierres y tu biblioteca, en un archivo JSON.`}
          action={
            <Button variant="secondary" onClick={exportData}>
              <Download />
              Descargar
            </Button>
          }
        />
        <Row
          title="Importar"
          body="Reemplaza todo lo que hay aquí por una copia descargada antes."
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
                Elegir archivo
              </Button>
            </>
          }
        />
        <Row
          title="Borrar todo"
          body="Elimina días, cierres, biblioteca y bloques de este navegador. No se puede deshacer."
          action={
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => setClearing(true)}
            >
              <Trash2 />
              Borrar
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
            <DialogTitle>¿Importar «{pendingImport?.name}»?</DialogTitle>
            <DialogDescription>
              Reemplazará todos los datos actuales. Si dudas, exporta una copia antes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingImport(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmImport}>
              Importar y reemplazar
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
            <DialogTitle>¿Borrar todos tus datos?</DialogTitle>
            <DialogDescription>
              No se puede deshacer. Escribe «borrar» para confirmar.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="pb-4">
            <Input
              autoFocus
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              aria-label="Escribe borrar para confirmar"
              placeholder="borrar"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setClearing(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={confirmText.trim().toLowerCase() !== "borrar"}
              onClick={confirmClear}
            >
              Borrar todo
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
