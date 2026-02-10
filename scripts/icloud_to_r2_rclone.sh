#!/usr/bin/env bash
set -euo pipefail

# iCloud → R2 Sync (no-upload-button workflow)
#
# This script is meant to run on an always-on machine (Mac mini, VPS).
# It syncs a local folder (that iCloud Drive keeps updated) to Cloudflare R2.
#
# Prereqs:
# - Install rclone: https://rclone.org/install/
# - Configure an "s3" remote pointing at Cloudflare R2:
#   rclone config
#   - New remote → name: r2
#   - Storage: S3
#   - Provider: Cloudflare
#   - Access Key ID / Secret Access Key: from Cloudflare R2
#   - Endpoint: https://<account-id>.r2.cloudflarestorage.com
#
# Usage:
#   ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/FinalArchive" \
#   R2_BUCKET="final-archive" \
#   R2_PREFIX="media" \
#   ./scripts/icloud_to_r2_rclone.sh
#
# Recommended scheduling:
# - macOS launchd or cron every 1-5 minutes.

ICLOUD_DIR="${ICLOUD_DIR:?Set ICLOUD_DIR to your iCloud-synced folder}"
R2_BUCKET="${R2_BUCKET:?Set R2_BUCKET}"
R2_PREFIX="${R2_PREFIX:-}"

DEST="r2:${R2_BUCKET}"
if [[ -n "${R2_PREFIX}" ]]; then
  DEST="${DEST}/${R2_PREFIX}"
fi

echo "Syncing iCloud folder → R2"
echo "  From: ${ICLOUD_DIR}"
echo "  To:   ${DEST}"

rclone sync "${ICLOUD_DIR}" "${DEST}" \
  --include "*.jpg" --include "*.jpeg" --include "*.png" --include "*.webp" --include "*.gif" --include "*.avif" \
  --include "*.mp4" --include "*.webm" --include "*.mov" \
  --exclude "*" \
  --progress

echo "Done."

