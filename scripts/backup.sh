#!/bin/bash
# PostgreSQL database backup script
# Usage: ./scripts/backup.sh

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/premiumshare_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Starting backup at ${TIMESTAMP}..."

docker compose exec -T db pg_dump \
  -U psuser \
  -d premiumshare \
  --no-owner \
  --no-acl \
  | gzip > "${BACKUP_FILE}"

echo "[backup] Backup saved to ${BACKUP_FILE}"
echo "[backup] Size: $(du -sh ${BACKUP_FILE} | cut -f1)"

# Keep only last 30 backups
ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm
echo "[backup] Cleanup done. Keeping last 30 backups."
