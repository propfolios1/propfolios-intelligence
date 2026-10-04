/**
 * Outbound HTTP for integrations: a timeout on every call, retries with
 * exponential backoff on 429 and 5xx (honouring Retry-After), and errors that
 * name the provider and status so they read well in job logs.
 */
export class IntegrationError extends Error {
  constructor(
    public provider: string,
    public status: number,
    message: string,
    public body?: string,
  ) {
    super(`${provider}: ${message}`);
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, unknown> | unknown[];
  timeoutMs?: number;
  retries?: number;
  form?: Record<string, string>;
  /** An undici dispatcher, for mutual TLS. */
  dispatcher?: unknown;
  /** Fetch implementation; undici's own fetch is used with a dispatcher. */
  fetcher?: typeof fetch;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function request<T = unknown>(provider: string, url: string, opts: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 15_000, retries = 2, form, body, headers, dispatcher, fetcher, ...rest } = opts;
  const h = new Headers(headers);
  let payload: BodyInit | undefined;
  if (form) {
    payload = new URLSearchParams(form).toString();
    h.set("content-type", "application/x-www-form-urlencoded");
  } else if (body !== undefined && (typeof body === "string" || body instanceof URLSearchParams || body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer)) {
    payload = body as BodyInit;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    if (!h.has("content-type")) h.set("content-type", "application/json");
  }
  if (!h.has("accept")) h.set("accept", "application/json");
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await (fetcher ?? fetch)(url, { ...rest, headers: h, body: payload, signal: ctrl.signal, ...(dispatcher ? { dispatcher } : {}) } as RequestInit);
    } catch (e) {
      clearTimeout(timer);
      if (attempt < retries) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      throw new IntegrationError(provider, 0, e instanceof Error && e.name === "AbortError" ? `no response within ${timeoutMs / 1000} seconds` : "could not be reached");
    }
    clearTimeout(timer);
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const after = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(after) && after > 0 ? Math.min(after, 10) * 1000 : 400 * 2 ** attempt);
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 300);
      try {
        const j = JSON.parse(text) as { message?: string; error?: string | { message?: string }; error_description?: string; errorMessage?: string };
        detail = j.error_description ?? j.message ?? j.errorMessage ?? (typeof j.error === "string" ? j.error : j.error?.message) ?? detail;
      } catch {
        // not JSON; keep the raw excerpt
      }
      throw new IntegrationError(provider, res.status, res.status === 401 || res.status === 403 ? `rejected the credentials (${res.status}). ${detail}`.trim() : `returned ${res.status}. ${detail}`.trim(), text);
    }
    if (!text) return undefined as T;
    const type = res.headers.get("content-type") ?? "";
    return (type.includes("json") || /^[[{]/.test(text.trim()) ? JSON.parse(text) : text) as T;
  }
}
