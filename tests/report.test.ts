import { describe, expect, test } from "bun:test";

import { createHygieneReport, createWeeklyReport } from "../src/utils/report.ts";
import type { ProjectItem } from "../src/utils/types.ts";

const items: ProjectItem[] = [
  {
    id: "item-1",
    contentType: "Issue",
    issue: {
      id: "issue-1",
      number: 1,
      title: "Overdue bug",
      body: "body",
      url: "https://example.com/1",
      state: "OPEN",
      assignees: [],
      labels: ["bug"],
      updatedAt: "2026-03-10T00:00:00Z",
    },
    fieldValues: {
      Status: "In Progress",
      "Due Date": "2026-03-20",
    },
  },
  {
    id: "item-2",
    contentType: "Issue",
    issue: {
      id: "issue-2",
      number: 2,
      title: "Done task",
      body: "body",
      url: "https://example.com/2",
      state: "OPEN",
      assignees: ["dev1"],
      labels: [],
      updatedAt: "2026-03-22T00:00:00Z",
    },
    fieldValues: {
      Status: "Done",
    },
  },
];

describe("reports", () => {
  test("builds a weekly report", () => {
    const report = createWeeklyReport(items, {
      now: new Date("2026-03-23T00:00:00Z"),
      dateFieldName: "Due Date",
      statusFieldName: "Status",
    });

    expect(report.totals.total).toBe(2);
    expect(report.totals.done).toBe(1);
    expect(report.totals.overdue).toBe(1);
    expect(report.markdown).toContain("Weekly Project Report");
    expect(report.markdown).toContain("#1 Overdue bug due 2026-03-20");
  });

  test("builds a hygiene report", () => {
    const report = createHygieneReport(items, {
      now: new Date("2026-03-23T00:00:00Z"),
      dateFieldName: "Due Date",
    });

    expect(report.markdown).toContain("Project Hygiene Report");
    expect(report.markdown).toContain("Missing due date: 1");
    expect(report.markdown).toContain("Missing labels: 1");
    expect(report.markdown).toContain("Overdue: 1");
  });
});
