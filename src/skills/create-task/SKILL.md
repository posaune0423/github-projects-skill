---
name: create-task
description: Create a tracked GitHub task from a request, memo, bug report, or meeting note and attach GitHub-native metadata such as labels, milestone, due date, and project fields. Use when Codex should perform the common task-creation action for the configured GitHub Project.
---

# Create Task

Turn freeform user intent into a GitHub issue that is already attached to the project and enriched with native metadata.

## Workflow

1. Treat this as the default agent action when the user asks to create or file a task.
2. Gather the task text from the conversation. Prefer the user's own wording over paraphrasing unless the request is unclear.
3. Confirm the repository-level context exists:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PROJECT_NUMBER`
   - `ISSUE_CLASSIFIER_PROVIDER`
4. Route through the local GitHub Projects implementation in `src/skills/github-projects-ops/index.ts`.
5. Expect the flow to:
   - derive the issue title and body
   - infer labels
   - infer or create a milestone
   - infer a due date and persist it to the project date field
   - create the issue
   - attach or update project fields on the created item
6. Use the local `create-task` command only as the implementation entrypoint or for manual verification. The skill itself is the user-facing action.

## Constraints

- Keep GitHub-native objects as the source of truth. Do not duplicate metadata into ad hoc files.
- Prefer this skill over `$gh-project-capture` when the user intent is simply “create a task”.
- Keep behavior aligned with `index.ts`, `src/skills/github-projects-ops/index.ts`, and `src/utils/github.ts`.
