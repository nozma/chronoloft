# Activity Tracker

Discordへのステータス表示機能を備えたアクティビティ記録ツール。

## 開発環境セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/nozma/activity-tracker.git
cd activity-tracker
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

`/backend/.env`にDB保管場所へのパスを記載（オプション）。

```bash
APP_DB_PATH=instance/app.db
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

## 使用方法

### 1. 記録の開始

アクティビティを選択し、STARTボタンで記録を開始する。アクティビティの記録単位が分であればストップウォッチが、回であれば記録用ダイアログが開く。ストップウォッチ動作中は、Discord連携設定をしていればDiscordのステータスにアクティビティの内容が表示される。

### 2. グループの設定とDiscord連携設定（オプション）

アクティビティの大きなグループで、Discordのアプリと関連付けられる。

Discord連携機能を使う場合、あらかじめ[Discord Developer Portall](https://discordapp.com/developers)からアプリケーションを作成しておき、APPLICATION IDを入手し、グループの管理からDiscord Client IDにセットしておく。

Discord連携時の「◯◯をプレイ中」の表示はアプリ名となるため、グループごとに表示を変える場合はアクティビティごとにアプリケーションを作成しておく。

### 3. アクティビティの設定

アクティビティの管理ボタンで開くテーブルから登録されているアクティビティの確認、追加、編集、削除ができる。

Asset KeyにDiscord Developer Portal > Rich Presence > Rich Presence Assetsから登録したアセット画像のキーを設定しておくと、Discord連携時に画像が表示される。