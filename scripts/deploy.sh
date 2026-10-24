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
git pull --ff-only
git log --oneline -1

echo "== Reconstruir y levantar"
docker compose up -d --build
# Caddy toma los cambios de su configuración (Caddyfile) sin cortar el servicio
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile || echo "Aviso: no se pudo recargar Caddy"

echo "== Limpieza de Docker"
docker image prune -f
docker builder prune -f --max-used-space 1gb

docker compose ps
df -h / | tail -1
