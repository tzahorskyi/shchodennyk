import { useEffect, useRef, useState } from "react";
import type { HomeworkData, HomeworkRevision, LessonOccurrence } from "../../shared/types";
import { ApiError, api } from "../lib/api";
import { createLatestRequestGuard, createSingleFlightGuard } from "../lib/requestGuard";
import { Close, History, Pencil } from "./Icons";

export function HomeworkDialog({ lesson, guestToken, adminToken, onClose, onSaved }: {
  lesson: LessonOccurrence;
  guestToken: string;
  adminToken?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState(lesson.homework.content);
  const [homework, setHomework] = useState(lesson.homework);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<HomeworkData | null>(null);
  const [revisions, setRevisions] = useState<HomeworkRevision[] | null>(null);
  const mutationGuard = useRef(createSingleFlightGuard());
  const historyRequestGuard = useRef(createLatestRequestGuard());

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      mutationGuard.current.cancel();
      historyRequestGuard.current.cancel();
      dialog?.close();
    };
  }, []);

  async function save() {
    const request = mutationGuard.current.start();
    if (!request) return;
    setSaving(true);
    setError("");
    setConflict(null);
    try {
      const saved = await api<HomeworkData>(
        `/api/guest/${encodeURIComponent(guestToken)}/homework/${lesson.id}/${lesson.date}`,
        { method: "PATCH", body: JSON.stringify({ content, version: homework.version }), signal: request.signal },
      );
      if (!request.isCurrent()) return;
      setHomework(saved);
      onSaved();
    } catch (caught) {
      if (!request.isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 409) {
        const data = caught.data as { current?: HomeworkData | null } | undefined;
        setConflict(data?.current ?? { id: null, content: "", version: 0, updatedAt: null });
      } else {
        setError(caught instanceof Error ? caught.message : "Не вдалося зберегти.");
      }
    } finally {
      if (request.isCurrent()) {
        request.release();
        setSaving(false);
      }
    }
  }

  async function loadHistory() {
    if (!adminToken || !homework.id) return;
    const request = historyRequestGuard.current.start();
    setError("");
    try {
      const result = await api<{ revisions: HomeworkRevision[] }>(
        `/api/admin/${encodeURIComponent(adminToken)}/revisions/${homework.id}`,
        { signal: request.signal },
      );
      if (!request.isCurrent()) return;
      setRevisions(result.revisions);
    } catch (caught) {
      if (!request.isCurrent()) return;
      setError(caught instanceof Error ? caught.message : "Не вдалося відкрити історію.");
    } finally {
      if (request.isCurrent()) request.release();
    }
  }

  async function restore(revision: HomeworkRevision) {
    if (!adminToken || !homework.id) return;
    const request = mutationGuard.current.start();
    if (!request) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/admin/${encodeURIComponent(adminToken)}/homework/${homework.id}/restore/${revision.id}`, {
        method: "POST",
        body: JSON.stringify({ version: homework.version }),
        signal: request.signal,
      });
      if (!request.isCurrent()) return;
      onSaved();
    } catch (caught) {
      if (!request.isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 409) {
        const data = caught.data as { current?: HomeworkData | null } | undefined;
        setConflict(data?.current ?? { id: null, content: "", version: 0, updatedAt: null });
      } else {
        setError(caught instanceof Error ? caught.message : "Не вдалося відновити версію.");
      }
    } finally {
      if (request.isCurrent()) {
        request.release();
        setSaving(false);
      }
    }
  }

  return (
    <dialog ref={dialogRef} className="homework-dialog" onCancel={onClose} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog-paper">
        <header>
          <div>
            <p>{lesson.period} пара · {lesson.startsAt}</p>
            <h2>{lesson.subject}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Закрити"><Close /></button>
        </header>

        <label htmlFor="homework">Домашнє завдання</label>
        <textarea
          id="homework"
          autoFocus
          maxLength={4000}
          rows={7}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Наприклад: прочитати §12, вправи 4–6…"
        />
        <div className="textarea-foot"><span>Посилання стануть активними автоматично</span><b>{content.length}/4000</b></div>

        {conflict && (
          <div className="notice notice--conflict" role="alert">
            <strong>Хтось уже змінив цей запис.</strong>
            <p>{conflict.content || "Актуальний запис порожній."}</p>
            <button onClick={() => { setContent(conflict.content); setHomework(conflict); setConflict(null); }}>Взяти актуальну версію</button>
          </div>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}

        {revisions && (
          <section className="revision-list">
            <h3>Попередні записи</h3>
            {revisions.length ? revisions.map((revision) => (
              <article key={revision.id}>
                <div><time>{formatTimestamp(revision.createdAt)}</time><p>{revision.content || "Порожній запис"}</p></div>
                <button disabled={saving} onClick={() => void restore(revision)}>Відновити</button>
              </article>
            )) : <p>Попередніх версій ще немає.</p>}
          </section>
        )}

        <footer>
          {adminToken && homework.id && (
            <button className="text-button" onClick={() => void loadHistory()}><History /> Історія</button>
          )}
          <button className="primary-button" disabled={saving || content === lesson.homework.content} onClick={() => void save()}>
            <Pencil /> {saving ? "Зберігаємо…" : content ? "Зберегти" : "Очистити запис"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
