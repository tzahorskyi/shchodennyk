import { describe, expect, it } from "vitest";
import { parsePositionedItems, splitDetails, splitSubject, type PdfTextItem } from "./pdfSchedule";

describe("PDF schedule parser", () => {
  it("splits lesson type and details", () => {
    expect(splitSubject("Маркетинг в агробізнесі В п")).toEqual({
      subject: "Маркетинг в агробізнесі",
      lessonType: "В п",
    });
    expect(splitDetails("доц. Куліш Г.П → 1 343а")).toEqual({
      teacher: "доц. Куліш Г.П",
      location: "1 343а",
    });
  });

  it("keeps a carried day until the period sequence restarts", () => {
    const items: PdfTextItem[] = [
      item("Верхній тиждень", 284, 795, 1),
      item("14.09.2026", 36, 692, 1),
      item("15.09.2026", 36, 494, 1),
      ...lesson(5, "14:30", "15:45", "Маркетинг п", "викладач → 101", 746, 1),
      ...lesson(6, "16:00", "17:15", "Фінанси Л", "викладач → online", 768, 2),
      ...lesson(4, "13:00", "14:15", "Менеджмент п", "викладач → 202", 671, 2),
      item("дані конференції", 358, 700, 2),
      item("Код доступу:", 359, 680, 2),
    ];
    const result = parsePositionedItems(items);
    expect(result.lessons.map((entry) => [entry.period, entry.sourceDate])).toEqual([
      [5, "2026-09-14"],
      [6, "2026-09-14"],
      [4, "2026-09-15"],
    ]);
    expect(result.lessons.some((entry) => entry.subject.includes("конференції"))).toBe(false);
  });
});

function item(text: string, x: number, y: number, page: number): PdfTextItem {
  return { text, x, y, page };
}

function lesson(
  period: number,
  start: string,
  end: string,
  subject: string,
  details: string,
  startY: number,
  page: number,
): PdfTextItem[] {
  const middleY = startY - 6.75;
  const detailY = startY - 13.5;
  return [
    item(String(period), 111.8, middleY, page),
    item(start, 120.8, startY, page),
    item(end, 120.8, detailY, page),
    item(subject, 151.1, startY, page),
    item(details, 151.1, detailY, page),
  ];
}
