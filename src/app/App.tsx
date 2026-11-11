import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import type { ISystemCore } from "../types";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ModelGate } from "./runtime/ModelGate";
import { AgentProvider } from "./agent/AgentProvider";
import type { ChatFn } from "./agent/agent";
import { LocaleProvider, type Locale } from "./i18n";
import { TooltipProvider } from "./components/ui/Tooltip";
import { LibraryPage } from "./features/library/LibraryPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { TodayPage } from "./features/today/TodayPage";
import { AppShell } from "./shell/AppShell";
import { ShellProvider } from "./shell/ShellContext";
import { ClosingFlowProvider } from "./state/closing";
import { SystemProvider } from "./state/system";
import { ThemeProvider } from "./state/theme";
import { ToastProvider } from "./state/toast";

const loadReview = () => import("./features/review/ReviewPage");
const ReviewPage = lazy(() => loadReview().then((module) => ({ default: module.ReviewPage })));

export function AppProviders({
  children,
  core,
  locale,
  agentChat,
}: {
  children: ReactNode;
  core?: ISystemCore;
  /** Pins the language (tests); otherwise it is detected and remembered. */
  locale?: Locale;
  /** A scripted model for the agent (tests); otherwise the loaded model. */
  agentChat?: ChatFn;
}) {
  return (
    <LocaleProvider initial={locale}>
      <ThemeProvider>
        <SystemProvider core={core}>
          <TooltipProvider delayDuration={400} skipDelayDuration={200}>
            <ToastProvider>
              <ClosingFlowProvider>
                {/* The web build and tests skip the model gate: no local model there */}
                <ModelGate>
                  <AgentProvider chat={agentChat}>{children}</AgentProvider>
                </ModelGate>
              </ClosingFlowProvider>
            </ToastProvider>
          </TooltipProvider>
        </SystemProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}

export function AppRoutes() {
  return (
    <ShellProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route
            path="review"
            element={
              <Suspense fallback={<div className="p-10" />}>
                <ReviewPage />
              </Suspense>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          {/* Legacy routes (Spanish ones and from the first UI) */}
          <Route path="biblioteca" element={<Navigate to="/library" replace />} />
          <Route path="resumen" element={<LegacyReviewRedirect />} />
          <Route path="ajustes" element={<Navigate to="/settings" replace />} />
          <Route path="start" element={<Navigate to="/" replace />} />
          <Route path="overview" element={<Navigate to="/review" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ShellProvider>
  );
}

/** /resumen?dia=… → /review?day=… */
function LegacyReviewRedirect() {
  const [params] = useSearchParams();
  const day = params.get("dia");
  return <Navigate to={day ? `/review?day=${day}` : "/review"} replace />;
}

export default function App() {
  // Preload Review in the background so opening it doesn't show a blank gap
  useEffect(() => {
    const timer = window.setTimeout(() => void loadReview(), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <AppProviders>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  );
}
