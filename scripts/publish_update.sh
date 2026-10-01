#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <version> <release-notes> <private-key-file> [--run-migrations]" >&2
  exit 2
fi

VERSION="$1"
RELEASE_NOTES="$2"
PRIVATE_KEY_FILE="$3"
RUN_MIGRATIONS="${4:-}"
BASE_URL="${UPDATE_SERVER_BASE_URL:-https://updates.kriskata.com}"
SSH_TARGET="${UPDATE_SSH_TARGET:-kriskata-hosting}"
REMOTE_ROOT="${UPDATE_REMOTE_ROOT:-updates.kriskata.com}"
KEY_ID="${UPDATE_SIGNING_KEY_ID:-release-2026-v2}"
COMPATIBLE_FROM="${UPDATE_COMPATIBLE_FROM:->=0.1.0 <1.0.0}"
ARTIFACT="/var/www/html/releases/${VERSION}/flex-cms-${VERSION}.zip"
LOCAL_ARTIFACT="/tmp/flex-cms-${VERSION}.zip"
LOCAL_ENTRY="/tmp/flex-release-${VERSION}.json"
LOCAL_SIGNED="/tmp/flex-release-${VERSION}-signed.json"
LOCAL_CATALOG="/tmp/flex-platform-manifest-${VERSION}.json"

[[ -f "$PRIVATE_KEY_FILE" ]] || { echo "Signing key not found: $PRIVATE_KEY_FILE" >&2; exit 1; }

CID="$(docker compose ps -q app)"
[[ -n "$CID" ]] || { echo "The app container is not running." >&2; exit 1; }
docker cp "$PRIVATE_KEY_FILE" "$CID:/tmp/flex-update-private.key"
trap 'docker exec "$CID" rm -f /tmp/flex-update-private.key /tmp/flex-release-entry.json /tmp/flex-release-entry-signed.json' EXIT

docker compose exec -T frontend npm run build
docker compose exec -T app php bin/flex platform:build \
  --target-version="$VERSION" --private-key-file=/tmp/flex-update-private.key \
  --key-id="$KEY_ID" ${RUN_MIGRATIONS:+--run-migrations} --output="$ARTIFACT"

docker cp "$CID:$ARTIFACT" "$LOCAL_ARTIFACT"
curl --fail --silent --show-error "$BASE_URL/platform/manifest.json" > "$LOCAL_CATALOG"

python3 scripts/release_catalog.py create --type platform --package flex-cms \
  --version "$VERSION" --artifact "$LOCAL_ARTIFACT" --base-url "$BASE_URL" \
  --minimum-php '>=8.3' --compatible-from "$COMPATIBLE_FROM" \
  --published-at "$(date -u +%Y-%m-%dT%H:%M:%S+00:00)" \
  --release-notes "$RELEASE_NOTES" --output "$LOCAL_ENTRY"

cat "$LOCAL_ENTRY" | docker compose exec -T app sh -c 'cat > /tmp/flex-release-entry.json'
docker compose exec -T app php bin/flex updates:sign-manifest \
  /tmp/flex-release-entry.json /tmp/flex-release-entry-signed.json \
  --private-key-file=/tmp/flex-update-private.key --key-id="$KEY_ID"
docker cp "$CID:/tmp/flex-release-entry-signed.json" "$LOCAL_SIGNED"
python3 scripts/release_catalog.py merge --catalog "$LOCAL_CATALOG" --release "$LOCAL_SIGNED"

REMOTE_DIR="$REMOTE_ROOT/platform/releases/$VERSION"
ssh "$SSH_TARGET" "mkdir -p '$REMOTE_DIR' && chmod 755 '$REMOTE_DIR'"
scp "$LOCAL_ARTIFACT" "$SSH_TARGET:$REMOTE_DIR/flex-cms-$VERSION.zip"
sha256sum "$LOCAL_ARTIFACT" | awk '{print $1}' | ssh "$SSH_TARGET" "cat > '$REMOTE_DIR/flex-cms-$VERSION.zip.sha256'"
scp "$LOCAL_CATALOG" "$SSH_TARGET:$REMOTE_ROOT/platform/manifest.json"

echo "Published platform $VERSION to $BASE_URL"
