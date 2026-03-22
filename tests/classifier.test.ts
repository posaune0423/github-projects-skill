import { describe, expect, test } from "bun:test";

import { createHeuristicIssueClassifier } from "../src/utils/classifier.ts";
import type { IntakeContext } from "../src/utils/types.ts";

const context: IntakeContext = {
  repo: {
    owner: "acme",
    repo: "app",
  },
  project: {
    owner: "acme",
    projectNumber: 1,
  },
  projectMetadata: {
    id: "PVT_project",
    title: "Roadmap",
    fields: [
      {
        id: "status",
        name: "Status",
        dataType: "SINGLE_SELECT",
        options: [{ id: "todo", name: "Todo" }],
      },
      {
        id: "priority",
        name: "Priority",
        dataType: "SINGLE_SELECT",
        options: [
          { id: "p0", name: "P0" },
          { id: "p2", name: "P2" },
        ],
      },
      {
        id: "type",
        name: "Type",
        dataType: "SINGLE_SELECT",
        options: [
          { id: "bug", name: "Bug" },
          { id: "feature", name: "Feature" },
        ],
      },
    ],
  },
  existingLabels: ["bug", "documentation"],
  existingMilestones: [],
  now: "2026-03-23T00:00:00.000Z",
};

describe("createHeuristicIssueClassifier", () => {
  test("classifies labels, due date, and project fields", async () => {
    const classifier = createHeuristicIssueClassifier(() => new Date("2026-03-23T00:00:00Z"));
    const result = await classifier.classify({
      text: "Bug: checkout is broken and needs a fix by tomorrow. This is urgent.",
      context,
    });

    expect(result.labels).toContain("bug");
    expect(result.dueDate).toBe("2026-03-24");
    expect(result.projectFields.Status).toEqual({
      kind: "single_select",
      optionName: "Todo",
    });
    expect(result.projectFields.Priority).toEqual({
      kind: "single_select",
      optionName: "P0",
    });
    expect(result.projectFields.Type).toEqual({
      kind: "single_select",
      optionName: "Bug",
    });
  });
});
