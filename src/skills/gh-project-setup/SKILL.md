---
name: gh-project-setup
description: Prepare a GitHub Project for this repository by ensuring the standard fields used by the local GitHub Projects automation exist. Use when Codex needs to initialize or repair project fields before running capture, sync, weekly report, or hygiene report flows.
---

# Gh Project Setup

Ensure the project has the fields expected by the local implementation in `src/skills/github-projects-ops` and `src/utils/github.ts`.

## Workflow

1. **Auto-detect owner and repo** from the current repository:

```bash
gh repo view --json owner,name -q '"\(.owner.login) \(.name)"'
```

Set `GITHUB_OWNER` and `GITHUB_REPO` from the output. Do not ask the user.

2. **Resolve project number** — check `.agents/memory/project-config.md` for a saved `GITHUB_PROJECT_NUMBER`. If it exists, use it. If not, create a new project:

```bash
gh project create --owner $GITHUB_OWNER --title "$GITHUB_REPO project" --format json
```

Save the returned project number into `.agents/memory/project-config.md` in this format:

```
GITHUB_PROJECT_NUMBER=<number>
```

3. **Confirm `gh` has project scope** — if `gh project list` fails with a scope error, tell the user to run:

```
! gh auth refresh -s read:project,project
```

Then stop and wait.

4. Run the setup command with the resolved values:

```bash
GITHUB_OWNER=<owner> GITHUB_REPO=<repo> GITHUB_PROJECT_NUMBER=<number> bun run index.ts setup-project
```

5. Expect the implementation to ensure these fields exist:
   - date field: default `Due Date`
   - status field: default `Status`
   - single-select `Priority`
   - single-select `Type`

6. If the command fails, inspect `src/utils/github.ts` first. That file owns `gh project field-create` behavior.

## Constraints

- Prefer reusing existing fields with case-insensitive name matching instead of creating duplicates.
- Do not invent extra project schema here. Keep the setup aligned with the current TypeScript implementation.
- Treat this skill as deterministic setup work. Do not involve LLM classification.
- Never prompt the user for owner or repo — always derive them from `gh repo view`.
- Always persist a newly created project number to `.agents/memory/project-config.md` before proceeding.
