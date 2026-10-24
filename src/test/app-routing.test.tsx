import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("requires the authenticated parent for every SCL Audit page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of ["/", "/importar", "/tendencia", "/contestacao", "/configuracoes", "/franquia/00000000-0000-0000-0000-000000000000/2026-10"]) {
      expect(router.matchRoutes(path).map((match) => match.routeId)).toContain("/_authenticated");
    }
  });

  it("keeps login and password recovery accessible without the authenticated parent", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of ["/login", "/reset-password"]) {
      const ids = router.matchRoutes(path).map((match) => match.routeId);
      expect(ids).not.toContain("/_authenticated");
      expect(ids.at(-1)).toBe(path);
    }
  });
});
