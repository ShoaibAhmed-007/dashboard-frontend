"use client";

import { useState } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { makeQueryClient } from "@/lib/queryClient";
import { createIDBPersister, QUERY_CACHE_BUSTER } from "@/lib/queryPersister";

// Only task/list/board-related queries are persisted across a browser refresh.
// Everything else (auth, profile, university, etc.) stays in-memory only.
//
// Deliberately NOT persisted: "projects", "workspace-members" and "my-tasks".
// All three are access-controlled — their contents depend on the caller's
// permissions — so persisting them caches an authorization decision. A user
// removed from a project, or one who gains access when a project turns PUBLIC,
// kept seeing the old result for up to `maxAge` (24h), because the restored
// cache is served before the refetch settles.
//
// "my-tasks" is the subtle one: it looks like personal content, but it is a
// cross-project query, so it can hold tasks from a project that has since gone
// PRIVATE. Those rows render and then 404 on open — visible as a row you
// cannot click into. All three refetch in milliseconds, so the offline benefit
// never justified showing a stale view of what someone may access.
const PERSISTED_KEY_PREFIXES = new Set([
  "task-lists",
  "task-board",
  "task-board-infinite",
  "statuses",
  "tags",
]);

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  const [persister] = useState(() => createIDBPersister());

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h — evict older persisted cache
        buster: QUERY_CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const root = query.queryKey[0];
            return (
              query.state.status === "success" &&
              typeof root === "string" &&
              PERSISTED_KEY_PREFIXES.has(root)
            );
          },
        },
      }}
    >
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </PersistQueryClientProvider>
  );
}
