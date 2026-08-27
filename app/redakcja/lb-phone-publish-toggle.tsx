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
  const [previewId, setPreviewId] = useState(0);
  const armedRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => { armedRef.current = armed; }, [armed]);

  useEffect(() => {
    if (mode !== "article" || typeof window === "undefined") return;
    const id = Number(new URLSearchParams(window.location.search).get("id"));
    if (Number.isInteger(id) && id > 0) setPreviewId(id);
  }, [mode]);

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
        setAllowed(Boolean(staff?.active && ["editor_in_chief", "deputy_editor_in_chief"].includes(String(staff?.role || ""))));
      } catch { if (active) setAllowed(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!allowed || typeof window === "undefined") return;
    const table = mode === "article" ? "articles" : mode === "culture" ? "street_features" : "guide_places";

    const onWrite = (event: Event) => {
      const detail = (event as CustomEvent<WriteDetail>).detail || {};
      const url = String(detail.url || "");

      if (mode === "article" && url.includes("/rest/v1/articles")) {
        const writtenId = parseEntityId(detail.result, url);
        if (writtenId) setPreviewId(writtenId);
      }

      if (!armedRef.current || sendingRef.current || !detail.body) return;
      if (!url.includes(`/rest/v1/${table}`)) return;

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

  const openHiddenPreview = () => {
    if (!previewId) {
      setNote("Najpierw zapisz materiał jako szkic. Potem otworzysz go w ukrytym widoku strony.");
      return;
    }
    window.open(`/artykul/${previewId}?preview=1`, "_blank", "noopener,noreferrer");
  };

  return <aside className="lb-phone-publish-toggle" aria-live="polite">
    {mode === "article" && <div className="hidden-preview-control">
      <button type="button" onClick={openHiddenPreview}>UKRYTY PODGLĄD ↗</button>
      <small>Otwiera prawdziwy widok artykułu. Materiał pozostaje ukryty i nie trafia na stronę główną.</small>
    </div>}
    <label>
      <input type="checkbox" checked={armed} onChange={event => { setArmed(event.target.checked); setNote(event.target.checked ? "Po publikacji push trafi do kolejki Supabase." : ""); }} />
      <span><b>POWIADOM LB PHONE</b><small>Po publikacji dodaj mieszkańcom push do kolejki Supabase.</small></span>
    </label>
    {note && <p>{note}</p>}
  </aside>;
}
