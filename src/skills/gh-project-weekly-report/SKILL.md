---
name: gh-project-weekly-report
description: Generate the deterministic weekly GitHub Projects report for the configured repository and project. Use when Codex needs to produce or troubleshoot the weekly report used by the scheduled GitHub Actions workflow, with no LLM reasoning in the report generation path.
---

# Gh Project Weekly Report

Generate the same weekly project report that the scheduled workflow produces.

## Workflow

1. Confirm these inputs exist:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PROJECT_NUMBER`
   - optional `GITHUB_PROJECT_DATE_FIELD`
   - optional `GITHUB_PROJECT_STATUS_FIELD`
2. Run:

```bash
bun run index.ts weekly-report
```

3. Add `--notify-slack` only when `SLACK_WEBHOOK_URL` is configured and a Slack post is intended.
4. Expect the report to summarize:
   - total items
   - done count
   - overdue count
   - unassigned count
   - stale count
   - status breakdown
5. Debug the report generator in `src/utils/report.ts` and the project item fetch logic in `src/utils/github.ts`.

## Constraints

- Keep this path deterministic. Do not add intake-style classification or any extra inference.
- Treat the scheduled workflow in `.github/workflows/weekly-project-report.yml` as the operational reference.
- Prefer fixing data retrieval or formatting logic instead of changing the meaning of report sections ad hoc.
