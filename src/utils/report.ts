import { isOverdue } from "./date.ts";
import type { HygieneReport, ProjectItem, WeeklyReport } from "./types.ts";

function formatItemLine(item: ProjectItem, dateFieldName: string): string {
  const issue = item.issue;
  if (!issue) {
    return `- Draft: ${item.draftTitle ?? "Untitled draft"}`;
  }

  const due = item.fieldValues[dateFieldName];
  const dueText = typeof due === "string" ? ` due ${due}` : "";
  return `- #${issue.number} ${issue.title}${dueText}`;
}

function buildStatusBuckets(items: ProjectItem[], statusFieldName: string): Record<string, ProjectItem[]> {
  const buckets: Record<string, ProjectItem[]> = {};
  for (const item of items) {
    const rawStatus = item.fieldValues[statusFieldName];
    const status = typeof rawStatus === "string" && rawStatus ? rawStatus : "Unspecified";
    buckets[status] ??= [];
    buckets[status]!.push(item);
  }

  return buckets;
}

export function createWeeklyReport(
  items: ProjectItem[],
  options: {
    now: Date;
    dateFieldName: string;
    statusFieldName: string;
  },
): WeeklyReport {
  const overdueItems = items.filter((item) => {
    const dueDate = item.fieldValues[options.dateFieldName];
    return typeof dueDate === "string" && isOverdue(dueDate, options.now);
  });
  const unassignedItems = items.filter((item) => item.issue && item.issue.assignees.length === 0);
  const staleItems = items.filter((item) => {
    const updatedAt = item.issue?.updatedAt;
    if (!updatedAt) {
      return false;
    }

    const updatedDate = new Date(updatedAt);
    return !Number.isNaN(updatedDate.getTime()) && (options.now.getTime() - updatedDate.getTime()) / 86400000 >= 7;
  });

  const statusBuckets = buildStatusBuckets(items, options.statusFieldName);
  const doneCount = Object.entries(statusBuckets).reduce((count, [status, value]) => {
    return /\bdone|complete|closed|shipped\b/i.test(status) ? count + value.length : count;
  }, 0);

  const markdown = [
    "# Weekly Project Report",
    "",
    `- Total items: ${items.length}`,
    `- Done: ${doneCount}`,
    `- Overdue: ${overdueItems.length}`,
    `- Unassigned: ${unassignedItems.length}`,
    `- Stale: ${staleItems.length}`,
    "",
    "## Status Breakdown",
    ...Object.entries(statusBuckets)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, value]) => `- ${status}: ${value.length}`),
    "",
    "## Overdue",
    ...(overdueItems.length > 0 ? overdueItems.map((item) => formatItemLine(item, options.dateFieldName)) : ["- None"]),
    "",
    "## Unassigned",
    ...(unassignedItems.length > 0
      ? unassignedItems.map((item) => formatItemLine(item, options.dateFieldName))
      : ["- None"]),
  ].join("\n");

  return {
    markdown,
    totals: {
      total: items.length,
      done: doneCount,
      overdue: overdueItems.length,
      unassigned: unassignedItems.length,
      stale: staleItems.length,
    },
  };
}

export function createHygieneReport(
  items: ProjectItem[],
  options: {
    now: Date;
    dateFieldName: string;
  },
): HygieneReport {
  const missingDueDate = items.filter((item) => item.issue && !item.fieldValues[options.dateFieldName]);
  const missingLabels = items.filter((item) => item.issue && item.issue.labels.length === 0);
  const missingAssignee = items.filter((item) => item.issue && item.issue.assignees.length === 0);
  const overdue = items.filter((item) => {
    const dueDate = item.fieldValues[options.dateFieldName];
    return typeof dueDate === "string" && isOverdue(dueDate, options.now);
  });

  const markdown = [
    "# Project Hygiene Report",
    "",
    `- Missing due date: ${missingDueDate.length}`,
    `- Missing labels: ${missingLabels.length}`,
    `- Missing assignee: ${missingAssignee.length}`,
    `- Overdue: ${overdue.length}`,
    "",
    "## Missing Due Date",
    ...(missingDueDate.length > 0
      ? missingDueDate.map((item) => formatItemLine(item, options.dateFieldName))
      : ["- None"]),
    "",
    "## Missing Labels",
    ...(missingLabels.length > 0
      ? missingLabels.map((item) => formatItemLine(item, options.dateFieldName))
      : ["- None"]),
    "",
    "## Overdue",
    ...(overdue.length > 0 ? overdue.map((item) => formatItemLine(item, options.dateFieldName)) : ["- None"]),
  ].join("\n");

  return {
    markdown,
    totals: {
      total: items.length,
      done: 0,
      overdue: overdue.length,
      unassigned: missingAssignee.length,
      stale: 0,
    },
  };
}
