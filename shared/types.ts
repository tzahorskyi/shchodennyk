export type WeekType = "upper" | "lower";

export interface LessonDraft {
  weekType: WeekType;
  weekday: number;
  period: number;
  startsAt: string;
  endsAt: string;
  subject: string;
  lessonType: string;
  teacher: string;
  location: string;
  sourceDate?: string;
  warning?: string;
}

export interface HomeworkData {
  id: number | null;
  content: string;
  version: number;
  updatedAt: string | null;
}

export interface LessonOccurrence {
  id: number;
  date: string;
  weekday: number;
  period: number;
  startsAt: string;
  endsAt: string;
  subject: string;
  lessonType: string;
  teacher: string;
  location: string;
  homework: HomeworkData;
}

export interface WeekResponse {
  monday: string;
  weekType: WeekType;
  scheduleVersionId: number | null;
  lessons: LessonOccurrence[];
}

export interface HomeworkRevision {
  id: number;
  content: string;
  version: number;
  createdAt: string;
}

export interface AdminSessionResponse {
  authenticated: boolean;
  guestPath?: string;
}

export interface SchedulePeriod {
  id: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  anchorMonday: string;
}
