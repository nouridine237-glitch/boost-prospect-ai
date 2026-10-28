import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createElement } from "react";

function PagePending() {
  return createElement("div", { className: "page-pending", role: "status", "aria-label": "Chargement" });
}

// After a new deploy, old hashed chunks disappear: reload once to fetch the fresh version.
function reloadOnStaleChunk() {
  const key = "mlm-chunk-reload";
  const last = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem(key, String(Date.now()));
  window.location.reload();
}
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnStaleChunk(); });
  const isChunkError = (m: unknown) => /reading 'component'|dynamically imported module|Importing a module script failed|error loading dynamically/i.test(String(m));
  window.addEventListener("unhandledrejection", (e) => { if (isChunkError((e.reason as Error)?.message ?? e.reason)) reloadOnStaleChunk(); });
  window.addEventListener("error", (e) => { if (isChunkError(e.message)) reloadOnStaleChunk(); });
}

export const getRouter = () => {
  // "JWT issued at future" (PGRST303) happens when the device clock is slightly
  // behind the server right after sign-in; retrying after a short delay succeeds.
  const isClockSkew = (e: unknown) =>
    !!e && typeof e === "object" && ((e as { code?: string }).code === "PGRST303" ||
      /issued at future/i.test(String((e as { message?: string }).message ?? "")));
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) => (isClockSkew(error) ? count < 5 : count < 3),
        retryDelay: (count, error) => (isClockSkew(error) ? 1500 * (count + 1) : Math.min(1000 * 2 ** count, 8000)),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
    defaultPendingComponent: PagePending,
    defaultPendingMs: 150,
  });

  return router;
};
