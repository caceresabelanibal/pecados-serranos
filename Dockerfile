# -------------------------------------------------------------
# Dockerfile para Pecados Serranos (Next.js 16 + Prisma + PostgreSQL)
# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar utilitarios necesarios para Prisma y Alpine
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci

# Copiar todo el código fuente del proyecto
COPY . .

# Generar cliente de Prisma
RUN npx prisma generate

# Compilar Next.js para producción
RUN npm run build

# Dar permisos de ejecución al script de arranque
RUN chmod +x ./scripts/entrypoint.sh

# Exponer el puerto de la aplicación
EXPOSE 3000

# Script de arranque (aplica esquema a PostgreSQL y levanta Next.js)
ENTRYPOINT ["./scripts/entrypoint.sh"]
CMD ["npm", "run", "start"]
