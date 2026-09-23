#!/bin/bash
# PostgreSQL database restore script
# Usage: ./scripts/restore.sh backups/premiumshare_20240101_120000.sql.gz

set -e

BACKUP_FILE="$1"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh backups/*.sql.gz 2>/dev/null || echo "  No backups found"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found"
  exit 1
fi

echo "[restore] WARNING: This will overwrite the database. Press Ctrl+C to cancel."
echo "[restore] Restoring from: ${BACKUP_FILE}"
sleep 3

# Drop and recreate
docker compose exec -T db psql -U psuser -d postgres -c "DROP DATABASE IF EXISTS premiumshare;"
docker compose exec -T db psql -U psuser -d postgres -c "CREATE DATABASE premiumshare OWNER psuser;"

# Restore
gunzip -c "${BACKUP_FILE}" | docker compose exec -T db psql -U psuser -d premiumshare

echo "[restore] Database restored successfully from ${BACKUP_FILE}"
