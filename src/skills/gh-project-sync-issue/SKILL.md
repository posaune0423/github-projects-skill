---
name: gh-project-sync-issue
description: Reclassify and resync an existing GitHub issue with project metadata such as labels, milestone, and project fields. Use when Codex needs to repair drift after a ticket changed, labels became stale, or project fields no longer match the issue contents.
---

# Gh Project Sync Issue

Re-run the local classification and project field synchronization flow for an existing issue.

## Workflow

1. Confirm these inputs exist:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PROJECT_NUMBER`
   - `ISSUE_CLASSIFIER_PROVIDER`
   - target issue number
2. Run:

```bash
bun run index.ts sync-issue --provider heuristic --issue 123
```

3. Expect the flow to:
   - fetch the current issue from GitHub
   - classify the current title and body
   - ensure missing labels exist
   - ensure milestone exists
   - update issue labels and milestone
   - update project date and single-select fields
4. Use this after manual edits, backlog triage, or when automation previously failed midway.

## Constraints

- Treat this as a repair operation for one issue, not a bulk migration tool.
- Avoid custom logic outside `src/skills/github-projects-ops/index.ts` and `src/utils/github.ts`; those files already define the supported sync behavior.
- Keep the operation idempotent. Re-running it should converge on the same GitHub state.
