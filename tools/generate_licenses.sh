#!/usr/bin/env bash
set -e

# Node (production 依存のみ)
npx license-checker --production --json > third_party_licenses_node.json

# Python（バックエンド venv に入っているパッケージ対象）
pip-licenses --format=json > third_party_licenses_python.json

echo "License files generated:"
echo "  third_party_licenses_node.json"
echo "  third_party_licenses_python.json"
