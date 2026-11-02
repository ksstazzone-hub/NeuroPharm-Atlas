const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

let nextRequestAt = 0;

function waitForRateLimit(): Promise<void> {
  const interval = process.env.NCBI_API_KEY ? 110 : 350;
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + interval;
  return wait === 0
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, wait));
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? Math.min(retryAfter * 1000, 10_000)
    : 500 * 2 ** attempt;
}

export async function eutilsJson<T>(
  endpoint: string,
  parameters: Record<string, string>,
): Promise<T> {
  const url = new URL(`${EUTILS_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("tool", "neuropharm_atlas");

  if (process.env.NCBI_EMAIL) {
    url.searchParams.set("email", process.env.NCBI_EMAIL);
  }
  if (process.env.NCBI_API_KEY) {
    url.searchParams.set("api_key", process.env.NCBI_API_KEY);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForRateLimit();
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      if (attempt === 2) {
        throw new Error("NCBI no respondió dentro del tiempo esperado.", {
          cause: error,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay(response, attempt)),
      );
      continue;
    }

    throw new Error(`NCBI E-utilities respondió HTTP ${response.status}.`);
  }

  throw new Error("No fue posible consultar NCBI E-utilities.");
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}