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
