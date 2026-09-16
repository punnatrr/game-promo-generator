import {
  getActivity,
  listActivities,
  listGames,
} from "@/lib/game-content/repository";

import { activityToCalendarEvent, mergeCalendarEvents } from "./logic";
import type {
  CalendarEventFilters,
  CalendarGame,
} from "./types";

const PUBLIC_WORKFLOW_STATUSES = new Set([
  "APPROVED",
  "PLANNED",
  "DESIGNING",
  "SCHEDULED",
  "PUBLISHED",
]);

function dateValue(value: string | null, fallback: string) {
  return new Date(value || fallback).getTime();
}

export async function listCalendarGames(): Promise<CalendarGame[]> {
  return (await listGames(true)).map((game) => ({
    id: game.id,
    slug: game.slug,
    name: game.name,
    iconUrl: game.iconUrl,
  }));
}

export async function listPublicCalendarEvents(
  filters: CalendarEventFilters = {}
) {
  const [activities, games] = await Promise.all([
    listActivities(),
    listGames(),
  ]);
  const icons = new Map(games.map((game) => [game.id, game.iconUrl]));
  let events = mergeCalendarEvents(
    activities
      .filter((activity) => PUBLIC_WORKFLOW_STATUSES.has(activity.status))
      .map((activity) =>
        activityToCalendarEvent(activity, icons.get(activity.gameId) || null)
      )
      .filter((event) => !event.requiresReview && !event.isDemo)
  );

  if (filters.game) {
    events = events.filter(
      (event) =>
        event.gameId === filters.game || event.gameSlug === filters.game
    );
  }
  if (filters.category) {
    events = events.filter((event) => event.category === filters.category);
  }
  if (filters.status) {
    events = events.filter((event) => event.status === filters.status);
  }
  if (filters.region) {
    events = events.filter((event) => event.region === filters.region);
  }
  if (filters.server) {
    events = events.filter((event) => event.server === filters.server);
  }
  if (filters.officialOnly) {
    events = events.filter((event) => event.isOfficial);
  }
  if (filters.communityTrend) {
    events = events.filter(
      (event) =>
        event.category === "COMMUNITY_TREND" ||
        event.communityInterest.score >= 70
    );
  }
  if (filters.minImportance !== undefined) {
    events = events.filter(
      (event) => event.importance.score >= filters.minImportance!
    );
  }
  if (filters.minOpportunity !== undefined) {
    events = events.filter(
      (event) => event.contentOpportunity.score >= filters.minOpportunity!
    );
  }
  if (filters.unconfirmed) {
    events = events.filter(
      (event) => event.isRumor || event.status === "UNCONFIRMED"
    );
  }
  if (filters.query) {
    const query = filters.query.normalize("NFKC").toLocaleLowerCase("th");
    events = events.filter((event) =>
      [
        event.title,
        event.titleTh,
        event.summaryTh,
        event.gameName,
        ...event.featuredCharacters,
        ...event.featuredSkins,
        ...event.featuredItems,
        ...event.keywords,
      ]
        .join(" ")
        .normalize("NFKC")
        .toLocaleLowerCase("th")
        .includes(query)
    );
  }

  const now = Date.now();
  if (filters.newToday) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
    events = events.filter(
      (event) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(event.firstDetectedAt)) === today
    );
  }
  if (filters.upcomingDays) {
    const until = now + filters.upcomingDays * 86_400_000;
    events = events.filter((event) => {
      if (!event.startDate) return false;
      const start = new Date(event.startDate).getTime();
      return start >= now && start <= until;
    });
  }
  if (filters.endingSoon) {
    const until = now + 3 * 86_400_000;
    events = events.filter((event) => {
      if (!event.endDate) return false;
      const end = new Date(event.endDate).getTime();
      return end >= now && end <= until;
    });
  }
  if (filters.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00+07:00`).getTime();
    events = events.filter(
      (event) => dateValue(event.startDate, event.firstDetectedAt) >= from
    );
  }
  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59+07:00`).getTime();
    events = events.filter(
      (event) => dateValue(event.startDate, event.firstDetectedAt) <= to
    );
  }

  const sort = filters.sort || "start_asc";
  events.sort((first, second) => {
    if (sort === "importance") {
      return second.importance.score - first.importance.score;
    }
    if (sort === "opportunity") {
      return second.contentOpportunity.score - first.contentOpportunity.score;
    }
    if (sort === "newest") {
      return (
        new Date(second.firstDetectedAt).getTime() -
        new Date(first.firstDetectedAt).getTime()
      );
    }
    const firstDate = dateValue(first.startDate, first.firstDetectedAt);
    const secondDate = dateValue(second.startDate, second.firstDetectedAt);
    return sort === "start_desc"
      ? secondDate - firstDate
      : firstDate - secondDate;
  });

  const page = Math.max(1, filters.page || 1);
  const limit = Math.max(1, Math.min(100, filters.limit || 50));
  const total = events.length;
  const items = events.slice((page - 1) * limit, page * limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getPublicCalendarEvent(id: string) {
  const [activity, games] = await Promise.all([getActivity(id), listGames()]);
  if (!activity || !PUBLIC_WORKFLOW_STATUSES.has(activity.status)) return null;
  const gameIcon = games.find((game) => game.id === activity.gameId)?.iconUrl;
  const event = activityToCalendarEvent(activity, gameIcon || null);
  return event.requiresReview || event.isDemo ? null : event;
}

export async function getCalendarDashboardSummary() {
  const { items } = await listPublicCalendarEvents({
    limit: 100,
    sort: "newest",
  });
  const now = Date.now();
  const inRange = (value: string | null, days: number) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return time >= now && time <= now + days * 86_400_000;
  };
  return {
    newToday: items.filter(
      (event) =>
        now - new Date(event.firstDetectedAt).getTime() <= 86_400_000
    ).length,
    new24Hours: items.filter(
      (event) =>
        now - new Date(event.firstDetectedAt).getTime() <= 86_400_000
    ).length,
    startsWithin7Days: items.filter((event) => inRange(event.startDate, 7))
      .length,
    startsWithin30Days: items.filter((event) => inRange(event.startDate, 30))
      .length,
    endsWithin3Days: items.filter((event) => inRange(event.endDate, 3)).length,
    highOpportunity: items.filter(
      (event) => event.contentOpportunity.score >= 70
    ).length,
    featured: items.filter((event) => event.isFeatured).slice(0, 10),
    latest: items.slice(0, 10),
  };
}
