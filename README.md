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

Activityを選択すると記録を開始する。Activityの記録単位が分であればストップウォッチが、回であれば記録用ダイアログが開く。ストップウォッチ動作中は、Discord連携設定をしていればDiscordのステータスにActivityの内容が表示される。

### 2. Groupの設定とDiscord連携設定（オプション）

各ActivityはGroupに所属し、GroupはDiscordと連携単位として機能する。

Discord連携機能を使う場合、あらかじめ[Discord Developer Portall](https://discordapp.com/developers)からアプリケーションを作成しておき、APPLICATION IDを入手し、グループの管理からDiscord Client IDにセットしておく。

Discord Client IDがセットされたGroupに所属するActivityのストップウォッチが動作中、起動しているDiscordクライアントがあれば、DiscordのアクティビティとしてActivityが表示される。

Discord連携時の「◯◯をプレイ中」の表示はアプリ名となるため、グループごとに表示を変える場合はアクティビティごとにアプリケーションを作成し、グループごとに対応するDiscord Client IDをセットする。

Groupにはその他に色、アイコンを設定可能で、設定はGroup末尾にホバーすると表示される設定アイコンから行う。

### 3. Activityの設定

Activity末尾にホバーすると表示される設定アイコンから開くダイアログからアクティビティの管理が行える。

Asset KeyにDiscord Developer Portal > Rich Presence > Rich Presence Assetsから登録したアセット画像のキーを設定しておくと、Discord連携時に画像が表示される。

### 4. Tagの設定

Activityには任意の数のTagを設定できる。Tagはグループをまたいだ集計などに利用できる。

TagはあらかじめTagの一覧の末尾にマウスホバーすると表示される歯車アイコンから表示される設定ダイアログより設定しておく。

### 5. History

アクティビティの履歴がさまざまな形式で集計、表示される。

#### ヒートマップ

ヒートマップの表示対象レコードは、Group、Tagの選択状態を反映する。

#### カレンダータイムライン

記録単位が分のActivityのみ表示対象となる。

Month、Agendaの表示では同日の同種Activityは経過時間を合算し、経過時間の降順で表示される。

#### レコードの一覧

個別レコードの確認・編集・削除が行える。