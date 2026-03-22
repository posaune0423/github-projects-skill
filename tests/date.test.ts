import { describe, expect, test } from "bun:test";

import { extractDueDate } from "../src/utils/date.ts";

describe("extractDueDate", () => {
  test("extracts explicit ISO dates", () => {
    const dueDate = extractDueDate("Ship this by 2026-04-01 please", new Date("2026-03-23T00:00:00Z"));
    expect(dueDate).toBe("2026-04-01");
  });

  test("supports simple relative dates", () => {
    const dueDate = extractDueDate("Need this tomorrow", new Date("2026-03-23T12:00:00Z"));
    expect(dueDate).toBe("2026-03-24");
  });
});
