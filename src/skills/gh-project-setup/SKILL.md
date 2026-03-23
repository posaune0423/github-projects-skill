---
name: gh-project-setup
description: Prepare a GitHub Project for this repository by ensuring the standard fields used by the local GitHub Projects automation exist. Use when Codex needs to initialize or repair project fields before running capture, sync, weekly report, or hygiene report flows.
---

# Gh Project Setup

Ensure the project exists and has the fields expected by the local implementation in `src/skills/github-projects-ops` and `src/utils/github.ts`.

## Workflow

1. Confirm these values first:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - existing `GITHUB_PROJECT_NUMBER`, or
   - `GITHUB_PROJECT_TEMPLATE_NUMBER` to create the project from a template
   - optional `GITHUB_PROJECT_TEMPLATE_OWNER`
   - optional `GITHUB_PROJECT_TITLE`
2. Confirm `gh` has `project` scope.
3. Route through the local setup implementation. If `GITHUB_PROJECT_NUMBER` is missing or points to a project that does not exist, and `GITHUB_PROJECT_TEMPLATE_NUMBER` is present, expect the implementation to copy the template project first.
4. Expect the implementation to link the copied project to the repository and then ensure these fields exist:
   - date field: default `Due Date`
   - status field: default `Status`
   - single-select `Priority`
   - single-select `Type`
5. If the command fails, inspect `src/utils/github.ts` first. That file owns `gh project copy`, `gh project link`, and `gh project field-create`.

## Constraints

- Prefer reusing existing fields with case-insensitive name matching instead of creating duplicates.
- Prefer creating from the configured default template instead of generating a blank project when setup must create a board.
- Do not invent extra project schema here. Keep the setup aligned with the current TypeScript implementation.
- Treat this skill as deterministic setup work. Do not involve LLM classification.
