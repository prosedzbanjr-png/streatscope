import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dedupeArticleTextBlocks } from "./dedupe-article-body";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_WRITE_EVENT = "streetscope:supabase-write";

let client: SupabaseClient | null = null;

function headerValue(headers: HeadersInit | undefined, name: string) {
  if (!headers) return "";
  const normalized = name.toLowerCase();
  if (headers instanceof Headers) return headers.get(name) || "";
  if (Array.isArray(headers)) return headers.find(([key]) => key.toLowerCase() === normalized)?.[1] || "";
  const record = headers as Record<string,string>;
  const keyName = Object.keys(record).find(key => key.toLowerCase() === normalized);
  return keyName ? String(record[keyName] || "") : "";
}

function parseReviewWrite(requestUrl: string, body: string) {
  if (typeof window === "undefined" || !body) return null;
  const isFeature = requestUrl.includes("/rest/v1/street_features");
  const isGuide = requestUrl.includes("/rest/v1/guide_places");
  if (!isFeature && !isGuide) return null;
  try {
    const decoded = JSON.parse(body);
    const payload = (Array.isArray(decoded) ? decoded[0] : decoded) as Record<string,unknown>;
    if (!payload || String(payload.review_status || "").toLowerCase() !== "review") return null;
    const parsed = new URL(requestUrl);
    const match = (parsed.searchParams.get("id") || "").match(/^eq\.(\d+)$/);
    return {
      kind: isFeature ? "feature" as const : "guide" as const,
      id: match ? Number(match[1]) : 0,
      payload,
      wantsSingle: parsed.searchParams.has("select") || requestUrl.includes("select=id"),
    };
  } catch {
    return null;
  }
}

function cleanArticleWriteBody(requestUrl: string, body: string) {
  if (!body || !requestUrl.includes("/rest/v1/articles")) return body;
  try {
    const decoded = JSON.parse(body);
    const rows = Array.isArray(decoded) ? decoded : [decoded];
    let changed = false;
    const cleaned = rows.map(row => {
      if (!row || typeof row !== "object") return row;
      const record = row as Record<string, unknown>;
      if (typeof record.body !== "string") return row;
      const nextBody = dedupeArticleTextBlocks(record.body);
      if (nextBody === record.body) return row;
      changed = true;
      return { ...record, body: nextBody };
    });
    if (!changed) return body;
    return JSON.stringify(Array.isArray(decoded) ? cleaned : cleaned[0]);
  } catch {
    return body;
  }
}

async function serverReviewWrite(init: RequestInit | undefined, request: Request | null, requestUrl: string, body: string) {
  const review = parseReviewWrite(requestUrl, body);
  if (!review) return null;

  const auth = headerValue(init?.headers, "authorization") || request?.headers.get("authorization") || "";
  if (!auth) return null;

  const response = await globalThis.fetch(`${window.location.origin}/api/redakcja/submit-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ kind: review.kind, id: review.id || undefined, payload: review.payload }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as { id?:number; message?:string; error?:string };

  if (!response.ok || !result.id) {
    const message = result.message || result.error || `Nie udało się wysłać materiału do akceptacji (${response.status}).`;
    return new Response(JSON.stringify({ message, details:null, hint:null, code:"review_submit_failed" }), {
      status: response.status || 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (review.wantsSingle) {
    return new Response(JSON.stringify({ id: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Range": "0-0/*" },
    });
  }
  return new Response(null, { status: 204 });
}

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

  return bodyPromise.then(async originalBody => {
    const body = cleanArticleWriteBody(requestUrl, originalBody);
    if (body !== originalBody && typeof init?.body === "string") {
      init = { ...init, body };
    }

    if (isRestWrite) {
      const handled = await serverReviewWrite(init, request, requestUrl, body);
      if (handled) return handled;
    }

    const response = await globalThis.fetch(input, init);
    if (typeof window !== "undefined" && isRestWrite && response.ok) {
      const copy = response.clone();
      void copy.json().catch(() => null).then(result => {
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
