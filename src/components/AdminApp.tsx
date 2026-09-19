import { FormEvent, useEffect, useState } from "react";
import type { AdminSessionResponse } from "../../shared/types";
import { api } from "../lib/api";
import { BookOpen, Close, Upload } from "./Icons";
import { Diary } from "./Diary";
import { PdfImporter } from "./PdfImporter";

export function AdminApp({ adminToken }: { adminToken: string }) {
  const [session, setSession] = useState<AdminSessionResponse | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"diary" | "import">("import");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<AdminSessionResponse>(`/api/admin/${encodeURIComponent(adminToken)}/session`)
      .then(setSession)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Не вдалося перевірити сесію."));
  }, [adminToken]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setSession(await api<AdminSessionResponse>(`/api/admin/${encodeURIComponent(adminToken)}/login`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      }));
      setPin("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не вдалося увійти.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api(`/api/admin/${encodeURIComponent(adminToken)}/logout`, { method: "POST" });
    setSession({ authenticated: false });
  }

  if (!session?.authenticated) {
    return (
      <main className="admin-login">
        <form className="login-paper" onSubmit={login}>
          <span className="brand-mark"><BookOpen aria-hidden="true" /></span>
          <p className="eyebrow">Сторінка адміністратора</p>
          <h1>Відкрийте щоденник</h1>
          <p>Введіть спільний PIN адміністратора. Учням він не потрібен.</p>
          <input className="sr-only" type="text" name="username" autoComplete="username" value="administrator" readOnly tabIndex={-1} aria-hidden="true" />
          <label htmlFor="pin">PIN-код</label>
          <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" minLength={4} maxLength={32} value={pin} onChange={(event) => setPin(event.target.value)} autoFocus />
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy || pin.length < 4}>{busy ? "Перевіряємо…" : "Увійти"}</button>
        </form>
      </main>
    );
  }

  const guestPathParts = session.guestPath?.split("/").filter(Boolean) ?? [];
  const guestToken = guestPathParts[guestPathParts.length - 1] ?? "";
  const fullGuestUrl = `${window.location.origin}${session.guestPath}`;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div className="wordmark"><span className="brand-mark"><BookOpen /></span><span><b>Щоденник</b><small>майстерня адміністратора</small></span></div>
        <div className="admin-actions">
          <button className="copy-link" onClick={async () => { await navigator.clipboard.writeText(fullGuestUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
            {copied ? "Посилання скопійовано" : "Скопіювати гостьове посилання"}
          </button>
          <button className="icon-button" onClick={() => void logout()} aria-label="Вийти"><Close /></button>
        </div>
      </header>
      <nav className="admin-tabs" aria-label="Розділи адміністратора">
        <button className={tab === "diary" ? "is-active" : ""} onClick={() => setTab("diary")}><BookOpen /> Перегляд і ДЗ</button>
        <button className={tab === "import" ? "is-active" : ""} onClick={() => setTab("import")}><Upload /> Імпорт PDF</button>
      </nav>
      {tab === "diary"
        ? <Diary guestToken={guestToken} adminToken={adminToken} embedded />
        : <PdfImporter adminToken={adminToken} onPublished={() => setTab("diary")} />}
    </main>
  );
}
