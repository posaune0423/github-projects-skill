---
name: gh-project-capture
description: Capture freeform text into a GitHub issue and attach GitHub-native project metadata such as labels, milestone, and due date. Use when Codex needs to turn notes, requests, or meeting text into a tracked GitHub issue in the configured project.
---

# Gh Project Capture

Create a project-backed GitHub issue from text by using the local capture flow in `src/skills/github-projects-ops`.

## Workflow

1. Confirm these inputs exist:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PROJECT_NUMBER`
   - `ISSUE_CLASSIFIER_PROVIDER`
2. Default to `ISSUE_CLASSIFIER_PROVIDER=heuristic` unless this repository later adds another provider adapter.
3. Pass the request text either with `--input` or stdin:

```bash
bun run index.ts capture --provider heuristic --input "Bug: checkout is broken and needs a fix tomorrow"
```

4. Expect the flow to do all of the following:
   - classify title and body
   - infer labels
   - infer or create milestone
   - infer due date
   - create the issue with `gh issue create`
   - find the project item and write project fields
5. Read `src/utils/classifier.ts` when the capture result looks wrong. Read `src/utils/github.ts` when GitHub mutations fail.

## Constraints

- Keep the source of truth GitHub-native. Reuse existing labels, milestones, and project fields before creating new objects.
- Persist due dates into the project date field, not into ad hoc text.
- Use this skill for intake only. Weekly reporting and hygiene checks belong to separate deterministic skills.
