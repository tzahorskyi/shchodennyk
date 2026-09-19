import type { WeekType } from "./types";

const DAY_MS = 86_400_000;

export function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Некоректна дата");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, amount: number): string {
  const date = parseIsoDate(isoDate);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatIsoDate(date);
}

export function mondayOf(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return formatIsoDate(date);
}

export function weekTypeFor(
  monday: string,
  anchorMonday: string,
  upperOnAnchor: boolean,
): WeekType {
  const difference = Math.round(
    (parseIsoDate(monday).getTime() - parseIsoDate(anchorMonday).getTime()) / DAY_MS / 7,
  );
  const anchorUpper = Math.abs(difference) % 2 === 0 ? upperOnAnchor : !upperOnAnchor;
  return anchorUpper ? "upper" : "lower";
}

export function weekdayFor(isoDate: string): number {
  return parseIsoDate(isoDate).getUTCDay() || 7;
}

