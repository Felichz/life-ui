import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { enableFileStorage, isDesktop } from "./app/platform/desktop";
import "./app/styles.css";

async function boot() {
  // Dev only: `?desktop-mock` stands in for the desktop shell in a plain browser
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("desktop-mock")) {
    const { installDesktopMock } = await import("./app/platform/desktopMock");
    installDesktopMock();
  }
  // The desktop app keeps its state in a file; it must be read before the core starts
  if (isDesktop()) await enableFileStorage();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void boot();
