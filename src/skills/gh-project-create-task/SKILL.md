---
name: gh-project-create-task
description: Create a GitHub task from freeform text and attach GitHub-native metadata such as labels, milestone, and project fields. Use when Codex should perform the common task-creation action for a request, memo, bug report, or meeting note in the configured GitHub Project.
---

# Gh Project Create Task

Use the local `create-task` CLI alias for the most common GitHub Projects intake action.

## Workflow

1. Confirm these inputs exist:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PROJECT_NUMBER`
   - `ISSUE_CLASSIFIER_PROVIDER`
2. Default to `ISSUE_CLASSIFIER_PROVIDER=heuristic` unless another provider adapter is intentionally configured.
3. Create the task by passing text with `--input` or stdin:

```bash
bun run index.ts create-task --provider heuristic --input "User cannot export CSV. Needs a fix by tomorrow."
```

4. Expect this action to:
   - classify the request into title and body
   - infer labels
   - infer or create a milestone
   - infer due date
   - create the GitHub issue
   - attach or update project fields for the created item
5. Treat this skill as the user-facing alias for the underlying capture flow. The implementation currently routes to the same logic as `capture`.

## Constraints

- Prefer this skill for common task creation language. Use `$gh-project-capture` when the request is explicitly about intake or capture workflows.
- Keep behavior aligned with `index.ts` and `src/skills/github-projects-ops/index.ts`.
- Keep GitHub-native objects as the source of truth. Do not store duplicate metadata elsewhere.
