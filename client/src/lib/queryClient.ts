import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  return res; // let the caller decide what to do with non-ok responses
}

type UnauthorizedBehavior = "returnNull" | "throw" | "logout";

/**
 * Default query function.
 * on401="logout" — when the server returns 401, call the global
 * unauthorizedHandler (set by AuthProvider) to force logout immediately.
 * This prevents a stale/expired token from rendering another user's data.
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey[0]}`, {
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") return null;
      if (unauthorizedBehavior === "logout") {
        // Notify AuthContext to log the user out
        unauthorizedHandler?.();
        return null;
      }
      await throwIfResNotOk(res); // "throw"
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Global unauthorized handler — set by AuthProvider on mount.
 * Allows queryClient to trigger logout without a direct import cycle.
 */
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "logout" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
