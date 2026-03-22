import { extractDueDate } from "./date.ts";
import type {
  IntakeClassification,
  IntakeContext,
  IntakeProjectFieldValue,
  IssueIntakeClassifier,
  ProjectField,
  ProjectFieldOption,
} from "./types.ts";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleFromInput(text: string): string {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ? firstLine.slice(0, 120) : "Untitled issue";
}

function selectExistingLabels(existingLabels: string[], haystack: string): string[] {
  const normalizedText = normalize(haystack);
  const matches = existingLabels.filter((label) => {
    const candidate = normalize(label);
    return candidate.length > 2 && normalizedText.includes(candidate);
  });

  if (matches.length > 0) {
    return matches;
  }

  if (/\bbug|error|incident|fix|broken\b/.test(normalizedText)) {
    return ["bug"];
  }

  if (/\bdocs|documentation\b/.test(normalizedText)) {
    return ["documentation"];
  }

  if (/\bfeature|request|improve|support\b/.test(normalizedText)) {
    return ["enhancement"];
  }

  return ["needs-triage"];
}

function findSingleSelectOption(
  fields: ProjectField[],
  fieldName: string,
  desiredNames: string[],
): ProjectFieldOption | undefined {
  const field = fields.find((candidate) => normalize(candidate.name) === normalize(fieldName));
  if (!field) {
    return undefined;
  }

  for (const desiredName of desiredNames) {
    const option = field.options.find((candidate) => normalize(candidate.name) === normalize(desiredName));
    if (option) {
      return option;
    }
  }

  return undefined;
}

function inferPriorityOption(text: string, context: IntakeContext): IntakeProjectFieldValue | undefined {
  const normalizedText = normalize(text);
  const desired = /\burgent|asap|today|p0\b/.test(normalizedText)
    ? ["P0", "High", "Urgent"]
    : /\bsoon|important|p1\b/.test(normalizedText)
      ? ["P1", "Medium", "Normal"]
      : ["P2", "Low"];

  const option = findSingleSelectOption(context.projectMetadata.fields, "Priority", desired);
  if (!option) {
    return undefined;
  }

  return {
    kind: "single_select",
    optionName: option.name,
  };
}

function inferStatusOption(context: IntakeContext): IntakeProjectFieldValue | undefined {
  const option = findSingleSelectOption(context.projectMetadata.fields, "Status", [
    "Todo",
    "To Do",
    "Backlog",
    "Planned",
  ]);

  if (!option) {
    return undefined;
  }

  return {
    kind: "single_select",
    optionName: option.name,
  };
}

function inferTypeOption(text: string, context: IntakeContext): IntakeProjectFieldValue | undefined {
  const normalizedText = normalize(text);
  const desired = /\bbug|error|incident|fix\b/.test(normalizedText)
    ? ["Bug"]
    : /\bdocs|documentation\b/.test(normalizedText)
      ? ["Docs", "Documentation"]
      : /\bchore|maintenance|cleanup\b/.test(normalizedText)
        ? ["Chore"]
        : ["Feature", "Task"];

  const option = findSingleSelectOption(context.projectMetadata.fields, "Type", desired);
  if (!option) {
    return undefined;
  }

  return {
    kind: "single_select",
    optionName: option.name,
  };
}

function inferMilestoneTitle(input: string, dueDate: string | undefined): string | undefined {
  const explicitMatch = input.match(/milestone\s*:\s*([^\n]+)/i);
  if (explicitMatch?.[1]) {
    return compactWhitespace(explicitMatch[1]);
  }

  if (!dueDate) {
    return undefined;
  }

  return `Auto ${dueDate}`;
}

export function createHeuristicIssueClassifier(now: () => Date = () => new Date()): IssueIntakeClassifier {
  return {
    name: "heuristic",
    async classify({ text, context }) {
      const dueDate = extractDueDate(text, now());
      const labels = Array.from(new Set(selectExistingLabels(context.existingLabels, text)));
      const projectFields: Record<string, IntakeProjectFieldValue> = {};

      const status = inferStatusOption(context);
      if (status) {
        projectFields.Status = status;
      }

      const priority = inferPriorityOption(text, context);
      if (priority) {
        projectFields.Priority = priority;
      }

      const type = inferTypeOption(text, context);
      if (type) {
        projectFields.Type = type;
      }

      return {
        title: titleFromInput(text),
        body: text.trim(),
        labels,
        milestone: inferMilestoneTitle(text, dueDate)
          ? {
              title: inferMilestoneTitle(text, dueDate)!,
              dueDate,
            }
          : undefined,
        dueDate,
        projectFields,
        confidence: 0.45,
        reasoningSummary: "Heuristic classification from issue text and existing GitHub project metadata.",
      } satisfies IntakeClassification;
    },
  };
}
