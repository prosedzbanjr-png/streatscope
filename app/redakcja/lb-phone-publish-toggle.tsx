"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase, SUPABASE_WRITE_EVENT } from "../../lib/supabase";
import "./lb-phone-publish-toggle.css";

type EditorMode = "article" | "culture" | "guide";
type PublishKind = "article" | "fashion" | "motor" | "guide";
type WriteDetail = { url?: string; method?: string; body?: string; result?: unknown };
type Props = { mode: EditorMode };

function parseEntityId(value: unknown, url: string) {
  const rows = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  const fromBody = Number((rows[0] as { id?: unknown } | undefined)?.id);
  if (Number.isInteger(fromBody) && fromBody > 0) return fromBody;
  try {
    const raw = new URL(url).searchParams.get("id") || "";
    const matched = raw.match(/^eq\.(\d+)$/);
    const fromUrl = matched ? Number(matched[1]) : 0;
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : 0;
  } catch { return 0; }
}

export default function LbPhonePublishToggle({ mode }: Props) {
  const [allowed, setAllowed] = useState(false);
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState("");
  const armedRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => { armedRef.current = armed; }, [armed]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sb = getSupabase();
        const { data } = await sb.auth.getUser();
        const email = data.user?.email?.toLowerCase() || "";
        if (!email) return;
        const { data: staff } = await sb.from("staff_accounts").select("active,role").eq("email", email).maybeSingle();
        if (!active) return;
        const canManage = Boolean(staff?.active && ["editor_in_chief", "deputy_editor_in_chief"].includes(String(staff?.role || "")));
        setAllowed(canManage);

        if (canManage && typeof window !== "undefined" && sessionStorage.getItem("streetscope-lb-image-sync-v2") !== "done") {
          const { data: sessionData } = await sb.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) {
            const sync = await fetch("/api/lb-phone/sync-image-tracking", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => null);
            if (sync?.ok) sessionStorage.setItem("streetscope-lb-image-sync-v2", "done");
          }
        }
      } catch { if (active) setAllowed(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!allowed || typeof window === "undefined") return;
    const table = mode === "article" ? "articles" : mode === "culture" ? "street_features" : "guide_places";

    const onWrite = (event: Event) => {
      if (!armedRef.current || sendingRef.current) return;
      const detail = (event as CustomEvent<WriteDetail>).detail || {};
      const url = String(detail.url || "");
      if (!url.includes(`/rest/v1/${table}`) || !detail.body) return;

      let payload: Record<string, unknown> = {};
      try {
        const decoded = JSON.parse(detail.body);
        payload = Array.isArray(decoded) ? (decoded[0] || {}) : decoded;
      } catch { return; }

      let kind: PublishKind | null = null;
      let eligible = false;

      if (mode === "article") {
        kind = "article";
        eligible = payload.status === "published";
        const scheduled = typeof payload.scheduled_for === "string" && payload.scheduled_for ? new Date(payload.scheduled_for).getTime() : 0;
        if (eligible && Number.isFinite(scheduled) && scheduled > Date.now() + 5000) {
          armedRef.current = false;
          setArmed(false);
          setNote("Zaplanowany materiał nie trafia do kolejki przed godziną publikacji.");
          return;
        }
      } else if (mode === "culture") {
        const rawKind = String(payload.kind || "");
        if (rawKind === "fashion" || rawKind === "motor") kind = rawKind;
        eligible = Boolean(kind && payload.published === true);
      } else {
        kind = "guide";
        eligible = payload.active === true;
      }

      if (!eligible || !kind) return;
      const id = parseEntityId(detail.result, url);
      if (!id) {
        setNote("Publikacja zapisana, ale nie udało się ustalić ID do powiadomienia.");
        return;
      }

      sendingRef.current = true;
      armedRef.current = false;
      setArmed(false);
      setNote("Dodaję push do kolejki LB Phone…");

      void (async () => {
        try {
          const sb = getSupabase();
          const { data } = await sb.auth.getSession();
          const token = data.session?.access_token;
          if (!token) throw new Error("Sesja redakcji wygasła.");

          const sent = await fetch("/api/lb-phone/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ kind, id }),
          });
          const result = await sent.json().catch(() => null) as { ok?: boolean; queued?: boolean; error?: string } | null;
          if (!sent.ok || !result?.ok) throw new Error(result?.error || `Kolejka LB Phone zwróciła błąd ${sent.status}.`);
          setNote("Push dodany do kolejki. FiveM wyśle go do LB Phone.");
        } catch (error) {
          setNote(error instanceof Error ? `Publikacja zapisana, ale kolejka push nie przyjęła wpisu: ${error.message}` : "Publikacja zapisana, ale nie udało się dodać pushu do kolejki.");
        } finally {
          sendingRef.current = false;
        }
      })();
    };

    window.addEventListener(SUPABASE_WRITE_EVENT, onWrite);
    return () => window.removeEventListener(SUPABASE_WRITE_EVENT, onWrite);
  }, [allowed, mode]);

  if (!allowed) return null;

  return <aside className="lb-phone-publish-toggle" aria-live="polite">
    <label>
      <input type="checkbox" checked={armed} onChange={event => { setArmed(event.target.checked); setNote(event.target.checked ? "Po publikacji push trafi do kolejki Supabase." : ""); }} />
      <span><b>POWIADOM LB PHONE</b><small>Po publikacji dodaj mieszkańcom push do kolejki Supabase.</small></span>
    </label>
    {note && <p>{note}</p>}
  </aside>;
}
