---
name: gh-project-hygiene-report
description: Generate the deterministic GitHub Projects hygiene report for missing due dates, labels, assignees, and overdue work. Use when Codex needs to run or debug the scheduled hygiene audit without invoking any LLM reasoning.
---

# Gh Project Hygiene Report

Generate the hygiene audit for the configured project.

## Workflow

1. Confirm these inputs exist:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PROJECT_NUMBER`
   - optional `GITHUB_PROJECT_DATE_FIELD`
2. Run:

```bash
bun run index.ts hygiene-report
```

3. Add `--notify-slack` only when a Slack webhook is configured and a notification is desired.
4. Expect the report to highlight:
   - items missing due dates
   - items missing labels
   - items missing assignees
   - overdue items
5. Treat `.github/workflows/project-hygiene.yml` as the production path for scheduled execution.

## Constraints

- Keep this report deterministic and read-only with respect to GitHub state.
- Use this skill for audit output, not for fixing the underlying issues. Use `$gh-project-sync-issue` or `$gh-project-capture` for metadata repair.
- Keep hygiene categories aligned with `src/utils/report.ts`.
