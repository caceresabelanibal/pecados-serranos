#!/bin/sh
set -e

echo "=========================================================="
echo "  Pecados Serranos - Iniciando contenedor de produccion"
echo "=========================================================="

if [ -n "$DATABASE_URL" ]; then
  echo "[Pecados Serranos] Conexion a PostgreSQL configurada."
  echo "[Pecados Serranos] Sincronizando tablas y esquema con Prisma..."
  npx prisma db push --skip-generate --accept-data-loss || true
  
  echo "[Pecados Serranos] Ejecutando verificacion de seed..."
  node scripts/seed.js || true
fi

echo "[Pecados Serranos] Iniciando servidor Next.js..."
exec "$@"
