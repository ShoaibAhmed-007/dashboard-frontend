import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    // src/lib/api.ts already owns single-flight refresh-and-retry for 401s.
    // Letting React Query retry too would race the redirect-to-login.
    return false;
  }
  return failureCount < 1;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Structural data changes rarely and realtime updates arrive via
        // SSE/sockets, so keep data fresh for a minute and don't refetch just
        // because the tab regained focus. Persistence (IndexedDB) covers reloads.
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        retry: shouldRetry,
        retryDelay: 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
