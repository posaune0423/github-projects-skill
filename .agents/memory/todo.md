# TODO

## Current Task: action別SKILL.md整備

- [completed] `src/skills` 配下に action ごとの skill フォルダを初期化する
- [completed] 各 SKILL.md を実装内容に合わせて書き換える
- [completed] skill validator を通す

## Review

- `skill-creator` の `init_skill.py` を使って action ごとの skill フォルダと `agents/openai.yaml` を生成した。
- `gh-project-setup`, `gh-project-capture`, `gh-project-sync-issue`, `gh-project-weekly-report`, `gh-project-hygiene-report`, `slack-project-notify` の6 skill を `src/skills/` に追加した。
- 各 SKILL.md は既存 TypeScript 実装と CLI entrypoint に合わせて、使いどころと最短実行手順に絞って記述した。
- `vp check` を通し、`quick_validate.py` は一時的に `PyYAML` を `/tmp` に入れて全 skill を validate した。
