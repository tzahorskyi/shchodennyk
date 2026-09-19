import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, mondayOf } from "../../shared/calendar";
import type { LessonOccurrence, WeekResponse } from "../../shared/types";
import { api } from "../lib/api";
import { ArrowLeft, ArrowRight, BookOpen, Clock, Pencil, Pin, User } from "./Icons";
import { HomeworkDialog } from "./HomeworkDialog";

interface DiaryProps {
  guestToken: string;
  adminToken?: string;
  embedded?: boolean;
}

const DAYS = ["Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця"];
const SHORT_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт"];

export function Diary({ guestToken, adminToken, embedded = false }: DiaryProps) {
  const today = useMemo(kyivToday, []);
  const [monday, setMonday] = useState(() => mondayOf(today));
  const [selectedDay, setSelectedDay] = useState(() => Math.min(new Date(`${today}T00:00:00Z`).getUTCDay() || 7, 5));
  const [week, setWeek] = useState<WeekResponse | null>(null);
  const [editing, setEditing] = useState<LessonOccurrence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<WeekResponse>(`/api/guest/${encodeURIComponent(guestToken)}/week?monday=${monday}`);
      setWeek(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не вдалося завантажити розклад.");
    } finally {
      setLoading(false);
    }
  }, [guestToken, monday]);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  const moveWeek = (amount: number) => setMonday((current) => addDays(current, amount * 7));
  const lessonsByDay = DAYS.map((_, index) => week?.lessons.filter((lesson) => lesson.weekday === index + 1) ?? []);
  const rangeEnd = addDays(monday, 4);

  return (
    <main className={embedded ? "diary diary--embedded" : "diary"}>
      {!embedded && (
        <header className="topbar">
          <a className="wordmark" href={`/c/${guestToken}`} aria-label="Щоденник — на початок">
            <span className="brand-mark"><BookOpen aria-hidden="true" /></span>
            <span><b>Щоденник</b><small>наш спільний розклад</small></span>
          </a>
          <span className="privacy-note">без акаунтів · без імен</span>
        </header>
      )}

      <section className="week-heading" aria-labelledby="week-title">
        <button className="round-button" onClick={() => moveWeek(-1)} aria-label="Попередній тиждень"><ArrowLeft /></button>
        <div>
          <p className={`week-ribbon week-ribbon--${week?.weekType ?? "upper"}`}>
            {week?.weekType === "lower" ? "нижній тиждень" : "верхній тиждень"}
          </p>
          <h1 id="week-title">{formatRange(monday, rangeEnd)}</h1>
          {monday !== mondayOf(today) && (
            <button className="today-link" onClick={() => setMonday(mondayOf(today))}>Повернутися до цього тижня</button>
          )}
        </div>
        <button className="round-button" onClick={() => moveWeek(1)} aria-label="Наступний тиждень"><ArrowRight /></button>
      </section>

      <nav className="day-tabs" aria-label="Дні тижня">
        {DAYS.map((day, index) => {
          const date = addDays(monday, index);
          return (
            <button
              key={day}
              className={selectedDay === index + 1 ? "day-tab is-active" : "day-tab"}
              onClick={() => setSelectedDay(index + 1)}
              aria-current={selectedDay === index + 1 ? "date" : undefined}
            >
              <span>{SHORT_DAYS[index]}</span>
              <b>{Number(date.slice(-2))}</b>
            </button>
          );
        })}
      </nav>

      {error && <div className="notice notice--error" role="alert">{error}<button onClick={() => void loadWeek()}>Спробувати ще</button></div>}

      <section className={loading ? "notebook is-loading" : "notebook"} aria-busy={loading}>
        <div className="binding" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
        {DAYS.map((day, index) => (
          <DaySheet
            key={day}
            day={day}
            date={addDays(monday, index)}
            lessons={lessonsByDay[index]}
            active={selectedDay === index + 1}
            onEdit={setEditing}
          />
        ))}
        {!loading && week?.scheduleVersionId === null && (
          <div className="empty-schedule">
            <span>Розклад ще не вклеєно</span>
            <p>Адміністратор має імпортувати два PDF з верхнім і нижнім тижнями.</p>
          </div>
        )}
      </section>

      {editing && (
        <HomeworkDialog
          lesson={editing}
          guestToken={guestToken}
          adminToken={adminToken}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadWeek();
          }}
        />
      )}
    </main>
  );
}

function DaySheet({ day, date, lessons, active, onEdit }: {
  day: string;
  date: string;
  lessons: LessonOccurrence[];
  active: boolean;
  onEdit: (lesson: LessonOccurrence) => void;
}) {
  return (
    <article className={active ? "day-sheet is-active" : "day-sheet"}>
      <header className="day-title">
        <span>{day}</span>
        <time dateTime={date}>{formatDayDate(date)}</time>
      </header>
      <div className="lesson-list">
        {lessons.length ? lessons.map((lesson, index) => (
          <article className="lesson" key={lesson.id} style={{ "--delay": `${index * 45}ms` } as React.CSSProperties}>
            <div className="period-number" aria-label={`${lesson.period} пара`}>{lesson.period}</div>
            <div className="lesson-body">
              <div className="lesson-topline">
                <h2>{lesson.subject}</h2>
                {lesson.lessonType && <span className="lesson-type">{lesson.lessonType}</span>}
              </div>
              <div className="lesson-meta">
                <span><Clock aria-hidden="true" />{lesson.startsAt}–{lesson.endsAt}</span>
                {lesson.location && <span><Pin aria-hidden="true" />{lesson.location}</span>}
                {lesson.teacher && <span><User aria-hidden="true" />{lesson.teacher}</span>}
              </div>
              <div className={lesson.homework.content ? "homework-note has-content" : "homework-note"} onClick={() => onEdit(lesson)}>
                <button className="homework-edit-trigger" onClick={() => onEdit(lesson)} aria-label={`Редагувати домашнє завдання: ${lesson.subject}`}>
                  <Pencil aria-hidden="true" />
                </button>
                <span>
                  <small>Домашнє завдання</small>
                  {lesson.homework.content ? <LinkifiedText text={lesson.homework.content} /> : <em>Натисніть, щоб записати…</em>}
                  {lesson.homework.updatedAt && <time className="homework-updated" dateTime={lesson.homework.updatedAt}>Оновлено {formatUpdated(lesson.homework.updatedAt)}</time>}
                </span>
              </div>
            </div>
          </article>
        )) : <p className="day-off">Пар немає <span>— можна видихнути</span></p>}
      </div>
    </article>
  );
}

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return <>{parts.map((part, index) => /^https?:\/\//.test(part)
    ? <a key={index} href={part} target="_blank" rel="noreferrer noopener" onClick={(event) => event.stopPropagation()}>{part}</a>
    : <span key={index}>{part}</span>)}</>;
}

function kyivToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatRange(start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" });
  return `${formatter.format(new Date(`${start}T12:00:00Z`))} — ${formatter.format(new Date(`${end}T12:00:00Z`))}`;
}

function formatDayDate(date: string): string {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`));
}

function formatUpdated(value: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
