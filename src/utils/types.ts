export type RepoRef = {
  owner: string;
  repo: string;
};

export type ProjectRef = {
  owner: string;
  projectNumber: number;
};

export type ProjectFieldOption = {
  id: string;
  name: string;
};

export type ProjectField = {
  id: string;
  name: string;
  dataType: "TEXT" | "NUMBER" | "DATE" | "SINGLE_SELECT" | "ITERATION" | string;
  options: ProjectFieldOption[];
};

export type ProjectMetadata = {
  id: string;
  title: string;
  fields: ProjectField[];
};

export type ProjectFieldPrimitive = string | number;

export type IntakeProjectFieldValue =
  | {
      kind: "text";
      value: string;
    }
  | {
      kind: "number";
      value: number;
    }
  | {
      kind: "single_select";
      optionName: string;
    };

export type IntakeClassification = {
  title: string;
  body: string;
  labels: string[];
  milestone?: {
    title: string;
    dueDate?: string;
  };
  dueDate?: string;
  projectFields: Record<string, IntakeProjectFieldValue>;
  confidence: number;
  reasoningSummary: string;
};

export type IntakeContext = {
  repo: RepoRef;
  project: ProjectRef;
  projectMetadata: ProjectMetadata;
  existingLabels: string[];
  existingMilestones: Array<{
    title: string;
    dueDate?: string;
    number: number;
  }>;
  now: string;
};

export type IssueIntakeClassifier = {
  name: string;
  classify: (input: { text: string; context: IntakeContext }) => Promise<IntakeClassification>;
};

export type IssueSummary = {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  createdAt?: string;
  updatedAt?: string;
  assignees: string[];
  labels: string[];
  milestone?: {
    title: string;
    dueDate?: string;
    number?: number;
  };
};

export type ProjectItem = {
  id: string;
  contentType: "Issue" | "PullRequest" | "DraftIssue";
  issue?: IssueSummary;
  draftTitle?: string;
  draftBody?: string;
  fieldValues: Record<string, string | number>;
};

export type WeeklyReport = {
  markdown: string;
  totals: {
    total: number;
    done: number;
    overdue: number;
    unassigned: number;
    stale: number;
  };
};

export type HygieneReport = WeeklyReport;

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type GitHubProjectsSkillOptions = RepoRef &
  ProjectRef & {
    projectDateFieldName?: string;
    projectStatusFieldName?: string;
    projectTitle?: string;
    projectTemplateOwner?: string;
    projectTemplateNumber?: number;
    slackWebhookUrl?: string;
  };

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type GhCommandRunner = (
  args: string[],
  options?: {
    stdin?: string;
  },
) => Promise<CommandResult>;

export type FetchLike = typeof fetch;
