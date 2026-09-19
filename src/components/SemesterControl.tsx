import { useEffect, useState } from "react";
import type { SchedulePeriod } from "../../shared/types";
import { api } from "../lib/api";

export function SemesterControl({ adminToken }: { adminToken: string }) {
  const [schedule, setSchedule] = useState<SchedulePeriod | null>(null);
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ schedule: SchedulePeriod | null }>(`/api/admin/${encodeURIComponent(adminToken)}/schedule/current`)
      .then(({ schedule: value }) => {
        setSchedule(value);
        setEndDate(value?.effectiveUntil ?? "");
      })
      .catch(() => setStatus("Не вдалося прочитати період розкладу."));
  }, [adminToken]);

  if (!schedule) return null;

  async function save() {
    setBusy(true);
    setStatus("");
    try {
      const updated = await api<SchedulePeriod>(`/api/admin/${encodeURIComponent(adminToken)}/schedule/current`, {
        method: "PATCH",
        body: JSON.stringify({ effectiveUntil: endDate }),
      });
      setSchedule(updated);
      setStatus("Семестр продовжено — двотижневий цикл повторюватиметься до цієї дати.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Не вдалося зберегти дату.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="semester-control" aria-label="Період дії розкладу">
      <div>
        <p className="eyebrow">Період навчання</p>
        <h2>Розтягнути розклад на семестр</h2>
        <p>Верхній і нижній тижні автоматично чергуватимуться від {schedule.effectiveFrom.split("-").reverse().join(".")}.</p>
      </div>
      <div className="semester-control__form">
        <label>Останній день семестру
          <input type="date" min={schedule.effectiveFrom} value={endDate} onChange={(event) => { setEndDate(event.target.value); setStatus(""); }} />
        </label>
        <button className="primary-button" disabled={!endDate || endDate === schedule.effectiveUntil || busy} onClick={() => void save()}>
          {busy ? "Зберігаємо…" : "Застосувати"}
        </button>
      </div>
      {status && <p className="semester-control__status" role="status">{status}</p>}
    </section>
  );
}
