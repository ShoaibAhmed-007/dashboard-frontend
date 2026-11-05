import { getAccessToken } from "@/stores/auth.store";

export class AiHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AiHttpError";
  }
}

/** Shared by every `/api/chat/*` proxy route caller — attaches the bearer
 * token these Next.js routes require. */
export function aiFetch(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const token = getAccessToken();
  return fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    },
    body: JSON.stringify(body),
    signal,
  });
}

export async function throwAiHttpError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new AiHttpError(body.error ?? `${fallback} (${res.status})`, res.status);
}
