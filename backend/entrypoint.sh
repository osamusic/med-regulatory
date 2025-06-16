#!/bin/bash
set -e

# Create storage directories if they don't exist
mkdir -p /app/storage/documents /app/storage/cls_index /app/storage/index /app/storage/proc_index /app/data

# Ensure correct ownership for the app directory
# This will run as root initially, then switch to appuser
if [ "$(id -u)" = "0" ]; then
    # Running as root, fix permissions
    chown -R appuser:appuser /app/storage /app/data
    
    # Switch to appuser
    exec su-exec appuser "$@"
else
    # Already running as non-root user
    exec "$@"
fi