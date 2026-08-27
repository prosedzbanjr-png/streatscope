"use client";

import { useEffect, useRef } from "react";
import { getSupabase, SUPABASE_WRITE_EVENT } from "../../lib/supabase";

type Mode = "culture" | "guide";
type WriteDetail = { url?: string; method?: string; body?: string; result?: unknown };

function parseId(value: unknown, url: string) {
  const rows = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  const fromBody = Number((rows[0] as { id?: unknown } | undefined)?.id);
  if (Number.isInteger(fromBody) && fromBody > 0) return fromBody;
  try {
    const raw = new URL(url).searchParams.get("id") || "";
    const matched = raw.match(/^eq\.(\d+)$/);
    const fromUrl = matched ? Number(matched[1]) : 0;
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : 0;
  } catch {
    return 0;
  }
}

export default function ReviewDiscordNotifier({ mode }: { mode: Mode }) {
  const sentRef = useRef(new Set<string>());

  useEffect(() => {
    const table = mode === "culture" ? "street_features" : "guide_places";

    const onWrite = (event: Event) => {
      const detail = (event as CustomEvent<WriteDetail>).detail || {};
      const url = String(detail.url || "");
      if (!url.includes(`/rest/v1/${table}`) || !detail.body) return;

      let payload: Record<string, unknown> = {};
      try {
        const decoded = JSON.parse(detail.body);
        payload = Array.isArray(decoded) ? (decoded[0] || {}) : decoded;
      } catch {
        return;
      }

      if (String(payload.review_status || "").toLowerCase() !== "review") return;

      const id = parseId(detail.result, url);
      const title = mode === "culture" ? String(payload.title || "") : String(payload.name || "");
      const subtitle = mode === "culture" ? String(payload.subtitle || "") : String(payload.short_description || "");
      const featureKind = mode === "culture" ? String(payload.kind || "") : "";
      const dedupeKey = `${table}:${id || title}:${String(payload.updated_at || "")}`;
      if (sentRef.current.has(dedupeKey)) return;
      sentRef.current.add(dedupeKey);

      void (async () => {
        try {
          const sb = getSupabase();
          const { data } = await sb.auth.getSession();
          const token = data.session?.access_token;
          if (!token) return;
          await fetch("/api/discord", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              event: "review",
              kind: mode === "culture" ? "feature" : "guide",
              entityId: id || undefined,
              title,
              subtitle,
              featureKind,
            }),
          });
        } catch {
          // Powiadomienie Discord nie może blokować zapisu materiału.
        }
      })();
    };

    window.addEventListener(SUPABASE_WRITE_EVENT, onWrite);
    return () => window.removeEventListener(SUPABASE_WRITE_EVENT, onWrite);
  }, [mode]);

  return null;
}
