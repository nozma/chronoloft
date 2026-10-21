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
# 自宅LAN内の別端末から利用する

配布版を起動し、起動元PCの設定画面の「LANアクセス」でパスワード（8〜256文字）を設定し、「同じLAN内からのアクセスを許可」をオンにして「LAN設定を保存」を押してください。この設定は通常の「適用」とは別に保存します。初期状態ではLANアクセスは無効です。

表示されたURLを、同じLANのスマートフォンや別PCのブラウザーで開いてログインします。通常のポート番号は5180です。使用中の場合は別の番号が選ばれるため、設定画面のURLを確認してください。OSのファイアウォールで許可が必要な場合があります。起動元PCでChronoloftが動作している間だけ利用できます。

ログイン状態は端末ごとに保存され、アプリを再起動しても保持されます。画面を開いたときやクリック・キー入力・スクロール時に期限を更新します（更新通信は最大1分に1回）。バックグラウンドの定期通信では延長せず、最後の利用から7日間経過すると再ログインが必要です。パスワード変更やLANアクセスの無効化は全端末のログインを無効にします。起動元PCのlocalhostからはパスワードなしで利用・設定できます。

LAN共有はHTTP接続のため通信は暗号化されません。信頼できる自宅LANで利用し、他サービスのパスワードを使い回さないでください。ルーターのポート開放は不要です。

開発時は `npm run start:no_webview:lan` を使用します。設定は起動元PCの `http://localhost:5173` から変更してください。
