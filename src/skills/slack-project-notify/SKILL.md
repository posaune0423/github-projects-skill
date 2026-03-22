---
name: slack-project-notify
description: Send GitHub Projects report output or operational messages to Slack through the configured webhook. Use when Codex needs to post weekly reports, hygiene alerts, or one-off project updates to Slack from the local implementation.
---

# Slack Project Notify

Post a message to Slack by using the outbound-only webhook support in `src/utils/slack.ts`.

## Workflow

1. Confirm `SLACK_WEBHOOK_URL` is configured.
2. Use the built-in notify command for one-off messages:

```bash
bun run index.ts notify-slack --message "Weekly GitHub Projects report is ready."
```

3. Prefer the report commands with `--notify-slack` when the message should mirror deterministic report output.
4. Use this skill for outbound notifications only. This repository does not implement Slack event ingestion, mentions, or slash commands.

## Constraints

- Keep messages short and operational. This skill is a transport, not a conversation agent.
- Route formatting changes through `src/utils/slack.ts`.
- Keep webhook posting separate from GitHub mutation logic so report jobs remain easy to debug.
