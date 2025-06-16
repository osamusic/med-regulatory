#!/bin/sh
# Fix permissions at runtime
# This runs as the container user (appuser)

# Create directories if they don't exist
mkdir -p /app/storage/documents /app/storage/cls_index /app/storage/index /app/storage/proc_index /app/data 2>/dev/null || true

# Execute the main command
exec "$@"