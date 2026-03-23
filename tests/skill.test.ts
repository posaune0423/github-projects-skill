import { describe, expect, mock, test } from "bun:test";

import { createGitHubProjectsSkill } from "../src/skills/github-projects-ops/index.ts";
import type { GitHubClient } from "../src/utils/github.ts";
import type { IntakeClassification, IssueIntakeClassifier, ProjectField } from "../src/utils/types.ts";

function createGithubMock(options?: { failInitialProjectLookup?: boolean }): {
  github: GitHubClient;
  calls: {
    copyProject: Array<unknown>;
    createIssue: Array<unknown>;
    editIssue: Array<unknown>;
    ensureMilestone: Array<unknown>;
    ensureLabels: Array<unknown>;
    linkProject: Array<unknown>;
    setProjectFieldValue: Array<unknown>;
  };
} {
  const dueDateField: ProjectField = {
    id: "field-due",
    name: "Due Date",
    dataType: "DATE",
    options: [],
  };
  const statusField: ProjectField = {
    id: "field-status",
    name: "Status",
    dataType: "SINGLE_SELECT",
    options: [{ id: "todo", name: "Todo" }],
  };
  const priorityField: ProjectField = {
    id: "field-priority",
    name: "Priority",
    dataType: "SINGLE_SELECT",
    options: [{ id: "p0", name: "P0" }],
  };

  const calls = {
    copyProject: [] as Array<unknown>,
    createIssue: [] as Array<unknown>,
    editIssue: [] as Array<unknown>,
    ensureMilestone: [] as Array<unknown>,
    ensureLabels: [] as Array<unknown>,
    linkProject: [] as Array<unknown>,
    setProjectFieldValue: [] as Array<unknown>,
  };

  let projectMetadataCalls = 0;
  const github: GitHubClient = {
    getProjectMetadata: mock(async () => {
      projectMetadataCalls += 1;
      if (options?.failInitialProjectLookup && projectMetadataCalls === 1) {
        throw new Error("Project not found");
      }

      return {
        id: "project-id",
        title: "Roadmap",
        fields: [dueDateField, statusField, priorityField],
      };
    }),
    copyProject: mock(async (...args: unknown[]) => {
      calls.copyProject.push(args);
      return {
        id: "project-id",
        number: 7,
        title: "Roadmap",
      };
    }),
    linkProject: mock(async (...args: unknown[]) => {
      calls.linkProject.push(args);
    }),
    listLabels: mock(async () => ["bug"]),
    ensureLabels: mock(async (...args: unknown[]) => {
      calls.ensureLabels.push(args);
    }),
    listMilestones: mock(async () => []),
    ensureMilestone: mock(async (...args: unknown[]) => {
      calls.ensureMilestone.push(args);
      return {
        title: "Auto 2026-03-24",
        number: 1,
        dueDate: "2026-03-24",
      };
    }),
    ensureProjectField: mock(async () => dueDateField),
    createIssue: mock(async (...args: unknown[]) => {
      calls.createIssue.push(args);
      return {
        url: "https://github.com/acme/app/issues/42",
        number: 42,
      };
    }),
    editIssue: mock(async (...args: unknown[]) => {
      calls.editIssue.push(args);
    }),
    getIssue: mock(async () => ({
      id: "issue-id",
      number: 42,
      title: "Original title",
      body: "Needs a fix tomorrow",
      url: "https://github.com/acme/app/issues/42",
      state: "OPEN",
      assignees: [],
      labels: [],
    })),
    findProjectItemIdForIssue: mock(async () => "item-id"),
    setProjectFieldValue: mock(async (...args: unknown[]) => {
      calls.setProjectFieldValue.push(args);
    }),
    listProjectItems: mock(async () => []),
  };

  return {
    github,
    calls,
  };
}

const classification: IntakeClassification = {
  title: "Bug: checkout broken",
  body: "Bug: checkout broken and urgent. Need it tomorrow.",
  labels: ["bug"],
  milestone: {
    title: "Auto 2026-03-24",
    dueDate: "2026-03-24",
  },
  dueDate: "2026-03-24",
  projectFields: {
    Status: {
      kind: "single_select",
      optionName: "Todo",
    },
    Priority: {
      kind: "single_select",
      optionName: "P0",
    },
  },
  confidence: 0.9,
  reasoningSummary: "test",
};

const classifier: IssueIntakeClassifier = {
  name: "test",
  classify: mock(async () => classification),
};

describe("createGitHubProjectsSkill", () => {
  test("creates a project from template during setup when project is missing", async () => {
    const { github, calls } = createGithubMock({ failInitialProjectLookup: true });
    const skill = createGitHubProjectsSkill(
      {
        owner: "acme",
        repo: "app",
        projectNumber: 0,
        projectTemplateNumber: 3,
        projectTemplateOwner: "acme-org",
        projectTitle: "app project",
      },
      {
        github,
      },
    );

    const result = await skill.setupProject();

    expect(result.projectNumber).toBe(7);
    expect(result.createdFromTemplate).toBe(true);
    expect(calls.copyProject.length).toBe(1);
    expect(calls.linkProject.length).toBe(1);
  });

  test("captures an issue and sets project metadata", async () => {
    const { github, calls } = createGithubMock();
    const skill = createGitHubProjectsSkill(
      {
        owner: "acme",
        repo: "app",
        projectNumber: 1,
      },
      {
        github,
        classifier,
      },
    );

    const result = await skill.captureIssueFromText("Bug: checkout broken and urgent. Need it tomorrow.");

    expect(result.issueNumber).toBe(42);
    expect(calls.ensureLabels.length).toBe(1);
    expect(calls.createIssue.length).toBe(1);
    expect(calls.ensureMilestone.length).toBe(1);
    expect(calls.setProjectFieldValue.length).toBe(3);
    expect(calls.editIssue.length).toBe(0);
  });

  test("syncs an existing issue", async () => {
    const { github, calls } = createGithubMock();
    const skill = createGitHubProjectsSkill(
      {
        owner: "acme",
        repo: "app",
        projectNumber: 1,
      },
      {
        github,
        classifier,
      },
    );

    const result = await skill.syncIssueMetadata(42);

    expect(result.issueNumber).toBe(42);
    expect(calls.editIssue.length).toBe(1);
    expect(calls.setProjectFieldValue.length).toBe(3);
  });
});
