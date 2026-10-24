#!/bin/sh
# -------------------------------------------------------------
# Deploy en el servidor: backup de la base, actualizar código desde GitHub,
# reconstruir y limpiar lo que deja Docker (imágenes viejas y caché de compilación).
# Uso (en el servidor):  sh /opt/pecados-serranos/scripts/deploy.sh
# -------------------------------------------------------------
set -e
cd /opt/pecados-serranos

BACKUP_DIR=/root/backups
KEEP_BACKUPS=3
mkdir -p "$BACKUP_DIR"

echo "== Backup de la base"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$BACKUP_DIR/pecados_$(date +%Y%m%d_%H%M%S).sql.gz"
chmod 600 "$BACKUP_DIR"/*.sql.gz
# Se conservan sólo los últimos $KEEP_BACKUPS backups
ls -1t "$BACKUP_DIR"/*.sql.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f

echo "== Actualizar código"
PREV=$(git rev-parse HEAD)
git pull --ff-only
git log --oneline -1

echo "== Reconstruir y levantar"
docker compose up -d --build
# Si cambió el Caddyfile, Caddy se reinicia para tomarlo (el archivo montado se reemplaza con git pull;
# un simple reload seguiría leyendo la versión anterior). Los certificados quedan en su volumen.
if ! git diff --quiet "$PREV" HEAD -- Caddyfile; then
  echo "== Caddyfile cambió: reiniciando Caddy"
  docker compose restart caddy
fi

echo "== Limpieza de Docker"
docker image prune -f
docker builder prune -f --max-used-space 1gb

docker compose ps
df -h / | tail -1
