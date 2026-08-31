"use client";

import { ReactNode, useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import MarketImageManager from "./market-image-manager";

const MARKET_ROLES = new Set(["editor_in_chief", "deputy_editor_in_chief", "dealer"]);

export default function MarketAdminLayout({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const client = getSupabase();
    client.auth.getUser().then(async ({ data }) => {
      const email = data.user?.email?.toLowerCase() || "";
      if (!email) {
        setAllowed(false);
        window.location.replace("/redakcja/logowanie");
        return;
      }

      const { data: person } = await client
        .from("staff_accounts")
        .select("role,active")
        .eq("email", email)
        .maybeSingle();

      const ok = Boolean(person?.active && MARKET_ROLES.has(person.role));
      setAllowed(ok);

      if (!ok) window.location.replace("/redakcja");
    });
  }, []);

  if (allowed === null) {
    return <main style={{minHeight:"100vh",background:"#111",color:"#fff",display:"grid",placeItems:"center",fontFamily:"Arial,sans-serif",fontWeight:900}}>SPRAWDZAM DOSTĘP…</main>;
  }

  if (!allowed) {
    return <main style={{minHeight:"100vh",background:"#111",color:"#fff",display:"grid",placeItems:"center",fontFamily:"Arial,sans-serif",fontWeight:900}}>BRAK DOSTĘPU.</main>;
  }

  return <>{children}<MarketImageManager /></>;
}
