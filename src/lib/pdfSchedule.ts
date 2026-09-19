import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { LessonDraft, WeekType } from "../../shared/types";
import { weekdayFor } from "../../shared/calendar";

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  page: number;
}

interface LessonCandidate {
  page: number;
  y: number;
  period: number;
  startsAt: string;
  endsAt: string;
  subjectLine: string;
  detailLine: string;
}

export interface ParsedPdfResult {
  weekType: WeekType;
  lessons: LessonDraft[];
  dates: string[];
  warnings: string[];
}

const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function parseSchedulePdfs(files: File[]): Promise<ParsedPdfResult[]> {
  if (files.length !== 2) throw new Error("Оберіть два PDF: верхній і нижній тиждень.");
  const results = await Promise.all(files.map(parseSchedulePdf));
  const types = new Set(results.map((result) => result.weekType));
  if (types.size !== 2) {
    throw new Error("Не вдалося знайти окремі верхній і нижній тижні.");
  }
  return results.sort((left) => (left.weekType === "upper" ? -1 : 1));
}

export async function parseSchedulePdf(file: File): Promise<ParsedPdfResult> {
  // The legacy bundle includes the small platform polyfills needed by older
  // iOS Safari versions (notably Promise.withResolvers used by PDF.js 6).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const items: PdfTextItem[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const rawItem of content.items) {
      if (!("str" in rawItem)) continue;
      const item = rawItem as TextItem;
      const text = item.str.trim();
      if (!text) continue;
      items.push({ text, x: item.transform[4], y: item.transform[5], page: pageNumber });
    }
  }
  return parsePositionedItems(items);
}

export function parsePositionedItems(items: PdfTextItem[]): ParsedPdfResult {
  const combinedText = items.map((item) => item.text).join(" ").toLocaleLowerCase("uk");
  const weekType: WeekType = combinedText.includes("верхній тиждень")
    ? "upper"
    : combinedText.includes("нижній тиждень")
      ? "lower"
      : (() => {
          throw new Error("У PDF немає позначки верхнього або нижнього тижня.");
        })();

  const dates = items
    .filter((item) => DATE_RE.test(item.text) && item.x < 100)
    .sort(readingOrder)
    .map((item) => dottedToIso(item.text));

  const candidates = extractCandidates(items);
  if (!dates.length || !candidates.length) {
    throw new Error("Не вдалося знайти дати або заняття у PDF.");
  }

  let dateIndex = 0;
  let previousPeriod = 0;
  const warnings: string[] = [];
  const lessons = candidates.map((candidate, index): LessonDraft => {
    if (index > 0 && candidate.period <= previousPeriod) dateIndex += 1;
    previousPeriod = candidate.period;
    const sourceDate = dates[Math.min(dateIndex, dates.length - 1)];
    const { subject, lessonType } = splitSubject(candidate.subjectLine);
    const { teacher, location } = splitDetails(candidate.detailLine);
    const warningParts: string[] = [];
    if (dateIndex >= dates.length) warningParts.push("не вдалося точно визначити дату");
    if (!location) warningParts.push("не знайдено аудиторію");
    if (!teacher) warningParts.push("не знайдено викладача");
    const warning = warningParts.join("; ");
    if (warning) warnings.push(`Пара ${candidate.period}, ${subject}: ${warning}.`);
    return {
      weekType,
      weekday: weekdayFor(sourceDate),
      period: candidate.period,
      startsAt: candidate.startsAt,
      endsAt: candidate.endsAt,
      subject,
      lessonType,
      teacher,
      location,
      sourceDate,
      warning,
    };
  });

  const distinctGroups = 1 + candidates.slice(1).filter((candidate, index) => candidate.period <= candidates[index].period).length;
  if (distinctGroups !== dates.length) {
    warnings.unshift(`Знайдено ${dates.length} дат і ${distinctGroups} груп занять. Перевірте дні у таблиці.`);
  }
  return { weekType, lessons, dates, warnings };
}

function extractCandidates(items: PdfTextItem[]): LessonCandidate[] {
  const relevant = items.filter((item) => item.x < 350 && item.y > 25 && item.y < 810);
  const periodItems = relevant.filter(
    (item) => /^\d{1,2}$/.test(item.text) && item.x >= 95 && item.x <= 119,
  );
  return periodItems
    .map((periodItem): LessonCandidate | null => {
      const onPage = relevant.filter((item) => item.page === periodItem.page);
      const times = onPage.filter((item) => TIME_RE.test(item.text) && item.x >= 116 && item.x <= 150);
      const startsAt = closest(times, periodItem.y + 6.75, 3);
      const endsAt = closest(times, periodItem.y - 6.75, 3);
      if (!startsAt || !endsAt) return null;
      const subjectLine = lineText(onPage, startsAt.y, 148, 350);
      const detailLine = lineText(onPage, endsAt.y, 148, 350);
      if (!subjectLine) return null;
      return {
        page: periodItem.page,
        y: startsAt.y,
        period: Number(periodItem.text),
        startsAt: startsAt.text,
        endsAt: endsAt.text,
        subjectLine,
        detailLine,
      };
    })
    .filter((candidate): candidate is LessonCandidate => Boolean(candidate))
    .sort((left, right) => left.page - right.page || right.y - left.y);
}

function closest(items: PdfTextItem[], expectedY: number, tolerance: number): PdfTextItem | undefined {
  return items
    .filter((item) => Math.abs(item.y - expectedY) <= tolerance)
    .sort((left, right) => Math.abs(left.y - expectedY) - Math.abs(right.y - expectedY))[0];
}

function lineText(items: PdfTextItem[], y: number, minX: number, maxX: number): string {
  return items
    .filter((item) => Math.abs(item.y - y) <= 1.7 && item.x >= minX && item.x < maxX)
    .sort((left, right) => left.x - right.x)
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitSubject(value: string): { subject: string; lessonType: string } {
  const match = /^(.*?)(?:\s+((?:В\s+)?(?:Лб\d*|Л|п)))$/u.exec(value.trim());
  if (!match) return { subject: value.trim(), lessonType: "" };
  return { subject: match[1].trim(), lessonType: match[2].trim() };
}

export function splitDetails(value: string): { teacher: string; location: string } {
  const [teacher = "", location = ""] = value.split(/\s*→\s*/, 2);
  return { teacher: teacher.trim(), location: location.trim() };
}

function dottedToIso(value: string): string {
  const match = DATE_RE.exec(value);
  if (!match) throw new Error("Некоректна дата у PDF.");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function readingOrder(left: PdfTextItem, right: PdfTextItem): number {
  return left.page - right.page || right.y - left.y || left.x - right.x;
}
