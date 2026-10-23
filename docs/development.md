# 開発ガイド

[README](../README.md) / [使い方](usage.md) / [リリースガイド](releasing.md)

## 開発環境の準備

MacではPython 3.13、Node.js、npmを用意してください。

```sh
git clone https://github.com/nozma/chronoloft.git
cd chronoloft
python3.13 -m venv backend/venv
backend/venv/bin/python -m pip install -r backend/requirements.txt -r scripts/requirements-build.txt
npm install
```

以降のコマンドは、特に指定がなければリポジトリ直下で実行します。
ルートのnpmワークスペース設定により、フロントエンドの依存関係もインストールされます。
ビルド用のPython依存関係は [requirements-build.txt](../scripts/requirements-build.txt) でバージョンを固定しています。

ブラウザーで開発する場合は、初回起動前にDBのマイグレーションを実行します。
デスクトップアプリは起動時に自動実行します。

```sh
backend/venv/bin/python -m flask --app backend.app:create_app db upgrade --directory backend/migrations
```

Macの記録DBは `~/Library/Application Support/Chronoloft/app.db` に保存されます。
開発起動も通常の記録DBを使用します。

## 起動方法

### ブラウザーで開発する

```sh
npm run start:no_webview
```

Viteの画面を [http://localhost:5173/](http://localhost:5173/) で開きます。
バックエンドは通常ポート5000で動き、画面からのAPI要求はVite経由で転送されます。

LANからのアクセスも確認する場合は次を使います。

```sh
npm run start:no_webview:lan
```

LAN設定は起動元PCの `http://localhost:5173` から変更します。
接続方法は[使い方](usage.md#同じlanの別端末から利用する)を参照してください。

### デスクトップ画面で確認する

```sh
npm run build:frontend
npm run dev:backend:webview
```

`main.py` がビルド済みの画面を表示します。画面を変更したらフロントエンドを再ビルドしてください。
配布版のSparkle更新機能は、[リリースガイドの更新テスト](releasing.md#実際の更新と再起動のテスト)で確認します。

## デスクトップアプリのビルド

初回は[リリースガイドの初回準備](releasing.md#初回準備)でSparkleを準備してから実行します。

```sh
npm run build
```

[Chronoloft.spec](../Chronoloft.spec) の設定で `dist/Chronoloft.app` を生成します。
現在の配布対象はApple Silicon・macOS 26以降です。同梱Pythonが要求するOS条件による制約です。
`dist/`・`build/` は生成物なので、直接編集しません。

### アイコンとバージョン

- Dock・Finder用のアイコンは `frontend/Chronoloft.icns` です。画面内のロゴ `frontend/favicon.svg` を変更した場合は、こちらも更新します。
- アプリのバージョンの正はルートの `package.json` です。`package-lock.json` のトップレベルと `packages[""].version` も揃えます。
- Finderのバージョンとビルド番号は、ビルド時にルートのバージョンから設定します。
- `frontend/package.json` のバージョンは内部パッケージ用です。アプリの改修では更新しません。

更新区分や確認のルールは [AGENTS.md](../AGENTS.md#バージョン管理) を参照してください。

## テスト

```sh
npm test
```

個別に実行する場合は `npm run test:frontend` または `npm run test:backend` を使います。
バックエンドは `backend/venv` の依存関係が導入済みであることが前提です。
Pythonの配置が異なる環境では、`backend/` で仮想環境を有効化して次を実行してください。

```sh
python -m unittest discover -s tests -v
```

通常の自動テストは次を確認します。

- フロントエンド：翻訳、グラフの分類・軸・色、詳細入力の正規化と貼り付け、共有ストップウォッチの状態管理。
- バックエンド：記録APIとDB保存結果、Discord管理処理とAPI、実際のTCP接続によるポート選択、更新時の計測保護と公開処理。
- DBはテストごとにメモリ内SQLiteを新規作成して破棄します。テスト設定でファイルDBを指定すると起動前に拒否します。
- 通常DBのパス取得やDiscordへの実接続は禁止し、通信はモックに置き換えます。

### Macのウィンドウ操作

GUIを利用できるMacで次を実行すると、画面を閉じた後のサーバー継続、Dockからの再表示、最小化からの復元、完全終了も確認します。
通常の記録DBにはアクセスしません。

```sh
CHRONOLOFT_TEST_NATIVE=1 npm test
```

画面の見た目、本物のDiscord上での表示、DBマイグレーションは、このテストの対象外です。
更新・再起動を行うテストは[リリースガイド](releasing.md#実際の更新と再起動のテスト)にまとめています。

## リポジトリ構成

| 場所 | 内容 |
|---|---|
| `frontend/` | Vite・Reactによる画面 |
| `backend/` | PythonによるAPI・記録管理 |
| `main.py` | デスクトップアプリの起動処理 |
| `scripts/` | ビルド・リリース・更新テストの補助処理 |
| `docs/` | 使い方・開発・リリースの詳細 |
| `dist/`・`build/` | ビルド生成物 |
