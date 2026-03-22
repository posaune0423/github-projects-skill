import { createHeuristicIssueClassifier } from "./classifier.ts";
import type { GitHubProjectsSkillOptions, IssueIntakeClassifier } from "./types.ts";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function readSkillOptions(flags: Record<string, string | boolean | undefined>): GitHubProjectsSkillOptions {
  const owner = typeof flags.owner === "string" ? flags.owner : process.env.GITHUB_OWNER;
  const repo = typeof flags.repo === "string" ? flags.repo : process.env.GITHUB_REPO;
  const projectNumberValue =
    typeof flags["project-number"] === "string" ? flags["project-number"] : process.env.GITHUB_PROJECT_NUMBER;

  const projectNumber = Number(required("GITHUB_PROJECT_NUMBER", projectNumberValue));
  if (!Number.isFinite(projectNumber)) {
    throw new Error("GITHUB_PROJECT_NUMBER must be numeric.");
  }

  const projectDateFieldName =
    typeof flags["date-field"] === "string" ? flags["date-field"] : process.env.GITHUB_PROJECT_DATE_FIELD;
  const projectStatusFieldName =
    typeof flags["status-field"] === "string" ? flags["status-field"] : process.env.GITHUB_PROJECT_STATUS_FIELD;
  const slackWebhookUrl =
    typeof flags["slack-webhook-url"] === "string" ? flags["slack-webhook-url"] : process.env.SLACK_WEBHOOK_URL;

  return {
    owner: required("GITHUB_OWNER", owner),
    repo: required("GITHUB_REPO", repo),
    projectNumber,
    projectDateFieldName,
    projectStatusFieldName,
    slackWebhookUrl,
  };
}

export function readClassifier(flags: Record<string, string | boolean | undefined>): IssueIntakeClassifier | undefined {
  const provider = typeof flags.provider === "string" ? flags.provider : process.env.ISSUE_CLASSIFIER_PROVIDER;
  if (!provider) {
    return undefined;
  }

  if (provider === "heuristic") {
    return createHeuristicIssueClassifier();
  }

  throw new Error(`Unsupported ISSUE_CLASSIFIER_PROVIDER: ${provider}`);
}
