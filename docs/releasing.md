# リリースガイド

[README](../README.md) / [開発ガイド](development.md) / [使い方](usage.md)

手元のMacでビルドし、Sparkleの更新ファイルをGitHub Releasesへ公開します。
アプリ側からの更新操作は[使い方](usage.md#アプリを更新する)を参照してください。

## 初回準備

[開発環境の準備](development.md#開発環境の準備)を済ませ、GitHub CLIを導入してから実行します。
以降のコマンドはリポジトリ直下で実行します。

```sh
gh auth login
npm run setup:release:mac
```

公開設定は [release-macos.json](../scripts/release-macos.json) にまとめています。

| 設定 | 内容 |
|---|---|
| 公開先 | `nozma/chronoloft` |
| Bundle ID | `io.github.nozma.chronoloft` |
| CPU形式 | `arm64` |
| 必要OS | 現在はmacOS 26.0以降。同梱ライブラリの条件も公開前に検証 |
| Sparkle | バージョンとSHA-256を固定し、公式配布物を `.cache/sparkle/` に取得 |
| 署名鍵 | キーチェーンのアカウント `chronoloft` |

SparkleのframeworkはPyInstallerの変換を通さずに同梱し、アプリ全体をアドホック署名します。
AppleのDeveloper ID署名・公証はこの構成には含めていません。
Sparkle自体の最低条件であるmacOS 12と、同梱Pythonによる現在の配布対象OSは異なります。

### 署名鍵の保管と移行

更新署名用の秘密鍵はキーチェーンに保管します。設定ファイルには公開鍵だけを保存し、秘密鍵はリポジトリやGitHubにアップロードしません。
設定済みの公開鍵とキーチェーンの鍵が一致しない場合は処理を停止します。
別のMacへ移る際は、新しい鍵で公開鍵を変更するのではなく、元の秘密鍵を移してください。

Sparkle付属の `generate_keys` でバックアップと復元ができます。
保存先はリポジトリ外の安全な場所を指定してください。

```sh
.cache/sparkle/2.10.0/bin/generate_keys --account chronoloft -x /安全な保存先/chronoloft-update-key
.cache/sparkle/2.10.0/bin/generate_keys --account chronoloft -f /安全な保存先/chronoloft-update-key
```

## 公開せずに確認する

```sh
npm run release:mac -- --dry-run
```

テスト、ビルド、ZIP作成、署名、更新情報の生成・検証まで行います。
GitHubへの認証・アクセス・変更は行わず、未コミットの作業差分も許容します。
生成物と公開時の処理は、次の節に記載しています。

## ビルドから公開する

まず[バージョン更新のルール](../AGENTS.md#バージョン管理)に従い、ルートの `package.json` と `package-lock.json` の番号を揃えます。
変更をコミット・プッシュしてから実行してください。

```sh
npm run release:mac
```

このコマンドは実際にGitHub Releasesへ公開します。バージョン更新、ソースのコミット、ブランチのプッシュは自動では行いません。

1. 依存関係・公開先・作業差分・バージョン・対象コミットを確認する。
2. テストとビルドを実行し、ZIP・署名・更新情報を生成して検証する。
3. 対象コミットに `vバージョン番号` のタグを作り、リリースを下書きで作成する。
4. ZIPと `appcast.xml` を添付し、再ダウンロードした内容を照合する。
5. 検証に成功したら正式公開し、Latestに設定する。

リリース本文には、GitHubが前回のリリース以降にマージされたPRから生成する変更一覧と比較リンクを含めます。
公開担当者は機能追加・修正内容を日本語で確認し、利用者向けの説明や注意点が必要な場合は本文に追記してください。
配布ファイルの案内や対象コミットだけを記載した状態では公開しないでください。

通信失敗をリリース未作成と取り違えて続行することはありません。
ソース・配布物とタグが異なるコミットを指す場合や、同じバージョンが公開済みの場合は停止します。
ビルド開始時のコミットを生成物に記録し、生成後と添付ファイルの照合後にもコミットを確認します。
途中でコミットや作業差分が変わった場合は、公開せずに停止します。

### 生成物と配信先

生成物は `dist/releases/バージョン番号/` に保存します。

| ファイル | 用途 |
|---|---|
| `Chronoloft-バージョン番号-macos-arm64.zip` | 公開するアプリ全体 |
| `appcast.xml` | 公開する更新情報 |
| `manifest.json` | ローカルでコミットと配布物のチェックサムを保持し、再開時に照合 |

公開するのはZIPとXMLの2ファイルです。差分更新や、別管理の変更履歴ファイルは作りません。
アプリの取得先は常にGitHub Releasesの `releases/latest/download/appcast.xml` です。
XMLの中のZIP取得先は各バージョンのリリースを直接指します。以後の正式リリースにも必ず `appcast.xml` を添付してください。

## 途中で失敗した場合

アップロード失敗後、同じ配布物で下書きの公開を再開する場合は次を使います。

```sh
npm run release:mac -- --resume
```

公開済みリリースの上書きは行いません。生成後にコミット・設定・配布物が変わっている場合も再開を拒否します。
`--resume --dry-run` では、生成済みの配布物を公開せずに再検証できます。

通常実行では配布物を新しく生成します。未コミットの状態でdry-runした後にコミットした場合は、`--resume` ではなく通常実行で再ビルドしてください。

## 実際の更新と再起動のテスト

GUIを使えるMacで実行します。下の2つ目は、1つ目で作成したテスト用.appを使います。

```sh
backend/venv/bin/python scripts/test_update_macos.py
backend/venv/bin/python scripts/test_update_macos.py --no-build --tamper
```

`build/updater-test/` 内の専用.app・DB・ローカルHTTP配信だけで、次を確認します。

- 更新・再起動と、DBの記録保持
- 閉じた画面からの更新と再表示
- 更新後にSparkleが再び初期化されること
- 初回起動・更新後・終了して再起動した後もアプリの署名が保たれること
- 保留処理を経由しない更新再開でも計測中の終了を拒否し、終了を再試行しても確認が続くこと
- 改変ZIPが拒否され、旧版のまま動作すること

通常の.appや記録DBには触れず、GitHubリリースも作成しません。
テスト専用のHTTP許可設定・操作用API・DB保存先は、テスト用エントリポイントのビルドだけに含めます。
結果は同ディレクトリの `result.json` / `tamper-result.json`、詳細は `app.log` に保存します。
更新再開時の終了確認の結果は `termination-guard-result.json` に保存します。
