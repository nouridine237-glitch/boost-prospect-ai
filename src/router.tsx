import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

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
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
