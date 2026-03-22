---
name: gh-project-setup
description: Prepare a GitHub Project for this repository by ensuring the standard fields used by the local GitHub Projects automation exist. Use when Codex needs to initialize or repair project fields before running capture, sync, weekly report, or hygiene report flows.
---

# Gh Project Setup

Ensure the project has the fields expected by the local implementation in `src/skills/github-projects-ops` and `src/utils/github.ts`.

## Workflow

1. Confirm these inputs exist before running anything:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PROJECT_NUMBER`
   - optional `GITHUB_PROJECT_DATE_FIELD`
   - optional `GITHUB_PROJECT_STATUS_FIELD`
2. Confirm `gh` is authenticated and has `project` scope.
3. Run:

```bash
bun run index.ts setup-project
```

4. Expect the implementation to ensure these fields exist:
   - date field: default `Due Date`
   - status field: default `Status`
   - single-select `Priority`
   - single-select `Type`
5. If the command fails, inspect `src/utils/github.ts` first. That file owns `gh project field-create` behavior.

## Constraints

- Prefer reusing existing fields with case-insensitive name matching instead of creating duplicates.
- Do not invent extra project schema here. Keep the setup aligned with the current TypeScript implementation.
- Treat this skill as deterministic setup work. Do not involve LLM classification.
