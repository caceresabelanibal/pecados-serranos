# 🔥 Pecados Serranos - Tienda Online & Gestión de Stock

Proyecto completo e independiente de **Pecados Serranos**, con catálogo público para clientes, carrito con pedidos automáticos por WhatsApp, panel de administración comercial (stock, precios con fórmulas VShop, importación de compras Excel, historial, revendedores y ventas) y persistencia 100% en base de datos **PostgreSQL**.

---

## 🚀 Arquitectura y Tecnologías

- **Frontend & Backend**: Next.js 16 (App Router + Turbopack) & React 19
- **Estilos**: Tailwind CSS 4 & Framer Motion
- **ORM & Base de Datos**: Prisma ORM & PostgreSQL 16
- **Contenedores**: Docker & Docker Compose
- **Almacenamiento**: Persistencia 100% en PostgreSQL (sin dependencia de `localStorage`)

---

## 📁 Estructura del Repositorio

```text
pecados-serranos/
├── app/
│   ├── layout.tsx              # Metadatos, fuentes y layout general
│   ├── page.tsx                # Tienda pública y Panel de Control Admin completo
│   ├── products.ts             # Tipos, catálogo oficial (30 productos) y fórmulas
│   └── api/
│       ├── productos/          # Sincronización completa con PostgreSQL
│       └── imagen/[sku]/       # Servidor de imágenes de productos por SKU
├── prisma/
│   └── schema.prisma           # Modelos de PostgreSQL (Productos, Ventas, Compras, etc.)
├── scripts/
│   ├── entrypoint.sh           # Script de arranque en Docker (sincroniza DB y levanta la app)
│   └── seed.js                 # Verificación y carga inicial de datos
├── public/                     # Logos, favicons y fotografías oficiales de productos
├── Dockerfile                  # Imagen optimizada de producción
├── docker-compose.yml          # Despliegue con 1 solo comando (App + PostgreSQL)
├── .env.example                # Plantilla de variables de entorno
└── package.json                # Dependencias y scripts
```

---

## 🛠️ Paso 1: Subir este proyecto a tu nuevo repositorio de GitHub

Desde tu computadora (en la carpeta donde quedó aislado el proyecto):

```bash
cd C:\Users\Santi\pecados-serranos

# 1. Iniciar el repositorio git local
git init

# 2. Agregar todos los archivos (node_modules y .next se ignoran automáticamente por .gitignore)
git add .

# 3. Crear el primer commit
git commit -m "feat: initial commit Pecados Serranos independiente con Docker y PostgreSQL"

# 4. Cambiar a rama main
git branch -M main

# 5. Vincular a tu nuevo repositorio en GitHub
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git

# 6. Subir el código
git push -u origin main
```

> **Nota:** El archivo `.gitignore` ya está preconfigurado para omitir `node_modules`, `.next`, y archivos temporales, por lo que el repositorio subirá limpio y liviano.

---

## 🐳 Paso 2: Despliegue en tu Servidor Productivo con Docker

En tu servidor Linux (Ubuntu/Debian) con Docker y Docker Compose instalados:

```bash
# 1. Clonar el repositorio
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git
cd TU_REPOSITORIO

# 2. (Opcional) Ajustar variables de entorno si deseás cambiar contraseñas o puertos
cp .env.example .env

# 3. Construir e iniciar la aplicación y la base de datos
docker compose up -d --build
```

### ¿Qué hace automáticamente `docker compose`?
1. Inicia el contenedor de base de datos **PostgreSQL 16** con un volumen persistente (`postgres_data`).
2. Espera a que la base de datos esté lista mediante un *healthcheck*.
3. Construye el contenedor de Next.js, ejecuta automáticamente `npx prisma db push` para crear las tablas y modelos en PostgreSQL.
4. Si la base está recién creada, siembra automáticamente los 30 productos oficiales, la compra inicial oficial y la configuración de WhatsApp.
5. Inicia el servidor de producción en el puerto `3000`.

### Ver la aplicación funcionando:
Abrí tu navegador en:
```text
http://TU_IP_O_DOMINIO:3000
```

---

## 📋 Comandos Útiles en el Servidor

- **Ver estado de los contenedores:**
  ```bash
  docker compose ps
  ```

- **Ver logs en tiempo real:**
  ```bash
  docker compose logs -f app
  ```

- **Reiniciar contenedores:**
  ```bash
  docker compose restart
  ```

- **Actualizar a la última versión tras hacer git pull:**
  ```bash
  git pull
  docker compose up -d --build
  ```

- **Detener la aplicación (sin borrar datos):**
  ```bash
  docker compose down
  ```
