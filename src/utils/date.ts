const DAY_MS = 24 * 60 * 60 * 1000;

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function daysBetween(base: Date, target: Date): number {
  return Math.round((startOfUtcDay(target).getTime() - startOfUtcDay(base).getTime()) / DAY_MS);
}

export function isOverdue(dueDate: string | undefined, now: Date): boolean {
  const parsed = parseIsoDate(dueDate);
  if (!parsed) {
    return false;
  }

  return daysBetween(now, parsed) < 0;
}

export function extractDueDate(text: string, now: Date): string | undefined {
  const normalized = text.toLowerCase();

  const isoMatch = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch?.[1]) {
    return isoMatch[1];
  }

  const slashMatch = normalized.match(/\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/);
  if (slashMatch) {
    const year = slashMatch[1];
    const month = slashMatch[2]!.padStart(2, "0");
    const day = slashMatch[3]!.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const relativePatterns: Array<{ pattern: RegExp; delta: number }> = [
    { pattern: /\btoday\b/, delta: 0 },
    { pattern: /\btomorrow\b/, delta: 1 },
    { pattern: /\bnext week\b/, delta: 7 },
    { pattern: /\bthis week\b/, delta: 5 },
    { pattern: /\bthis month\b/, delta: 14 },
  ];

  for (const candidate of relativePatterns) {
    if (!candidate.pattern.test(normalized)) {
      continue;
    }

    return toIsoDate(new Date(startOfUtcDay(now).getTime() + candidate.delta * DAY_MS));
  }

  return undefined;
}
