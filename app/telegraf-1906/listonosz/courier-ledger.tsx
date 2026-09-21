"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Category = "czlonek" | "skladka" | "decyzja" | "wydarzenie" | "wiadomosc";
type EntryStatus = "otwarte" | "przekazane" | "zamkniete";
type LedgerEntry = {
  id: string;
  category: Category;
  title: string;
  person: string;
  date: string;
  amount: string;
  status: EntryStatus;
  body: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "streetscope:listonosz:ledger:v1";
const categoryLabels: Record<Category, string> = {
  czlonek: "Członek",
  skladka: "Składka",
  decyzja: "Decyzja",
  wydarzenie: "Wydarzenie",
  wiadomosc: "Wiadomość",
};
const statusLabels: Record<EntryStatus, string> = {
  otwarte: "Do załatwienia",
  przekazane: "Przekazane",
  zamkniete: "Archiwum",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function blankEntry(): Omit<LedgerEntry, "id" | "createdAt" | "updatedAt"> {
  return { category: "wiadomosc", title: "", person: "", date: today(), amount: "", status: "otwarte", body: "" };
}

function safeEntries(value: unknown): LedgerEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is LedgerEntry => {
    if (!item || typeof item !== "object") return false;
    const row = item as Partial<LedgerEntry>;
    return typeof row.id === "string" && typeof row.title === "string" && typeof row.body === "string" && Boolean(row.category);
  });
}

