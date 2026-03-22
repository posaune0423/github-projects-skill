import { createGhCommandRunner } from "./process.ts";
import type {
  CommandResult,
  GhCommandRunner,
  IntakeProjectFieldValue,
  IssueSummary,
  ProjectField,
  ProjectItem,
  ProjectMetadata,
  ProjectRef,
  RepoRef,
} from "./types.ts";

function fail(message: string, result?: CommandResult): never {
  const details = result ? `\n${result.stderr || result.stdout}`.trimEnd() : "";
  throw new Error(`${message}${details ? `\n${details}` : ""}`);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function defaultLabelColor(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash.toString(16).padStart(6, "0").slice(0, 6);
}

export type GitHubClient = ReturnType<typeof createGitHubClient>;

export function createGitHubClient(gh: GhCommandRunner = createGhCommandRunner()) {
  async function runJson<T>(args: string[], stdin?: string): Promise<T> {
    const result = await gh(args, stdin ? { stdin } : undefined);
    if (result.exitCode !== 0) {
      fail(`gh ${args.join(" ")} failed.`, result);
    }

    try {
      return JSON.parse(result.stdout) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON output from gh ${args.join(" ")}: ${String(error)}`);
    }
  }

  async function run(args: string[], stdin?: string): Promise<string> {
    const result = await gh(args, stdin ? { stdin } : undefined);
    if (result.exitCode !== 0) {
      fail(`gh ${args.join(" ")} failed.`, result);
    }

    return result.stdout.trim();
  }

  async function ghApi<T>(path: string, options?: { method?: string; fields?: Record<string, string> }): Promise<T> {
    const args = ["api"];
    if (options?.method) {
      args.push("-X", options.method);
    }
    args.push(path);

    for (const [key, value] of Object.entries(options?.fields ?? {})) {
      args.push("-f", `${key}=${value}`);
    }

    return runJson<T>(args);
  }

  async function ghGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const args = ["api", "graphql", "-f", `query=${query}`];
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        args.push("-F", `${key}=${JSON.stringify(value)}`);
      }
    }

    return runJson<T>(args);
  }

  async function getProjectMetadata(project: ProjectRef): Promise<ProjectMetadata> {
    const query = `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            title
            fields(first: 50) {
              nodes {
                ... on ProjectV2FieldCommon {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
        user(login: $owner) {
          projectV2(number: $number) {
            id
            title
            fields(first: 50) {
              nodes {
                ... on ProjectV2FieldCommon {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    type GraphqlResponse = {
      data?: {
        organization?: {
          projectV2?: {
            id: string;
            title: string;
            fields: {
              nodes: Array<{
                id?: string;
                name?: string;
                dataType?: string;
                options?: Array<{ id: string; name: string }>;
              } | null>;
            };
          };
        };
        user?: {
          projectV2?: {
            id: string;
            title: string;
            fields: {
              nodes: Array<{
                id?: string;
                name?: string;
                dataType?: string;
                options?: Array<{ id: string; name: string }>;
              } | null>;
            };
          };
        };
      };
    };

    const response = await ghGraphql<GraphqlResponse>(query, {
      owner: project.owner,
      number: project.projectNumber,
    });
    const projectNode = response.data?.organization?.projectV2 ?? response.data?.user?.projectV2;
    if (!projectNode) {
      throw new Error(`Project ${project.owner}#${project.projectNumber} was not found.`);
    }

    return {
      id: projectNode.id,
      title: projectNode.title,
      fields: projectNode.fields.nodes
        .filter((field): field is NonNullable<typeof field> => Boolean(field?.id && field.name && field.dataType))
        .map((field) => ({
          id: field.id!,
          name: field.name!,
          dataType: field.dataType!,
          options: field.options ?? [],
        })),
    };
  }

  async function listLabels(repo: RepoRef): Promise<string[]> {
    type Label = { name: string };
    const labels = await ghApi<Label[]>(`repos/${repo.owner}/${repo.repo}/labels?per_page=100`);
    return labels.map((label) => label.name);
  }

  async function ensureLabels(repo: RepoRef, labels: string[]): Promise<void> {
    const existingLabels = await listLabels(repo);
    for (const label of labels) {
      if (existingLabels.some((candidate) => normalize(candidate) === normalize(label))) {
        continue;
      }

      await run([
        "label",
        "create",
        label,
        "--repo",
        `${repo.owner}/${repo.repo}`,
        "--color",
        defaultLabelColor(label),
        "--description",
        "Auto-created by github-projects-skill",
      ]);
    }
  }

  async function listMilestones(repo: RepoRef): Promise<Array<{ title: string; dueDate?: string; number: number }>> {
    type Milestone = { title: string; due_on?: string; number: number };
    const milestones = await ghApi<Milestone[]>(`repos/${repo.owner}/${repo.repo}/milestones?state=all&per_page=100`);
    return milestones.map((milestone) => ({
      title: milestone.title,
      dueDate: milestone.due_on ? milestone.due_on.slice(0, 10) : undefined,
      number: milestone.number,
    }));
  }

  async function ensureMilestone(
    repo: RepoRef,
    title: string,
    dueDate?: string,
  ): Promise<{ title: string; number: number; dueDate?: string }> {
    const milestones = await listMilestones(repo);
    const existing = milestones.find((milestone) => normalize(milestone.title) === normalize(title));
    if (existing) {
      if (dueDate && !existing.dueDate) {
        await ghApi(`repos/${repo.owner}/${repo.repo}/milestones/${existing.number}`, {
          method: "PATCH",
          fields: {
            due_on: `${dueDate}T00:00:00Z`,
          },
        });
        return {
          ...existing,
          dueDate,
        };
      }

      return existing;
    }

    type Milestone = { title: string; due_on?: string; number: number };
    const created = await ghApi<Milestone>(`repos/${repo.owner}/${repo.repo}/milestones`, {
      method: "POST",
      fields: dueDate
        ? {
            title,
            due_on: `${dueDate}T00:00:00Z`,
          }
        : {
            title,
          },
    });

    return {
      title: created.title,
      number: created.number,
      dueDate: created.due_on ? created.due_on.slice(0, 10) : dueDate,
    };
  }

  async function ensureProjectField(
    project: ProjectRef,
    specification: {
      name: string;
      dataType: "DATE" | "TEXT" | "NUMBER" | "SINGLE_SELECT";
      options?: string[];
    },
  ): Promise<ProjectField> {
    const metadata = await getProjectMetadata(project);
    const existing = metadata.fields.find((field) => normalize(field.name) === normalize(specification.name));
    if (existing) {
      return existing;
    }

    const args = [
      "project",
      "field-create",
      String(project.projectNumber),
      "--owner",
      project.owner,
      "--name",
      specification.name,
      "--data-type",
      specification.dataType,
      "--format",
      "json",
    ];

    if (specification.dataType === "SINGLE_SELECT" && specification.options && specification.options.length > 0) {
      args.push("--single-select-options", specification.options.join(","));
    }

    type FieldResponse = {
      id: string;
      name: string;
      dataType?: string;
      options?: Array<{ id: string; name: string }>;
    };
    const created = await runJson<FieldResponse>(args);
    return {
      id: created.id,
      name: created.name,
      dataType: created.dataType ?? specification.dataType,
      options: created.options ?? [],
    };
  }

  async function createIssue(
    repo: RepoRef,
    input: {
      title: string;
      body: string;
      labels: string[];
      milestoneTitle?: string;
      projectTitle: string;
    },
  ): Promise<{ url: string; number: number }> {
    const args = [
      "issue",
      "create",
      "--repo",
      `${repo.owner}/${repo.repo}`,
      "--title",
      input.title,
      "--body",
      input.body,
      "--project",
      input.projectTitle,
    ];

    for (const label of input.labels) {
      args.push("--label", label);
    }

    if (input.milestoneTitle) {
      args.push("--milestone", input.milestoneTitle);
    }

    const stdout = await run(args);
    const match = stdout.match(/\/issues\/(\d+)\s*$/);
    if (!match?.[1]) {
      throw new Error(`Unable to parse issue number from gh issue create output: ${stdout}`);
    }

    return {
      url: stdout,
      number: Number(match[1]),
    };
  }

  async function editIssue(
    repo: RepoRef,
    issueNumber: number,
    input: {
      addLabels?: string[];
      milestoneTitle?: string;
    },
  ): Promise<void> {
    const args = ["issue", "edit", String(issueNumber), "--repo", `${repo.owner}/${repo.repo}`];
    for (const label of input.addLabels ?? []) {
      args.push("--add-label", label);
    }
    if (input.milestoneTitle) {
      args.push("--milestone", input.milestoneTitle);
    }

    await run(args);
  }

  async function getIssue(repo: RepoRef, issueNumber: number): Promise<IssueSummary> {
    type IssueResponse = {
      id: string;
      number: number;
      title: string;
      body: string;
      url: string;
      state: string;
      createdAt?: string;
      updatedAt?: string;
      assignees?: Array<{ login: string }>;
      labels?: Array<{ name: string }>;
      milestone?: { title: string; dueOn?: string; number?: number };
    };

    const issue = await runJson<IssueResponse>([
      "issue",
      "view",
      String(issueNumber),
      "--repo",
      `${repo.owner}/${repo.repo}`,
      "--json",
      "id,number,title,body,url,state,createdAt,updatedAt,assignees,labels,milestone",
    ]);

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      url: issue.url,
      state: issue.state,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      assignees: issue.assignees?.map((assignee) => assignee.login) ?? [],
      labels: issue.labels?.map((label) => label.name) ?? [],
      milestone: issue.milestone
        ? {
            title: issue.milestone.title,
            dueDate: issue.milestone.dueOn?.slice(0, 10),
            number: issue.milestone.number,
          }
        : undefined,
    };
  }

  async function findProjectItemIdForIssue(
    repo: RepoRef,
    project: ProjectRef,
    issueNumber: number,
  ): Promise<string | undefined> {
    const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $issueNumber) {
            projectItems(first: 50) {
              nodes {
                id
                project {
                  ... on ProjectV2 {
                    number
                    owner {
                      ... on Organization { login }
                      ... on User { login }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    type Response = {
      data?: {
        repository?: {
          issue?: {
            projectItems?: {
              nodes: Array<{
                id: string;
                project?: {
                  number?: number;
                  owner?: { login?: string };
                };
              } | null>;
            };
          };
        };
      };
    };

    const response = await ghGraphql<Response>(query, {
      owner: repo.owner,
      repo: repo.repo,
      issueNumber,
    });

    const item = response.data?.repository?.issue?.projectItems?.nodes.find((candidate) => {
      return (
        candidate?.project?.number === project.projectNumber &&
        normalize(candidate.project.owner?.login ?? "") === normalize(project.owner)
      );
    });

    return item?.id;
  }

  async function setProjectFieldValue(
    project: ProjectRef,
    projectId: string,
    itemId: string,
    field: ProjectField,
    value: IntakeProjectFieldValue | { kind: "date"; value: string },
  ): Promise<void> {
    const args = ["project", "item-edit", "--id", itemId, "--project-id", projectId, "--field-id", field.id];

    if (value.kind === "text") {
      args.push("--text", value.value);
    } else if (value.kind === "number") {
      args.push("--number", String(value.value));
    } else if (value.kind === "date") {
      args.push("--date", value.value);
    } else {
      const option = field.options.find((candidate) => normalize(candidate.name) === normalize(value.optionName));
      if (!option) {
        throw new Error(`Project field "${field.name}" does not have option "${value.optionName}".`);
      }
      args.push("--single-select-option-id", option.id);
    }

    await run(args);
  }

  async function listProjectItems(project: ProjectRef): Promise<ProjectItem[]> {
    const metadata = await getProjectMetadata(project);
    const query = `
      query($projectId: ID!, $cursor: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldNumberValue {
                      number
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                  }
                }
                content {
                  ... on Issue {
                    id
                    number
                    title
                    body
                    url
                    state
                    createdAt
                    updatedAt
                    labels(first: 30) { nodes { name } }
                    assignees(first: 20) { nodes { login } }
                    milestone { title dueOn number }
                  }
                  ... on DraftIssue {
                    title
                    body
                  }
                }
              }
            }
          }
        }
      }
    `;

    type Response = {
      data?: {
        node?: {
          items?: {
            pageInfo?: { hasNextPage: boolean; endCursor?: string };
            nodes: Array<{
              id: string;
              fieldValues?: {
                nodes: Array<{
                  text?: string;
                  date?: string;
                  number?: number;
                  name?: string;
                  field?: { name?: string };
                } | null>;
              };
              content?:
                | {
                    id: string;
                    number: number;
                    title: string;
                    body: string;
                    url: string;
                    state: string;
                    createdAt?: string;
                    updatedAt?: string;
                    labels?: { nodes: Array<{ name: string } | null> };
                    assignees?: { nodes: Array<{ login: string } | null> };
                    milestone?: { title: string; dueOn?: string; number?: number };
                  }
                | {
                    title?: string;
                    body?: string;
                  }
                | null;
            }>;
          };
        };
      };
    };

    const items: ProjectItem[] = [];
    let cursor: string | undefined;

    while (true) {
      const response = await ghGraphql<Response>(query, {
        projectId: metadata.id,
        cursor: cursor ?? null,
      });
      const page = response.data?.node?.items;
      if (!page) {
        break;
      }

      for (const node of page.nodes) {
        const fieldValues: Record<string, string | number> = {};
        for (const fieldValue of node.fieldValues?.nodes ?? []) {
          const fieldName = fieldValue?.field?.name;
          if (!fieldName) {
            continue;
          }

          if (typeof fieldValue?.text === "string") {
            fieldValues[fieldName] = fieldValue.text;
          } else if (typeof fieldValue?.date === "string") {
            fieldValues[fieldName] = fieldValue.date;
          } else if (typeof fieldValue?.number === "number") {
            fieldValues[fieldName] = fieldValue.number;
          } else if (typeof fieldValue?.name === "string") {
            fieldValues[fieldName] = fieldValue.name;
          }
        }

        const issueContent =
          node.content && "number" in node.content
            ? {
                id: node.content.id,
                number: node.content.number,
                title: node.content.title,
                body: node.content.body,
                url: node.content.url,
                state: node.content.state,
                createdAt: node.content.createdAt,
                updatedAt: node.content.updatedAt,
                assignees:
                  node.content.assignees?.nodes.flatMap((assignee) => (assignee?.login ? [assignee.login] : [])) ?? [],
                labels: node.content.labels?.nodes.flatMap((label) => (label?.name ? [label.name] : [])) ?? [],
                milestone: node.content.milestone
                  ? {
                      title: node.content.milestone.title,
                      dueDate: node.content.milestone.dueOn?.slice(0, 10),
                      number: node.content.milestone.number,
                    }
                  : undefined,
              }
            : undefined;

        items.push({
          id: node.id,
          contentType: issueContent ? "Issue" : "DraftIssue",
          issue: issueContent,
          draftTitle:
            !issueContent && node.content && "title" in node.content ? (node.content.title ?? undefined) : undefined,
          draftBody:
            !issueContent && node.content && "body" in node.content ? (node.content.body ?? undefined) : undefined,
          fieldValues,
        });
      }

      if (!page.pageInfo?.hasNextPage) {
        break;
      }

      cursor = page.pageInfo.endCursor;
    }

    return items;
  }

  return {
    getProjectMetadata,
    listLabels,
    ensureLabels,
    listMilestones,
    ensureMilestone,
    ensureProjectField,
    createIssue,
    editIssue,
    getIssue,
    findProjectItemIdForIssue,
    setProjectFieldValue,
    listProjectItems,
  };
}
