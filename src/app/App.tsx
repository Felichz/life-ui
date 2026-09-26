import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import type { ISystemCore } from "../types";
import { ErrorBoundary } from "./components/ErrorBoundary";
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

const ReviewPage = lazy(() =>
  import("./features/review/ReviewPage").then((module) => ({ default: module.ReviewPage }))
);

export function AppProviders({
  children,
  core,
  locale,
}: {
  children: ReactNode;
  core?: ISystemCore;
  /** Fija el idioma (tests); si no, se detecta y se recuerda. */
  locale?: Locale;
}) {
  return (
    <LocaleProvider initial={locale}>
      <ThemeProvider>
        <SystemProvider core={core}>
          <TooltipProvider delayDuration={400} skipDelayDuration={200}>
            <ToastProvider>
              <ClosingFlowProvider>{children}</ClosingFlowProvider>
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
          {/* Rutas anteriores (en español y de la primera UI) */}
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
