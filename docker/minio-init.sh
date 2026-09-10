#!/usr/bin/env bash
# Run this script once after starting MinIO to create the bucket and set public read.
# Usage: bash docker/minio-init.sh
# Requires: mc (MinIO client) — install with: brew install minio/stable/mc  OR  use the mc Docker image

set -euo pipefail

MINIO_ENDPOINT="${STORAGE_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${STORAGE_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${STORAGE_SECRET_KEY:-minioadmin}"
BUCKET="${STORAGE_BUCKET:-realworld}"

echo "Configuring MinIO alias..."
mc alias set local "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"

echo "Creating bucket '$BUCKET' (if not exists)..."
mc mb --ignore-existing "local/$BUCKET"

echo "Setting public download policy on '$BUCKET/public'..."
# Scoped to the public/ prefix, not the whole bucket: objects will later also
# live under private/ for the not-yet-built private tier, and that prefix
# must never become anonymously readable.
mc anonymous set download "local/$BUCKET/public"

echo "Done. Bucket '$BUCKET' is ready at $MINIO_ENDPOINT/$BUCKET (public/ prefix only)"
