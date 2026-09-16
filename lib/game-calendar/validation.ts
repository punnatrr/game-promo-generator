import {
  CALENDAR_CATEGORIES,
  CALENDAR_STATUSES,
  type CalendarCategory,
  type CalendarEventFilters,
  type CalendarStatus,
} from "./types";

function integer(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export function readCalendarFilters(url: URL): CalendarEventFilters {
  const params = url.searchParams;
  const category = params.get("category") as CalendarCategory | null;
  const status = params.get("status") as CalendarStatus | null;
  const upcoming = integer(params.get("upcomingDays"), 0, 0, 30);
  return {
    game: params.get("game") || undefined,
    category:
      category && CALENDAR_CATEGORIES.includes(category)
        ? category
        : undefined,
    status:
      status && CALENDAR_STATUSES.includes(status) ? status : undefined,
    region: params.get("region")?.slice(0, 80) || undefined,
    server: params.get("server")?.slice(0, 80) || undefined,
    officialOnly: params.get("officialOnly") === "1",
    communityTrend: params.get("communityTrend") === "1",
    minImportance: params.has("minImportance")
      ? integer(params.get("minImportance"), 0, 0, 100)
      : undefined,
    minOpportunity: params.has("minOpportunity")
      ? integer(params.get("minOpportunity"), 0, 0, 100)
      : undefined,
    query: params.get("q")?.trim().slice(0, 200) || undefined,
    dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(params.get("dateFrom") || "")
      ? params.get("dateFrom")!
      : undefined,
    dateTo: /^\d{4}-\d{2}-\d{2}$/.test(params.get("dateTo") || "")
      ? params.get("dateTo")!
      : undefined,
    upcomingDays: upcoming === 7 || upcoming === 30 ? upcoming : undefined,
    newToday: params.get("newToday") === "1",
    endingSoon: params.get("endingSoon") === "1",
    unconfirmed: params.get("unconfirmed") === "1",
    sort: [
      "start_asc",
      "start_desc",
      "importance",
      "opportunity",
      "newest",
    ].includes(params.get("sort") || "")
      ? (params.get("sort") as CalendarEventFilters["sort"])
      : undefined,
    page: integer(params.get("page"), 1, 1, 10_000),
    limit: integer(params.get("limit"), 50, 1, 100),
  };
}
