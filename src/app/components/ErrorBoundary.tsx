import { Component, type ErrorInfo, type ReactNode } from "react";
import { STORAGE_KEY } from "../../system/persistenceManager";

/**
 * Si un render falla, en vez de una pantalla en blanco se ofrece recargar y
 * descargar los datos tal como están guardados (nunca se pierden por esto).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("La interfaz falló al renderizar", error, info.componentStack);
  }

  private download = () => {
    let data = "{}";
    try {
      data = localStorage.getItem(STORAGE_KEY) ?? "{}";
    } catch {
      // sin acceso al almacenamiento
    }
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `qualia-control-rescate-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold text-ink">Algo se rompió en la pantalla</h1>
        <p className="mt-2 text-base text-ink-2">
          Tus datos siguen guardados en este navegador. Recarga para seguir; si vuelve a pasar,
          descarga una copia antes de probar otra cosa.
        </p>
        <p className="mt-3 rounded-md bg-subtle px-3 py-2 font-mono text-xs text-ink-2">
          {this.state.error.message}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-9 rounded bg-accent-fill px-4 text-sm font-medium text-white hover:bg-accent-fill-hover"
          >
            Recargar
          </button>
          <button
            type="button"
            onClick={this.download}
            className="h-9 rounded border border-line bg-panel px-4 text-sm font-medium text-ink hover:bg-subtle"
          >
            Descargar mis datos
          </button>
        </div>
      </div>
    );
  }
}
