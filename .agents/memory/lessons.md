# Lessons

- 初期化直後のリポジトリでは `.agents/memory/` が存在しないことがある。非自明タスクでは先に task memory を作成してから進める。
- ユーザーが GitHub運用skill を求める場合、抽象的な運用論だけでなく `gh issue` / `gh project` / `gh api` / GitHub Actions まで含む実行手段ベースで設計する。
- `vp check` を通すには TypeScript の型宣言だけでなく、実行時に解決される設定 import も成立している必要がある。設定ファイルの unresolved import は最後まで残さない。
- `skill-creator` の validator は `PyYAML` 依存なので、環境に無い場合は repo 内へ依存を持ち込まず一時ディレクトリに入れて実行する。
