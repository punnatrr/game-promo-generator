export const DISCOVERY_LOOKBACK_DAYS = 7;

export function isFreshGameUpdate(
  item: { publishedAt: string; title: string; description: string },
  now = new Date()
) {
  const publishedAt = new Date(item.publishedAt).getTime();
  if (Number.isNaN(publishedAt)) return false;

  const lookbackWindow =
    DISCOVERY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const futureTolerance = 2 * 60 * 60 * 1000;
  if (
    publishedAt < now.getTime() - lookbackWindow ||
    publishedAt > now.getTime() + futureTolerance
  ) {
    return false;
  }

  const content = `${item.title} ${item.description}`;
  const currentYear = now.getFullYear();
  const currentBuddhistYear = currentYear + 543;
  const staleYears = [
    ...Array.from({ length: 8 }, (_, index) => currentYear - index - 1),
    ...Array.from(
      { length: 8 },
      (_, index) => currentBuddhistYear - index - 1
    ),
  ];

  return !staleYears.some((year) => content.includes(String(year)));
}
