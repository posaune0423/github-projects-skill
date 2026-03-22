import { createGitHubClient } from "../../utils/github.ts";
import { createHygieneReport, createWeeklyReport } from "../../utils/report.ts";
import { formatSlackReportMessage, postSlackMessage } from "../../utils/slack.ts";
import type {
  FetchLike,
  GitHubProjectsSkillOptions,
  HygieneReport,
  IntakeClassification,
  IntakeContext,
  IssueIntakeClassifier,
  Logger,
  ProjectField,
  WeeklyReport,
} from "../../utils/types.ts";

function createLogger(): Logger {
  return {
    info: (message) => console.log(message),
    warn: (message) => console.warn(message),
    error: (message) => console.error(message),
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function defaultProjectDateFieldName(options: GitHubProjectsSkillOptions): string {
  return options.projectDateFieldName ?? "Due Date";
}

function defaultProjectStatusFieldName(options: GitHubProjectsSkillOptions): string {
  return options.projectStatusFieldName ?? "Status";
}

function findField(fields: ProjectField[], fieldName: string): ProjectField | undefined {
  return fields.find((field) => normalize(field.name) === normalize(fieldName));
}

async function buildContext(
  options: GitHubProjectsSkillOptions,
  dependencies: {
    github: ReturnType<typeof createGitHubClient>;
    now: () => Date;
  },
): Promise<IntakeContext> {
  const [projectMetadata, existingLabels, existingMilestones] = await Promise.all([
    dependencies.github.getProjectMetadata(options),
    dependencies.github.listLabels(options),
    dependencies.github.listMilestones(options),
  ]);

  return {
    repo: {
      owner: options.owner,
      repo: options.repo,
    },
    project: {
      owner: options.owner,
      projectNumber: options.projectNumber,
    },
    projectMetadata,
    existingLabels,
    existingMilestones,
    now: dependencies.now().toISOString(),
  };
}

async function ensureDueDateField(
  options: GitHubProjectsSkillOptions,
  github: ReturnType<typeof createGitHubClient>,
): Promise<ProjectField> {
  return github.ensureProjectField(options, {
    name: defaultProjectDateFieldName(options),
    dataType: "DATE",
  });
}

async function applyClassificationToIssue(
  issueNumber: number,
  classification: IntakeClassification,
  options: GitHubProjectsSkillOptions,
  dependencies: {
    github: ReturnType<typeof createGitHubClient>;
    logger: Logger;
  },
): Promise<void> {
  const context = await buildContext(options, {
    github: dependencies.github,
    now: () => new Date(),
  });

  const itemId = await dependencies.github.findProjectItemIdForIssue(options, options, issueNumber);
  if (!itemId) {
    dependencies.logger.warn(`Issue #${issueNumber} is not attached to the project; project fields were skipped.`);
    return;
  }

  if (classification.dueDate) {
    const dueDateField = await ensureDueDateField(options, dependencies.github);
    await dependencies.github.setProjectFieldValue(options, context.projectMetadata.id, itemId, dueDateField, {
      kind: "date",
      value: classification.dueDate,
    });
  }

  for (const [fieldName, fieldValue] of Object.entries(classification.projectFields)) {
    const projectField = findField(context.projectMetadata.fields, fieldName);
    if (!projectField) {
      throw new Error(`Project field "${fieldName}" does not exist in project ${context.projectMetadata.title}.`);
    }

    await dependencies.github.setProjectFieldValue(
      options,
      context.projectMetadata.id,
      itemId,
      projectField,
      fieldValue,
    );
  }
}

export function createGitHubProjectsSkill(
  options: GitHubProjectsSkillOptions,
  dependencies?: {
    github?: ReturnType<typeof createGitHubClient>;
    classifier?: IssueIntakeClassifier;
    fetch?: FetchLike;
    now?: () => Date;
    logger?: Logger;
  },
) {
  const github = dependencies?.github ?? createGitHubClient();
  const now = dependencies?.now ?? (() => new Date());
  const logger = dependencies?.logger ?? createLogger();
  const fetchImpl = dependencies?.fetch ?? fetch;

  return {
    async setupProject(): Promise<void> {
      await github.ensureProjectField(options, {
        name: defaultProjectDateFieldName(options),
        dataType: "DATE",
      });
      await github.ensureProjectField(options, {
        name: defaultProjectStatusFieldName(options),
        dataType: "SINGLE_SELECT",
        options: ["Todo", "In Progress", "Blocked", "Done"],
      });
      await github.ensureProjectField(options, {
        name: "Priority",
        dataType: "SINGLE_SELECT",
        options: ["P0", "P1", "P2", "P3"],
      });
      await github.ensureProjectField(options, {
        name: "Type",
        dataType: "SINGLE_SELECT",
        options: ["Feature", "Bug", "Chore", "Docs"],
      });
    },

    async captureIssueFromText(
      text: string,
    ): Promise<{ issueNumber: number; url: string; classification: IntakeClassification }> {
      if (!dependencies?.classifier) {
        throw new Error("No issue classifier is configured for capture.");
      }

      const context = await buildContext(options, { github, now });
      const classification = await dependencies.classifier.classify({
        text,
        context,
      });

      if (classification.labels.length > 0) {
        await github.ensureLabels(options, classification.labels);
      }

      let milestoneTitle = classification.milestone?.title;
      if (classification.milestone?.title) {
        const milestone = await github.ensureMilestone(
          options,
          classification.milestone.title,
          classification.milestone.dueDate,
        );
        milestoneTitle = milestone.title;
      }

      const createdIssue = await github.createIssue(options, {
        title: classification.title,
        body: classification.body,
        labels: classification.labels,
        milestoneTitle,
        projectTitle: context.projectMetadata.title,
      });

      await applyClassificationToIssue(createdIssue.number, classification, options, {
        github,
        logger,
      });

      return {
        issueNumber: createdIssue.number,
        url: createdIssue.url,
        classification,
      };
    },

    async syncIssueMetadata(
      issueNumber: number,
    ): Promise<{ issueNumber: number; classification: IntakeClassification }> {
      if (!dependencies?.classifier) {
        throw new Error("No issue classifier is configured for sync.");
      }

      const issue = await github.getIssue(options, issueNumber);
      const context = await buildContext(options, { github, now });
      const classification = await dependencies.classifier.classify({
        text: `${issue.title}\n\n${issue.body}`.trim(),
        context,
      });

      if (classification.labels.length > 0) {
        await github.ensureLabels(options, classification.labels);
      }

      let milestoneTitle = classification.milestone?.title;
      if (classification.milestone?.title) {
        const milestone = await github.ensureMilestone(
          options,
          classification.milestone.title,
          classification.milestone.dueDate,
        );
        milestoneTitle = milestone.title;
      }

      await github.editIssue(options, issueNumber, {
        addLabels: classification.labels,
        milestoneTitle,
      });

      await applyClassificationToIssue(issueNumber, classification, options, {
        github,
        logger,
      });

      return {
        issueNumber,
        classification,
      };
    },

    async generateWeeklyReport(input?: { notifySlack?: boolean }): Promise<WeeklyReport> {
      const items = await github.listProjectItems(options);
      const report = createWeeklyReport(items, {
        now: now(),
        dateFieldName: defaultProjectDateFieldName(options),
        statusFieldName: defaultProjectStatusFieldName(options),
      });

      if (input?.notifySlack && options.slackWebhookUrl) {
        await postSlackMessage(
          options.slackWebhookUrl,
          formatSlackReportMessage("Weekly Project Report", report.markdown),
          fetchImpl,
        );
      }

      return report;
    },

    async generateHygieneReport(input?: { notifySlack?: boolean }): Promise<HygieneReport> {
      const items = await github.listProjectItems(options);
      const report = createHygieneReport(items, {
        now: now(),
        dateFieldName: defaultProjectDateFieldName(options),
      });

      if (input?.notifySlack && options.slackWebhookUrl) {
        await postSlackMessage(
          options.slackWebhookUrl,
          formatSlackReportMessage("Project Hygiene Report", report.markdown),
          fetchImpl,
        );
      }

      return report;
    },

    async notifySlack(message: string): Promise<void> {
      if (!options.slackWebhookUrl) {
        throw new Error("SLACK_WEBHOOK_URL is not configured.");
      }

      await postSlackMessage(options.slackWebhookUrl, message, fetchImpl);
    },
  };
}
