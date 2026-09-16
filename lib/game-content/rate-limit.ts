const attempts = new Map<string, number[]>();

export function allowAction(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(
    (timestamp) => now - timestamp < windowMs
  );
  if (recent.length >= limit) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

