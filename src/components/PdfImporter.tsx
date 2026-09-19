import { ChangeEvent, useMemo, useState } from "react";
import type { LessonDraft } from "../../shared/types";
import { addDays, mondayOf } from "../../shared/calendar";
import { api } from "../lib/api";
import { parseSchedulePdfs } from "../lib/pdfSchedule";
import { Close, Upload } from "./Icons";

const DAY_NAMES = ["", "Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота", "Неділя"];

export function PdfImporter({ adminToken, onPublished }: { adminToken: string; onPublished: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [lessons, setLessons] = useState<LessonDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [anchorMonday, setAnchorMonday] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [parsing, setParsing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const blockers = useMemo(
    () => lessons.filter((lesson) => !lesson.subject.trim() || !lesson.startsAt || !lesson.endsAt || !lesson.weekday || !lesson.period),
    [lessons],
  );

  const mobileGroups = useMemo(() => {
    const groups: Array<{ key: string; weekType: LessonDraft["weekType"]; weekday: number; rows: Array<{ lesson: LessonDraft; index: number }> }> = [];
    lessons.forEach((lesson, index) => {
      const key = `${lesson.weekType}-${lesson.weekday}`;
      const current = groups[groups.length - 1];
      if (!current || current.key !== key) {
        groups.push({ key, weekType: lesson.weekType, weekday: lesson.weekday, rows: [] });
      }
      groups[groups.length - 1]?.rows.push({ lesson, index });
    });
    return groups;
  }, [lessons]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
    setLessons([]);
    setWarnings([]);
    setError("");
  }

  async function parseFiles() {
    setParsing(true);
    setError("");
    try {
      const results = await parseSchedulePdfs(files);
      const rows = results.flatMap((result) => result.lessons);
      setLessons(rows);
      setWarnings(results.flatMap((result) => result.warnings));
      const upperFirstDate = results.find((result) => result.weekType === "upper")?.dates[0];
      if (upperFirstDate) {
        const monday = mondayOf(upperFirstDate);
        setAnchorMonday(monday);
        setEffectiveUntil(addDays(monday, 125));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не вдалося прочитати PDF.");
    } finally {
      setParsing(false);
    }
  }

  function updateLesson(index: number, field: keyof LessonDraft, value: string | number) {
    setLessons((current) => current.map((lesson, rowIndex) => rowIndex === index ? { ...lesson, [field]: value } : lesson));
  }

  async function publish() {
    setPublishing(true);
    setError("");
    try {
      await api(`/api/admin/${encodeURIComponent(adminToken)}/schedule`, {
        method: "POST",
        body: JSON.stringify({ anchorMonday, effectiveUntil, lessons }),
      });
      onPublished();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не вдалося опублікувати розклад.");
    } finally {
      setPublishing(false);
    }
  }

  if (!lessons.length) {
    return (
      <section className="import-page">
        <div className="import-intro">
          <p className="eyebrow">Новий розклад</p>
          <h1>Вклейте дві сторінки семестру</h1>
          <p>Оберіть PDF верхнього й нижнього тижня. Файли відкриються лише у вашому браузері — на сервер вони не потраплять.</p>
        </div>
        <label className={files.length ? "drop-zone has-files" : "drop-zone"}>
          <input type="file" accept="application/pdf,.pdf" multiple onChange={chooseFiles} />
          <span className="upload-seal"><Upload /></span>
          <strong>{files.length === 2 ? "Два PDF готові" : "Оберіть два PDF"}</strong>
          <span>{files.length ? files.map((file) => file.name).join(" · ") : "верхній і нижній тиждень"}</span>
        </label>
        {error && <p className="field-error centered" role="alert">{error}</p>}
        <button className="primary-button import-button" disabled={files.length !== 2 || parsing} onClick={() => void parseFiles()}>
          {parsing ? "Читаємо сторінки…" : "Розпізнати розклад"}
        </button>
      </section>
    );
  }

  return (
    <section className="preview-page">
      <header className="preview-heading">
        <div><p className="eyebrow">Перевірка перед публікацією</p><h1>{lessons.length} занять розпізнано</h1></div>
        <label>Верхній тиждень починається
          <input type="date" value={anchorMonday} onChange={(event) => setAnchorMonday(event.target.value)} />
        </label>
        <label>Розклад діє до
          <input type="date" min={anchorMonday} value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} />
        </label>
      </header>
      {warnings.length > 0 && (
        <details className="parse-warnings">
          <summary>{warnings.length} рядків варто переглянути</summary>
          <ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </details>
      )}
      <div className="schedule-table-wrap">
        <table className="schedule-table">
          <thead><tr><th>Тиждень / день</th><th>Пара</th><th>Час</th><th>Предмет</th><th>Тип</th><th>Викладач</th><th>Аудиторія</th><th><span className="sr-only">Дії</span></th></tr></thead>
          <tbody>{lessons.map((lesson, index) => (
            <tr key={`${lesson.weekType}-${lesson.weekday}-${lesson.period}-${index}`} className={lesson.warning ? "needs-review" : ""}>
              <td><span className={`week-dot week-dot--${lesson.weekType}`} />{lesson.weekType === "upper" ? "Верхній" : "Нижній"}<small>{DAY_NAMES[lesson.weekday]}</small></td>
              <td><input aria-label="Номер пари" type="number" min="1" max="20" value={lesson.period} onChange={(event) => updateLesson(index, "period", Number(event.target.value))} /></td>
              <td className="time-cell"><input aria-label="Початок" type="time" value={lesson.startsAt} onChange={(event) => updateLesson(index, "startsAt", event.target.value)} /><input aria-label="Кінець" type="time" value={lesson.endsAt} onChange={(event) => updateLesson(index, "endsAt", event.target.value)} /></td>
              <td><input aria-label="Предмет" value={lesson.subject} onChange={(event) => updateLesson(index, "subject", event.target.value)} /></td>
              <td><input aria-label="Тип заняття" value={lesson.lessonType} onChange={(event) => updateLesson(index, "lessonType", event.target.value)} /></td>
              <td><input aria-label="Викладач" value={lesson.teacher} onChange={(event) => updateLesson(index, "teacher", event.target.value)} /></td>
              <td><input aria-label="Аудиторія" value={lesson.location} onChange={(event) => updateLesson(index, "location", event.target.value)} /></td>
              <td><button className="icon-button" onClick={() => setLessons((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} aria-label="Видалити рядок"><Close /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="schedule-cards">
        {mobileGroups.map((group) => (
          <section className="schedule-card-group" key={group.key}>
            <header className="schedule-card-group__heading">
              <span className={`week-dot week-dot--${group.weekType}`} />
              <strong>{DAY_NAMES[group.weekday]}</strong>
              <span>{group.weekType === "upper" ? "Верхній тиждень" : "Нижній тиждень"}</span>
            </header>
            {group.rows.map(({ lesson, index }) => (
              <article className={lesson.warning ? "schedule-card needs-review" : "schedule-card"} key={`${group.key}-${lesson.period}-${index}`}>
                <div className="schedule-card__topline">
                  <label className="schedule-card__period">Пара
                    <input aria-label="Номер пари" type="number" min="1" max="20" value={lesson.period} onChange={(event) => updateLesson(index, "period", Number(event.target.value))} />
                  </label>
                  <button className="icon-button" onClick={() => setLessons((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} aria-label={`Видалити ${lesson.subject || "заняття"}`}><Close /></button>
                </div>
                <label className="schedule-card__subject">Предмет
                  <input value={lesson.subject} onChange={(event) => updateLesson(index, "subject", event.target.value)} />
                </label>
                <div className="schedule-card__grid">
                  <label>Початок<input type="time" value={lesson.startsAt} onChange={(event) => updateLesson(index, "startsAt", event.target.value)} /></label>
                  <label>Кінець<input type="time" value={lesson.endsAt} onChange={(event) => updateLesson(index, "endsAt", event.target.value)} /></label>
                  <label>Тип заняття<input value={lesson.lessonType} onChange={(event) => updateLesson(index, "lessonType", event.target.value)} /></label>
                  <label>Аудиторія<input value={lesson.location} onChange={(event) => updateLesson(index, "location", event.target.value)} /></label>
                </div>
                <label className="schedule-card__teacher">Викладач
                  <input value={lesson.teacher} onChange={(event) => updateLesson(index, "teacher", event.target.value)} />
                </label>
                {lesson.warning && <p className="schedule-card__warning">Перевірте цей запис перед публікацією</p>}
              </article>
            ))}
          </section>
        ))}
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <footer className="preview-actions">
        <button className="text-button" onClick={() => { setLessons([]); setFiles([]); }}>Обрати інші файли</button>
        <button className="primary-button" disabled={!anchorMonday || !effectiveUntil || blockers.length > 0 || publishing} onClick={() => void publish()}>
          {publishing ? "Публікуємо…" : "Опублікувати розклад"}
        </button>
      </footer>
    </section>
  );
}
