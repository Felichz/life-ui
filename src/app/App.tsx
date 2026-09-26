import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ISystemCore } from "../types";
import { ErrorBoundary } from "./components/ErrorBoundary";
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

export function AppProviders({ children, core }: { children: ReactNode; core?: ISystemCore }) {
  return (
    <ThemeProvider>
      <SystemProvider core={core}>
        <TooltipProvider delayDuration={400} skipDelayDuration={200}>
          <ToastProvider>
            <ClosingFlowProvider>{children}</ClosingFlowProvider>
          </ToastProvider>
        </TooltipProvider>
      </SystemProvider>
    </ThemeProvider>
  );
}

export function AppRoutes() {
  return (
    <ShellProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="biblioteca" element={<LibraryPage />} />
          <Route
            path="resumen"
            element={
              <Suspense fallback={<div className="p-10" />}>
                <ReviewPage />
              </Suspense>
            }
          />
          <Route path="ajustes" element={<SettingsPage />} />
          {/* Rutas de la UI anterior */}
          <Route path="start" element={<Navigate to="/" replace />} />
          <Route path="overview" element={<Navigate to="/resumen" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ShellProvider>
  );
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
