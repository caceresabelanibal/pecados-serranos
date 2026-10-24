# -------------------------------------------------------------
# Dockerfile para Pecados Serranos (Next.js 16 + Prisma + PostgreSQL)
# Build en etapas: la imagen final lleva sólo lo necesario para correr
# (sin herramientas de desarrollo, código fuente ni caché de compilación).
# -------------------------------------------------------------
FROM node:20-alpine AS base
# Utilitarios necesarios para Prisma en Alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1) Compilación (dependencias completas)
FROM base AS build
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --include=dev
COPY . .
RUN npx prisma generate && npm run build && rm -rf .next/cache

# 2) Dependencias de producción (incluye el cliente de Prisma generado)
FROM base AS prod-deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npm cache clean --force

# 3) Imagen final
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Cliente de PostgreSQL 16 (pg_dump / pg_restore) para el backup completo desde el panel
RUN apk add --no-cache postgresql16-client

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
RUN chmod +x ./scripts/entrypoint.sh ./scripts/deploy.sh

# Ejecutar como usuario sin privilegios (no root)
USER node

EXPOSE 3000

# Script de arranque (aplica esquema a PostgreSQL y levanta Next.js)
ENTRYPOINT ["./scripts/entrypoint.sh"]
CMD ["npm", "run", "start"]
