"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";
import styles from "./market-image-manager.module.css";

type Vehicle = {
  id: number;
  brand: string;
  model: string;
  image_url: string | null;
  gallery: string[] | null;
};

type RemoveResult = {
  ok?: boolean;
  row?: { id: number; image_url: string | null; gallery: string[] | null };
  error?: string;
};

export default function MarketImageManager() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");

  const client = () => getSupabase();

  const load = async () => {
    const { data, error } = await client()
      .from("market_vehicles")
      .select("id,brand,model,image_url,gallery")
      .eq("sale_mode", "sale")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    setRows((data as Vehicle[] | null) ?? []);
  };

  useEffect(() => {
    if (!open) return;
    load().catch(error => setMessage(`BŁĄD: ${error instanceof Error ? error.message : "Nie udało się wczytać zdjęć."}`));
  }, [open]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pl-PL");
    if (!needle) return rows;
    return rows.filter(row => `${row.brand} ${row.model} #${row.id}`.toLocaleLowerCase("pl-PL").includes(needle));
  }, [rows, query]);

  const removeImage = async (vehicle: Vehicle, imageUrl: string) => {
    if (!window.confirm(`Usunąć to zdjęcie z ${vehicle.brand} ${vehicle.model}?`)) return;
    const key = `${vehicle.id}:${imageUrl}`;
    setBusyKey(key);
    setMessage("USUWAM ZDJĘCIE…");

    try {
      const { data } = await client().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

      const response = await fetch("/api/redakcja/market/remove-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicleId: vehicle.id, imageUrl }),
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as RemoveResult;
      if (!response.ok || !result.row) throw new Error(result.error || `Serwer zwrócił błąd ${response.status}.`);

      setRows(current => current.map(row => row.id === vehicle.id ? {
        ...row,
        image_url: result.row?.image_url ?? null,
        gallery: result.row?.gallery ?? [],
      } : row));
      setMessage("ZDJĘCIE USUNIĘTE.");
    } catch (error) {
      setMessage(`BŁĄD: ${error instanceof Error ? error.message : "Nie udało się usunąć zdjęcia."}`);
    } finally {
      setBusyKey("");
    }
  };

  if (pathname?.includes("/redakcja/market/licytacje")) return null;

  return (
    <>
      <button type="button" className={styles.fab} onClick={() => setOpen(true)}>ZDJĘCIA OFERT</button>
      {open && (
        <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className={styles.panel}>
            <header className={styles.header}>
              <div>
                <small>TOW & TRADE</small>
                <h2>ZARZĄDZAJ ZDJĘCIAMI</h2>
                <p>{message || "Usuń pojedynczą okładkę albo wybrane zdjęcie z galerii bez kasowania całej oferty."}</p>
              </div>
              <button type="button" className={styles.close} onClick={() => setOpen(false)}>×</button>
            </header>

            <div className={styles.search}>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Szukaj marki, modelu albo ID…" />
              <button type="button" onClick={() => load().catch(error => setMessage(`BŁĄD: ${error instanceof Error ? error.message : "Nie udało się odświeżyć."}`))}>ODŚWIEŻ</button>
            </div>

            <div className={styles.list}>
              {visible.map(vehicle => {
                const gallery = Array.isArray(vehicle.gallery) ? vehicle.gallery : [];
                const images = [
                  ...(vehicle.image_url ? [{ url: vehicle.image_url, label: "OKŁADKA" }] : []),
                  ...gallery.map((url, index) => ({ url, label: `GALERIA ${index + 1}` })),
                ];

                return (
                  <article className={styles.vehicle} key={vehicle.id}>
                    <div className={styles.vehicleHead}>
                      <div><small>OFERTA #{vehicle.id}</small><h3>{vehicle.brand} {vehicle.model}</h3></div>
                      <span>{images.length} ZDJ.</span>
                    </div>

                    {images.length ? (
                      <div className={styles.grid}>
                        {images.map((image, index) => {
                          const key = `${vehicle.id}:${image.url}`;
                          return (
                            <figure className={styles.photo} key={`${image.url}-${index}`}>
                              <img src={image.url} alt="" />
                              <figcaption>{image.label}</figcaption>
                              <button type="button" disabled={Boolean(busyKey)} onClick={() => removeImage(vehicle, image.url)}>
                                {busyKey === key ? "USUWAM…" : "USUŃ"}
                              </button>
                            </figure>
                          );
                        })}
                      </div>
                    ) : <p className={styles.empty}>Ta oferta nie ma zdjęć.</p>}
                  </article>
                );
              })}
              {!visible.length && <p className={styles.empty}>Brak pasujących ofert.</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