export function CourierLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [draft, setDraft] = useState(blankEntry);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setEntries(safeEntries(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")));
    } catch {
      setNotice("Nie udało się odczytać wcześniejszych zapisków.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries, ready]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pl");
    return entries
      .filter((entry) => filter === "all" || entry.category === filter)
      .filter((entry) => !normalized || [entry.title, entry.person, entry.body, entry.amount].join(" ").toLocaleLowerCase("pl").includes(normalized))
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  }, [entries, filter, query]);

  const dueTotal = useMemo(() => entries.filter((entry) => entry.category === "skladka").reduce((sum, entry) => sum + (Number(entry.amount.replace(",", ".")) || 0), 0), [entries]);
  const openCount = entries.filter((entry) => entry.status === "otwarte").length;

  function submit(event: FormEvent) {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) return;
    const stamp = new Date().toISOString();

    if (editingId) {
      setEntries((current) => current.map((entry) => entry.id === editingId ? { ...entry, ...draft, title, body, updatedAt: stamp } : entry));
      setNotice("Wpis poprawiony.");
    } else {
      setEntries((current) => [{ ...draft, id: crypto.randomUUID(), title, body, createdAt: stamp, updatedAt: stamp }, ...current]);
      setNotice("Wpis trafił do rejestru.");
    }
    setDraft(blankEntry());
    setEditingId(null);
  }

  function edit(entry: LedgerEntry) {
    setEditingId(entry.id);
    setDraft({ category: entry.category, title: entry.title, person: entry.person, date: entry.date, amount: entry.amount, status: entry.status, body: entry.body });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(entry: LedgerEntry) {
    if (!window.confirm(`Usunąć wpis „${entry.title}”? Tej czynności nie da się cofnąć.`)) return;
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    if (editingId === entry.id) cancelEdit();
    setNotice("Wpis usunięty.");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(blankEntry());
  }

  function updateStatus(entry: LedgerEntry, status: EntryStatus) {
    setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
  }

  function exportLedger() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rejestr-listonosza-${today()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice("Kopia rejestru pobrana.");
  }

  async function importLedger(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = safeEntries(Array.isArray(parsed) ? parsed : parsed.entries);
      if (!imported.length) throw new Error("empty");
      if (!window.confirm(`Wczytać ${imported.length} wpisów? Obecny rejestr zostanie zastąpiony.`)) return;
      setEntries(imported);
      setNotice("Kopia rejestru wczytana.");
    } catch {
      setNotice("Ten plik nie jest poprawną kopią rejestru.");
    } finally {
      event.target.value = "";
    }
  }

  return <main className="courier-ledger">
    <header className="ledger-masthead">
      <div className="ledger-mark" aria-hidden="true">L</div>
      <div>
        <p>ROK 1906 · EGZEMPLARZ POUFNY</p>
        <h1>Kancelaria <em>Listonosza</em></h1>
      </div>
      <div className="ledger-place">REJESTR ORGANIZACJI<br/><b>DO RĄK WŁASNYCH</b></div>
    </header>

    <section className="ledger-summary" aria-label="Podsumowanie rejestru">
      <div><span>Wszystkie wpisy</span><b>{entries.length}</b></div>
      <div><span>Do załatwienia</span><b>{openCount}</b></div>
      <div><span>Suma składek</span><b>{dueTotal.toLocaleString("pl-PL")} $</b></div>
      <p>Zapis lokalny<br/><strong>NA TYM URZĄDZENIU</strong></p>
    </section>

    <section className="ledger-workspace">
      <form className="ledger-form" onSubmit={submit}>
        <div className="ledger-section-title">
          <span>{editingId ? "POPRAWKA" : "NOWY WPIS"}</span>
          <b>{editingId ? "Redaguj istniejący zapis" : "Wprowadź do księgi"}</b>
        </div>

        <label>Kategoria
          <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}>
            {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Data
          <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required />
        </label>
        <label className="wide">Tytuł zapisu
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Np. zebranie przy starym młynie" maxLength={120} required />
        </label>
        <label>Osoba lub grupa
          <input value={draft.person} onChange={(event) => setDraft({ ...draft, person: event.target.value })} placeholder="Kogo dotyczy" maxLength={100} />
        </label>
        {draft.category === "skladka" ? <label>Kwota ($)
          <input type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="0" />
        </label> : <label>Status
          <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EntryStatus })}>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>}
        {draft.category === "skladka" && <label className="wide compact-status">Status
          <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EntryStatus })}>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>}
        <label className="wide">Treść
          <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Nazwiska, ustalenia, miejsce, godzina i wszystko, czego nie wolno zgubić…" rows={7} maxLength={5000} required />
        </label>
        <div className="ledger-form-actions wide">
          <button className="ink-button" type="submit">{editingId ? "ZAPISZ POPRAWKI" : "DODAJ DO REJESTRU"}</button>
          {editingId && <button className="plain-button" type="button" onClick={cancelEdit}>ANULUJ</button>}
        </div>
      </form>

      <aside className="ledger-rules">
        <span className="confidential-stamp">POUFNE</span>
        <p className="eyebrow">OBOWIĄZKI LISTONOSZA</p>
        <h2>Pamięć organizacji nie może zawieść.</h2>
        <ol>
          <li>Zapisuj członków i ich zobowiązania.</li>
          <li>Odnotowuj składki bez zaokrągleń.</li>
          <li>Utrwalaj decyzje podjęte na zebraniach.</li>
          <li>Wiadomości oznaczaj jako przekazane.</li>
        </ol>
        <small>Adres tej księgi nie jest widoczny w żadnym menu StreetScope. Nie przekazuj go osobom postronnym.</small>
      </aside>
    </section>

    <section className="ledger-register">
      <div className="register-head">
        <div>
          <p className="eyebrow">KSIĘGA GŁÓWNA</p>
          <h2>Zapiski i korespondencja</h2>
        </div>
        <div className="register-tools">
          <button type="button" onClick={exportLedger} disabled={!entries.length}>POBIERZ KOPIĘ</button>
          <button type="button" onClick={() => fileInput.current?.click()}>WCZYTAJ KOPIĘ</button>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={importLedger} hidden />
          <button type="button" onClick={() => window.print()}>DRUKUJ</button>
        </div>
      </div>

      <div className="ledger-filters">
        <div role="group" aria-label="Filtr kategorii">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Wszystko</button>
          {Object.entries(categoryLabels).map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value as Category)}>{label}</button>)}
        </div>
        <label><span className="sr-only">Szukaj w rejestrze</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj nazwiska, miejsca, sprawy…" /></label>
      </div>

      {!ready ? <p className="ledger-empty">Otwieranie księgi…</p> : visibleEntries.length === 0 ? <div className="ledger-empty"><b>{entries.length ? "Brak pasujących wpisów." : "Księga jest jeszcze pusta."}</b><span>{entries.length ? "Zmień filtr albo treść wyszukiwania." : "Pierwszą wiadomość możesz zapisać w formularzu powyżej."}</span></div> : <div className="entry-list">
        {visibleEntries.map((entry, index) => <article className={`ledger-entry category-${entry.category}`} key={entry.id}>
          <div className="entry-number">{String(visibleEntries.length - index).padStart(3, "0")}</div>
          <div className="entry-main">
            <div className="entry-meta"><span>{categoryLabels[entry.category]}</span><time dateTime={entry.date}>{new Date(`${entry.date}T12:00:00`).toLocaleDateString("pl-PL")}</time>{entry.person && <b>{entry.person}</b>}</div>
            <h3>{entry.title}</h3>
            <p>{entry.body}</p>
            {entry.category === "skladka" && entry.amount && <strong className="entry-amount">{Number(entry.amount).toLocaleString("pl-PL")} $</strong>}
          </div>
          <div className="entry-actions">
            <select aria-label={`Status wpisu ${entry.title}`} value={entry.status} onChange={(event) => updateStatus(entry, event.target.value as EntryStatus)}>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button onClick={() => edit(entry)}>POPRAW</button>
            <button className="danger" onClick={() => remove(entry)}>USUŃ</button>
          </div>
        </article>)}
      </div>}
    </section>
    <footer className="ledger-footer"><span>KANCELARIA LISTONOSZA · 1906</span><span>REJESTR PRYWATNY</span></footer>
    {notice && <div className="ledger-notice" role="status">{notice}</div>}
  </main>;
}
