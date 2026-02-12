#!/usr/bin/env bash
# iCloud → R2 Automatic Sync Script
# This script syncs your iCloud folder to Cloudflare R2 bucket

set -euo pipefail

# ============================================
# CONFIGURATION - Update these values
# ============================================

# iCloud folder path (where you drop images)
ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/FinalArchive"

# R2 bucket name (from Cloudflare)
R2_BUCKET="final-archive"

# R2 remote name (from rclone config, usually "r2")
R2_REMOTE="r2"

# Optional: subfolder in R2 bucket (leave empty for root)
R2_PREFIX=""

# ============================================
# SCRIPT (Don't modify below)
# ============================================

echo "🔄 Starting iCloud → R2 Sync..."
echo "   From: $ICLOUD_DIR"
echo "   To:   $R2_REMOTE:$R2_BUCKET${R2_PREFIX:+/$R2_PREFIX}"
echo ""

# Check if iCloud folder exists
if [ ! -d "$ICLOUD_DIR" ]; then
    echo "❌ Error: iCloud folder not found: $ICLOUD_DIR"
    echo ""
    echo "📝 Create the folder first:"
    echo "   1. Open Finder"
    echo "   2. Go to iCloud Drive"
    echo "   3. Create folder: FinalArchive"
    echo "   4. Run this script again"
    exit 1
fi

# Build destination path
DEST="$R2_REMOTE:$R2_BUCKET"
if [[ -n "$R2_PREFIX" ]]; then
    DEST="$DEST/$R2_PREFIX"
fi

# Sync images and videos only
rclone sync "$ICLOUD_DIR" "$DEST" \
    --include "*.jpg" \
    --include "*.jpeg" \
    --include "*.png" \
    --include "*.webp" \
    --include "*.gif" \
    --include "*.avif" \
    --include "*.mp4" \
    --include "*.webm" \
    --include "*.mov" \
    --exclude "*" \
    --progress \
    --stats-one-line

echo ""
echo "✅ Sync complete!"
echo ""
echo "📝 Next steps:"
echo "   - Images will appear in R2 bucket within 60 seconds"
echo "   - Check: https://final-archive-production.up.railway.app/api/images"
echo "   - Or trigger manual sync via admin panel"
