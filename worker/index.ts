import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { addDays, weekTypeFor } from "../shared/calendar";
import type {
  AdminSessionResponse,
  HomeworkRevision,
  LessonDraft,
  LessonOccurrence,
  SchedulePeriod,
  WeekResponse,
} from "../shared/types";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  GUEST_TOKEN: string;
  ADMIN_TOKEN: string;
  PIN_PEPPER: string;
  ADMIN_PIN_HASH: string;
  SESSION_SECRET: string;
}

interface ScheduleVersionRow {
  id: number;
  effective_from: string;
  anchor_monday: string;
  upper_on_anchor: number;
  effective_until: string | null;
}

interface LessonRow {
  id: number;
  weekday: number;
  period: number;
  starts_at: string;
  ends_at: string;
  subject: string;
  lesson_type: string;
  teacher: string;
  location: string;
  homework_id: number | null;
  homework_content: string | null;
  homework_version: number | null;
  homework_updated_at: string | null;
}

interface HomeworkRow {
  id: number;
  content: string;
  version: number;
  updated_at: string;
}

const app = new Hono<{ Bindings: Env }>();
const textEncoder = new TextEncoder();
const MAX_HOMEWORK_LENGTH = 4000;

app.use("*", async (context, next) => {
  await next();
  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Frame-Options", "DENY");
  context.header("Referrer-Policy", "no-referrer");
  context.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  context.header("X-Robots-Tag", "noindex, nofollow, noarchive");
  context.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
});

app.get("/api/health", (context) => context.json({ ok: true }));

app.get("/api/guest/:token/week", async (context) => {
  assertGuestToken(context.req.param("token"), context.env);
  const monday = requireDate(context.req.query("monday"));
  return context.json(await loadWeek(context.env.DB, monday));
});

