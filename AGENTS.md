# AGENTS

このリポジトリは Chronoloft（Discord へのステータス表示機能を備えたアクティビティ記録ツール）です。
Codex が作業する際の最小限の指針をまとめています。

## 構成
- `backend/` Python バックエンド（初回は venv + `pip install -r requirements.txt`）
- `frontend/` Vite + React フロントエンド
- `main.py` デスクトップアプリのエントリポイント
- `dist/` と `build/` は生成物（基本的に編集しない）

## よく使うコマンド
- 開発起動: `npm run start`（`http://localhost:5173/`）
- ビルド: `npm run build`

## 編集ガイド
- 既存の構成・ファイル配置を尊重する（新規作成は必要最小限）。
- 自動生成ファイル（`dist/`, `build/`, `third_party_licenses_*.json` など）は原則触らない。
- UI変更は `frontend/` 配下に限定し、バックエンド変更が必要なら理由を明記する。
- コミットや PR 作成時には、適切なメッセージを日本語で添える。
- コード中のコメントは日本語で記入する。
- プッシュを依頼されたタイミングで、PR本文としてそのまま使える品質の description を提案する。
