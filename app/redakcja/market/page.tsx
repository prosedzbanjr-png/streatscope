"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import { compressImageForUpload } from "../../../lib/image-optimization";
import "./market-admin.css";

type V = {
  id: number;
  brand: string;
  model: string;
  year: number | null;
  price: number;
  mileage: number | null;
  drivetrain: string | null;
  transmission: string | null;
  engine: string | null;
  color: string | null;
  description: string | null;
  image_url: string | null;
  gallery: string[] | null;
  seller_name: string | null;
  seller_phone: string | null;
  listed_by_name: string | null;
  status: string;
  featured: boolean;
  sale_mode: "sale" | "auction";
};

type MarketApiResult = { ok?: boolean; row?: V; id?: number; token?: string; path?: string; error?: string; message?: string };

const empty = {
  brand: "",
  model: "",
  year: "",
  price: "",
  mileage: "",
  drivetrain: "",
  transmission: "",
  engine: "",
  color: "",
  description: "",
  seller_name: "Tow & Trade",
  seller_phone: "",
  status: "available",
  featured: false,
};

export default function MarketAdmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<V[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);
  const [existingCover, setExistingCover] = useState("");
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [offerSearch, setOfferSearch] = useState("");
  const s = () => getSupabase();

  const load = async () => {
    const { data, error } = await s()
      .from("market_vehicles")
      .select("*")
      .eq("sale_mode", "sale")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Nie udało się odświeżyć listy ofert: ${error.message}`);
    setRows((data as V[] | null) ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await s().auth.getUser();
      if (!data.user) {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      try {
        await load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Nie udało się wczytać ofert.");
      }
    })();
  }, []);

  const valid = (file: File) => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024;

  const marketRequest = async (body: Record<string, unknown>) => {
    const { data } = await s().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

    const response = await fetch("/api/redakcja/market", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const result = (await response.json().catch(() => ({}))) as MarketApiResult;
    if (!response.ok) throw new Error(result.error || result.message || `Serwer zwrócił błąd ${response.status}.`);
    return result;
  };

  const upload = async (file: File) => {
    if (!valid(file)) throw new Error(`Zdjęcie ${file.name} musi być obrazem i mieć maks. 8 MB.`);
    const optimized = await compressImageForUpload(file);
    const path = `market-${Date.now()}-${crypto.randomUUID()}.webp`;
    const signed = await marketRequest({ action: "sign-upload", path });
    if (!signed.token) throw new Error("Serwer nie przygotował tokenu wysyłania zdjęcia.");

    const { error } = await s().storage.from("article-images").uploadToSignedUrl(path, signed.token, optimized, {
      contentType: optimized.type,
      upsert: false,
    });
    if (error) throw new Error(`Nie udało się wysłać zdjęcia ${file.name}: ${error.message}`);
    return s().storage.from("article-images").getPublicUrl(path).data.publicUrl;
  };

  const onCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && !valid(file)) {
      setCover(null);
      setMessage(`Okładka ${file.name} jest nieprawidłowa. Dozwolony jest obraz do 8 MB.`);
      event.target.value = "";
      return;
    }
    setCover(file);
    if (file) setMessage(`Wybrano okładkę: ${file.name}`);
  };

  const onGallery = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    const invalid = selected.filter(file => !valid(file));
    const files = selected.filter(valid);
    const room = Math.max(0, 8 - existingGallery.length);
    setGallery(files.slice(0, room));
    if (invalid.length) setMessage(`Pominięto ${invalid.length} zdjęć: plik musi być obrazem do 8 MB.`);
    else if (files.length > room) setMessage(`Galeria może mieć maksymalnie 8 zdjęć. Dodano ${room}.`);
    else if (files.length) setMessage(`Wybrano ${files.length} zdjęć do galerii.`);
    event.target.value = "";
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(editing ? "ZAPISUJĘ ZMIANY…" : "WYSYŁAM ZDJĘCIA I ZAPISUJĘ OFERTĘ…");
    try {
      if (!form.price || Number(form.price) <= 0) throw new Error("Ustaw cenę sprzedaży.");

      const image_url = cover ? await upload(cover) : existingCover || null;
      const fresh: string[] = [];
      for (let index = 0; index < gallery.length; index += 1) {
        setMessage(`WYSYŁAM ZDJĘCIA… ${index + 1}/${gallery.length}${cover ? " + OKŁADKA" : ""}`);
        fresh.push(await upload(gallery[index]));
      }

      setMessage(editing ? "ZAPISUJĘ ZMIANY W BAZIE…" : "ZAPISUJĘ OFERTĘ W BAZIE…");
      const payload = {
        brand: form.brand,
        model: form.model,
        year: form.year ? Number(form.year) : null,
        price: Number(form.price) || 0,
        mileage: form.mileage ? Number(form.mileage) : null,
        drivetrain: form.drivetrain || null,
        transmission: form.transmission || null,
        engine: form.engine || null,
        color: form.color || null,
        description: form.description || null,
        image_url,
        gallery: [...existingGallery, ...fresh].slice(0, 8),
        seller_name: form.seller_name || "Tow & Trade",
        seller_phone: form.seller_phone || null,
        status: form.status,
        featured: Boolean(form.featured),
      };

      const result = await marketRequest({ action: "save", id: editing || undefined, payload });
      if (!result.row?.id) throw new Error("Serwer nie potwierdził zapisanej oferty.");

      const success = editing ? "OFERTA ZAKTUALIZOWANA." : `OFERTA WYSTAWIONA. ID #${result.row.id}.`;
      setForm(empty);
      setEditing(null);
      setCover(null);
      setGallery([]);
      setExistingCover("");
      setExistingGallery([]);

      try {
        await load();
        setMessage(success);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Nie udało się odświeżyć listy.";
        setMessage(`${success} ${detail}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? `BŁĄD: ${error.message}` : "BŁĄD: Nie udało się zapisać oferty.");
    } finally {
      setBusy(false);
    }
  };

  const edit = (vehicle: V) => {
    setMessage(`EDYTUJESZ: ${vehicle.brand} ${vehicle.model}`);
    setEditing(vehicle.id);
    setForm({ ...vehicle, year: vehicle.year ?? "", mileage: vehicle.mileage ?? "" });
    setExistingCover(vehicle.image_url || "");
    setExistingGallery(vehicle.gallery || []);
    setCover(null);
    setGallery([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setStatus = async (vehicle: V, status: string) => {
    setBusy(true);
    setMessage("ZAPISUJĘ STATUS…");
    try {
      await marketRequest({ action: "status", id: vehicle.id, payload: { status } });
      setRows(prev => prev.map(row => (row.id === vehicle.id ? { ...row, status } : row)));
      setMessage(`${vehicle.brand} ${vehicle.model}: status zmieniony.`);
    } catch (error) {
      setMessage(error instanceof Error ? `BŁĄD: ${error.message}` : "Nie udało się zmienić statusu.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (vehicle: V) => {
    if (!window.confirm(`Usunąć ${vehicle.brand} ${vehicle.model}? Tej operacji nie można cofnąć.`)) return;
    setBusy(true);
    setMessage("USUWAM OFERTĘ…");
    try {
      await marketRequest({ action: "delete", id: vehicle.id });
      setRows(prev => prev.filter(row => row.id !== vehicle.id));
      if (editing === vehicle.id) {
        setEditing(null);
        setForm(empty);
        setExistingCover("");
        setExistingGallery([]);
      }
      setMessage(`${vehicle.brand} ${vehicle.model}: USUNIĘTO.`);
    } catch (error) {
      setMessage(error instanceof Error ? `BŁĄD: ${error.message}` : "Nie udało się usunąć oferty.");
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(empty);
    setExistingCover("");
    setExistingGallery([]);
    setCover(null);
    setGallery([]);
    setMessage("");
  };

  if (allowed === null) return <main className="market-admin">ŁADOWANIE…</main>;
  if (!allowed)
    return (
      <main className="market-admin">
        <h1>ZALOGUJ SIĘ.</h1>
        <a href="/redakcja/logowanie">PRZEJDŹ DO LOGOWANIA →</a>
      </main>
    );

  const offers = rows.filter(vehicle =>
    `${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(offerSearch.toLowerCase().trim()),
  );

  return (
    <main className="market-admin">
      <header>
        <a href="/" className="logo">STREET<span>SCOPE</span></a>
        <nav>
          <a href="/redakcja/market/licytacje">LICYTACJE</a>
          <a href="/market" target="_blank">OTWÓRZ MARKET</a>
          <a href="/redakcja/dashboard">REDAKCJA</a>
        </nav>
      </header>

      <section className="admin-head">
        <p>STREETSCOPE × TOW & TRADE</p>
        <h1>MAR<br/><em>KET.</em></h1>
        <span>{message || "Wystaw i zarządzaj zwykłymi ofertami sprzedaży. Licytacje mają osobny panel."}</span>
      </section>

      <form onSubmit={save} className="market-form">
        <label>STATUS<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="available">AKTYWNE</option><option value="reserved">ZAREZERWOWANE</option><option value="sold">SPRZEDANE</option></select></label>
        <label>MARKA<input required value={form.brand} onChange={event => setForm({ ...form, brand: event.target.value })}/></label>
        <label>MODEL<input required value={form.model} onChange={event => setForm({ ...form, model: event.target.value })}/></label>
        <label>ROK<input type="number" value={form.year} onChange={event => setForm({ ...form, year: event.target.value })}/></label>
        <label>CENA SPRZEDAŻY $<input required type="number" min="1" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })}/></label>
        <label>PRZEBIEG MI<input type="number" value={form.mileage} onChange={event => setForm({ ...form, mileage: event.target.value })}/></label>
        <label>NAPĘD<input value={form.drivetrain} onChange={event => setForm({ ...form, drivetrain: event.target.value })}/></label>
        <label>SKRZYNIA<input value={form.transmission} onChange={event => setForm({ ...form, transmission: event.target.value })}/></label>
        <label>SILNIK<input value={form.engine} onChange={event => setForm({ ...form, engine: event.target.value })}/></label>
        <label>KOLOR<input value={form.color} onChange={event => setForm({ ...form, color: event.target.value })}/></label>
        <label>SPRZEDAJĄCY<input value={form.seller_name} onChange={event => setForm({ ...form, seller_name: event.target.value })}/></label>
        <label>TELEFON SPRZEDAJĄCEGO<input value={form.seller_phone} onChange={event => setForm({ ...form, seller_phone: event.target.value })}/></label>
        <label className="full">OPIS<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/></label>
        <label className="full">OKŁADKA<input type="file" accept="image/*" onChange={onCover}/></label>
        <label className="full">GALERIA — DO 8 ZDJĘĆ<input type="file" accept="image/*" multiple onChange={onGallery}/><small>{existingGallery.length} obecnych + {gallery.length} nowych</small></label>
        <label className="check full"><input type="checkbox" checked={form.featured} onChange={event => setForm({ ...form, featured: event.target.checked })}/> WYRÓŻNIONE</label>
        <div className="full actions">
          <button type="submit" disabled={busy}>{busy ? "PRZETWARZAM…" : editing ? "ZAPISZ ZMIANY" : "WYSTAW OFERTĘ"}</button>
          {editing && <button type="button" onClick={cancelEdit}>ANULUJ</button>}
        </div>
        {message && <small className="full" role="status"><strong>{message}</strong></small>}
      </form>

      <section className="market-list">
        <div className="market-list-title-row">
          <h2>OFERTY SPRZEDAŻY <span>{offers.length}</span></h2>
          <input className="market-list-search" value={offerSearch} onChange={event => setOfferSearch(event.target.value)} placeholder="SZUKAJ PO NAZWIE AUTA"/>
        </div>
        {offers.length ? offers.map(vehicle => (
          <article key={vehicle.id}>
            <div className="thumb" style={vehicle.image_url ? { backgroundImage: `url(${vehicle.image_url})` } : undefined}/>
            <div>
              <small>{vehicle.status === "sold" ? "SPRZEDANE" : vehicle.status === "reserved" ? "ZAREZERWOWANE" : "NA SPRZEDAŻ"}</small>
              <h3>{vehicle.brand} {vehicle.model}</h3>
              <b>${Number(vehicle.price || 0).toLocaleString("en-US")}</b>
              <small style={{ display: "block", marginTop: 8 }}>WYSTAWIŁ: <strong>{vehicle.listed_by_name?.trim() || "—"}</strong></small>
              <small style={{ display: "block", marginTop: 5 }}>SPRZEDAJĄCY: <strong>{vehicle.seller_name || "Tow & Trade"}</strong>{vehicle.seller_phone ? ` · ${vehicle.seller_phone}` : ""}</small>
            </div>
            <div className="row-actions">
              <button type="button" disabled={busy} onClick={() => edit(vehicle)}>EDYTUJ</button>
              <button type="button" disabled={busy || vehicle.status === "available"} onClick={() => void setStatus(vehicle, "available")}>AKTYWUJ</button>
              <button type="button" disabled={busy || vehicle.status === "reserved"} onClick={() => void setStatus(vehicle, "reserved")}>REZERWUJ</button>
              <button type="button" disabled={busy || vehicle.status === "sold"} onClick={() => void setStatus(vehicle, "sold")}>SPRZEDANE</button>
              <button type="button" className="delete-offer" disabled={busy} onClick={() => void remove(vehicle)}>USUŃ</button>
            </div>
          </article>
        )) : <p>BRAK OFERT PASUJĄCYCH DO WYSZUKIWANIA.</p>}
      </section>
    </main>
  );
}