app.patch("/api/guest/:token/homework/:lessonId/:date", async (context) => {
  assertGuestToken(context.req.param("token"), context.env);
  assertSameOrigin(context.req.raw);
  const lessonId = requirePositiveInteger(context.req.param("lessonId"));
  const lessonDate = requireDate(context.req.param("date"));
  const body = await context.req.json<{ content?: unknown; version?: unknown }>();
  const content = requireHomework(body.content);
  const expectedVersion = requireNonNegativeInteger(body.version);

  const lessonExists = await context.env.DB.prepare(
    "SELECT id FROM lesson_templates WHERE id = ?1 AND weekday = ?2",
  )
    .bind(lessonId, isoWeekday(lessonDate))
    .first();
  if (!lessonExists) return context.json({ error: "Пару не знайдено." }, 404);

  const existing = await context.env.DB.prepare(
    "SELECT id, content, version, updated_at FROM homework WHERE lesson_template_id = ?1 AND lesson_date = ?2",
  )
    .bind(lessonId, lessonDate)
    .first<HomeworkRow>();

  if (!existing) {
    if (expectedVersion !== 0) return homeworkConflict(context.env.DB, lessonId, lessonDate, context);
    try {
      const result = await context.env.DB.prepare(
        "INSERT INTO homework (lesson_template_id, lesson_date, content) VALUES (?1, ?2, ?3)",
      )
        .bind(lessonId, lessonDate, content)
        .run();
      return context.json({
        id: Number(result.meta.last_row_id),
        content,
        version: 1,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      return homeworkConflict(context.env.DB, lessonId, lessonDate, context);
    }
  }

  if (existing.version !== expectedVersion) {
    return context.json({ error: "Це завдання вже змінили.", current: toHomework(existing) }, 409);
  }

  const newVersion = existing.version + 1;
  const results = await context.env.DB.batch([
    context.env.DB
      .prepare(
        "UPDATE homework SET content = ?1, version = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?3 AND version = ?4",
      )
      .bind(content, newVersion, existing.id, existing.version),
    context.env.DB
      .prepare(
        "INSERT INTO homework_revisions (homework_id, content, version) SELECT ?1, ?2, ?3 WHERE changes() = 1",
      )
      .bind(existing.id, existing.content, existing.version),
  ]);

  if (Number(results[0].meta.changes) !== 1) {
    return homeworkConflict(context.env.DB, lessonId, lessonDate, context);
  }
  const saved = await context.env.DB.prepare(
    "SELECT id, content, version, updated_at FROM homework WHERE id = ?1",
  )
    .bind(existing.id)
    .first<HomeworkRow>();
  return context.json(toHomework(saved!));
});

app.post("/api/admin/:token/login", async (context) => {
  assertAdminToken(context.req.param("token"), context.env);
  assertSameOrigin(context.req.raw);
  const body = await context.req.json<{ pin?: unknown }>();
  if (typeof body.pin !== "string" || body.pin.length < 4 || body.pin.length > 32) {
    return context.json({ error: "Невірний PIN." }, 401);
  }
  const suppliedHash = await sha256Hex(`${context.env.PIN_PEPPER}:${body.pin}`);
  if (!safeEqual(suppliedHash, context.env.ADMIN_PIN_HASH.toLowerCase())) {
    return context.json({ error: "Невірний PIN." }, 401);
  }
  const expiresAt = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const session = await signSession(expiresAt, context.env.SESSION_SECRET);
  setCookie(context, "admin_session", session, {
    httpOnly: true,
    secure: new URL(context.req.url).hostname !== "localhost",
    sameSite: "Strict",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return context.json({ authenticated: true, guestPath: `/c/${context.env.GUEST_TOKEN}` });
});

app.post("/api/admin/:token/logout", async (context) => {
  assertAdminToken(context.req.param("token"), context.env);
  assertSameOrigin(context.req.raw);
  deleteCookie(context, "admin_session", { path: "/" });
  return context.json({ ok: true });
});

app.get("/api/admin/:token/session", async (context) => {
  assertAdminToken(context.req.param("token"), context.env);
  const authenticated = await hasAdminSession(context, context.env);
  const response: AdminSessionResponse = authenticated
    ? { authenticated: true, guestPath: `/c/${context.env.GUEST_TOKEN}` }
    : { authenticated: false };
  return context.json(response);
});

app.get("/api/admin/:token/schedule/current", async (context) => {
  assertAdminToken(context.req.param("token"), context.env);
  if (!(await hasAdminSession(context, context.env))) {
    return context.json({ error: "Потрібен вхід адміністратора." }, 401);
  }
  const row = await context.env.DB.prepare(
    "SELECT id, effective_from, effective_until, anchor_monday FROM schedule_versions ORDER BY effective_from DESC, id DESC LIMIT 1",
  ).first<{ id: number; effective_from: string; effective_until: string | null; anchor_monday: string }>();
  const schedule: SchedulePeriod | null = row ? {
    id: row.id,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    anchorMonday: row.anchor_monday,
  } : null;
  return context.json({ schedule });
});

app.patch("/api/admin/:token/schedule/current", async (context) => {
  assertAdminToken(context.req.param("token"), context.env);
  assertSameOrigin(context.req.raw);
  if (!(await hasAdminSession(context, context.env))) {
    return context.json({ error: "Потрібен вхід адміністратора." }, 401);
  }
  const body = await context.req.json<{ effectiveUntil?: unknown }>();
  const effectiveUntil = requireDate(body.effectiveUntil);
  const current = await context.env.DB.prepare(
    "SELECT id, effective_from FROM schedule_versions ORDER BY effective_from DESC, id DESC LIMIT 1",
  ).first<{ id: number; effective_from: string }>();
  if (!current) return context.json({ error: "Спочатку імпортуйте розклад." }, 404);
  if (effectiveUntil < current.effective_from) {
    return context.json({ error: "Кінець семестру не може бути раніше початку." }, 400);
  }
  await context.env.DB.prepare("UPDATE schedule_versions SET effective_until = ?1 WHERE id = ?2")
    .bind(effectiveUntil, current.id).run();
  return context.json({ id: current.id, effectiveFrom: current.effective_from, effectiveUntil });
});

app.post("/api/admin/:token/schedule", async (context) => {
  assertAdminToken(context.req.param("token"), context.env);
  assertSameOrigin(context.req.raw);
  if (!(await hasAdminSession(context, context.env))) {
    return context.json({ error: "Потрібен вхід адміністратора." }, 401);
  }
  const body = await context.req.json<{ anchorMonday?: unknown; effectiveUntil?: unknown; lessons?: unknown }>();
  const anchorMonday = requireDate(body.anchorMonday);
  const effectiveUntil = requireDate(body.effectiveUntil);
  const lessons = requireLessons(body.lessons);
  if (isoWeekday(anchorMonday) !== 1) {
    return context.json({ error: "Опорна дата має бути понеділком." }, 400);
  }
  if (effectiveUntil < anchorMonday) {
    return context.json({ error: "Кінець семестру не може бути раніше початку." }, 400);
  }

  const versionResult = await context.env.DB.prepare(
    "INSERT INTO schedule_versions (effective_from, effective_until, anchor_monday, upper_on_anchor) VALUES (?1, ?2, ?1, 1)",
  )
    .bind(anchorMonday, effectiveUntil)
    .run();
  const versionId = Number(versionResult.meta.last_row_id);
  try {
    await context.env.DB.batch(
      lessons.map((lesson) =>
        context.env.DB
          .prepare(
            `INSERT INTO lesson_templates
              (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
          )
          .bind(
            versionId,
            lesson.weekType,
            lesson.weekday,
            lesson.period,
            lesson.startsAt,
            lesson.endsAt,
            lesson.subject,
            lesson.lessonType,
            lesson.teacher,
            lesson.location,
          ),
      ),
    );
  } catch (error) {
    await context.env.DB.prepare("DELETE FROM schedule_versions WHERE id = ?1").bind(versionId).run();
    throw error;
  }
  return context.json({ id: versionId, lessons: lessons.length }, 201);
});

app.get("/api/admin/:token/revisions/:homeworkId", async (context) => {
  assertAdminToken(context.req.param("token"), context.env);
  if (!(await hasAdminSession(context, context.env))) {
    return context.json({ error: "Потрібен вхід адміністратора." }, 401);
  }
  const homeworkId = requirePositiveInteger(context.req.param("homeworkId"));
  const result = await context.env.DB.prepare(
    "SELECT id, content, version, created_at FROM homework_revisions WHERE homework_id = ?1 ORDER BY id DESC LIMIT 30",
  )
    .bind(homeworkId)
    .all<{ id: number; content: string; version: number; created_at: string }>();
  const revisions: HomeworkRevision[] = result.results.map((row) => ({
    id: row.id,
    content: row.content,
    version: row.version,
    createdAt: row.created_at,
  }));
  return context.json({ revisions });
});

app.post("/api/admin/:token/homework/:homeworkId/restore/:revisionId", async (context) => {
  assertAdminToken(context.req.param("token"), context.env);
  assertSameOrigin(context.req.raw);
  if (!(await hasAdminSession(context, context.env))) {
    return context.json({ error: "Потрібен вхід адміністратора." }, 401);
  }
  const homeworkId = requirePositiveInteger(context.req.param("homeworkId"));
  const revisionId = requirePositiveInteger(context.req.param("revisionId"));
  const body = await context.req.json<{ version?: unknown }>().catch(() => null);
  const requestedVersion = body?.version === undefined ? null : requireNonNegativeInteger(body.version);
  const current = await context.env.DB.prepare(
    "SELECT id, content, version, updated_at FROM homework WHERE id = ?1",
  )
    .bind(homeworkId)
    .first<HomeworkRow>();
  const revision = await context.env.DB.prepare(
    "SELECT id, content, version FROM homework_revisions WHERE id = ?1 AND homework_id = ?2",
  )
    .bind(revisionId, homeworkId)
    .first<{ id: number; content: string; version: number }>();
  if (!current || !revision) return context.json({ error: "Версію не знайдено." }, 404);
  const expectedVersion = requestedVersion ?? current.version;
  if (requestedVersion !== null && current.version !== expectedVersion) {
    return context.json({ error: "Це завдання вже змінили.", current: toHomework(current) }, 409);
  }

  const nextVersion = current.version + 1;
  const results = await context.env.DB.batch([
    context.env.DB
      .prepare(
        "UPDATE homework SET content = ?1, version = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?3 AND version = ?4",
      )
      .bind(revision.content, nextVersion, homeworkId, expectedVersion),
    context.env.DB
      .prepare("INSERT INTO homework_revisions (homework_id, content, version) SELECT ?1, ?2, ?3 WHERE changes() = 1")
      .bind(homeworkId, current.content, current.version),
  ]);
  if (Number(results[0].meta.changes) !== 1) {
    return homeworkConflictById(context.env.DB, homeworkId, context);
  }
  const restored = await context.env.DB.prepare(
    "SELECT id, content, version, updated_at FROM homework WHERE id = ?1",
  )
    .bind(homeworkId)
    .first<HomeworkRow>();
  return context.json(toHomework(restored!));
});

async function loadWeek(db: D1Database, monday: string): Promise<WeekResponse> {
  const schedule = await db
    .prepare(
      "SELECT id, effective_from, effective_until, anchor_monday, upper_on_anchor FROM schedule_versions WHERE effective_from <= ?1 ORDER BY effective_from DESC, id DESC LIMIT 1",
    )
    .bind(monday)
    .first<ScheduleVersionRow>();
  if (!schedule) return { monday, weekType: null, scheduleVersionId: null, lessons: [] };
  if (schedule.effective_until && monday > schedule.effective_until) {
    return { monday, weekType: weekTypeFor(monday, schedule.anchor_monday, Boolean(schedule.upper_on_anchor)), scheduleVersionId: schedule.id, lessons: [] };
  }

  const weekType = weekTypeFor(monday, schedule.anchor_monday, Boolean(schedule.upper_on_anchor));
  const endDate = addDays(monday, 6);
  const result = await db
    .prepare(
      `SELECT l.id, l.weekday, l.period, l.starts_at, l.ends_at, l.subject, l.lesson_type, l.teacher, l.location,
              h.id AS homework_id, h.content AS homework_content, h.version AS homework_version, h.updated_at AS homework_updated_at
       FROM lesson_templates l
       LEFT JOIN homework h ON h.lesson_template_id = l.id AND h.lesson_date BETWEEN ?3 AND ?4
       WHERE l.schedule_version_id = ?1 AND l.week_type = ?2
       ORDER BY l.weekday, l.period`,
    )
    .bind(schedule.id, weekType, monday, endDate)
    .all<LessonRow>();

  const lessons: LessonOccurrence[] = result.results.map((row) => ({
    id: row.id,
    date: addDays(monday, row.weekday - 1),
    weekday: row.weekday,
    period: row.period,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    subject: row.subject,
    lessonType: row.lesson_type,
    teacher: row.teacher,
    location: row.location,
    homework: {
      id: row.homework_id,
      content: row.homework_content ?? "",
      version: row.homework_version ?? 0,
      updatedAt: row.homework_updated_at,
    },
  })).filter((lesson) => !schedule.effective_until || lesson.date <= schedule.effective_until);
  return { monday, weekType, scheduleVersionId: schedule.id, lessons };
}

function requireLessons(value: unknown): LessonDraft[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    throw new HTTPError(400, "Розклад має містити від 1 до 100 занять.");
  }
  const lessons = value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new HTTPError(400, "Некоректний рядок розкладу.");
    const row = raw as Record<string, unknown>;
    const lesson: LessonDraft = {
      weekType: row.weekType === "lower" ? "lower" : row.weekType === "upper" ? "upper" : fail("Тип тижня"),
      weekday: numberInRange(row.weekday, 1, 7, "День тижня"),
      period: numberInRange(row.period, 1, 20, "Номер пари"),
      startsAt: requireTime(row.startsAt),
      endsAt: requireTime(row.endsAt),
      subject: requireString(row.subject, 1, 160, "Предмет"),
      lessonType: requireString(row.lessonType ?? "", 0, 30, "Тип заняття"),
      teacher: requireString(row.teacher ?? "", 0, 120, "Викладач"),
      location: requireString(row.location ?? "", 0, 80, "Аудиторія"),
    };
    return lesson;
  });
  const keys = new Set<string>();
  for (const lesson of lessons) {
    const key = `${lesson.weekType}:${lesson.weekday}:${lesson.period}`;
    if (keys.has(key)) throw new HTTPError(400, "У розкладі є дубль номера пари.");
    keys.add(key);
  }
  return lessons;
}

class HTTPError extends Error {
  constructor(public status: 400 | 401 | 403 | 404, message: string) {
    super(message);
  }
}

app.onError((error, context) => {
  if (error instanceof HTTPError) return context.json({ error: error.message }, error.status);
  console.error(error);
  return context.json({ error: "Сталася помилка сервера." }, 500);
});

function assertGuestToken(token: string, env: Env): void {
  if (!safeEqual(token, env.GUEST_TOKEN)) throw new HTTPError(404, "Сторінку не знайдено.");
}

function assertAdminToken(token: string, env: Env): void {
  if (!safeEqual(token, env.ADMIN_TOKEN)) throw new HTTPError(404, "Сторінку не знайдено.");
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  const requestUrl = new URL(request.url);
  const originUrl = new URL(origin);
  const bothLocal = [requestUrl.hostname, originUrl.hostname].every((host) => host === "localhost" || host === "127.0.0.1");
  if (originUrl.origin !== requestUrl.origin && !bothLocal) throw new HTTPError(403, "Запит з іншого сайту заборонено.");
}

async function hasAdminSession(context: Parameters<typeof getCookie>[0], env: Env): Promise<boolean> {
  const cookie = getCookie(context, "admin_session");
  if (!cookie) return false;
  const [expiryText, signature] = cookie.split(".");
  const expiry = Number(expiryText);
  if (!signature || !Number.isInteger(expiry) || expiry <= Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(expiryText, env.SESSION_SECRET);
  return safeEqual(signature, expected);
}

async function signSession(expiresAt: number, secret: string): Promise<string> {
  const expiry = String(expiresAt);
  return `${expiry}.${await hmacHex(expiry, secret)}`;
}

async function hmacHex(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function requireDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new HTTPError(400, "Некоректна дата.");
  }
  return value;
}

function requireTime(value: unknown): string {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) fail("Час");
  return value;
}

function requireString(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== "string") fail(label);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < min || normalized.length > max || /[<>]/.test(normalized)) fail(label);
  return normalized;
}

function requireHomework(value: unknown): string {
  if (typeof value !== "string") throw new HTTPError(400, "Введіть текст завдання.");
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length > MAX_HOMEWORK_LENGTH || /[<>]/.test(normalized)) {
    throw new HTTPError(400, `До ${MAX_HOMEWORK_LENGTH} символів, без HTML.`);
  }
  return normalized;
}

function requirePositiveInteger(value: unknown): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new HTTPError(400, "Некоректний ідентифікатор.");
  return number;
}

function requireNonNegativeInteger(value: unknown): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new HTTPError(400, "Некоректна версія.");
  return number;
}

function numberInRange(value: unknown, min: number, max: number, label: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) fail(label);
  return number;
}

function fail(label: string): never {
  throw new HTTPError(400, `${label}: некоректне значення.`);
}

function isoWeekday(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay() || 7;
}

function toHomework(row: HomeworkRow) {
  return { id: row.id, content: row.content, version: row.version, updatedAt: row.updated_at };
}

async function homeworkConflict(
  db: D1Database,
  lessonId: number,
  date: string,
  context: { json: (body: unknown, status: 409) => Response },
): Promise<Response> {
  const current = await db
    .prepare("SELECT id, content, version, updated_at FROM homework WHERE lesson_template_id = ?1 AND lesson_date = ?2")
    .bind(lessonId, date)
    .first<HomeworkRow>();
  return context.json({ error: "Це завдання вже змінили.", current: current ? toHomework(current) : null }, 409);
}

async function homeworkConflictById(
  db: D1Database,
  homeworkId: number,
  context: { json: (body: unknown, status: 409) => Response },
): Promise<Response> {
  const current = await db
    .prepare("SELECT id, content, version, updated_at FROM homework WHERE id = ?1")
    .bind(homeworkId)
    .first<HomeworkRow>();
  return context.json({ error: "Це завдання вже змінили.", current: current ? toHomework(current) : null }, 409);
}

export default app;
