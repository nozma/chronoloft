#!/usr/bin/env bash
set -euo pipefail

# Node (production 依存のみ)。ローカルのパス情報は保存しない。
npx license-checker --production --json | node -e '
const fs = require("node:fs");
const licenses = JSON.parse(fs.readFileSync(0, "utf8"));
for (const entry of Object.values(licenses)) {
    delete entry.path;
    delete entry.licenseFile;
}
process.stdout.write(JSON.stringify(licenses, null, 2) + "\n");
' > third_party_licenses_node.json

# Python（バックエンド venv に入っているパッケージ対象）
pip-licenses --format=json > third_party_licenses_python.json

echo "License files generated:"
echo "  third_party_licenses_node.json"
echo "  third_party_licenses_python.json"
