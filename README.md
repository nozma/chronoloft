# Chronoloft

Discordへのステータス表示機能を備えたアクティビティ記録ツール。

## 開発環境セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/nozma/chronoloft.git
cd chronoloft
```
### 2. バックエンド

Python仮想環境の作成、アクティベート。

```bash
cd backend
python -m venv venv
source venv/bin/activate
```

Pythonパッケージのインストール。

```bash
pip install -r requirements.txt
```

DB初期化。

```bash
python init_db.py
```

### 3. フロントエンド

```bash
cd ../frontend
npm install
cd ..
npm install
```

### 4. 起動

```bash
npm run start
```

http://localhost:5173/ にアクセス。

### 5. アプリのビルド

```bash
npm run build
```

dist以下にアプリケーションファイルが出力される。現状macOS向けappファイルのみ。

## 使用方法

[Pages · nozma/activity-tracker Wiki](https://github.com/nozma/activity-tracker/wiki)

## ライセンス

本リポジトリのソースコードは **MIT License** の下で公開しています。  
詳細は [LICENSE](./LICENSE) を参照してください。

依存ライブラリのライセンス一覧は、自動生成された  
`third_party_licenses_node.json` と `third_party_licenses_python.json` に同梱しています。


## 自動テスト

リポジトリ直下で全テストを実行できます。

```sh
npm test
```

個別に実行する場合は `npm run test:frontend` または `npm run test:backend` を使用します。
バックエンドは `backend/venv` の依存関係をインストール済みであることが前提です。
WindowsなどPythonの配置が異なる環境では、`backend/` で仮想環境を有効化して
`python -m unittest discover -s tests -v` を実行してください。

- フロントエンド：翻訳、グラフの分類・軸・色、詳細入力の正規化と貼り付けの単体テスト。
- バックエンド：記録APIとDB保存結果の結合テスト、およびDiscord管理処理の単体テストとAPIテスト。
- DBはテストごとにメモリ内SQLiteを新規作成し、終了時に破棄します。テスト設定でファイルDBを指定すると起動前に拒否します。
- 通常DBのパス取得とDiscordの実接続は禁止し、Discordへの通信はモックに置き換えています。

画面操作、本物のDiscord上での表示、DBマイグレーションは、このテストの対象外です。
