import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { hydrateLocalState } from "./lib/localBridge";
import "./styles.css";

async function boot() {
  await hydrateLocalState();
  const { App } = await import("./App");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();

// Offline support (production only): the service worker caches the app
// shell, corpus JSON, and fonts after the first visit. Dev stays uncached.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        // Offline caching is an enhancement; the app works without it.
      });
  });
}
