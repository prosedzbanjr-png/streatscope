import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_WRITE_EVENT = "streetscope:supabase-write";

let client: SupabaseClient | null = null;

function instrumentedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = String(init?.method || request?.method || "GET").toUpperCase();
  const isRestWrite = requestUrl.includes("/rest/v1/") && (method === "POST" || method === "PATCH");
  const bodyPromise = isRestWrite
    ? typeof init?.body === "string"
      ? Promise.resolve(init.body)
      : request
        ? request.clone().text().catch(() => "")
        : Promise.resolve("")
    : Promise.resolve("");

  return globalThis.fetch(input, init).then(response => {
    if (typeof window !== "undefined" && isRestWrite && response.ok) {
      const copy = response.clone();
      void Promise.all([
        bodyPromise,
        copy.json().catch(() => null),
      ]).then(([body, result]) => {
        window.dispatchEvent(new CustomEvent(SUPABASE_WRITE_EVENT, {
          detail: { url: requestUrl, method, body, result },
        }));
      });
    }
    return response;
  });
}

export function getSupabase() {
  if (!url || !key) {
    throw new Error("Brakuje konfiguracji Supabase.");
  }

  if (!client) {
    client = createClient(url, key, { global: { fetch: instrumentedFetch } });
  }

  return client;
}
